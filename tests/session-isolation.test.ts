import {expect,it,vi} from 'vitest';
import {AuthManager} from '../src/auth/AuthManager';
import {MemoryPersistence} from '../src/offline/Persistence';
import {MemoryRepository} from '../src/repositories/AgendaRepository';
import {AgendaStore} from '../src/stores/AgendaStore';
import {SyncEngine} from '../src/sync/SyncEngine';

it('an old sync engine cannot send one user data after another user signs in',async()=>{
 let identity='A';
 const auth=new AuthManager({signIn:async()=>identity,signOut:async()=>{}});
 await auth.signIn();
 const store=new AgendaStore(new MemoryPersistence());await store.boot();
 await store.create('Task',{title:'Private A'});
 const remote=new MemoryRepository();const fetch=vi.spyOn(remote,'fetchChanges');const save=vi.spyOn(remote,'save');
 const old=new SyncEngine(store,remote,auth);
 await auth.signOut();identity='B';await auth.signIn();
 await old.sync();
 expect(fetch).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
 expect(store.outbox).toHaveLength(1);
 const currentStore=new AgendaStore(new MemoryPersistence());await currentStore.boot();
 await currentStore.create('Task',{title:'Private B'});
 await new SyncEngine(currentStore,remote,auth).sync();
 expect(save).toHaveBeenCalledTimes(1);
 expect((await remote.fetchChanges()).entities.map(e=>e.fields.title)).toEqual(['Private B']);
});
