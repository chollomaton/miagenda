/** Browser-side probes for synthetic local E2E only; never imported by the app. */
import {getApp} from 'firebase/app';
import {getAuth,signOut,signInWithCredential,GoogleAuthProvider} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore/lite';
import {ProductionOwnerPairing} from '../src/mirror/productionPairing';
function app(){
 if(!import.meta.env.DEV||globalThis.location.hostname!=='127.0.0.1')throw Error('LOCAL_ONLY');
 const value=getApp('miagenda-mirror-preprod');
 if(value.options.projectId!=='demo-miagenda-mirror')throw Error('DEMO_ONLY');
 return value;
}
export async function withoutOwner(secret:string){
 const value=app(),auth=getAuth(value);await signOut(auth);
 const service=new ProductionOwnerPairing(getFirestore(value),auth,true);
 const failures=[];
 for(const action of [()=>service.preview(secret),()=>service.confirm(secret)]){
  try{await action();failures.push('UNEXPECTED_SUCCESS');}catch(error){failures.push(error instanceof Error?error.message:'UNKNOWN');}
 }
 return failures;
}
export async function restoreOwner(){await signInWithCredential(getAuth(app()),GoogleAuthProvider.credential(JSON.stringify({sub:'preprod-owner',email:'preprod-owner@example.test',email_verified:true})));}
