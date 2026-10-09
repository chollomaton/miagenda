import {ProductionOwnerPairing} from './productionPairing';
import {getApp,initializeApp} from 'firebase/app';
import {browserLocalPersistence,getAuth,GoogleAuthProvider,onAuthStateChanged,setPersistence,signInWithPopup} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore/lite';
import type {FirebaseApp} from 'firebase/app';
import {firestoreMirrorTransport} from './firestoreTransport';
import type {FirebaseConfig} from '../cloud/FirebaseConfig';
import {MemoryMirrorCache} from './cache';
import {MirrorReader} from './reader';
import {MemoryMirrorTransport} from './transport';
import {LocalMirrorSession} from './localSession';
export class MirrorRuntime {
 state:'checking'|'signedOut'|'signedIn'|'unavailable'='checking';
 source=new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'unconnected');
 message='';revision=0;
 pairing:ProductionOwnerPairing|null=null;
 private listeners=new Set<()=>void>();private stop:(()=>void)|null=null;private epoch=0;
 private local:LocalMirrorSession|null=null;private online:(()=>void)|null=null;private timer:number|null=null;private auth:ReturnType<typeof getAuth>|null=null;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};
 private emit(){this.revision++;this.listeners.forEach(fn=>fn());}
 constructor(private config:FirebaseConfig|null,private connection?:{appName:string;setup:(app:FirebaseApp)=>Promise<void>},private pairingEnabled=false){}
 async start(){
  if(!this.config){this.state='unavailable';this.message='La conexión con tu copia de iCloud aún no está disponible.';this.emit();return;}
  const startup=++this.epoch;
  try{
   const appName=this.connection?.appName??'miagenda-firebase';
   let app;try{app=getApp(appName);}catch{app=initializeApp(this.config,appName);}
   await this.connection?.setup(app);
   const auth=getAuth(app),db=getFirestore(app);this.auth=auth;this.pairing=new ProductionOwnerPairing(db,auth,this.pairingEnabled);
   await setPersistence(auth,browserLocalPersistence);if(startup!==this.epoch)return;
   this.stop=onAuthStateChanged(auth,user=>{
    const epoch=++this.epoch;this.source.detach();this.local?.dispose();this.local=null;if(this.online)window.removeEventListener('online',this.online);this.online=null;if(this.timer!==null)window.clearInterval(this.timer);this.timer=null;
    this.source=new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'unconnected');
    this.state=user?'signedIn':'signedOut';this.message='';this.emit();if(!user)return;
    const valid=()=>epoch===this.epoch&&auth.currentUser?.uid===user.uid;
    const transport=firestoreMirrorTransport(db,user.uid,valid,()=>{++this.epoch;this.source.detach();this.local?.dispose();if(this.timer!==null)window.clearInterval(this.timer);if(this.online)window.removeEventListener('online',this.online);this.state='signedOut';this.message='Vuelve a conectar Mi Agenda para actualizar tu copia.';this.emit();});
    const local=new LocalMirrorSession(`${this.config!.projectId}:${user.uid}`,transport,valid,reader=>{if(valid()){this.source=reader;this.emit();}});this.local=local;
    this.source.refresh=async()=>await local.refresh()??{valid:false,issues:['MIRROR_NOT_PUBLISHED']};
    const refresh=async()=>{try{const result=await local.refresh();if(valid()){this.message=result&&!result.valid?'No se pudo validar la copia. Se conserva la última sincronización disponible.':'';this.emit();}}catch{if(valid()){this.message='La copia remota no está disponible. Se conserva la última copia validada.';this.emit();}}};
    void local.boot().catch(()=>{}).then(()=>{if(!valid())return;this.online=()=>{void refresh();};window.addEventListener('online',this.online);this.timer=window.setInterval(()=>{if(navigator.onLine)void refresh();},60000);return refresh();});
   },()=>{++this.epoch;this.source.detach();this.state='unavailable';this.message='No se pudo restaurar la conexión.';this.emit();});
  }catch{if(startup===this.epoch){this.state='unavailable';this.message='No se pudo restaurar la conexión.';this.emit();}}
 }
 async login(){if(!this.auth)return;try{await signInWithPopup(this.auth,new GoogleAuthProvider());if(this.state==='signedOut'&&this.auth.currentUser){this.stop?.();this.stop=null;await this.start();}}catch{this.message='No se completó la conexión. Puedes volver a intentarlo.';this.emit();}}
 dispose(){if(this.timer!==null)window.clearInterval(this.timer);++this.epoch;this.stop?.();this.stop=null;this.source.detach();this.local?.dispose();if(this.online)window.removeEventListener('online',this.online);}
}
