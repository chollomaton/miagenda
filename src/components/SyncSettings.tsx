import {useState} from 'react';
import type {AgendaStore} from '../stores/AgendaStore';
import {syncPresentation,lastSyncLabel} from '../sync/syncPresentation';

export function SyncSettings({store,onSync,onLogout,logoutBusy,onOpen}:{store:AgendaStore;onSync:()=>Promise<void>;onLogout:()=>Promise<void>;logoutBusy:boolean;onOpen:(id:string)=>void}){
 const view=syncPresentation(store),lastSync=lastSyncLabel(view.lastSync);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const failed=store.outbox.find(op=>op.status==='permanentFailure');
 const affected=store.entities.find(entity=>entity.id===failed?.entityID);
 async function sync(retry=false){if(busy)return;setBusy(true);setError('');try{if(retry)await store.retryPermanentFailures();await onSync()}catch{setError('No se pudo completar el intento. Tus cambios se conservan; vuelve a intentarlo.')}finally{setBusy(false)}}
 return <><h3>Cuenta</h3><p>Google conectado</p><button disabled={logoutBusy||busy} onClick={()=>void onLogout().catch(()=>setError('No se pudo cerrar la sesión. Vuelve a intentarlo.'))}>Cerrar sesión</button><h3>Sincronización</h3><p role="status" aria-live="polite">{view.title} · {view.detail}</p>{lastSync&&<p>{lastSync}</p>}<p>{view.pending} cambios pendientes</p>{view.state==='offline'&&<p>Se reintentará automáticamente cuando vuelva la conexión.</p>}{view.state==='pending'&&<p>Los cambios se reintentan automáticamente.</p>}<button disabled={busy||logoutBusy||store.status==='syncing'} onClick={()=>void sync()}>Sincronizar ahora</button>{view.state==='permanent'&&<><p>{view.permanent} cambios con error permanente. Los cambios posteriores de esos elementos esperan a que se resuelva el error; los demás pueden seguir sincronizándose.</p><button disabled={busy||logoutBusy||store.status==='syncing'} onClick={()=>void sync(true)}>Reintentar</button>{affected&&affected.kind!=='Template'&&affected.kind!=='Preferences'&&<button onClick={()=>onOpen(affected.id)}>Abrir elemento</button>}</>}{error&&<p role="alert">{error}</p>}</>;
}
