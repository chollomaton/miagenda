import 'fake-indexeddb/auto';
import {expect,it,vi} from 'vitest';
import {IndexedDBPersistence} from '../src/offline/Persistence';
import {AgendaStore} from '../src/stores/AgendaStore';
import {createEntity,merge,updateEntity} from '../src/models/entities';
import type {Entity} from '../src/models/entities';
import {AuthManager} from '../src/auth/AuthManager';
import {AgendaSession} from '../src/auth/AgendaSession';
import {MemoryRepository} from '../src/repositories/AgendaRepository';
import {exportBackup,importBackup} from '../src/backup/backup';
import {occurrences} from '../src/utils/calendar';
import {generateWorker} from '../scripts/service-worker';
async function open(scope=crypto.randomUUID()){const s=new AgendaStore(new IndexedDBPersistence(scope));await s.boot();return s}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}}
it('SAME_FIELD deterministic merge ignores updatedAt in both directions',()=>{
 const base=createEntity('Task'),a=updateEntity(base,{title:'A'},'a'),b=updateEntity(base,{title:'B'},'b');
 a.fieldClocks.title={physicalMilliseconds:100,logical:2,writerID:'a'};
 b.fieldClocks.title={physicalMilliseconds:100,logical:2,writerID:'b'};
 a.updatedAt='2099-01-01T00:00:00.000Z';b.updatedAt='2020-01-01T00:00:00.000Z';
 expect(merge(a,b)).toEqual(merge(b,a));expect(merge(a,b).fields.title).toBe('B');
});
it('DELETE_VS_OFFLINE_EDIT and EXPLICIT_RESTORE preserve latest content after reopen',async()=>{
 const scope=crypto.randomUUID(),s=await open(scope),e=await s.create('Task',{title:'original'});
 const offline=updateEntity(e,{notes:'latest offline content'},'offline');
 await s.service.delete(e.id);await s.remote([offline]);await s.patch(e.id,{title:'normal Save'});
 expect(s.entities[0].lifecycle).toBe('deleted');
 await s.service.restore(e.id);const reopened=await open(scope);
 expect(reopened.entities[0]).toMatchObject({id:e.id,lifecycle:'active',fields:{title:'normal Save',notes:'latest offline content'}});
});
for(const phase of ['pull','push'] as const)it('STALE_SESSION_RESPONSE '+phase+' cannot change new scope Store IDB cursor or quarantine',async()=>{
 let identity=crypto.randomUUID();const auth=new AuthManager({signIn:async()=>identity,signOut:async()=>{}});
 await auth.signIn();const session=new AgendaSession(auth);const remote=new MemoryRepository();
 await session.attach(remote);const old=session.store!;old.repository.connectSync(null);await old.create('Task',{title:'A'});
 const arrived=deferred<void>(),response=deferred<{entities:Entity[];cursor:string;moreComing:boolean;quarantine:unknown[]}>(),saved=deferred<Entity>();
 if(phase==='pull')vi.spyOn(remote,'fetchChanges').mockImplementation(()=>{arrived.resolve();return response.promise});
 else vi.spyOn(remote,'save').mockImplementation(()=>{arrived.resolve();return saved.promise});
 const pending=session.sync!.sync();await arrived.promise;await session.logout();identity=crypto.randomUUID();await auth.signIn();await session.attach(new MemoryRepository());
 const current=session.store!;current.repository.connectSync(null);await current.create('Task',{title:'B'});await current.remote([],'B-token',undefined,[{scope:'B'}]);
 const before=current.snapshot(),generation=auth.generation;
 if(phase==='pull')response.resolve({entities:[createEntity('Task',{title:'late A'})],cursor:'A-token',moreComing:false,quarantine:[{scope:'A'}]});
 else saved.resolve(createEntity('Task',{title:'late A'}));
 await pending;expect(current.snapshot()).toEqual(before);expect(await current.persistence.load()).toEqual(before);
 expect(old.entities).toEqual([]);expect(old.cursor).toBeUndefined();expect(auth.identity).toBe(identity);expect(auth.generation).toBe(generation);expect(auth.state).toBe('signedIn');
});
it('OFFLINE_COLD_RELOAD recovers sending with identical operation ID and latest content',async()=>{
 const scope=crypto.randomUUID(),s=await open(scope),e=await s.create('QuickNote',{text:'first'});await s.patch(e.id,{text:'last'});
 await s.markOperation(s.outbox[0].operationID,{status:'sending'});const before=s.snapshot();const reopened=await open(scope);
 expect(reopened.entities).toEqual(before.entities);expect(reopened.outbox.map(o=>o.operationID)).toEqual(before.outbox.map(o=>o.operationID));expect(reopened.outbox[0].status).toBe('retry');
});
it('CORRUPT_BACKUP_ZERO_MUTATION validates all records before changing IDB',async()=>{
 const s=await open();await s.create('Task',{title:'keep'});const before=s.snapshot(),backup=await exportBackup([createEntity('Task')]);backup.tasks[0].fields.title='tampered';
 const save=vi.spyOn(s.persistence,'save');await expect(importBackup(s,backup,'replace','REEMPLAZAR')).rejects.toThrow('CHECKSUM_FAILED');
 expect(save).not.toHaveBeenCalled();expect(s.snapshot()).toEqual(before);expect(await s.persistence.load()).toEqual(before);
});
it('REPLACE_ROLLBACK preserves existing entities outbox and metadata on transaction abort',async()=>{
 const s=await open();await s.create('Task',{title:'keep'});await s.remote([],'keep-token',undefined,[{bad:true}]);const before=s.snapshot();const backup=await exportBackup([createEntity('Task',{title:'replacement'})]);
 const original=IDBObjectStore.prototype.put;const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){const result=original.apply(this,args);if(this.name==='preferences')this.transaction.abort();return result});
 try{await expect(importBackup(s,backup,'replace','REEMPLAZAR')).rejects.toThrow('STORAGE_WRITE_FAILED')}finally{spy.mockRestore()}
 expect(s.snapshot()).toEqual(before);expect(await s.persistence.load()).toEqual(before);
 await importBackup(s,backup,'replace','REEMPLAZAR');expect(s.entities.find(e=>e.fields.title==='keep')?.lifecycle).toBe('deleted');
});
it('REMOTE_QUARANTINE and CHANGE_TOKEN_SAFETY roll back together',async()=>{
 const s=await open();await s.create('Task');await s.remote([],'old');const before=s.snapshot();const original=IDBObjectStore.prototype.put;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){const result=original.apply(this,args);if(this.name==='preferences')this.transaction.abort();return result});
 try{await expect(s.remote([],'next',undefined,[{invalid:true}])).rejects.toThrow()}finally{spy.mockRestore()}
 expect(s.snapshot()).toEqual(before);expect(await s.persistence.load()).toEqual(before);
 await s.remote([],'next',undefined,[{invalid:true}]);const disk=await s.persistence.load();expect(disk.cursor).toBe('next');expect(disk.quarantine).toHaveLength(1);
});
it('DST_AUTUMN recurring wall time remains 09:00',()=>{
 const e=createEntity('Event',{start:'2026-10-24T07:00:00.000Z',end:'2026-10-24T08:00:00.000Z',timezone:'Europe/Madrid',recurrence:{frequency:'daily',interval:1,weekdays:[],monthDay:null,count:3,until:null,exceptions:[]}});
 expect(occurrences(e,'2026-10-24','2026-10-27').map(o=>o.start)).toEqual(['2026-10-24T07:00:00.000Z','2026-10-25T08:00:00.000Z','2026-10-26T08:00:00.000Z']);
});
it('FEB_29 yearly recurrence skips non leap years',()=>{
 const e=createEntity('Event',{allDay:true,startDate:'2024-02-29',endDate:'2024-03-01',recurrence:{frequency:'yearly',interval:1,weekdays:[],monthDay:null,count:2,until:null,exceptions:[]}});
 expect(occurrences(e,'2024-01-01','2028-12-31').map(o=>o.date)).toEqual(['2024-02-29','2028-02-29']);
});
it('SW_UPDATE_PRESERVES_DATA activation only removes obsolete shell caches',async()=>{
 const s=await open();await s.create('QuickNote',{text:'private'});const before=s.snapshot();let activate!:(e:{waitUntil:(p:Promise<unknown>)=>void})=>void;
 const remove=vi.fn(async(key:string)=>key.length>0);const cache={keys:async()=>['miagenda-shell-old','miagenda-shell-new','private-data','other-app'],delete:remove};
 new Function('self','caches','indexedDB',generateWorker(['./'],'new'))({addEventListener:(name:string,fn:typeof activate)=>{if(name==='activate')activate=fn}},cache,new Proxy({},{get(){throw Error('SW must not access IDB')}}));
 let pending:Promise<unknown>|undefined;activate({waitUntil:p=>{pending=p}});await pending;
 expect(remove.mock.calls).toEqual([['miagenda-shell-old']]);expect(await s.persistence.load()).toEqual(before);
});
