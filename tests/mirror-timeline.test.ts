import {describe,it,expect} from 'vitest';
import fixture from './fixtures/mirror/full-snapshot.json';
import {mirrorTimeline} from '../src/mirror/timeline';
import type {ActiveMirrorEntity} from '../src/mirror/selectors';
function event(id:string,start:string,end:string):ActiveMirrorEntity {const e=structuredClone(fixture.entities.find(e=>e.kind==='CalendarItem'&&e.payload&&'isEvent'in e.payload&&e.payload.isEvent)!) as ActiveMirrorEntity;if(e.kind!=='CalendarItem')throw Error('fixture');e.id=id;e.payload.start=start;e.payload.end=end;e.payload.allDay=false;return e;}
describe('mirror timeline uses the actual civil day',()=>{
 it('shows spring DST as 23 hours and autumn DST as 25 distinct offset hours',()=>{expect(mirrorTimeline([],'2026-03-29').minutes).toBe(1380);const fall=mirrorTimeline([],'2026-10-25');expect(fall.minutes).toBe(1500);expect(fall.hours.filter(h=>h.label.startsWith('02:00')).map(h=>h.label)).toEqual(['02:00 GMT+2','02:00 GMT+1']);});
 it('clips multiday intervals without adding or duplicating occurrences',()=>{const e=event('overnight','2026-10-08T21:00:00.000Z','2026-10-09T01:00:00.000Z');const t=mirrorTimeline([e],'2026-10-09');expect(t.entries).toHaveLength(1);expect(t.entries[0].minute).toBe(0);expect(t.entries[0].duration).toBe(180);});
 it('keeps overlapping events accessible in separate lanes',()=>{const t=mirrorTimeline([event('a','2026-10-09T08:00:00.000Z','2026-10-09T09:00:00.000Z'),event('b','2026-10-09T08:30:00.000Z','2026-10-09T09:30:00.000Z')],'2026-10-09');expect(t.columns).toBe(2);expect(t.entries.map(e=>e.column)).toEqual([0,1]);});
 it('does not re-expand materialized recurrence rules',()=>{const e=event('single','2026-10-09T08:00:00.000Z','2026-10-09T09:00:00.000Z');expect(mirrorTimeline([e],'2026-10-10').entries).toHaveLength(0);});
});
