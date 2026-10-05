import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
import type {Template} from '../src/models/entities';
import {describe,expect,it,vi} from 'vitest';
import {createCommandRegistry,matchingCommands,templateCommands} from '../src/commands/registry';
describe('command registry',()=>{
 it('has unique stable IDs and routes each command to its callback',()=>{
  const callbacks={'task.new':vi.fn(),'reminder.new':vi.fn(),'event.new':vi.fn(),'note.new':vi.fn(),'quickCapture.open':vi.fn(),'calendar.today':vi.fn()};
  const commands=createCommandRegistry(callbacks);
  expect(commands.map(command=>command.id)).toEqual(Object.keys(callbacks));
  expect(new Set(commands.map(command=>command.id)).size).toBe(6);
  for(const command of commands){command.execute();expect(callbacks[command.id]).toHaveBeenCalledTimes(1)}
 });
 it('matches labels using existing normalization and preserves order',()=>{
  const noop=()=>{};const commands=createCommandRegistry({'task.new':noop,'reminder.new':noop,'event.new':noop,'note.new':noop,'quickCapture.open':noop,'calendar.today':noop});
  expect(matchingCommands(commands,'')).toHaveLength(6);
  expect(matchingCommands(commands,'  NÚEVA   TAREA ')).toEqual([commands[0]]);
  expect(matchingCommands(commands,'nuevo').map(command=>command.id)).toEqual(['reminder.new','event.new']);
  expect(matchingCommands(commands,'crear')[0].id).toBe('quickCapture.open');
  expect(matchingCommands(commands,'unknown')).toEqual([]);
 });
});

describe('dynamic template commands',()=>{
 it('filters by normalized name and lifecycle, validates, and derives fresh labels without writes',async()=>{
  const store=new AgendaStore(new MemoryPersistence());await store.boot();
  const template=await store.create('Template',{name:'Reunión semanal',definition:{targetKind:'Event',values:{title:'Sesión'}}});
  const apply=vi.fn();
  expect(templateCommands(store.entities,'',apply)).toEqual([]);
  expect(templateCommands(store.entities,'   ',apply)).toEqual([]);
  expect(templateCommands(store.entities,'sesión',apply)).toEqual([]);
  expect(templateCommands(store.entities,'unknown',apply)).toEqual([]);
  const [command]=templateCommands(store.entities,' REUNION ',apply);
  expect(command.label).toBe('Crear desde plantilla: Reunión semanal');command.execute();expect(apply).toHaveBeenCalledWith(template);
  expect(templateCommands([{...template,fields:{...template.fields,definition:{targetKind:'Event',values:{},durationMinutes:0}}} as Template],'reunión',apply)).toEqual([]);
  await store.service.delete(template.id);expect(templateCommands(store.entities,'reunión',apply)).toEqual([]);
  await store.service.restore(template.id);expect(templateCommands(store.entities,'reunión',apply)[0].id).toBe(command.id);
  await store.patch(template.id,{name:'Revisión'});
  expect(templateCommands(store.entities,'reunión',apply)).toEqual([]);
  expect(templateCommands(store.entities,'revision',apply)[0].label).toBe('Crear desde plantilla: Revisión');
  expect(templateCommands([], 'revision',apply)).toEqual([]);
 });
});
