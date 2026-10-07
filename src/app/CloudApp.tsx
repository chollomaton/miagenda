import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {App} from './App';
import {firebaseConfig} from '../cloud/FirebaseConfig';
import {FirebaseRuntime} from '../cloud/FirebaseRuntime';
import {LocalFirebaseMigration} from '../migration/LocalFirebaseMigration';
import {LocalMigrationControls} from '../components/LocalMigrationControls';
export function CloudApp(){
 const [runtime]=useState(()=>new FirebaseRuntime(firebaseConfig(import.meta.env)));
 useSyncExternalStore(runtime.subscribe,()=>runtime.revision);
 useEffect(()=>{void runtime.start(window)},[runtime]);
 const session=runtime.state==='signedIn'?runtime.session:null;
 const migration=useMemo(()=>{const config=firebaseConfig(import.meta.env);return session&&config?new LocalFirebaseMigration(session,config.projectId):null},[session]);
 useEffect(()=>{if(!migration)return;void migration.initialize().catch(()=>{});return ()=>migration.dispose()},[migration]);
 const controls=<div><p role="status">{runtime.state==='unavailable'?'Firebase no disponible. Puedes usar la agenda local.':runtime.state==='connecting'?'Conectando con Google…':session?'Sincronización con Firebase activada.':'Google: sesión cerrada. La agenda de tu cuenta está separada de la agenda local.'}</p>{runtime.state==='signedOut'&&<button onClick={()=>void runtime.login()}>Entrar con Google</button>}{session&&<button onClick={()=>void session.sync?.sync()}>Sincronizar ahora</button>}{migration&&<LocalMigrationControls migration={migration} manual/>}</div>;
 return <App key={session?.auth.identity??'local'} providedStore={session?.store??undefined} cloudControls={controls} migrationNotice={migration?<LocalMigrationControls migration={migration}/>:undefined} onCloudLogout={session?()=>runtime.logout():undefined}/>;
}
