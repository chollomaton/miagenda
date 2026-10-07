import type {AgendaSession} from '../auth/AgendaSession';
import type {Persistence} from '../offline/Persistence';
import {IndexedDBPersistence} from '../offline/Persistence';
import {backupEntities,exportBackup} from '../backup/backup';
import type {Backup} from '../backup/backup';
import {downloadBackupZIP} from '../backup/backupFiles';
import {merge} from '../models/entities';
import type {Entity} from '../models/entities';

export interface MigrationMarker {
 version:1;status:'pending'|'completed'|'dismissed';sourceChecksum:string;
 createdAt:string;updatedAt:string;entityIDs:string[];
}
export interface MigrationMetadata {
 readMetadata<T>(key:string):Promise<T|undefined>;
 writeMetadata<T>(key:string,value:T,valid:()=>boolean):Promise<void>;
}
export const migrationKey=(projectId:string,uid:string)=>`migration:local-workspace->firebase:${projectId}:${uid}`;
export const significantCount=(entities:Entity[])=>entities.filter(e=>e.kind!=='Preferences').length;

/** Copies only validated user entities; source persistence is never written. */
export class LocalFirebaseMigration {
 copied=false;count=0;marker:MigrationMarker|undefined;busy=false;later=false;error='';revision=0;
 phase:'read'|'backup'|'download'|'import'|'marker'|'sync'='read';
 private listeners=new Set<()=>void>();private readonly generation:number;private readonly identity:string;
 private readonly store;private readonly sync;readonly key:string;
 private stopStore:(()=>void)|undefined;private settling=false;private initialization=0;
 constructor(private session:AgendaSession,projectId:string,
  private source:Persistence=new IndexedDBPersistence('local-workspace'),
  private metadata:MigrationMetadata=new IndexedDBPersistence('local-workspace'),
  private download:(backup:Backup,valid:()=>boolean)=>Promise<void>=downloadBackupZIP){
  if(!projectId||!session.auth.identity||!session.store||!session.sync)throw Error('SIGNED_OUT');
  this.generation=session.auth.generation;this.identity=session.auth.identity;
  this.store=session.store;this.sync=session.sync;this.key=migrationKey(projectId,this.identity);
 }
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn)}};
 private emit(){++this.revision;this.listeners.forEach(fn=>fn())}
 private valid=()=>this.session.auth.valid(this.generation)&&this.session.auth.identity===this.identity&&this.session.store===this.store&&this.session.sync===this.sync;
 private guard(){if(!this.valid())throw Error('STALE_SESSION')}
 private get completed(){return this.marker?.status==='completed'}
 get offer(){return this.valid()&&this.count>0&&!this.marker&&!this.later}
 async initialize(){
  const initialization=++this.initialization;
  try{this.guard();const marker=await this.metadata.readMetadata<MigrationMarker>(this.key);this.guard();if(initialization!==this.initialization)return;this.marker=marker;
  const snapshot=await this.source.load();this.guard();if(initialization!==this.initialization)return;this.count=significantCount(snapshot.entities);this.emit();
  this.stopStore?.();this.stopStore=this.store.subscribe(()=>{
   if(!this.busy&&this.marker?.status==='pending')void this.finishPending().catch(()=>{if(this.valid()){this.error='STORAGE_WRITE_FAILED';this.emit()}});
  });
  if(marker?.status==='pending'){await this.sync.sync();this.guard();await this.finishPending()}
  }catch(error){if(this.valid()&&initialization===this.initialization){this.error='MIGRATION_READ_FAILED';this.emit()}throw error}
 }
 dispose(){++this.initialization;this.stopStore?.();this.stopStore=undefined}
 nowNot(){this.guard();this.later=true;this.error='';this.copied=false;this.emit()}
 async dismiss(){
  this.guard();if(this.busy||this.marker?.status==='pending')throw Error('MIGRATION_BUSY');
  this.busy=true;this.error='';this.emit();
  try{this.phase='read';const snapshot=await this.source.load();this.guard();this.phase='backup';const backup=await exportBackup(snapshot.entities);this.guard();this.phase='marker';
   await this.saveMarker({version:1,status:'dismissed',sourceChecksum:backup.checksum,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),entityIDs:[]});
  }catch(error){if(this.valid()){this.error='STORAGE_WRITE_FAILED';this.emit()}throw error}
  finally{if(this.valid()){this.busy=false;this.emit()}}
 }
 private async saveMarker(marker:MigrationMarker){this.guard();await this.metadata.writeMetadata(this.key,marker,this.valid);this.guard();this.marker=marker;this.emit()}
 private async finishPending(){
  if(this.settling||!this.valid()||this.marker?.status!=='pending'||!this.store.lastSync||this.store.error||!['ready','pending'].includes(this.store.status))return;
  if(this.store.outbox.some(o=>this.marker!.entityIDs.includes(o.entityID)))return;
  this.settling=true;
  try{await this.saveMarker({...this.marker,status:'completed',updatedAt:new Date().toISOString()})}finally{this.settling=false}
 }
 async copy():Promise<'pending'|'completed'>{
  this.guard();if(this.busy)throw Error('MIGRATION_BUSY');this.busy=true;this.error='';this.emit();
  try{
   // A persisted pending copy is resumed, never imported again.
   this.phase='read';this.marker=await this.metadata.readMetadata<MigrationMarker>(this.key);this.guard();
   this.phase='sync';
   await this.sync.sync();this.guard();
   if(this.marker?.status==='pending'){await this.finishPending();return this.completed?'completed':'pending'}
   if(this.store.status==='offline'||this.store.error)throw Error('INITIAL_SYNC_FAILED');
   this.phase='read';const snapshot=await this.source.load();this.guard();
   this.phase='backup';
   const backup=await exportBackup(snapshot.entities);this.guard();
   this.count=significantCount(backupEntities(backup));if(!this.count)throw Error('NO_LOCAL_DATA');
   this.phase='download';await this.download(backup,this.valid);this.guard();
   // Construct only after the validated ZIP download has started.
   const incoming=backupEntities(backup);let entityIDs:string[]=[];
   this.phase='import';await this.store.commit(()=>{
    this.guard();const hasPreferences=this.store.entities.some(e=>e.kind==='Preferences');
    const changes=incoming.filter(e=>e.kind!=='Preferences'||!hasPreferences).map(e=>{
     const old=this.store.entities.find(v=>v.id===e.id);return old?merge(old,e):e;
    });entityIDs=changes.map(e=>e.id);return changes;
   },false);this.guard();
   const now=new Date().toISOString();
   this.phase='marker';await this.saveMarker({version:1,status:'pending',sourceChecksum:backup.checksum,createdAt:now,updatedAt:now,entityIDs});
   this.phase='sync';
   await this.sync.sync();this.guard();await this.finishPending();
   this.copied=true;return this.completed?'completed':'pending';
  }catch(error){if(this.valid()){this.error=error instanceof Error?error.message:'MIGRATION_FAILED';this.emit()}throw error}
  finally{if(this.valid()){this.busy=false;this.emit()}}
 }
}
