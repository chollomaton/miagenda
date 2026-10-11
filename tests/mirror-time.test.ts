import {expect,it} from 'vitest';
import {entities} from './fixtures/mirror/helpers';
import {onDay} from '../src/mirror/selectors';
import {canonicalJSON} from '../src/mirror/canonical';
import {validateEntity} from '../src/mirror/validation';
it.each([
 ['2026-03-29','2026-03-28T23:00:00.000Z','2026-03-29T22:00:00.000Z'],
 ['2026-10-25','2026-10-24T22:00:00.000Z','2026-10-25T23:00:00.000Z'],
])('all-day %s remains its civil date in viewers across timezones', (day,start,end)=>{const e=structuredClone(entities.find(e=>e.kind==='CalendarItem'&&e.lifecycle==='active'&&e.payload.isEvent)!);if(e.kind!=='CalendarItem'||e.lifecycle!=='active')throw Error();Object.assign(e.payload,{start,end,allDay:true,startComponents:{date:day,time:null,timeZone:'Europe/Madrid'}});for(const viewer of ['Europe/Madrid','America/Los_Angeles','Asia/Tokyo']){expect(onDay(e,day,viewer)).toBe(true);expect(onDay(e,new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10),viewer)).toBe(false);}});
it('rejects fractional alarm seconds and unsafe integers in both validation and canonical wire',()=>{for(const value of [0.5,9007199254740992,Infinity])expect(()=>canonicalJSON({relative:value})).toThrow();const e=structuredClone(entities[0]);if(e.kind==='CalendarItem'&&e.lifecycle==='active'){e.payload.alarms=[{absolute:null,relative:-0.5}];expect(()=>validateEntity(e)).toThrow('INVALID_ALARM');}});
