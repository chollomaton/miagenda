import 'fake-indexeddb/auto';
import {expect,it,vi} from 'vitest';
import {IndexedDBPersistence} from '../src/offline/Persistence';
import {AgendaStore} from '../src/stores/AgendaStore';
for(const deleted of [false,true])it('NO_OP_SAVE preserves data clocks outbox and lifecycle deleted='+deleted,async()=>{
 const p=new IndexedDBPersistence(crypto.randomUUID()),s=new AgendaStore(p);await s.boot();const e=await s.create('Task',{title:'unchanged'});
 if(deleted)await s.service.delete(e.id);
 const before=s.snapshot(),save=vi.spyOn(p,'save');await s.patch(e.id,{...s.entities[0].fields});
 expect(save).not.toHaveBeenCalled();expect(s.snapshot()).toEqual(before);expect(await p.load()).toEqual(before);
 await s.patch(e.id,{title:'changed'});expect(save).toHaveBeenCalledTimes(1);expect(s.entities[0].fields.title).toBe('changed');expect(s.entities[0].lifecycle).toBe(deleted?'deleted':'active');
});

it('historical scheduling missing versus semantic null preserves disk clocks updatedAt and outbox',async()=>{
 const p=new IndexedDBPersistence(crypto.randomUUID()),s=new AgendaStore(p);await s.boot();const e=await s.create('Task');
 const before=s.snapshot(),save=vi.spyOn(p,'save');
 const fields={...e.fields,scheduledStartAt:null,scheduledDurationMinutes:null,scheduledTimezone:null};
 await s.patch(e.id,fields);expect(save).not.toHaveBeenCalled();expect(s.snapshot()).toEqual(before);expect(await p.load()).toEqual(before);
});
