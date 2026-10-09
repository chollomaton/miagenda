import {productionMirrorEnvironment} from './productionEnvironment';
import {browserLocalPersistence,connectAuthEmulator,getAuth,initializeAuth,signInWithEmailAndPassword,signInWithCredential,GoogleAuthProvider} from 'firebase/auth';
import {connectFirestoreEmulator,getFirestore} from 'firebase/firestore/lite';
import {MirrorRuntime} from './MirrorRuntime';
const connected=new WeakSet<object>();
/** No host, project, credentials or URL can be supplied by a dev environment variable. */
export function emulatorAllowed(dev:boolean,hostname:string,search:string){return dev&&['127.0.0.1','localhost'].includes(hostname)&&new URLSearchParams(search).get('mirrorEmulator')==='1';}
export function createEmulatorRuntime(){
 if(!emulatorAllowed(import.meta.env.DEV,window.location.hostname,window.location.search))throw Error('EMULATOR_DEV_ONLY');
 return new MirrorRuntime({apiKey:'synthetic-emulator-key',authDomain:'demo-miagenda-mirror.firebaseapp.com',projectId:'demo-miagenda-mirror',appId:'synthetic-emulator-app'}, {appName:'miagenda-mirror-emulator',async setup(app){
  let auth;try{auth=initializeAuth(app,{persistence:browserLocalPersistence});}catch{auth=getAuth(app);}if(!connected.has(app)){connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});connectFirestoreEmulator(getFirestore(app),'127.0.0.1',18080);connected.add(app);}
  await auth.authStateReady();if(!auth.currentUser)await signInWithEmailAndPassword(auth,'owner@example.test','synthetic-emulator-only');
 }});
}

export function preprodAllowed(dev:boolean,hostname:string,search:string){return dev&&hostname==='127.0.0.1'&&new URLSearchParams(search).get('mirrorPreprod')==='1';}
export function createPreprodRuntime(){
 if(!preprodAllowed(import.meta.env.DEV,window.location.hostname,window.location.search))throw Error('PREPROD_ISOLATION_REQUIRED');
 const config={apiKey:'synthetic-public-key',authDomain:'demo-miagenda-mirror.firebaseapp.com',projectId:'demo-miagenda-mirror',appId:'synthetic-preprod-app'};productionMirrorEnvironment({VITE_MIRROR_ENABLED:'1',VITE_MIRROR_ENVIRONMENT:'preprod'},import.meta.env.DEV,window.location.hostname,config);
 return new MirrorRuntime(config, {appName:'miagenda-mirror-preprod',async setup(app){
  let auth;try{auth=initializeAuth(app,{persistence:browserLocalPersistence});}catch{auth=getAuth(app);}
  if(!connected.has(app)){connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});connectFirestoreEmulator(getFirestore(app),'127.0.0.1',18080);connected.add(app);}
  await auth.authStateReady();if(!auth.currentUser)await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({sub:'preprod-owner',email:'preprod-owner@example.test',email_verified:true})));
 }},true);
}
