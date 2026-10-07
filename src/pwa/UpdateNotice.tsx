import {useEffect,useState} from 'react';
import {editingOpen,watchWaiting,requestSafeUpdate} from './updates';
export function UpdateNotice({flush}:{flush:()=>Promise<void>}) {
 const [worker,setWorker]=useState<ServiceWorker|null>(null),[deferred,setDeferred]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
  let dispose: (()=>void)|undefined, cancelled=false;
  const register=()=>{void navigator.serviceWorker.register('./service-worker.js').then(registration=>{if(!cancelled)dispose=watchWaiting(registration,setWorker)}).catch(()=>{});};
  if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
  return ()=>{cancelled=true;dispose?.();window.removeEventListener('load',register)};
 },[]);
 useEffect(()=>{
  if(!worker||!deferred)return;
  return requestSafeUpdate(worker,navigator.serviceWorker,flush,()=>window.location.reload(),message=>{setDeferred(false);setError(message)});
 },[worker,deferred,flush]);
 if(!worker)return null;
 return <aside className="notice update-notice" aria-label="Actualización"><p role="status" aria-live="polite">Hay una nueva versión de Mi Agenda.{deferred?' Se actualizará al terminar y cerrar el editor.':''}</p><button disabled={deferred} onClick={()=>{setError('');setDeferred(true)}}>{editingOpen()?'Actualizar al terminar':'Actualizar'}</button>{error&&<p role="alert">{error}</p>}</aside>;
}
