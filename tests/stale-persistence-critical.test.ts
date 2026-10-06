import 'fake-indexeddb/auto';
import {expect,it,vi} from 'vitest';
import {IndexedDBPersistence} from '../src/offline/Persistence';
import {AgendaStore} from '../src/stores/AgendaStore';
async function raw(scope:string){const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('miagenda',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{return await new Promise<unknown[]>((resolve,reject)=>{const names=['entities','outbox','syncMetadata','preferences','quarantine'];const tx=db.transaction(names,'readonly');const requests=names.map(name=>tx.objectStore(name).get(scope));tx.oncomplete=()=>resolve(requests.map(r=>r.result));tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
for(const boundary of ['metadata','write'] as const)for(const phase of ['entity','remote','operation'] as const)it('STALE_SESSION during IDB metadata read rolls back '+phase+' at '+boundary,async()=>{
 const scope=crypto.randomUUID(),p=new IndexedDBPersistence(scope),s=new AgendaStore(p);await s.boot();
 const e=await s.create('Task',{title:'before'});await s.remote([],'before-token');const before=s.snapshot(),diskBefore=await raw(scope);
 const get=IDBObjectStore.prototype.get,put=IDBObjectStore.prototype.put;let invalidated=false;
 const spy=vi.spyOn(IDBObjectStore.prototype,'get').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['get']>){
  const request=get.apply(this,args);
  if(boundary==='metadata'&&this.name==='syncMetadata'&&this.transaction.mode==='readwrite')request.addEventListener('success',()=>{invalidated=true;s.detach()},{once:true});
  return request;
 });
 const putSpy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){const request=put.apply(this,args);if(boundary==='write'&&this.name==='preferences')request.addEventListener('success',()=>{invalidated=true;s.detach()},{once:true});return request});
 try{await (phase==='entity'?s.patch(e.id,{title:'late'}):phase==='remote'?s.remote([],'late-token',undefined,[{late:true}]):s.markOperation(s.outbox[0].operationID,{status:'sending'})).catch(()=>{})}finally{spy.mockRestore();putSpy.mockRestore()}
 expect(invalidated).toBe(true);expect(s.status).toBe('signedOut');expect(s.entities).toEqual([]);
 expect(await new IndexedDBPersistence(scope).load()).toEqual(before);expect(await raw(scope)).toEqual(diskBefore);
});

it('STALE_SESSION during conflict recovery cannot retry a write',async()=>{
 const scope=crypto.randomUUID(),p=new IndexedDBPersistence(scope),s=new AgendaStore(p);await s.boot();const e=await s.create('Task',{title:'before'});const before=await raw(scope);
 const save=vi.spyOn(p,'save').mockRejectedValueOnce(Error('STORAGE_WRITE_ABORTED_OR_ANOTHER_TAB'));const load=p.load.bind(p);
 vi.spyOn(p,'load').mockImplementationOnce(async()=>{const disk=await load();s.detach();return disk});
 await expect(s.patch(e.id,{title:'late'})).rejects.toThrow();expect(save).toHaveBeenCalledTimes(1);expect(await raw(scope)).toEqual(before);expect(s.entities).toEqual([]);
});
it('STALE_SESSION before database open cannot write a snapshot',async()=>{
 const scope=crypto.randomUUID(),p=new IndexedDBPersistence(scope);let valid=true;
 const pending=p.save({entities:[],outbox:[],quarantine:[],cursor:'late'},()=>valid);valid=false;
 await expect(pending).rejects.toThrow('STALE_SESSION');expect(await raw(scope)).toEqual([undefined,undefined,undefined,undefined,undefined]);
});

for(const reopen of [false,true])it('STALE_SESSION delayed boot failure cannot overwrite '+(reopen?'a reopened store':'logout'),async()=>{
 const p=new IndexedDBPersistence(crypto.randomUUID()),s=new AgendaStore(p);
 let reject!:(error:Error)=>void;
 vi.spyOn(p,'load').mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail}));
 const pending=s.boot();s.detach();
 if(reopen)await s.boot();
 const before={status:s.status,error:s.error,revision:s.revision,snapshot:s.snapshot()};
 reject(Error('late open failure'));await pending;
 expect({status:s.status,error:s.error,revision:s.revision,snapshot:s.snapshot()}).toEqual(before);
});
