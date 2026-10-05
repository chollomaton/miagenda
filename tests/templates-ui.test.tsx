import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {App} from '../src/app/App';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
import type {Template,TemplateDefinition} from '../src/models/entities';
import {select} from '../src/search/selectors';
import {templateToDraft} from '../src/models/templateDraft';
async function fixture(definition?:TemplateDefinition){
 const persistence=new MemoryPersistence(),store=new AgendaStore(persistence);await store.boot();
 const template=definition?await store.create('Template',{name:'Rutina',definition}) as Template:undefined;
 const writes=vi.spyOn(persistence,'save');
 render(<App providedStore={store}/>);
 fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Ajustes'}));
 fireEvent.click(screen.getByRole('button',{name:'Plantillas'}));
 return {store,template,writes};
}
async function settled(store:AgendaStore){await act(async()=>{await store.flush()})}
function edit(){fireEvent.click(screen.getByRole('button',{name:/Rutina/}))}
function saveTemplate(){fireEvent.click(screen.getByRole('button',{name:'Guardar plantilla'}))}
function useTemplate(){edit();fireEvent.click(screen.getByRole('button',{name:'Usar plantilla'}));return screen.getByRole('dialog')}
describe('Templates Settings UI',()=>{
 it('adds only a settings panel, lists name and type, creates exactly one Template',async()=>{
  const {store,writes}=await fixture();
  expect(within(screen.getByRole('navigation',{name:'Secciones'})).queryByRole('button',{name:'Plantillas'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Nueva plantilla'}));fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Rutina'}});fireEvent.change(screen.getByLabelText('Título opcional'),{target:{value:'Preparar'}});
  saveTemplate();await settled(store);
  expect(store.entities).toHaveLength(1);expect(store.entities[0]).toMatchObject({kind:'Template',fields:{name:'Rutina',definition:{targetKind:'Task',values:{title:'Preparar'}}}});expect(writes).toHaveBeenCalledTimes(1);expect(store.outbox).toHaveLength(1);
  const row=screen.getByRole('button',{name:'Rutina Tarea'});expect(within(row).getByText('Tarea')).toBeInTheDocument();
 });
 it('edits only Template and no-op save causes no persistence or outbox operation',async()=>{
  const {store,writes,template}=await fixture({targetKind:'Task',values:{title:'Preparar'}});const task=await act(()=>store.create('Task',{title:'Independiente'}));const snapshot=structuredClone(store.entities.find(e=>e.id===task.id));writes.mockClear();
  edit();saveTemplate();await settled(store);expect(writes).not.toHaveBeenCalled();expect(store.outbox).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Rutina editada'}});saveTemplate();await settled(store);expect(writes).toHaveBeenCalledTimes(1);expect(store.entities.find(e=>e.id===task.id)).toEqual(snapshot);expect((store.entities.find(e=>e.id===template!.id) as Template).fields.name).toBe('Rutina editada');
 });
 it('switches Task to Event preserving only common values, drops priority and hidden defaults',async()=>{
  const {store}=await fixture({targetKind:'Task',values:{title:'Título',notes:'Notas',labelIDs:[],priority:3}});edit();fireEvent.change(screen.getByLabelText('Tipo'),{target:{value:'Event'}});expect(screen.queryByLabelText('Prioridad')).toBeNull();saveTemplate();await settled(store);
  expect((store.entities[0] as Template).fields.definition).toEqual({targetKind:'Event',values:{title:'Título',notes:'Notas',labelIDs:[]}});
  fireEvent.change(screen.getByLabelText('Lugar'),{target:{value:'Oficina'}});fireEvent.change(screen.getByLabelText('Duración (minutos)'),{target:{value:'45'}});fireEvent.change(screen.getByLabelText('Tipo'),{target:{value:'Reminder'}});saveTemplate();await settled(store);
  expect((store.entities[0] as Template).fields.definition).toEqual({targetKind:'Reminder',values:{title:'Título',notes:'Notas',labelIDs:[]}});
 });
 it('deletes by tombstone and restores from the existing Settings trash',async()=>{
  const {store,template}=await fixture({targetKind:'Task',values:{}});edit();fireEvent.click(screen.getByRole('button',{name:'Eliminar plantilla'}));await settled(store);
  expect(store.entities.find(e=>e.id===template!.id)?.lifecycle).toBe('deleted');expect(screen.queryByRole('button',{name:'Rutina Tarea'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Datos y recuperación'}));expect(screen.getByText('Rutina')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Restaurar'}));await settled(store);
  expect(store.entities[0].lifecycle).toBe('active');fireEvent.click(screen.getByRole('button',{name:'Plantillas'}));expect(screen.getByRole('button',{name:'Rutina Tarea'})).toBeInTheDocument();
 });
 it.each(['Task','Reminder','Event'] as const)('%s apply and cancel make zero writes; save creates exactly one normal entity',async targetKind=>{
  const {store,writes}=await fixture({targetKind,values:{title:'Preparar',notes:'Notas'}});
  let dialog=useTemplate();expect(within(dialog).getByLabelText('Título')).toHaveValue('Preparar');expect(within(dialog).getByLabelText('Notas')).toHaveValue('Notas');expect(writes).not.toHaveBeenCalled();expect(store.outbox).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole('button',{name:'Cerrar'}));await settled(store);expect(writes).not.toHaveBeenCalled();expect(store.entities).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Usar plantilla'}));dialog=screen.getByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Guardar'}));await settled(store);
  expect(writes).toHaveBeenCalledTimes(1);expect(store.entities.filter(e=>e.kind===targetKind)).toHaveLength(1);expect(store.outbox).toHaveLength(2);
  const created=structuredClone(store.entities.find(e=>e.kind===targetKind));fireEvent.change(screen.getByLabelText('Título opcional'),{target:{value:'Otro título'}});saveTemplate();await settled(store);expect(store.entities.find(e=>e.kind===targetKind)).toEqual(created);
 });
 it('Event duration is relative to normal editor start and location, URL and alerts remain editable',async()=>{
  const {store,writes}=await fixture({targetKind:'Event',values:{title:'Sesión'},durationMinutes:90});edit();
  fireEvent.change(screen.getByLabelText('Lugar'),{target:{value:'Oficina'}});fireEvent.change(screen.getByLabelText('Enlace'),{target:{value:'https://example.com'}});fireEvent.change(screen.getByLabelText('Aviso (minutos antes)'),{target:{value:'15'}});saveTemplate();await settled(store);writes.mockClear();
  fireEvent.click(screen.getByRole('button',{name:'Usar plantilla'}));const dialog=screen.getByRole('dialog');
  const start=(within(dialog).getByLabelText('Inicio') as HTMLInputElement).value,end=(within(dialog).getByLabelText('Fin') as HTMLInputElement).value;expect(Date.parse(end)-Date.parse(start)).toBe(90*60000);expect(writes).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button',{name:'Guardar'}));await settled(store);expect(store.entities.find(e=>e.kind==='Event')).toMatchObject({fields:{location:'Oficina',url:'https://example.com',alerts:[15]}});
 });
 it('preserves Reminder reusable recurrence and applies it with a fresh due, no until/exceptions',async()=>{
  const recurrence={frequency:'weekly' as const,interval:2,weekdays:[1],monthDay:null,count:5};const {store,template,writes}=await fixture({targetKind:'Reminder',values:{title:'Revisión'},recurrence});
  expect(templateToDraft(template!)).toMatchObject({recurrence});edit();expect(screen.queryByLabelText('Repetición')).toBeNull();saveTemplate();await settled(store);expect(writes).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Usar plantilla'}));const dialog=screen.getByRole('dialog');expect(within(dialog).getByLabelText('Repetición')).toHaveValue('weekly');expect(within(dialog).getByLabelText('Hasta')).toHaveValue('');fireEvent.click(within(dialog).getByRole('button',{name:'Guardar'}));await settled(store);
  const reminder=store.entities.find(e=>e.kind==='Reminder');expect(reminder).toMatchObject({fields:{recurrence:{...recurrence,until:null,exceptions:[]}}});expect(reminder?.fields.due).toBeTruthy();
 });
 it('preserves deleted and missing label IDs on edit and omits unavailable labels only in the draft',async()=>{
  const {store,writes}=await fixture();const label=await act(()=>store.create('Label',{title:'Archivada'}));await act(()=>store.service.delete(label.id));const missing=crypto.randomUUID();const template=await act(()=>store.create('Template',{name:'Rutina',definition:{targetKind:'Task',values:{title:'Trabajo',labelIDs:[label.id,missing]}}}));writes.mockClear();
  edit();expect(screen.getByText(/2 etiqueta\(s\) no disponible/)).toBeInTheDocument();saveTemplate();await settled(store);expect(writes).not.toHaveBeenCalled();expect((store.entities.find(e=>e.id===template.id) as Template).fields.definition.values.labelIDs).toEqual([label.id,missing]);
  fireEvent.click(screen.getByRole('button',{name:'Usar plantilla'}));const dialog=screen.getByRole('dialog');expect(writes).not.toHaveBeenCalled();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar'}));await settled(store);expect(store.entities.find(e=>e.kind==='Task')?.fields.labelIDs).toEqual([]);expect((store.entities.find(e=>e.id===template.id) as Template).fields.definition.values.labelIDs).toEqual([label.id,missing]);
 });
 it('selects labels by ID and preserves extra alert defaults until explicitly changed',async()=>{
  const {store}=await fixture({targetKind:'Reminder',values:{title:'Aviso',alerts:[10,30]}});const label=await act(()=>store.create('Label',{title:'Casa'}));edit();fireEvent.click(screen.getByLabelText('Casa'));fireEvent.change(screen.getByLabelText('Aviso (minutos antes)'),{target:{value:'15'}});saveTemplate();await settled(store);expect((store.entities.find(e=>e.kind==='Template') as Template).fields.definition.values).toMatchObject({labelIDs:[label.id],alerts:[15,30]});
 });
 it('rejects zero duration without a write',async()=>{
  const {store,writes}=await fixture({targetKind:'Event',values:{}});edit();fireEvent.change(screen.getByLabelText('Duración (minutos)'),{target:{value:'0'}});fireEvent.submit(screen.getByRole('form',{name:'Editor de plantilla'}));await settled(store);expect(writes).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('No se ha guardado');
 });
 it.each([390,1280])('responsive smoke at %s keeps list/detail and back controls usable',async width=>{
  Object.defineProperty(window,'innerWidth',{value:width,configurable:true});await fixture({targetKind:'Task',values:{}});edit();expect(document.querySelector('.templates-layout')).toHaveClass('show-detail');fireEvent.click(screen.getByRole('button',{name:'← Plantillas'}));expect(document.querySelector('.templates-layout')).not.toHaveClass('show-detail');expect(screen.getByRole('button',{name:'Rutina Tarea'})).toBeInTheDocument();
 });
 it('never returns a Template in global search or commands',async()=>{
  const {store}=await fixture({targetKind:'Task',values:{title:'Rutina'}});expect(select(store.entities,{query:'Rutina'})).toEqual([]);
  fireEvent.click(screen.getByRole('button',{name:'Buscar en toda Mi Agenda'}));fireEvent.change(screen.getByRole('combobox'),{target:{value:'Rutina'}});expect(screen.queryAllByRole('option')).toHaveLength(0);
 });
});
