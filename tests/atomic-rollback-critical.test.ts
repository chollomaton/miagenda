import 'fake-indexeddb/auto';
import {it,expect,vi} from 'vitest';
import {IndexedDBPersistence} from '../src/offline/Persistence';
import {AgendaStore} from '../src/stores/AgendaStore';
it('ATOMIC_ENTITY_OUTBOX',async()=>{
 const scope=crypto.randomUUID(),p=new IndexedDBPersistence(scope),s=new AgendaStore(p);
 await s.boot();const task=await s.create('Task',{title:'OLD'});
 const before=await p.load();const next=structuredClone(before);
 next.entities[0].fields.title='NEW';next.outbox.push({...structuredClone(before.outbox[0]),operationID:crypto.randomUUID(),payload:structuredClone(next.entities[0])});
 const original=IDBObjectStore.prototype.put;let injected=false;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){
  const result=original.apply(this,args);
  if(this.name==='outbox'){injected=true;this.transaction.abort()}
  return result;
 });
 try{await expect(p.save(next)).rejects.toThrow('STORAGE_WRITE_FAILED')}finally{spy.mockRestore()}
 expect(injected).toBe(true);
 const reopened=await new IndexedDBPersistence(scope).load();
 expect(reopened.entities).toEqual(before.entities);expect(reopened.outbox).toEqual(before.outbox);
 expect(reopened.entities.find(e=>e.id===task.id)?.fields.title).toBe('OLD');
});
