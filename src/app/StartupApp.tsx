import {lazy,Suspense,useEffect,useState,useSyncExternalStore} from 'react';
import {firebaseConfig} from '../cloud/FirebaseConfig';
import {MirrorRuntime} from '../mirror/MirrorRuntime';
import {MirrorApp} from '../mirror/MirrorApp';
import {Dialog} from '../components/Dialog';
const emulatorFactory=import.meta.env.DEV?await import('../mirror/emulatorDev'):null;
const MirrorPreview=import.meta.env.DEV?lazy(()=>import('../mirror/MirrorPreview').then(module=>({default:module.MirrorPreview}))):null;
export const AppMode='icloudMirrorReadonly' as const;
export function mirrorPreviewEnabled(dev:boolean,search:string){return dev&&new URLSearchParams(search).get('mirrorPreview')==='1';}
export function StartupApp(){
 const [runtime]=useState(()=>emulatorFactory?.emulatorAllowed(import.meta.env.DEV,window.location.hostname,window.location.search)?emulatorFactory.createEmulatorRuntime():new MirrorRuntime(firebaseConfig(import.meta.env)));
 useSyncExternalStore(runtime.subscribe,()=>runtime.revision);
 const preview=mirrorPreviewEnabled(import.meta.env.DEV,window.location.search);
 useEffect(()=>{if(!preview)void runtime.start();return ()=>runtime.dispose();},[runtime,preview]);
 if(preview&&MirrorPreview)return <Suspense fallback={<MirrorApp source={runtime.source}/>}><MirrorPreview/></Suspense>;
 return <><MirrorApp source={runtime.source}/>{runtime.message&&<p className="mirror-connection-status" role="status">{runtime.message}</p>}{runtime.state==='signedOut'&&<Dialog label="Conectar Mi Agenda" onClose={()=>{}}><h2>Conectar Mi Agenda</h2><p>Entra para consultar la copia de iCloud publicada desde tu Mac.</p><button onClick={()=>void runtime.login()}>Entrar con Google</button></Dialog>}</>;
}
