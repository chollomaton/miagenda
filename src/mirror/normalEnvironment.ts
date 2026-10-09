import {firebaseConfig} from '../cloud/FirebaseConfig';
/** The normal entrypoint can never select an emulator. Dev needs explicit permission for real Firebase. */
export function normalMirrorEnvironment(env:Record<string,unknown>,dev:boolean){
 const config=firebaseConfig(env),requested=env.VITE_MIRROR_ENABLED==='1';
 if(requested&&(!config||env.VITE_MIRROR_ENVIRONMENT!=='production'||config.projectId.startsWith('demo-')||env.FIRESTORE_EMULATOR_HOST!==undefined||env.FIREBASE_AUTH_EMULATOR_HOST!==undefined))throw Error('MIRROR_CONFIG_AMBIGUOUS');
 if(dev&&env.VITE_MIRROR_ALLOW_PRODUCTION_DEV!=='1')return {config:null,pairingEnabled:false};
 return {config,pairingEnabled:requested};
}
