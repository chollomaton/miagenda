import {AuthManager} from '../auth/AuthManager';
import {AgendaSession} from '../auth/AgendaSession';
import {CloudKitGateway,CloudKitRepository} from './CloudGateway';
import {CloudKitWebTransport} from './CloudKitWebTransport';
import type {CloudKitConfig,CloudKitDevelopmentConfig} from './CloudKitWebTransport';
import {IndexedDBPersistence} from '../offline/Persistence';
import type {Persistence} from '../offline/Persistence';

/** The host must obtain a web token via Apple's sign-in flow. Never supply it through VITE_* or a file. */
export async function connectCloudKit(config:CloudKitConfig,webAuthToken:string,options:{request?:typeof fetch;persistence?:(scope:string)=>Persistence;target?:Window}={}){
 const transport=new CloudKitWebTransport(config,webAuthToken,options.request);
 const auth=new AuthManager({check:()=>transport.currentUser(),signIn:()=>transport.currentUser(),signOut:async()=>transport.invalidate()});
 await auth.check();if(auth.state!=='signedIn'){transport.invalidate();throw Error('CLOUDKIT_AUTHENTICATION_FAILED')}
 auth.onInvalidate(()=>transport.invalidate());
 try{
  await transport.ensureZone();
  const repository=new CloudKitRepository(new CloudKitGateway(transport));
  const session=new AgendaSession(auth,id=>(options.persistence??(scope=>new IndexedDBPersistence(scope)))(`${config.containerIdentifier}:${config.environment}:${id}`));
  await session.attach(repository,options.target);
  return {session,repository,transport};
 }catch(error){transport.invalidate();throw error}
}

/** Compatibility entry point: never permits Production. */
export function connectCloudKitDevelopment(config:CloudKitDevelopmentConfig,webAuthToken:string,options:Parameters<typeof connectCloudKit>[2]={}){
 if(config.environment!=='development')throw Error('CLOUDKIT_DEVELOPMENT_REQUIRED');
 return connectCloudKit(config,webAuthToken,options);
}
