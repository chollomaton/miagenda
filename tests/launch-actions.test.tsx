import {StrictMode} from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {App} from '../src/app/App';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';

afterEach(()=>{cleanup();window.history.replaceState(null,'','/');vi.restoreAllMocks()});
async function fixture(action?:string){
 window.history.replaceState({kept:true},'', '/miagenda/'+(action?'?other=kept&action='+action:'')+'#main');
 const persistence=new MemoryPersistence(),store=new AgendaStore(persistence);await store.boot();
 const save=vi.spyOn(persistence,'save');
 const view=render(<StrictMode><App providedStore={store}/></StrictMode>);
 return {store,save,...view};
}
it('manifest exposes exactly four whitelisted shortcuts under the Vite base path',async()=>{
 const manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
 expect(manifest.shortcuts).toEqual([
  {name:'Nueva tarea',url:'/miagenda/?action=new-task'},
  {name:'Nuevo recordatorio',url:'/miagenda/?action=new-reminder'},
  {name:'Nuevo evento',url:'/miagenda/?action=new-event'},
  {name:'Hoy',url:'/miagenda/?action=today'},
 ]);
 expect(await readFile('vite.config.ts','utf8')).toContain("base: '/miagenda/'");
 for(const shortcut of manifest.shortcuts){const url=new URL(shortcut.url,'https://example.test/miagenda/manifest.webmanifest');expect(url.pathname).toBe('/miagenda/');expect([...url.searchParams.keys()]).toEqual(['action'])}
});
it.each([['new-task','Tarea'],['new-reminder','Recordatorio'],['new-event','Evento']])('%s opens the existing editor once, preserves URL state and does not repeat on reload',async(action,name)=>{
 const replace=vi.spyOn(window.history,'replaceState');const {store,save,unmount}=await fixture(action);expect(replace).toHaveBeenCalledTimes(2);replace.mockClear();
 expect(screen.getByRole('dialog',{name:'Nueva '+name})).toBeInTheDocument();
 expect(window.location.pathname+window.location.search+window.location.hash).toBe('/miagenda/?other=kept#main');
 expect(window.history.state).toEqual({kept:true});
 const dialog=screen.getByRole('dialog');fireEvent.keyDown(within(dialog).getByLabelText('Título'),{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Tareas'}));expect(screen.queryByRole('dialog')).toBeNull();
 expect(replace).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();expect(store.entities).toHaveLength(0);
 unmount();render(<App providedStore={store}/>);expect(screen.queryByRole('dialog')).toBeNull();
});
it('today runs the existing calendar today command',async()=>{
 await fixture('today');expect(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Calendario',current:'page'})).toBeInTheDocument();
 expect(window.location.search).toBe('?other=kept');
});
it.each(['unknown','toString','__proto__'])('ignores unknown action %s and removes only action',async action=>{
 await fixture(action);expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('button',{name:'Dashboard',current:'page'})).toBeInTheDocument();expect(window.location.search).toBe('?other=kept');
});
it('waits for explicit entry and store boot before consuming the launch URL',async()=>{
 window.history.replaceState(null,'','/miagenda/?action=new-task');render(<App/>);
 expect(window.location.search).toBe('?action=new-task');expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Abrir agenda local'}));
 expect(await screen.findByRole('dialog',{name:'Nueva Tarea'})).toBeInTheDocument();expect(window.location.search).toBe('');
});
it('does not consume an action while a provided store is loading',async()=>{
 window.history.replaceState(null,'','/miagenda/?action=new-event');
 const persistence=new MemoryPersistence();let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve});const load=persistence.load.bind(persistence);
 vi.spyOn(persistence,'load').mockImplementation(async()=>{await gate;return load()});
 const store=new AgendaStore(persistence);render(<App providedStore={store}/>);
 expect(window.location.search).toBe('?action=new-event');expect(screen.queryByRole('dialog')).toBeNull();
 await act(async()=>{release();await gate});expect(await screen.findByRole('dialog',{name:'Nueva Evento'})).toBeInTheDocument();
});
for(const modifiers of [{metaKey:true},{ctrlKey:true}]){
 it.each([['k',false,'Búsqueda global'],['n',false,'Nueva Tarea'],['n',true,'Nueva Recordatorio'],['e',false,'Nueva Evento']])('handles %s shift=%s with '+JSON.stringify(modifiers),async(key,shiftKey,name)=>{
  await fixture();const trigger=screen.getByRole('button',{name:'Buscar en toda Mi Agenda'});trigger.focus();
  expect(fireEvent.keyDown(trigger,{key,shiftKey,...modifiers})).toBe(false);
  const dialog=screen.getByRole('dialog',{name});expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.keyDown(within(dialog).getByRole('button',{name:'Cerrar'}),{key:'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();expect(trigger).toHaveFocus();
 });
}
it.each(['input','textarea','select','contenteditable'])('leaves shortcuts untouched in %s including descendants',async tag=>{
 await fixture();const element=document.createElement(tag==='contenteditable'?'div':tag);
 if(tag==='contenteditable'){element.setAttribute('contenteditable','true');element.append(document.createElement('span'))}
 document.body.append(element);
 try{for(const modifiers of [{ctrlKey:true},{metaKey:true}])for(const [key,shiftKey] of [['k',false],['n',false],['n',true],['e',false]] as const){
  expect(fireEvent.keyDown(element.firstChild??element,{key,shiftKey,...modifiers})).toBe(true);expect(screen.queryByRole('dialog')).toBeNull();
 }}finally{element.remove()}
});
it('does not prevent unhandled, modified, repeated or composing keys or open a second modal',async()=>{
 await fixture();for(const event of [{key:'x',ctrlKey:true},{key:'e',ctrlKey:true,shiftKey:true},{key:'n',ctrlKey:true,altKey:true},{key:'n',ctrlKey:true,repeat:true},{key:'n',ctrlKey:true,isComposing:true},{key:'n'}])expect(fireEvent.keyDown(window,event)).toBe(true);
 fireEvent.keyDown(window,{key:'n',ctrlKey:true});expect(fireEvent.keyDown(window,{key:'e',ctrlKey:true})).toBe(true);expect(screen.getByRole('dialog',{name:'Nueva Tarea'})).toBeInTheDocument();
});
