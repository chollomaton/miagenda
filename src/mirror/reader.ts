import {canonicalJSON,sha256} from './canonical';
import type {MirrorEntity,MirrorFreshness,MirrorSnapshot,MirrorValidationResult} from './contract';
import type {MirrorCache} from './cache';
import {MirrorOfflineError} from './transport';
import type {MirrorReadTransport} from './transport';
import {validateEntity,validateManifest,validateSnapshot,validateState} from './validation';
export interface AgendaDataSource {
 readonly mode:'mirror-readonly';
 readonly capabilities:Readonly<{read:true;create:false;update:false;delete:false;push:false}>;
 readonly entities:readonly MirrorEntity[];
 readonly freshness:MirrorFreshness;
 subscribe(listener:()=>void):()=>void;
 getSnapshot():number;
 refresh():Promise<MirrorValidationResult>;
}
export class MirrorReader implements AgendaDataSource {
 readonly mode='mirror-readonly' as const;
 readonly capabilities=Object.freeze({read:true,create:false,update:false,delete:false,push:false} as const);
 private current:MirrorSnapshot|null=null;private offline=false;private detached=false;private epoch=0;private revision=0;
 private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
 issues:string[]=[];
 constructor(private transport:MirrorReadTransport,private cache:MirrorCache,private publisherID:string,private sessionValid=()=>true,private now=()=>Date.now()){}
 get entities(){return structuredClone(this.current?.entities??[]);}
 get manifest(){return structuredClone(this.current?.manifest??null);}
 get freshness():MirrorFreshness {const publishedAt=this.current?.manifest.publishedAt??null;const ageMilliseconds=publishedAt?Math.max(0,this.now()-Date.parse(publishedAt)):null;return {status:!publishedAt?'empty':this.offline?'offline':ageMilliseconds!>15*60*1000?'stale':'fresh',publishedAt,ageMilliseconds};}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.revision;
 private emit(){this.revision++;this.listeners.forEach(fn=>fn());}
 private queue<T>(fn:()=>Promise<T>):Promise<T>{const next=this.tail.then(fn);this.tail=next.catch(()=>{});return next;}
 detach(){this.detached=true;this.epoch++;this.current=null;this.issues=[];this.emit();}
 async boot(){const epoch=this.epoch;return this.queue(async()=>{
  const record=await this.cache.load();if(this.detached||epoch!==this.epoch||!this.sessionValid())return;
  for(const snapshot of [record.current,record.previous])if(snapshot&&snapshot.manifest.source.publisherID===this.publisherID){
   const result=await validateSnapshot(snapshot);if(this.detached||epoch!==this.epoch||!this.sessionValid())return;
   if(result.valid){this.current=structuredClone(snapshot);this.offline=true;this.emit();return;}
   this.issues=result.issues;
  }
  this.emit();
 });}
 refresh():Promise<MirrorValidationResult>{const epoch=this.epoch;const valid=()=>!this.detached&&epoch===this.epoch&&this.sessionValid();return this.queue(async()=>{
  try{
   if(!valid())throw Error('STALE_SESSION');
   const cached=await this.cache.load();const state=await this.transport.readState();validateState(state);
   if(state.publisherID!==this.publisherID)throw Error('PUBLISHER_REVOKED');
   const manifest=await this.transport.readGeneration(state.currentGeneration);validateManifest(manifest);
   if(manifest.generationID!==state.currentGeneration||manifest.rootHash!==state.rootHash||manifest.publishedAt!==state.publishedAt||manifest.source.publisherID!==this.publisherID)throw Error('STATE_MANIFEST_MISMATCH');
   const entities:MirrorEntity[]=[];
   for(const reference of manifest.buckets){
    if(!valid())throw Error('STALE_SESSION');const value=await this.transport.readBucket(reference.hash);
    if(await sha256(value)!==reference.hash)throw Error('BUCKET_HASH_MISMATCH');
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_BUCKET');
    const bucket=value as {mirrorSchemaVersion:number;entities:unknown[]};
    if(Object.keys(bucket).sort().join(',')!=='entities,mirrorSchemaVersion'||bucket.mirrorSchemaVersion!==1||!Array.isArray(bucket.entities)||bucket.entities.length!==reference.entityCount)throw Error('INVALID_BUCKET');
    for(const raw of bucket.entities){
     if(!raw||typeof raw!=='object')throw Error('INVALID_REFERENCE');const r=raw as {hash:string;id:string;kind:string};
     if(Object.keys(r).sort().join(',')!=='hash,id,kind'||typeof r.hash!=='string'||!/^[0-9a-f]{64}$/.test(r.hash))throw Error('INVALID_REFERENCE');
     if(!valid())throw Error('STALE_SESSION');const entity=await this.transport.readObject(r.hash);validateEntity(entity);
     if(entity.id!==r.id||entity.kind!==r.kind||await sha256(entity)!==r.hash)throw Error('OBJECT_HASH_MISMATCH');entities.push(entity);
    }
   }
   const snapshot={manifest,entities};const result=await validateSnapshot(snapshot);if(!result.valid)throw Error(result.issues.join(','));
   const latest=await this.transport.readState();validateState(latest);if(canonicalJSON(latest)!==canonicalJSON(state))throw Error('GENERATION_CHANGED');
   if(!valid())throw Error('STALE_SESSION');
   if(cached.current?.manifest.generationID===manifest.generationID&&canonicalJSON(cached.current)!==canonicalJSON(snapshot))throw Error('GENERATION_NOT_IMMUTABLE');
   if(cached.current?.manifest.generationID!==manifest.generationID)await this.cache.activate(snapshot,cached.revision,valid);
   if(!valid())throw Error('STALE_SESSION');this.current=structuredClone(snapshot);this.offline=false;this.issues=[];this.emit();return {valid:true,issues:[]};
  }catch(error){const issue=error instanceof Error?error.message:'INVALID_GENERATION';if(valid()){this.offline=error instanceof MirrorOfflineError;this.issues=[issue];this.emit();}return {valid:false,issues:[issue]};}
 });}
}
export function freshnessLabel(freshness:MirrorFreshness):string {
 if(!freshness.publishedAt)return 'Aún sin copia de iCloud';
 const stamp=new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(freshness.publishedAt));
 if(freshness.status==='offline')return 'Sin conexión · copia de '+stamp;
 if(freshness.status==='stale')return 'Última actualización '+stamp;
 const minutes=Math.floor((freshness.ageMilliseconds??0)/60000);
 return minutes<1?'Actualizada ahora':'Actualizada hace '+minutes+' min';
}
