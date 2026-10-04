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
 it('opens global search by Control K and escapes text',async()=>{const store=await app();await store.create('Task',{title:'<script>synthetic</script>'});fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getByRole('dialog',{name:'Búsqueda global'})).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Buscar en Mi Agenda'),{target:{value:'synthetic'}});expect(screen.getByRole('button',{name:'Tarea · <script>synthetic</script>'})).toBeInTheDocument();expect(document.querySelectorAll('script')).toHaveLength(0)});
 it('renders recoverable error boundary',()=>{function Broken():never{throw Error('Synthetic render failure')}const log=vi.spyOn(console,'error').mockImplementation(()=>{});try{render(<ErrorBoundary><Broken/></ErrorBoundary>);expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido mostrar Mi Agenda')}finally{log.mockRestore()}});
});

it('global search traps focus and Escape restores the trigger',async()=>{await app();const trigger=screen.getByRole('button',{name:'Buscar en toda Mi Agenda'});trigger.focus();fireEvent.click(trigger);const input=screen.getByLabelText('Buscar en Mi Agenda'),close=screen.getByRole('button',{name:'Cerrar'});expect(input).toHaveFocus();fireEvent.keyDown(input,{key:'Tab',shiftKey:true});expect(close).toHaveFocus();fireEvent.keyDown(close,{key:'Tab'});expect(input).toHaveFocus();fireEvent.keyDown(input,{key:'Escape'});expect(trigger).toHaveFocus();expect(screen.queryByRole('dialog')).toBeNull()});
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
