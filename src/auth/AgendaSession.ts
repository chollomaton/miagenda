import type {AuthManager} from './AuthManager';
import type {AgendaRepository} from '../repositories/AgendaRepository';
import type {Persistence} from '../offline/Persistence';
import {IndexedDBPersistence} from '../offline/Persistence';
import {AgendaStore} from '../stores/AgendaStore';
import {SyncEngine} from '../sync/SyncEngine';
/** The caller injects an authenticated, user-scoped remote repository. */
export class AgendaSession {
 store:AgendaStore|null=null;sync:SyncEngine|null=null;
 constructor(public auth:AuthManager,private persistence:(identity:string)=>Persistence=id=>new IndexedDBPersistence(id)){
  auth.onInvalidate(()=>{this.sync?.stop();this.store?.repository.connectSync(null);this.store?.detach();this.store=null;this.sync=null});
 }
 async attach(remote:AgendaRepository,target?:Window){const generation=this.auth.generation,identity=this.auth.identity;if(!identity||!this.auth.valid(generation))throw Error('SIGNED_OUT');const store=new AgendaStore(this.persistence(identity),undefined,'sync-enabled');await store.boot();if(!this.auth.valid(generation)){store.detach();return}this.store=store;this.sync=new SyncEngine(store,remote,this.auth);store.repository.connectSync(this.sync);if(target)this.sync.start(target)}
 async logout(){await this.auth.signOut()}
}
