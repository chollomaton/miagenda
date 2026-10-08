import {lazy,Suspense,useCallback,useState} from 'react';
import type {ComponentProps} from 'react';
import {App} from './App';
import '../styles/source-selector.css';

const MirrorPreview=import.meta.env.DEV?lazy(()=>import('../mirror/MirrorPreview').then(module=>({default:module.MirrorPreview}))):null;
const CloudConnection=lazy(()=>import('./CloudApp').then(module=>({default:module.CloudConnection})));
type CloudProps=Pick<ComponentProps<typeof App>,'providedStore'|'migrationNotice'|'onCloudLogout'|'cloudControls'>;

export function StartupApp(){
 const previewEnabled=import.meta.env.DEV&&new URLSearchParams(window.location.search).get('mirrorPreview')==='1';
 const [source,setSource]=useState<'Online'|'iCloud'>('Online');
 const sourceControl=previewEnabled?<nav className="source-selector" aria-label="Fuente de agenda">{(['iCloud','Online'] as const).map(name=><button key={name} aria-pressed={source===name} onClick={()=>setSource(name)}>{name}</button>)}</nav>:undefined;
 const [cloudRequested,setCloudRequested]=useState(false);
 const [cloudProps,setCloudProps]=useState<CloudProps>({});
 const updateCloud=useCallback((props:CloudProps)=>setCloudProps(props),[]);
 const controls=cloudRequested
  ?cloudProps.cloudControls??<p className="muted" role="status">Conectando con Google…</p>
  :<button onClick={()=>setCloudRequested(true)}>Entrar con Google</button>;
 if(previewEnabled&&source==='iCloud'&&MirrorPreview)return <Suspense fallback={<p role="status">Abriendo vista local…</p>}><MirrorPreview sourceControl={sourceControl}/></Suspense>;
 return <>{cloudRequested&&<Suspense fallback={null}><CloudConnection onChange={updateCloud}/></Suspense>}<App sourceControl={sourceControl} key={cloudProps.providedStore?.writerID??'local'} {...cloudProps} cloudControls={controls}/></>;
}
