import type {FirebaseConfig} from '../cloud/FirebaseConfig';
export interface MirrorEnvironment {mode:'preprod'|'production';config:FirebaseConfig;pairingEnabled:boolean}
/** Validate before initialization: preprod is fixed loopback/demo, production needs an explicit capability. */
export function productionMirrorEnvironment(env:Record<string,unknown>,dev:boolean,hostname:string,config:FirebaseConfig|null):MirrorEnvironment|null {
 if(env.VITE_MIRROR_ENABLED!=='1')return null;
 if(!config||env.FIRESTORE_EMULATOR_HOST!==undefined||env.FIREBASE_AUTH_EMULATOR_HOST!==undefined)throw Error('MIRROR_CONFIG_AMBIGUOUS');
 if(env.VITE_MIRROR_ENVIRONMENT==='preprod'){
  if(!dev||hostname!=='127.0.0.1'||config.projectId!=='demo-miagenda-mirror'||config.apiKey!=='synthetic-public-key')throw Error('PREPROD_ISOLATION_REQUIRED');
  return {mode:'preprod',config,pairingEnabled:true};
 }
 if(env.VITE_MIRROR_ENVIRONMENT!=='production'||config.projectId.startsWith('demo-')||dev&&env.VITE_MIRROR_ALLOW_PRODUCTION_DEV!=='1')throw Error('PRODUCTION_OPT_IN_REQUIRED');
 return {mode:'production',config,pairingEnabled:true};
}
