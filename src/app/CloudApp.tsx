import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import type {ComponentProps} from 'react';
import {App} from './App';
import {firebaseConfig} from '../cloud/FirebaseConfig';
import {FirebaseRuntime} from '../cloud/FirebaseRuntime';
import {LocalFirebaseMigration} from '../migration/LocalFirebaseMigration';
import {LocalMigrationControls} from '../components/LocalMigrationControls';
type CloudProps=Pick<ComponentProps<typeof App>,'providedStore'|'migrationNotice'|'onCloudLogout'|'cloudControls'>;
export function CloudApp(){return <CloudConnection/>}
export function CloudConnection({onChange}:{onChange?:(props:CloudProps)=>void}){
 const [runtime]=useState(()=>new FirebaseRuntime(firebaseConfig(import.meta.env)));
 useSyncExternalStore(runtime.subscribe,()=>runtime.revision);
 useEffect(()=>{void runtime.start(window)},[runtime]);
 const session=runtime.state==='signedIn'?runtime.session:null;
 const migration=useMemo(()=>{const config=firebaseConfig(import.meta.env);return session&&config?new LocalFirebaseMigration(session,config.projectId):null},[session]);
 useEffect(()=>{if(!migration)return;void migration.initialize().catch(()=>{});return ()=>migration.dispose()},[migration]);
 const {state,sessionExpired}=runtime;
 const controls=useMemo(()=><div>{!session&&<><p role={sessionExpired?'alert':'status'} aria-live={sessionExpired?undefined:'polite'}>{sessionExpired?'Tu sesión ha caducado. Vuelve a entrar para continuar sincronizando.':state==='unavailable'?'Firebase no disponible. Puedes usar la agenda local.':state==='connecting'?'Conectando con Google…':'Google: sesión cerrada. La agenda de tu cuenta está separada de la agenda local.'}</p>{state==='signedOut'&&<button onClick={()=>void runtime.login()}>Entrar con Google</button>}</>}{migration&&<LocalMigrationControls migration={migration} manual/>}</div>,[migration,runtime,state,sessionExpired,session]);
 useEffect(()=>{if(onChange)onChange({cloudControls:controls,providedStore:session?.store??undefined,migrationNotice:runtime.sessionExpired?<p role="alert">Tu sesión ha caducado. Vuelve a entrar para continuar sincronizando. <button onClick={()=>void runtime.login()}>Entrar con Google</button></p>:migration?<LocalMigrationControls migration={migration}/>:undefined,onCloudLogout:session?()=>runtime.logout():undefined})},[controls,onChange,session,migration,runtime,runtime.revision]);
 if(onChange)return null;
 return <App key={session?.auth.identity??'local'} providedStore={session?.store??undefined} cloudControls={controls} migrationNotice={runtime.sessionExpired?<p role="alert">Tu sesión ha caducado. Vuelve a entrar para continuar sincronizando. <button onClick={()=>void runtime.login()}>Entrar con Google</button></p>:migration?<LocalMigrationControls migration={migration}/>:undefined} onCloudLogout={session?()=>runtime.logout():undefined}/>;
}
