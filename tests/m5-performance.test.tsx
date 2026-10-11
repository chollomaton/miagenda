import {lazy,Suspense} from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {StartupApp} from '../src/app/StartupApp';
import {App} from '../src/app/App';
import {ErrorBoundary} from '../src/components/ErrorBoundary';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
const cloud=vi.hoisted(()=>({loaded:vi.fn(),mounted:vi.fn()}));
vi.mock('../src/app/CloudApp',()=>{cloud.loaded();return {CloudConnection:()=>{cloud.mounted();return null}}});

it('M5 readonly startup never loads the legacy editable cloud app',()=>{
 render(<ErrorBoundary><StartupApp/></ErrorBoundary>);
 expect(screen.getByRole('searchbox',{name:'Buscar en iCloud'})).toBeInTheDocument();
 expect(cloud.loaded).not.toHaveBeenCalled();expect(cloud.mounted).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Abrir agenda local'})).not.toBeInTheDocument();
});
it('M5 heavy panels remain dynamic and recovery is mounted only on demand',()=>{
 const source=readFileSync('src/app/App.tsx','utf8');
 for(const name of ['BackupControls','TemplatesPanel','CalendarTimeline']){
  expect(source).toMatch(new RegExp(`const ${name}=lazy\\(`));
  expect(source).not.toMatch(new RegExp(`import \\{${name}\\}`));
 }
 expect(source).toContain("recoveryOpened&&<Suspense");
 const startup=readFileSync('src/app/StartupApp.tsx','utf8');
 expect(startup).not.toContain('FirebaseRuntime');
 expect(startup).not.toContain("import('./CloudApp')");
 expect(startup).toContain('MirrorRuntime');
});
it('M5 recovery, templates and calendar load repeatedly without altering stored data',async()=>{
 const store=new AgendaStore(new MemoryPersistence());await store.boot();
 await store.create('Task',{title:'Conservar'});const before=store.snapshot();
 render(<ErrorBoundary><App providedStore={store}/></ErrorBoundary>);
 for(let i=0;i<2;i++){
  fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
  fireEvent.click(screen.getByRole('button',{name:'Datos y recuperación'}));
  await screen.findByRole('button',{name:'Exportar backup ZIP'});
  fireEvent.click(screen.getByRole('button',{name:'Plantillas'}));
  await screen.findByRole('button',{name:'Nueva plantilla'});
  fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Calendario'}));
  fireEvent.click(screen.getByRole('button',{name:'Día'}));
  await waitFor(()=>expect(document.querySelector('.timeline')).not.toBeNull());
 }
 await act(()=>store.flush());expect(store.snapshot()).toEqual(before);
});
it('M5 rejected dynamic imports reach the existing safe ErrorBoundary',async()=>{
 const Failed=lazy(()=>Promise.reject(Error('chunk unavailable')));
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{render(<ErrorBoundary><Suspense fallback={null}><Failed/></Suspense></ErrorBoundary>);expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido mostrar Mi Agenda');expect(screen.getByRole('button',{name:'Reintentar'})).toBeInTheDocument()}finally{log.mockRestore()}
});
