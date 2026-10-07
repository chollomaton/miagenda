import {initializeApp} from 'firebase/app';
import type {User} from 'firebase/auth';
import {browserLocalPersistence,getAuth,GoogleAuthProvider,onAuthStateChanged,setPersistence,signInWithPopup,signOut} from 'firebase/auth';
import {initializeFirestore,memoryLocalCache} from 'firebase/firestore';
import {AuthManager} from '../auth/AuthManager';
import {AgendaSession} from '../auth/AgendaSession';
import {IndexedDBPersistence} from '../offline/Persistence';
import type {Persistence} from '../offline/Persistence';
import {CloudKitRepository} from './CloudGateway';
import {FirebaseCloudTransport} from './FirebaseCloudTransport';
import type {FirebaseConfig} from './FirebaseConfig';
import {firebaseScope} from './FirebaseConfig';

export class FirebaseRuntime {
 state:'unavailable'|'signedOut'|'connecting'|'signedIn'='unavailable';
 session:AgendaSession|null=null;
 sessionExpired=false;
 private resume:((user:User|null)=>void)|null=null;
 private generation=0;
 revision=0;
 private listeners=new Set<()=>void>();
 private sdkAuth:ReturnType<typeof getAuth>|null=null;
 private stop:(()=>void)|null=null;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn)}};
 private emit(){++this.revision;this.listeners.forEach(fn=>fn())}
 constructor(private config:FirebaseConfig|null,private persistence:(scope:string)=>Persistence=scope=>new IndexedDBPersistence(scope)){}
 async start(target?:Window){
  if(!this.config||this.sdkAuth)return;
  const config=this.config;
  try{
   const app=initializeApp(config,'miagenda-firebase');
   const sdkAuth=getAuth(app);this.sdkAuth=sdkAuth;
   const db=initializeFirestore(app,{localCache:memoryLocalCache()});
   await setPersistence(sdkAuth,browserLocalPersistence);
   const changed=(user:User|null)=>{
    const generation=++this.generation;
    this.session?.auth.expire();this.session=null;
    this.sessionExpired=false;this.state=user?'connecting':'signedOut';this.emit();
    if(!user)return;
    const uid=user.uid;
    const auth=new AuthManager({check:async()=>uid,signIn:async()=>uid,signOut:()=>signOut(sdkAuth)});
    const session=new AgendaSession(auth,id=>this.persistence(firebaseScope(config.projectId,id)));
    this.session=session;
    void (async()=>{
     await auth.check();
     auth.onInvalidate(()=>{if(this.session===session){this.sessionExpired=auth.state==='expired';this.session=null;this.state='signedOut';this.emit()}});
     const authGeneration=auth.generation;
     const valid=()=>generation===this.generation&&sdkAuth.currentUser?.uid===uid&&auth.valid(authGeneration);
     if(!valid())return;
     await session.attach(new CloudKitRepository(new FirebaseCloudTransport(db,uid,valid)),target);
     if(!valid()){auth.expire();return}
     this.state='signedIn';this.emit();
    })().catch(()=>{if(generation===this.generation){auth.expire();this.session=null;this.state='unavailable';this.emit()}});
   };
   this.resume=changed;this.stop=onAuthStateChanged(sdkAuth,changed,()=>{this.invalidate();this.state='unavailable';this.emit()});
  }catch{this.state='unavailable';this.emit()}
 }
 async login(){
  if(!this.sdkAuth)return;
  const generation=this.generation;
  try{await signInWithPopup(this.sdkAuth,new GoogleAuthProvider());if(generation===this.generation&&this.sessionExpired&&this.sdkAuth.currentUser)this.resume?.(this.sdkAuth.currentUser)}catch(error){
   if(generation!==this.generation)return;
   const code=typeof error==='object'&&error!==null&&'code' in error?error.code:null;
   const fatal=['auth/invalid-api-key','auth/app-not-authorized','auth/unauthorized-domain','auth/operation-not-allowed','auth/invalid-auth-event'];
   if(fatal.includes(String(code))){this.invalidate();this.state='unavailable'}
   else if(!this.session)this.state='signedOut';
   this.emit();
  }
 }
 private invalidate(){++this.generation;this.session?.auth.expire();this.session=null}
 async logout(){this.invalidate();this.sessionExpired=false;this.state='signedOut';this.emit();if(this.sdkAuth)await signOut(this.sdkAuth)}
 dispose(){this.resume=null;this.stop?.();this.stop=null;this.invalidate()}
}
