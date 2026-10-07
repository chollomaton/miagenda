import {lazy,Suspense,useCallback,useState} from 'react';
import type {ComponentProps} from 'react';
import {App} from './App';

const CloudConnection=lazy(()=>import('./CloudApp').then(module=>({default:module.CloudConnection})));
type CloudProps=Pick<ComponentProps<typeof App>,'providedStore'|'migrationNotice'|'onCloudLogout'|'cloudControls'>;

export function StartupApp(){
 const [cloudRequested,setCloudRequested]=useState(false);
 const [cloudProps,setCloudProps]=useState<CloudProps>({});
 const updateCloud=useCallback((props:CloudProps)=>setCloudProps(props),[]);
 const controls=cloudRequested
  ?cloudProps.cloudControls??<p className="muted" role="status">Conectando con Google…</p>
  :<button onClick={()=>setCloudRequested(true)}>Entrar con Google</button>;
 return <>{cloudRequested&&<Suspense fallback={null}><CloudConnection onChange={updateCloud}/></Suspense>}<App key={cloudProps.providedStore?.writerID??'local'} {...cloudProps} cloudControls={controls}/></>;
}
