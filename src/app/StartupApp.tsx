import {diagnostic,diagnosticCorrelation} from '../mirror/pairingDiagnostic';
import {lazy,Suspense,useEffect,useState,useSyncExternalStore} from 'react';
import {normalMirrorEnvironment} from '../mirror/normalEnvironment';
import {MirrorRuntime} from '../mirror/MirrorRuntime';
import {MirrorPairingPanel} from '../mirror/MirrorPairingPanel';
import {MirrorApp} from '../mirror/MirrorApp';
import {Dialog} from '../components/Dialog';
const DiagnosticPanel=(import.meta.env.DEV||import.meta.env.VITE_PAIRING_DIAGNOSTICS==='1')?lazy(()=>import('../mirror/PairingDiagnosticPanel').then(module=>({default:module.PairingDiagnosticPanel}))):null;
const emulatorFactory=import.meta.env.DEV?await import('../mirror/emulatorDev'):null;
const MirrorPreview=import.meta.env.DEV?lazy(()=>import('../mirror/MirrorPreview').then(module=>({default:module.MirrorPreview}))):null;
export const AppMode='icloudMirrorReadonly' as const;
export function mirrorPreviewEnabled(dev:boolean,search:string){return dev&&new URLSearchParams(search).get('mirrorPreview')==='1';}
function takePairingFragment(){const fragment=new URLSearchParams(window.location.hash.slice(1));const secret=fragment.get('pair')??'';if(fragment.has('pair'))window.history.replaceState(null,'',window.location.pathname+window.location.search);if(diagnostic){if(/^[0-9a-f]{64}$/.test(secret))void diagnosticCorrelation(secret).then(id=>diagnostic?.emit('web-fragment-seen',id));else diagnostic?.emit('fragment-missing');}return /^[0-9a-f]{64}$/.test(secret)?secret:'';}
export function StartupApp(){
 const [pairingSecret,setPairingSecret]=useState(takePairingFragment);
 useEffect(()=>{const receive=()=>setPairingSecret(takePairingFragment());window.addEventListener('hashchange',receive);return ()=>window.removeEventListener('hashchange',receive);},[]);
 const preprod=emulatorFactory?.preprodAllowed(import.meta.env.DEV,window.location.hostname,window.location.search)??false;
 const normal=preprod?{config:null,pairingEnabled:false}:normalMirrorEnvironment(import.meta.env,import.meta.env.DEV);
 const enabled=normal.pairingEnabled;
 const [runtime]=useState(()=>preprod?emulatorFactory!.createPreprodRuntime():emulatorFactory?.emulatorAllowed(import.meta.env.DEV,window.location.hostname,window.location.search)?emulatorFactory.createEmulatorRuntime():new MirrorRuntime(normal.config,undefined,enabled));
 useSyncExternalStore(runtime.subscribe,()=>runtime.revision);
 const preview=mirrorPreviewEnabled(import.meta.env.DEV,window.location.search);
 useEffect(()=>{if(!preview)void runtime.start();return ()=>runtime.dispose();},[runtime,preview]);
 if(preview&&MirrorPreview)return <Suspense fallback={<MirrorApp source={runtime.source}/>}><MirrorPreview/></Suspense>;
 return <>{diagnostic&&DiagnosticPanel&&<Suspense><DiagnosticPanel/></Suspense>}<MirrorApp key={pairingSecret} source={runtime.source} initialSettings={!!pairingSecret} pairingControl={(enabled||preprod)&&runtime.pairing?<MirrorPairingPanel service={runtime.pairing} initialSecret={pairingSecret}/>:undefined}/>{runtime.message&&<p className="mirror-connection-status" role="status">{runtime.message}</p>}{runtime.state==='signedOut'&&<Dialog label="Conectar Mi Agenda" onClose={()=>{}}><h2>Conectar Mi Agenda</h2><p>Entra para consultar la copia de iCloud publicada desde tu Mac.</p><button onClick={()=>void runtime.login()}>Entrar con Google</button></Dialog>}</>;
}
