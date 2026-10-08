import {getApp,initializeApp} from 'firebase/app';
import {browserLocalPersistence,getAuth,GoogleAuthProvider,onAuthStateChanged,setPersistence,signInWithPopup} from 'firebase/auth';
import {doc,getDoc,getFirestore} from 'firebase/firestore';
import type {FirebaseConfig} from '../cloud/FirebaseConfig';
import {IndexedDBMirrorCache,MemoryMirrorCache} from './cache';
import {MirrorReader} from './reader';
import {MemoryMirrorTransport} from './transport';
import type {MirrorReadTransport} from './transport';
import {validateState} from './validation';
export class MirrorRuntime {
 state:'checking'|'signedOut'|'signedIn'|'unavailable'='checking';
 source=new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'unconnected');
 message='';revision=0;
 private listeners=new Set<()=>void>();private stop:(()=>void)|null=null;private epoch=0;
 private cache:IndexedDBMirrorCache|null=null;private auth:ReturnType<typeof getAuth>|null=null;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};
 private emit(){this.revision++;this.listeners.forEach(fn=>fn());}
 constructor(private config:FirebaseConfig|null){}
 async start(){
  if(!this.config){this.state='unavailable';this.message='La conexión con tu copia de iCloud aún no está disponible.';this.emit();return;}
  const startup=++this.epoch;
  try{
   let app;try{app=getApp('miagenda-firebase');}catch{app=initializeApp(this.config,'miagenda-firebase');}
   const auth=getAuth(app),db=getFirestore(app);this.auth=auth;
   await setPersistence(auth,browserLocalPersistence);if(startup!==this.epoch)return;
   this.stop=onAuthStateChanged(auth,user=>{
    const epoch=++this.epoch;this.source.detach();void this.cache?.close();this.cache=null;
    this.source=new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'unconnected');
    this.state=user?'signedIn':'signedOut';this.message='';this.emit();if(!user)return;
    const valid=()=>epoch===this.epoch&&auth.currentUser?.uid===user.uid;
    const read=async(...segments:string[])=>{if(!valid())throw Error('STALE_SESSION');const snapshot=await getDoc(doc(db,'users',user.uid,'icloudMirror','state',...segments));if(!valid())throw Error('STALE_SESSION');return snapshot.exists()?snapshot.data():null;};
    const transport:MirrorReadTransport={readState:()=>read(),readGeneration:id=>read('generations',id),readBucket:hash=>read('buckets',hash),readObject:hash=>read('objects',hash)};
    void (async()=>{
     const state=await transport.readState();if(!valid())return;if(state===null)return;validateState(state);
     const cache=new IndexedDBMirrorCache(`${this.config!.projectId}:${user.uid}`,state.publisherID);this.cache=cache;
     const reader=new MirrorReader(transport,cache,state.publisherID,valid);this.source=reader;this.emit();await reader.boot();const result=await reader.refresh();
     if(valid()&&!result.valid){this.message='No se pudo validar la copia. Se conserva la última sincronización disponible.';this.emit();}
    })().catch(()=>{if(valid()){this.message='La copia de iCloud aún no está disponible. Vuelve a actualizar más tarde.';this.emit();}});
   },()=>{++this.epoch;this.source.detach();this.state='unavailable';this.message='No se pudo restaurar la conexión.';this.emit();});
  }catch{if(startup===this.epoch){this.state='unavailable';this.message='No se pudo restaurar la conexión.';this.emit();}}
 }
 async login(){if(!this.auth)return;try{await signInWithPopup(this.auth,new GoogleAuthProvider());}catch{this.message='No se completó la conexión. Puedes volver a intentarlo.';this.emit();}}
 dispose(){++this.epoch;this.stop?.();this.stop=null;this.source.detach();void this.cache?.close();}
}
