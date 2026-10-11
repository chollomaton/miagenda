import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryMirrorCache} from '../src/mirror/cache';
import {MirrorReader} from '../src/mirror/reader';
import {MemoryMirrorTransport} from '../src/mirror/transport';
import {setupTransport,source} from './fixtures/mirror/helpers';
const fixture=vi.hoisted(()=>({runtime:null as unknown}));
vi.mock('../src/mirror/MirrorRuntime',()=>({MirrorRuntime:vi.fn(function(){return fixture.runtime;})}));
import {StartupApp,mirrorPreviewEnabled} from '../src/app/StartupApp';
beforeEach(()=>window.history.replaceState({},'','/'));
it('restores a valid mirror session directly into the dashboard',async()=>{
 const {transport}=await setupTransport();const reader=new MirrorReader(transport,new MemoryMirrorCache(),source.publisherID);await reader.refresh();
 fixture.runtime={source:reader,state:'signedIn',revision:0,message:'',subscribe:()=>()=>{},start:vi.fn(),dispose:vi.fn()};
 render(<StartupApp/>);expect(screen.getByRole('searchbox',{name:'Buscar en iCloud'})).toBeInTheDocument();expect(screen.getByRole('button',{name:/Ideas para clase/})).toBeInTheDocument();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.queryByText(/Datos de ejemplo/)).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Online|Abrir agenda local|Nuevo|Guardar/})).not.toBeInTheDocument();expect(reader.capabilities.push).toBe(false);
});
it('shows only a minimal auth gate over the dashboard and removes it after login',async()=>{
 const listeners=new Set<()=>void>();const runtime={source:new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'empty'),state:'signedOut',revision:0,message:'',subscribe:(fn:()=>void)=>{listeners.add(fn);return ()=>listeners.delete(fn);},start:vi.fn(),dispose:vi.fn(),login:vi.fn(async()=>{runtime.state='signedIn';runtime.revision++;listeners.forEach(fn=>fn());})};fixture.runtime=runtime;
 render(<StartupApp/>);expect(screen.getByRole('dialog',{name:'Conectar Mi Agenda'})).toBeInTheDocument();expect(screen.getByRole('searchbox',{name:'Buscar en iCloud'})).toBeInTheDocument();expect(screen.queryByRole('navigation',{name:'Fuente de agenda'})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Entrar con Google'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(runtime.login).toHaveBeenCalledOnce();
});
it('requires both development and an explicit preview URL',()=>{
 expect(mirrorPreviewEnabled(true,'')).toBe(false);expect(mirrorPreviewEnabled(true,'?mirrorPreview=1')).toBe(true);expect(mirrorPreviewEnabled(false,'?mirrorPreview=1')).toBe(false);expect(mirrorPreviewEnabled(true,'?mirrorPreview=true')).toBe(false);
});

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('registers the production worker from the mirror entrypoint under the Pages base',async()=>{
 vi.stubEnv('PROD',true);vi.stubEnv('BASE_URL','/miagenda/');
 const register=vi.fn(async()=>Object.assign(new EventTarget(),{waiting:null,installing:null}));
 vi.stubGlobal('navigator',Object.create(navigator,{onLine:{value:true},serviceWorker:{value:{register}}}));
 fixture.runtime={source:new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'empty'),state:'checking',revision:0,message:'',subscribe:()=>()=>{},start:vi.fn(),dispose:vi.fn()};
 render(<StartupApp/>);window.dispatchEvent(new Event('load'));
 await waitFor(()=>expect(register).toHaveBeenCalledWith('/miagenda/service-worker.js',{scope:'/miagenda/',updateViaCache:'none'}));
});

it('explains an offline first visit without offering a broken login',()=>{
 vi.stubGlobal('navigator',Object.create(navigator,{onLine:{value:false}}));
 fixture.runtime={source:new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'empty'),state:'signedOut',revision:0,message:'',subscribe:()=>()=>{},start:vi.fn(),dispose:vi.fn()};
 render(<StartupApp/>);expect(screen.getByText(/Sin conexión. No hay una sesión local/)).toBeInTheDocument();expect(screen.getByText('Sin conexión. No hay una copia validada disponible en este navegador.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Entrar con Google'})).toBeDisabled();
});
it('does not register the production worker in development',()=>{
 vi.stubEnv('PROD',false);const register=vi.fn();
 vi.stubGlobal('navigator',Object.create(navigator,{onLine:{value:true},serviceWorker:{value:{register}}}));
 fixture.runtime={source:new MirrorReader(new MemoryMirrorTransport(null),new MemoryMirrorCache(),'empty'),state:'checking',revision:0,message:'',subscribe:()=>()=>{},start:vi.fn(),dispose:vi.fn()};
 render(<StartupApp/>);window.dispatchEvent(new Event('load'));expect(register).not.toHaveBeenCalled();
});
