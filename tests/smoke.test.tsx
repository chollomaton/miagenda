import {fireEvent,render,screen,waitFor,cleanup,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {App} from '../src/app/App';
import {ErrorBoundary} from '../src/components/ErrorBoundary';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
afterEach(cleanup);
async function app(){const store=new AgendaStore(new MemoryPersistence());await store.boot();render(<App providedStore={store}/>);return store}
describe('Functional UI',()=>{
 it('requires explicit local entry',()=>{render(<App/>);expect(screen.getByRole('button',{name:'Abrir agenda local'})).toBeInTheDocument()});
 it('navigates the native sections',async()=>{await app();for(const name of ['Recordatorios','Notas','Completados','Etiquetas','Ajustes']){fireEvent.click(screen.getByRole('button',{name}));expect(screen.getByRole('heading',{name:name==='Notas'?'Notas rápidas':name==='Recordatorios'?'Recordatorios 0':name})).toBeInTheDocument()}});
 it('creates a task through editor and persists it',async()=>{const store=await app();fireEvent.click(screen.getByRole('button',{name:'＋ Nuevo'}));fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Synthetic task'}});fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(store.entities).toHaveLength(1));expect(store.outbox).toHaveLength(1);expect(store.entities[0].fields.due).toBeNull();expect(store.entities[0].fields.startDate).toBeNull()});
 it('opens global search by Control K and escapes text',async()=>{const store=await app();await store.create('Task',{title:'<script>synthetic</script>'});fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getByRole('dialog',{name:'Búsqueda global'})).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Buscar en Mi Agenda'),{target:{value:'synthetic'}});expect(screen.getByRole('option',{name:'Tarea · <script>synthetic</script>'})).toBeInTheDocument();expect(document.querySelectorAll('script')).toHaveLength(0)});
 it('renders recoverable error boundary',()=>{function Broken():never{throw Error('Synthetic render failure')}const log=vi.spyOn(console,'error').mockImplementation(()=>{});try{render(<ErrorBoundary><Broken/></ErrorBoundary>);expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido mostrar Mi Agenda')}finally{log.mockRestore()}});
});

it('global search traps focus and Escape restores the trigger',async()=>{await app();const trigger=screen.getByRole('button',{name:'Buscar en toda Mi Agenda'});trigger.focus();fireEvent.click(trigger);const input=screen.getByLabelText('Buscar en Mi Agenda'),close=screen.getByRole('option',{name:'Ir a Hoy'});expect(input).toHaveFocus();fireEvent.keyDown(input,{key:'Tab',shiftKey:true});expect(close).toHaveFocus();fireEvent.keyDown(close,{key:'Tab'});expect(input).toHaveFocus();fireEvent.keyDown(input,{key:'Escape'});expect(trigger).toHaveFocus();expect(screen.queryByRole('dialog')).toBeNull()});
it('notes are created immediately and autosaved',async()=>{const store=await app();fireEvent.click(screen.getByRole('button',{name:'Notas'}));fireEvent.click(screen.getByRole('button',{name:'＋ Nuevo'}));await waitFor(()=>expect(store.entities).toHaveLength(1));fireEvent.change(screen.getByLabelText('Nota'),{target:{value:'Synthetic note'}});await waitFor(()=>expect(store.entities[0].fields.text).toBe('Synthetic note'));fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())});

it('NOTE_AUTOSAVE_RACE close flushes latest text behind an in-flight save and survives reopen',async()=>{
 const store=await app();fireEvent.click(screen.getByRole('button',{name:'Notas'}));fireEvent.click(screen.getByRole('button',{name:'＋ Nuevo'}));
 await screen.findByLabelText('Nota');
 const original=store.persistence.save.bind(store.persistence);let release!:()=>void;let started=false;
 const gate=new Promise<void>(resolve=>{release=resolve});
 const spy=vi.spyOn(store.persistence,'save').mockImplementationOnce(async snapshot=>{started=true;await gate;await original(snapshot)});
 try{
  fireEvent.change(screen.getByLabelText('Nota'),{target:{value:'older autosave'}});
  await waitFor(()=>expect(started).toBe(true));
  fireEvent.change(screen.getByLabelText('Nota'),{target:{value:'latest rapid text'}});
  fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));
  expect(screen.getByRole('dialog')).toBeInTheDocument();release();
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await store.flush();
  const reopened=new AgendaStore(store.persistence);await reopened.boot();
  expect(reopened.entities).toHaveLength(1);expect(reopened.entities[0].fields.text).toBe('latest rapid text');
 }finally{release();spy.mockRestore()}
});

it('appearance persists in existing preferences without replacing other settings',async()=>{
 const store=await app();await store.create('Preferences',{theme:'system',timezone:'Europe/Paris',hour24:false});
 fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
 for(const theme of ['dark','light','system']){
  fireEvent.change(screen.getByLabelText('Apariencia'),{target:{value:theme}});
  await waitFor(()=>expect(document.documentElement.dataset.theme).toBe(theme));
  await store.flush();const reopened=new AgendaStore(store.persistence);await reopened.boot();
  const prefs=reopened.entities.find(e=>e.kind==='Preferences')!;
  expect(prefs.fields.theme).toBe(theme);expect(prefs.fields.timezone).toBe('Europe/Paris');expect(prefs.fields.hour24).toBe(false);
 }
});
it('completed section reopens tasks without changing their identity',async()=>{
 const store=await app();
 const task=await store.create('Task',{title:'Completed visual fixture',completed:true,completedAt:new Date().toISOString()});
 fireEvent.click(screen.getByRole('button',{name:'Completados'}));
 fireEvent.click(screen.getByRole('button',{name:'Reabrir'}));
 await waitFor(()=>expect(store.entities.find(e=>e.id===task.id)?.fields.completed).toBe(false));
 expect(screen.queryByRole('button',{name:'Reabrir'})).toBeNull();
});

it('dashboard week/month controls open the same stored event',async()=>{
 const store=new AgendaStore(new MemoryPersistence());await store.boot();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);
 await store.create('Event',{title:'Calendar visual fixture',allDay:true,startDate:today,endDate:end.toISOString().slice(0,10)});
 render(<App providedStore={store}/>);
 fireEvent.click(screen.getByRole('button',{name:'Mes'}));
 expect(screen.getByRole('button',{name:'Mes'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:today}));
 fireEvent.click(screen.getByRole('button',{name:'Calendar visual fixture'}));
 expect(screen.getByLabelText('Título')).toHaveValue('Calendar visual fixture');
 expect(store.entities).toHaveLength(1);
});

it('edits a label in the detail panel and persists its appearance and parent',async()=>{
 const store=await app();const parent=await store.create('Label',{title:'Trabajo'});
 fireEvent.click(screen.getByRole('button',{name:'Etiquetas'}));
 fireEvent.click(screen.getByRole('button',{name:'Nueva etiqueta'}));
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Proyecto'}});
 fireEvent.click(screen.getByRole('button',{name:'Color #ff9500'}));
 fireEvent.change(screen.getByLabelText('Etiqueta superior'),{target:{value:parent.id}});
 fireEvent.click(within(screen.getByRole('group',{name:'Tipo de vista previa'})).getByRole('button',{name:'Calendario'}));
 expect(screen.getByText('Evento de ejemplo')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Guardar'}));
 await waitFor(()=>expect(store.entities.find(e=>e.fields.title==='Proyecto')?.fields.color).toBe('#ff9500'));
 await store.flush();const reopened=new AgendaStore(store.persistence);await reopened.boot();
 expect(reopened.entities.find(e=>e.fields.title==='Proyecto')?.fields.parentLabelId).toBe(parent.id);
});

it.each([{ctrlKey:true},{metaKey:true}])('CmdK shows actions and navigates to an editor with %o',async modifiers=>{
 await app();fireEvent.keyDown(window,{key:'k',...modifiers});
 const input=screen.getByLabelText('Buscar en Mi Agenda');
 expect(screen.getAllByRole('option')).toHaveLength(6);
 expect(screen.getByRole('option',{name:'Nueva tarea'})).toHaveAttribute('aria-selected','true');
 fireEvent.keyDown(input,{key:'ArrowDown'});
 expect(screen.getByRole('option',{name:'Nuevo recordatorio'})).toHaveAttribute('aria-selected','true');
 fireEvent.keyDown(input,{key:'ArrowUp'});
 expect(screen.getByRole('option',{name:'Nueva tarea'})).toHaveAttribute('aria-selected','true');
 fireEvent.keyDown(input,{key:'ArrowUp'});
 expect(screen.getByRole('option',{name:'Ir a Hoy'})).toHaveAttribute('aria-selected','true');
 fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});
 expect(screen.queryByRole('dialog',{name:'Búsqueda global'})).toBeNull();
 expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(within(screen.getByRole('dialog')).getByRole('button',{name:'Cerrar'})).toHaveFocus();
 fireEvent.keyDown(window,{key:'k',...modifiers});expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
it('mixes matching actions before entities and Enter opens the stored result',async()=>{
 const store=await app();await store.create('Task',{title:'Nueva tarea pendiente'});
 fireEvent.keyDown(window,{key:'k',ctrlKey:true});const input=screen.getByLabelText('Buscar en Mi Agenda');
 fireEvent.change(input,{target:{value:'nueva tarea'}});
 expect(screen.getAllByRole('option').map(node=>node.textContent)).toEqual(['Nueva tarea','Tarea · Nueva tarea pendiente']);
 fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});
 expect(screen.getByLabelText('Título')).toHaveValue('Nueva tarea pendiente');
 fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));
 fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getByLabelText('Buscar en Mi Agenda')).toHaveValue('');
 expect(screen.getByRole('option',{name:'Nueva tarea'})).toHaveAttribute('aria-selected','true');
});
it.each(['Nuevo recordatorio','Nuevo evento','Nueva nota','Ir a Hoy'])('executes %s through the existing flow',async label=>{
 const store=await app();fireEvent.keyDown(window,{key:'k',ctrlKey:true});
 fireEvent.click(screen.getByRole('option',{name:label}));expect(screen.queryByRole('dialog',{name:'Búsqueda global'})).toBeNull();
 if(label==='Nueva nota'){await screen.findByLabelText('Nota');expect(store.entities[0].kind).toBe('QuickNote')}
 else if(label==='Ir a Hoy'){expect(screen.getByLabelText('Fecha calendario')).toHaveValue(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))}
 else expect(screen.getByLabelText('Título')).toBeInTheDocument();
});
it('handles no matches without executing a command',async()=>{
 await app();fireEvent.keyDown(window,{key:'k',ctrlKey:true});const input=screen.getByLabelText('Buscar en Mi Agenda');
 fireEvent.change(input,{target:{value:'zzzz-no-match'}});fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});
 expect(screen.queryAllByRole('option')).toHaveLength(0);expect(screen.getByRole('dialog',{name:'Búsqueda global'})).toBeInTheDocument();
});

async function capture(){const store=await app();fireEvent.keyDown(window,{key:'k',metaKey:true});expect(screen.getByRole('option',{name:'Captura rápida'})).toBeInTheDocument();const input=screen.getByLabelText('Buscar en Mi Agenda');fireEvent.change(input,{target:{value:'captura'}});fireEvent.keyDown(input,{key:'Enter'});expect(screen.queryByRole('dialog',{name:'Búsqueda global'})).toBeNull();expect(screen.getByRole('dialog',{name:'Captura rápida'})).toBeInTheDocument();expect(screen.getByLabelText('Qué quieres recordar')).toHaveFocus();return store}
it('quick capture previews a task and saves only through the existing editor',async()=>{
 const store=await capture();fireEvent.change(screen.getByLabelText('Qué quieres recordar'),{target:{value:'mañana llamar a Ana'}});
 expect(within(screen.getByRole('region',{name:'Vista previa'})).getByText('llamar a Ana')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Crear'})).toBeEnabled();expect(store.entities).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Crear'}));expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(screen.getByLabelText('Título')).toHaveValue('llamar a Ana');expect(store.entities).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(store.entities).toHaveLength(1));expect(store.entities[0].fields.due).toBeTruthy();
});
it('quick capture resolves an ambiguous hour and priority',async()=>{
 await capture();fireEvent.change(screen.getByLabelText('Qué quieres recordar'),{target:{value:'lunes 6 reunión !alta !baja'}});expect(screen.getByText('Elige una hora.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'06:00'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Crear'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'18:00'}));fireEvent.click(screen.getByRole('button',{name:'Sin prioridad'}));expect(screen.getByRole('button',{name:'Crear'})).toBeEnabled();fireEvent.click(screen.getByRole('button',{name:'Editar detalles'}));expect(screen.getByLabelText('Fecha y hora').getAttribute('value')).toContain('T18:00');expect(screen.getByLabelText('Prioridad')).toHaveValue('0');
});
it('quick capture rejects invalid time and Escape restores focus without reopening CmdK',async()=>{
 await capture();fireEvent.change(screen.getByLabelText('Qué quieres recordar'),{target:{value:'25:99 llamar'}});expect(screen.getByText('La hora no es válida.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Crear'})).toBeDisabled();fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getAllByRole('dialog')).toHaveLength(1);fireEvent.keyDown(screen.getByLabelText('Qué quieres recordar'),{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('button',{name:'Buscar en toda Mi Agenda'})).toHaveFocus();
 fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getByLabelText('Buscar en Mi Agenda')).toHaveValue('');expect(screen.getByRole('option',{name:'Nueva tarea'})).toHaveAttribute('aria-selected','true');
});
it('quick capture keeps note content literal in preview and editor',async()=>{
 const store=await capture();fireEvent.change(screen.getByLabelText('Qué quieres recordar'),{target:{value:'nota idea para vídeo de mañana'}});const preview=screen.getByRole('region',{name:'Vista previa'});expect(preview).toHaveTextContent('idea para vídeo de mañana');expect(within(preview).queryByText('Fecha')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Editar detalles'}));expect(screen.getByLabelText('Nota')).toHaveValue('idea para vídeo de mañana');expect(store.entities).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(store.entities[0]?.fields.text).toBe('idea para vídeo de mañana'));
});

it.each([
 ['recordatorio mañana 10:30 llamar','Nueva Recordatorio','Fecha y hora','T10:30'],
 ['evento mañana 10:00-11:00 reunión','Nueva Evento','Fin','T11:00'],
])('quick capture prefills %s without writing',async(text,dialog,field,value)=>{
 const store=await capture();fireEvent.change(screen.getByLabelText('Qué quieres recordar'),{target:{value:text}});fireEvent.click(screen.getByRole('button',{name:'Crear'}));expect(screen.getByRole('dialog',{name:dialog})).toBeInTheDocument();expect(screen.getByLabelText(field).getAttribute('value')).toContain(value);expect(store.entities).toHaveLength(0);
});
it('quick capture routes an unresolved label to details and traps focus',async()=>{
 await capture();const input=screen.getByLabelText('Qué quieres recordar');fireEvent.change(input,{target:{value:'llamar #desconocida'}});expect(screen.getByText('La etiqueta no existe.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Crear'})).toBeDisabled();const close=screen.getByRole('button',{name:'Cerrar'});close.focus();fireEvent.keyDown(close,{key:'Tab',shiftKey:true});expect(screen.getByRole('button',{name:'Editar detalles'})).toHaveFocus();fireEvent.click(screen.getByRole('button',{name:'Editar detalles'}));expect(screen.getByLabelText('Título')).toHaveValue('llamar #desconocida');
});
