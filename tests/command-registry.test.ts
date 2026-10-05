import {describe,expect,it,vi} from 'vitest';
import {createCommandRegistry,matchingCommands} from '../src/commands/registry';
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
