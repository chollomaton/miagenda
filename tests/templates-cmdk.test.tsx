import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {App} from '../src/app/App';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
import {select} from '../src/search/selectors';
async function fixture(targetKind:'Task'|'Reminder'|'Event'='Task'){
 const persistence=new MemoryPersistence(),store=new AgendaStore(persistence);await store.boot();
 const template=await store.create('Template',{name:'Rutina',definition:{targetKind,values:{title:'Preparar',notes:'Notas'}}});
 const writes=vi.spyOn(persistence,'save');render(<App providedStore={store}/>);
 return {store,template,writes};
}
function palette(query=''){
 const trigger=screen.getByRole('button',{name:'Buscar en toda Mi Agenda'});trigger.focus();fireEvent.click(trigger);
 const input=screen.getByRole('combobox');expect(input).toHaveFocus();fireEvent.change(input,{target:{value:query}});return input;
}
async function settled(store:AgendaStore){await act(async()=>{await store.flush()})}
describe('Templates CmdK',()=>{
 it.each(['Task','Reminder','Event'] as const)('%s Enter opens a prefilled normal editor; apply/cancel write nothing and save creates one entity',async targetKind=>{
  const {store,writes}=await fixture(targetKind);const before=structuredClone(store.outbox);
  let input=palette('rutina');expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.keyDown(input,{key:'Enter'});
  expect(screen.queryByRole('dialog',{name:'Búsqueda global'})).toBeNull();
  let dialog=screen.getByRole('dialog',{name:'Nueva '+({Task:'Tarea',Reminder:'Recordatorio',Event:'Evento'}[targetKind])});
  expect(within(dialog).getByLabelText('Título')).toHaveValue('Preparar');expect(within(dialog).getByLabelText('Notas')).toHaveValue('Notas');
  expect(within(dialog).getByRole('button',{name:'Cerrar'})).toHaveFocus();
  await settled(store);expect(writes).not.toHaveBeenCalled();expect(store.outbox).toEqual(before);
  fireEvent.keyDown(within(dialog).getByLabelText('Título'),{key:'Escape'});await settled(store);
  expect(screen.queryByRole('dialog')).toBeNull();expect(writes).not.toHaveBeenCalled();expect(store.outbox).toEqual(before);
  input=palette('rutina');fireEvent.keyDown(input,{key:'Enter'});dialog=screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button',{name:'Guardar'}));await settled(store);
  expect(writes).toHaveBeenCalledTimes(1);expect(store.entities).toHaveLength(2);expect(store.entities.filter(e=>e.kind===targetKind)).toHaveLength(1);expect(store.outbox).toHaveLength(before.length+1);
 });
 it('updates commands on rename, delete and restore while the palette is open',async()=>{
  const {store,template}=await fixture();const input=palette('rutina');
  expect(select(store.entities,{query:'rutina'})).toEqual([]);
  await act(()=>store.patch(template.id,{name:'Rutina nueva'}));expect(screen.getByRole('option',{name:'Crear desde plantilla: Rutina nueva'})).toBeInTheDocument();
  await act(()=>store.service.delete(template.id));expect(screen.queryAllByRole('option')).toHaveLength(0);
  await act(()=>store.service.restore(template.id));expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.change(input,{target:{value:'Preparar'}});expect(screen.queryAllByRole('option')).toHaveLength(0);
  fireEvent.change(input,{target:{value:'no coincide'}});expect(screen.queryAllByRole('option')).toHaveLength(0);
 });
 it.each([390,1280])('CmdK smoke at %s preserves base actions, navigation, Escape and focus restoration',async width=>{
  Object.defineProperty(window,'innerWidth',{value:width,configurable:true});const {store,writes}=await fixture();
  await act(()=>store.create('Template',{name:'Rutina segunda',definition:{targetKind:'Reminder',values:{}}}));writes.mockClear();
  const input=palette();expect(screen.getAllByRole('option')).toHaveLength(6);expect(screen.getByRole('option',{name:'Captura rápida'})).toBeInTheDocument();
  fireEvent.change(input,{target:{value:'rutina'}});expect(screen.getAllByRole('option')).toHaveLength(2);
  fireEvent.keyDown(input,{key:'ArrowUp'});expect(screen.getByRole('option',{name:'Crear desde plantilla: Rutina segunda'})).toHaveAttribute('aria-selected','true');
  fireEvent.keyDown(input,{key:'ArrowDown'});expect(screen.getByRole('option',{name:'Crear desde plantilla: Rutina'})).toHaveAttribute('aria-selected','true');
  fireEvent.keyDown(input,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('button',{name:'Buscar en toda Mi Agenda'})).toHaveFocus();expect(writes).not.toHaveBeenCalled();
 });
});
