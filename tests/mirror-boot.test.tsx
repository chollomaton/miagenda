import {beforeEach,expect,it,vi} from 'vitest';
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
