import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {AuthManager} from '../src/auth/AuthManager';
import {AgendaSession} from '../src/auth/AgendaSession';
import {IndexedDBPersistence,MemoryPersistence} from '../src/offline/Persistence';
import {MemoryRepository,RepositoryError} from '../src/repositories/AgendaRepository';
import {createEntity,merge,updateEntity} from '../src/models/entities';
import type {Entity} from '../src/models/entities';
import {parseBackup,backupEntities} from '../src/backup/backup';
import type {Backup} from '../src/backup/backup';
import {downloadBackupZIP,parseBackupFile} from '../src/backup/backupFiles';
import {LocalFirebaseMigration,migrationKey} from '../src/migration/LocalFirebaseMigration';
import type {MigrationMarker,MigrationMetadata} from '../src/migration/LocalFirebaseMigration';

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals()});
class Metadata implements MigrationMetadata {
 data=new Map<string,unknown>();
 async readMetadata<T>(key:string){return structuredClone(this.data.get(key)) as T|undefined}
 async writeMetadata<T>(key:string,value:T,valid:()=>boolean){if(!valid())throw Error('STALE_SESSION');this.data.set(key,structuredClone(value))}
}
async function fixture(entities:Entity[]=[createEntity('Task',{title:'Local'})],metadata=new Metadata()){
 const source=new MemoryPersistence();await source.save({entities,outbox:[],quarantine:[],cursor:'source-cursor'});
 const auth=new AuthManager({signIn:async()=> 'A',signOut:async()=>{}});await auth.signIn();
 const destination=new MemoryPersistence(),remote=new MemoryRepository(),session=new AgendaSession(auth,()=>destination);await session.attach(remote);
 const download=vi.fn<(backup:Backup,valid:()=>boolean)=>Promise<void>>(async()=>{}),migration=new LocalFirebaseMigration(session,'project',source,metadata,download);
 await migration.initialize();return {source,destination,remote,session,auth,migration,metadata,download,store:session.store!};
}
it.each(['empty','preferences','task','label','template'] as const)('eligibility: %s',async sample=>{
 const entities=sample==='empty'?[]:sample==='preferences'?[createEntity('Preferences')]:sample==='template'?[createEntity('Template',{name:'Routine',definition:{targetKind:'Task',values:{title:'Routine'}}})]:[createEntity(sample==='task'?'Task':'Label')];
 const {migration}=await fixture(entities);expect(migration.offer).toBe(!['empty','preferences'].includes(sample));expect(migration.count).toBe(migration.offer?1:0);
});
it.each([false,true])('Preferences: Firebase already has them=%s',async exists=>{
 const local=createEntity('Preferences',{theme:'dark'}),f=await fixture([createEntity('Task'),local]);
 const cloud=createEntity('Preferences',{theme:'light'});if(exists)await f.remote.save(cloud,'cloud');
 await f.migration.copy();expect(f.store.entities.filter(e=>e.kind==='Preferences')).toEqual([exists?cloud:local]);
});
it('same ID merges existing clocks; distinct IDs with same title both survive',async()=>{
 const local=createEntity('Task',{title:'Same'}),newer=updateEntity(local,{priority:3},'remote'),other=createEntity('Task',{title:'Same'});
 const f=await fixture([local,other]);await f.remote.save(newer,'cloud');await f.migration.copy();
 expect(f.store.entities).toHaveLength(2);expect(f.store.entities.find(e=>e.id===local.id)).toEqual(merge(newer,local));expect(await f.remote.fetch(other.id)).toEqual(other);
});
it('rereads source after initial pull, validates real V2 checksum, downloads before any import',async()=>{
 const f=await fixture(),latest=createEntity('Task',{title:'Latest'}),order:string[]=[];
 vi.spyOn(f.remote,'fetchChanges').mockImplementationOnce(async()=>{order.push('initial-sync');await f.source.save({entities:[latest],outbox:[],quarantine:[]});return {entities:[],cursor:'0',moreComing:false}});
 f.download.mockImplementationOnce(async backup=>{order.push('backup-download');expect(await parseBackup(JSON.stringify(backup))).toEqual(backup);expect(backup.formatVersion).toBe(2);expect(backupEntities(backup)).toEqual([latest]);expect(f.store.entities).toEqual([])});
 const commit=vi.spyOn(f.store,'commit');commit.mockImplementationOnce(async(...args)=>{order.push('import');return Object.getPrototypeOf(f.store).commit.apply(f.store,args)});
 expect(await f.migration.copy()).toBe('completed');expect(order).toEqual(['initial-sync','backup-download','import']);expect(f.store.entities).toEqual([latest]);
});
it('source remains byte-identical; backup and marker omit all transport/session data',async()=>{
 const f=await fixture(),entity=(await f.source.load()).entities[0];
 await f.source.save({entities:[entity],outbox:[{operationID:'source-operation',entityID:entity.id,entityKind:entity.kind,operationKind:'save',createdAt:entity.createdAt,writerID:'source',baseVersion:null,payload:entity,attempts:7,nextAttemptAt:999,status:'retry'}],cursor:'private-cursor',quarantine:[{code:'auth',entity:{tokens:'private-token'}}]});
 const before=JSON.stringify(await f.source.load()),save=vi.spyOn(f.source,'save');await f.migration.copy();expect(JSON.stringify(await f.source.load())).toBe(before);expect(save).not.toHaveBeenCalled();
 const text=JSON.stringify([f.download.mock.calls[0][0],f.metadata.data.get(f.migration.key)]);
 for(const secret of ['outbox','cursor','quarantine','tokens','auth','source-operation','private-token','private-cursor'])expect(text).not.toContain(secret);
 expect(f.store.outbox).toEqual([]);expect(f.store.cursor).not.toBe('private-cursor');
});
it.each(['network','permission','invalidRecord'] as const)('pending for relevant %s; resumes without reimport',async code=>{
 const f=await fixture();vi.spyOn(f.remote,'save').mockRejectedValueOnce(new RepositoryError(code));
 expect(await f.migration.copy()).toBe('pending');expect(f.migration.marker?.status).toBe('pending');
 const commit=vi.spyOn(f.store,'commit');if(code==='network')await f.store.markOperation(f.store.outbox[0].operationID,{nextAttemptAt:0});
 expect(await f.migration.copy()).toBe(code==='network'?'completed':'pending');expect(commit).not.toHaveBeenCalled();expect(f.download).toHaveBeenCalledTimes(1);
});
it('persisted pending completes on startup without download or import',async()=>{
 const f=await fixture();vi.spyOn(f.remote,'save').mockRejectedValueOnce(new RepositoryError('network'));await f.migration.copy();f.migration.dispose();
 await f.store.markOperation(f.store.outbox[0].operationID,{nextAttemptAt:0});const commit=vi.spyOn(f.store,'commit');
 const restarted=new LocalFirebaseMigration(f.session,'project',f.source,f.metadata,f.download);await restarted.initialize();
 expect(restarted.marker?.status).toBe('completed');expect(commit).not.toHaveBeenCalled();expect(f.download).toHaveBeenCalledTimes(1);restarted.dispose();
});
it('background sync completes pending marker, despite unrelated permanentFailure',async()=>{
 const f=await fixture();const unrelated=createEntity('Task',{title:'Unrelated'});await f.store.commit([unrelated]);await f.store.markOperation(f.store.outbox[0].operationID,{status:'permanentFailure'});
 vi.spyOn(f.remote,'save').mockRejectedValueOnce(new RepositoryError('network'));await f.migration.copy();await f.store.markOperation(f.store.outbox.find(o=>o.entityID!==unrelated.id)!.operationID,{nextAttemptAt:0});await f.session.sync!.sync();
 await vi.waitFor(()=>expect(f.migration.marker?.status).toBe('completed'));expect(f.store.outbox).toHaveLength(1);f.migration.dispose();
});
it.each(['logout','account-change','expire'] as const)('identity guard aborts %s during backup and never writes another scope',async action=>{
 const f=await fixture(),other=new MemoryPersistence();f.download.mockImplementationOnce(async()=>{
  if(action==='expire')f.auth.expire();else {await f.session.logout();if(action==='account-change'){await f.auth.signIn();f.auth.identity='B';await f.session.attach(new MemoryRepository());await other.save(f.session.store!.snapshot())}}
 });await expect(f.migration.copy()).rejects.toThrow('STALE_SESSION');expect((await f.destination.load()).entities).toEqual([]);expect((await other.load()).entities).toEqual([]);expect(f.metadata.data.size).toBe(0);
});
it('logout while destination persistence is in flight aborts its guarded write',async()=>{
 const f=await fixture(),save=f.destination.save.bind(f.destination);let imported=false;
 vi.spyOn(f.destination,'save').mockImplementation(async(snapshot,valid)=>{if(snapshot.outbox.length&&!imported){imported=true;await f.auth.signOut()}await save(snapshot,valid)});
 await expect(f.migration.copy()).rejects.toThrow();expect((await f.destination.load()).entities).toEqual([]);expect(f.metadata.data.size).toBe(0);
});
it.each(['completed','dismissed'] as const)('%s suppresses automatic offer but permits explicit manual copy',async status=>{
 const f=await fixture();if(status==='completed')await f.migration.copy();else await f.migration.dismiss();expect(f.migration.offer).toBe(false);await f.migration.initialize();expect(f.migration.offer).toBe(false);expect(await f.migration.copy()).toBe('completed');
});
it('Ahora no does not persist any marker',async()=>{const f=await fixture();f.migration.nowNot();expect(f.migration.offer).toBe(false);expect(f.metadata.data.size).toBe(0);const next=new LocalFirebaseMigration(f.session,'project',f.source,f.metadata,f.download);await next.initialize();expect(next.offer).toBe(true);next.dispose()});
it('marker uses existing IndexedDB metadata, isolated by project+uid, without schema upgrade',async()=>{
 const persistence=new IndexedDBPersistence(crypto.randomUUID()),marker:MigrationMarker={version:1,status:'completed',sourceChecksum:'checksum',createdAt:'now',updatedAt:'now',entityIDs:[]},key=migrationKey('p','A');
 await persistence.writeMetadata(key,marker,()=>true);await persistence.save({entities:[],outbox:[],cursor:'cursor',quarantine:[]});
 expect(await new IndexedDBPersistence('other').readMetadata(key)).toEqual(marker);expect(await persistence.readMetadata(migrationKey('p','B'))).toBeUndefined();expect(await persistence.readMetadata(migrationKey('other','A'))).toBeUndefined();
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('miagenda');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});expect(db.version).toBe(1);expect([...db.objectStoreNames]).toEqual(['entities','outbox','preferences','quarantine','syncMetadata']);db.close();
 await expect(persistence.writeMetadata('stale',marker,()=>false)).rejects.toThrow('STALE_SESSION');expect(await persistence.readMetadata('stale')).toBeUndefined();
});
it.each(['read','backup','download','import','storage','marker','initial-sync'] as const)('%s failure never changes source or marks completed',async phase=>{
 const f=await fixture(),before=await f.source.load();
 if(phase==='backup')await f.source.save({...before,entities:[{...before.entities[0],fields:{}} as Entity]});
 if(phase==='download')f.download.mockRejectedValueOnce(Error('download'));
 if(phase==='import')vi.spyOn(f.store,'commit').mockRejectedValueOnce(Error('import'));
 if(phase==='storage')vi.spyOn(f.destination,'save').mockImplementation(async snapshot=>{if(snapshot.outbox.length)throw Error('storage')});
 if(phase==='marker')vi.spyOn(f.metadata,'writeMetadata').mockRejectedValueOnce(Error('marker'));
 if(phase==='initial-sync')vi.spyOn(f.remote,'fetchChanges').mockRejectedValueOnce(new RepositoryError('network'));
 const exact=await f.source.load();if(phase==='read')vi.spyOn(f.source,'load').mockRejectedValueOnce(Error('read'));
 await expect(f.migration.copy()).rejects.toThrow();expect(await f.source.load()).toEqual(exact);expect(f.migration.marker?.status).not.toBe('completed');
 if(!['marker'].includes(phase))expect(f.store.entities).toEqual([]);
});
it('preserves completed, trash, relationships, Templates and Time Blocking exactly',async()=>{
 const label=createEntity('Label'),task=createEntity('Task',{completed:true,completedAt:'2026-10-05T08:00:00.000Z',labelIDs:[label.id],scheduledStartAt:'2026-10-05T08:00:00.000Z',scheduledDurationMinutes:30,scheduledTimezone:'Europe/Madrid'});
 const entities=[label,task,createEntity('Subtask',{parentTaskId:task.id}),updateEntity(createEntity('QuickNote',{text:'Trash'}),{},'local','deleted'),createEntity('Template',{name:'Routine',definition:{targetKind:'Task',values:{labelIDs:[label.id]}}}),createEntity('Reminder',{due:'2026-10-05T08:00:00.000Z'}),createEntity('Event',{start:'2026-10-05T08:00:00.000Z',end:'2026-10-05T09:00:00.000Z'})];
 const f=await fixture(entities);expect(f.migration.count).toBe(entities.length);await f.migration.copy();expect([...f.store.entities].sort((a,b)=>a.id.localeCompare(b.id))).toEqual([...entities].sort((a,b)=>a.id.localeCompare(b.id)));for(const entity of entities)expect(await f.remote.fetch(entity.id)).toEqual(entity);
});
it('real migration download produces a valid ZIP before import; stale ZIP download is blocked',async()=>{
 const f=await fixture();let blob:Blob|undefined;
 const createURL=vi.fn((value:Blob)=>{blob=value;return 'blob:fixture'}),click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{expect(f.store.entities).toEqual([])});
 vi.stubGlobal('URL',{createObjectURL:createURL,revokeObjectURL:vi.fn()});vi.stubGlobal('CompressionStream',undefined);
 const migration=new LocalFirebaseMigration(f.session,'project',f.source,f.metadata);await migration.initialize();vi.useFakeTimers();await migration.copy();await vi.advanceTimersByTimeAsync(1000);vi.useRealTimers();
 expect(click).toHaveBeenCalledTimes(1);expect(blob?.type).toBe('application/zip');const backup=await parseBackupFile(new File([blob!],'migration.zip'));expect(backupEntities(backup)).toEqual((await f.source.load()).entities);
 await expect(downloadBackupZIP(backup,()=>false)).rejects.toThrow('STALE_SESSION');expect(click).toHaveBeenCalledTimes(1);migration.dispose();
});
it('failed final pull leaves a durable pending marker',async()=>{
 const f=await fixture(),fetch=f.remote.fetchChanges.bind(f.remote);let pulls=0;vi.spyOn(f.remote,'fetchChanges').mockImplementation(async cursor=>{if(++pulls===2)throw new RepositoryError('network');return fetch(cursor)});
 expect(await f.migration.copy()).toBe('pending');expect((f.metadata.data.get(f.migration.key) as MigrationMarker).status).toBe('pending');expect(f.store.outbox).toHaveLength(1);
});
it('cannot overlap two explicit copies',async()=>{
 const f=await fixture();let release!:()=>void;f.download.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve}));const copy=f.migration.copy();await vi.waitFor(()=>expect(f.download).toHaveBeenCalled());await expect(f.migration.copy()).rejects.toThrow('MIGRATION_BUSY');await expect(f.migration.dismiss()).rejects.toThrow('MIGRATION_BUSY');release();await copy;expect(f.download).toHaveBeenCalledTimes(1);
});
