import type {MirrorSnapshot} from './contract';
export interface MirrorCacheRecord {revision:number; current:MirrorSnapshot|null; previous:MirrorSnapshot|null}
export interface MirrorCache {
 load():Promise<MirrorCacheRecord>;
 activate(snapshot:MirrorSnapshot,expectedRevision:number,valid:()=>boolean):Promise<MirrorCacheRecord>;
}
const empty=():MirrorCacheRecord=>({revision:0,current:null,previous:null});
function next(record:MirrorCacheRecord,snapshot:MirrorSnapshot):MirrorCacheRecord {
 return {revision:record.revision+1,current:structuredClone(snapshot),previous:record.current?.manifest.generationID===snapshot.manifest.generationID?record.previous:record.current};
}
export class MemoryMirrorCache implements MirrorCache {
 private record=empty();
 async load(){return structuredClone(this.record);}
 async activate(snapshot:MirrorSnapshot,expectedRevision:number,valid:()=>boolean){
  if(!valid())throw Error('STALE_SESSION');if(this.record.revision!==expectedRevision)throw Error('MIRROR_CACHE_CHANGED');
  this.record=next(this.record,snapshot);return this.load();
 }
}
/** A separate database, no entities/outbox stores from 1.1. Scope is fixed per session. */
export class IndexedDBMirrorCache implements MirrorCache {
 private db:Promise<IDBDatabase>;
 constructor(ownerID:string,publisherID:string){
  if(!ownerID||!publisherID)throw Error('MIRROR_SCOPE_REQUIRED');
  const scope=JSON.stringify([ownerID,publisherID]);
  this.db=new Promise((resolve,reject)=>{const request=indexedDB.open('miagenda-icloud-mirror-v1:'+scope,1);
   request.onupgradeneeded=()=>request.result.createObjectStore('generations');
   request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
   request.onerror=()=>reject(Error('MIRROR_CACHE_OPEN_FAILED'));
   request.onblocked=()=>reject(Error('MIRROR_CACHE_BLOCKED'));
  });
 }
 async load():Promise<MirrorCacheRecord>{const db=await this.db;return new Promise((resolve,reject)=>{
  const tx=db.transaction('generations','readonly'),request=tx.objectStore('generations').get('active');
  tx.oncomplete=()=>resolve(request.result??empty());tx.onerror=()=>reject(Error('MIRROR_CACHE_READ_FAILED'));
 });}
 async activate(snapshot:MirrorSnapshot,expectedRevision:number,valid:()=>boolean):Promise<MirrorCacheRecord>{
  const db=await this.db;if(!valid())throw Error('STALE_SESSION');
  return new Promise((resolve,reject)=>{const tx=db.transaction('generations','readwrite'),store=tx.objectStore('generations');let result:MirrorCacheRecord;let reason='MIRROR_CACHE_WRITE_FAILED';
   const abort=(message:string)=>{reason=message;tx.abort();};
   const read=store.get('active');read.onsuccess=()=>{if(!valid()){abort('STALE_SESSION');return;}
    const record:MirrorCacheRecord=read.result??empty();if(record.revision!==expectedRevision){abort('MIRROR_CACHE_CHANGED');return;}
    result=next(record,snapshot);const write=store.put(result,'active');write.onsuccess=()=>{if(!valid())abort('STALE_SESSION');};
   };
   tx.oncomplete=()=>resolve(structuredClone(result));tx.onerror=()=>reject(Error(reason));tx.onabort=()=>reject(Error(reason));
  });
 }
 async close(){(await this.db).close();}
}
