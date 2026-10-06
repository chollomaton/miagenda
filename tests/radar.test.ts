import {describe,expect,it} from 'vitest';
import {createEntity} from '../src/models/entities';
import type {AgendaEntity,Entity} from '../src/models/entities';
import {integrity} from '../src/recovery/integrity';
import {isOverdue,selectRadar} from '../src/radar/selectRadar';
const now='2026-10-05T12:00:00.000Z',start='2026-10-05T08:00:00.000Z',end='2026-10-05T09:00:00.000Z',zone='Europe/Madrid';
const radar=(entities:Entity[])=>selectRadar(entities,now,zone);
const event=()=>createEntity('Event',{title:'Reunión',start,end});
const task=()=>createEntity('Task',{title:'Bloque',scheduledStartAt:start,scheduledDurationMinutes:60,scheduledTimezone:zone});
describe('overdue',()=>{
 it('uses due instant strictly before now for tasks and reminders',()=>{const entities=[createEntity('Task',{due:start}),createEntity('Reminder',{due:start}),createEntity('Task',{due:now})];expect(radar(entities).overdueItems).toEqual(entities.slice(0,2))});
 it('past scheduling with absent or future due does not expire',()=>{const a=task(),b=task();b.fields.due='2026-10-06T08:00:00.000Z';expect(radar([a,b]).overdueItems).toEqual([])});
 it.each(['Task','Reminder'] as const)('excludes completed and deleted %s',kind=>{const a=createEntity(kind,{due:start,completed:true}),b=createEntity(kind,{due:start});b.lifecycle='deleted';expect(radar([a,b]).overdueItems).toEqual([])});
 it('excludes invalid records and store quarantine',()=>{const bad=createEntity('Task',{due:start});bad.fields.timezone='invalid';const checked=integrity([bad,{}]);expect(checked.quarantine).toHaveLength(2);expect(radar(checked.entities).counts.overdue).toBe(0);expect(radar([bad,{} as Entity]).counts.overdue).toBe(0)});
 it('civil due expires at local midnight, including DST and a zone different from UTC',()=>{expect(isOverdue('2026-10-05','2026-10-05T21:59:59.999Z',zone)).toBe(false);expect(isOverdue('2026-10-05','2026-10-05T22:00:00.000Z',zone)).toBe(true);expect(isOverdue('2026-10-25','2026-10-25T22:59:59.999Z',zone)).toBe(false);expect(isOverdue('2026-10-25','2026-10-25T23:00:00.000Z',zone)).toBe(true)});
 it('does not reinterpret invalid civil due as a valid stored entity',()=>{const a=createEntity('Task');a.fields.due='2026-10-05';expect(radar([a]).overdueItems).toEqual([])});
});
describe('conflicts',()=>{
 it.each([[event,event],[event,task],[task,task]])('compares each real interval pairing', (first,second)=>{const a=first(),b=second();const c=radar([a,b]).conflicts;expect(c).toHaveLength(1);expect([c[0].first.entity,c[0].second.entity]).toContain(a);expect([c[0].first.entity,c[0].second.entity]).toContain(b)});
 it('does not conflict at touching endpoints',()=>{const a=event(),b=event();b.fields.start=end;b.fields.end='2026-10-05T10:00:00.000Z';expect(radar([a,b]).conflicts).toEqual([])});
 it('excludes all-day events',()=>{const a=createEntity('Event',{allDay:true,startDate:'2026-10-05',endDate:'2026-10-06'});expect(radar([a,task()]).conflicts).toEqual([])});
 it.each(['completed','deleted','invalid'])('excludes %s scheduled tasks and events',state=>{const a=task(),b=event();for(const e of [a,b]){if(state==='completed')e.fields.completed=true;else if(state==='deleted')e.lifecycle='deleted';else e.fields.timezone='invalid'}expect(radar([a,b,task()]).conflicts).toEqual([])});
 it('produces three unique pairs from three blocks without mutating inputs',()=>{const entities:AgendaEntity[]=[task(),event(),task()],before=structuredClone(entities);const result=radar(entities);expect(result.conflicts).toHaveLength(3);expect(new Set(result.conflicts.map(c=>c.key)).size).toBe(3);expect(entities).toEqual(before)});
});
