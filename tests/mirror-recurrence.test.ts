import {expect,it} from 'vitest';
import {projectReminder} from '../src/mirror/recurrence';
import type {MirrorRecurrence} from '../src/mirror/contract';
import {entities} from './fixtures/mirror/helpers';
import {onDay} from '../src/mirror/selectors';
import {validateEntity} from '../src/mirror/validation';
const rule=(value:Partial<MirrorRecurrence>={}):MirrorRecurrence=>({frequency:0,interval:1,endDate:null,occurrenceCount:0,weekdays:[],weekNumbers:[],monthDays:null,yearDays:null,yearWeeks:null,months:null,positions:null,firstWeekday:2,...value});
const anchor={date:'2026-03-27',time:'09:00:00',timeZone:'Europe/Madrid'};
it.each([
 ['daily',{},'2026-03-27','2026-03-30',['2026-03-27','2026-03-28','2026-03-29','2026-03-30']],
 ['interval',{interval:2},'2026-03-27','2026-04-01',['2026-03-27','2026-03-29','2026-03-31']],
 ['weekly',{frequency:1,weekdays:[2],weekNumbers:[0]},'2026-03-27','2026-04-10',['2026-03-30','2026-04-06']],
 ['monthly',{frequency:2},'2026-03-27','2026-06-01',['2026-03-27','2026-04-27','2026-05-27']],
 ['yearly',{frequency:3},'2026-03-27','2027-03-27',['2026-03-27','2027-03-27']],
 ['ordinal',{frequency:2,weekdays:[2],weekNumbers:[-1]},'2026-03-27','2026-05-01',['2026-03-30','2026-04-27']],
 ['count',{occurrenceCount:3},'2026-03-29','2026-04-05',['2026-03-29']],
 ['end-date',{endDate:'2026-03-29T07:00:00.000Z'},'2026-03-27','2026-04-05',['2026-03-27','2026-03-28','2026-03-29']],
] as [string,Partial<MirrorRecurrence>,string,string,string[]][])('%s projects only the requested window',(_,r,from,to,dates)=>{expect(projectReminder(anchor,rule(r),from,to)).toEqual({dates,limitation:null});});
it('preserves civil 09:00 over Madrid DST spring and fall and skips nonexistent local times',()=>{
 expect(projectReminder({...anchor,time:'02:30:00'},rule(), '2026-03-28','2026-03-30').dates).toEqual(['2026-03-28','2026-03-30']);
 expect(projectReminder({date:'2026-10-24',time:'09:00:00',timeZone:'Europe/Madrid'},rule({endDate:'2026-10-25T08:00:00.000Z'}),'2026-10-24','2026-10-27').dates).toEqual(['2026-10-24','2026-10-25']);
 expect(projectReminder({...anchor,time:null},rule({occurrenceCount:3}),'2026-03-27','2026-04-01').dates).toHaveLength(3);
});
it('does not re-expand EventKit occurrences, including a moved detached event',()=>{
 const e=structuredClone(entities.find(e=>e.kind==='CalendarItem'&&e.lifecycle==='active'&&e.payload.isEvent)!);
 if(e.kind!=='CalendarItem'||e.lifecycle!=='active')throw Error();
 Object.assign(e.payload,{start:'2026-03-30T10:00:00.000Z',end:'2026-03-30T11:00:00.000Z',allDay:false,recurrence:[rule()],occurrence:{originalStart:'2026-03-29T07:00:00.000Z',detached:true}});
 expect(()=>validateEntity(e)).not.toThrow();expect(onDay(e,'2026-03-29')).toBe(false);expect(onDay(e,'2026-03-30')).toBe(true);expect(onDay(e,'2026-03-31')).toBe(false);
 e.payload.occurrence!.originalStart=null;expect(()=>validateEntity(e)).toThrow('INVALID_OCCURRENCE');
});
it('reports budgets and unsupported selectors instead of inventing occurrences',()=>{
 expect(projectReminder(anchor,rule(),'2026-01-01','2028-01-01').limitation).toBe('window-limit');
 expect(projectReminder({...anchor,date:'1800-01-01'},rule(),'2026-01-01','2026-01-02').limitation).toBe('scan-limit');
 expect(projectReminder(anchor,rule({yearWeeks:[1]}),'2026-03-27','2026-03-29').limitation).toBe('year-week-or-day-selector');
});
it('projects only reminder series with an explicitly known origin; legacy/native due dates stay concrete',()=>{
 const e=structuredClone(entities.find(e=>e.kind==='CalendarItem'&&e.lifecycle==='active'&&!e.payload.isEvent)!);
 if(e.kind!=='CalendarItem'||e.lifecycle!=='active')throw Error();
 Object.assign(e.payload,{completed:false,dueComponents:anchor,recurrence:[rule({occurrenceCount:3})],recurrenceMode:'materialized'});
 expect(onDay(e,'2026-03-28')).toBe(false);
 e.payload.recurrenceMode='series';expect(()=>validateEntity(e)).not.toThrow();expect(onDay(e,'2026-03-28')).toBe(true);expect(onDay(e,'2026-03-30')).toBe(false);
});
it('applies set positions to the entire period before trimming the series origin',()=>{
 expect(projectReminder(anchor,rule({frequency:2,weekdays:[2],weekNumbers:[0],positions:[1]}),'2026-03-27','2026-05-01').dates).toEqual(['2026-04-06']);
});
