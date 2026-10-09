import type {MirrorEntity} from './contract';
import {addDays,dateInZone} from '../utils/calendar';
export type ActiveMirrorEntity=Extract<MirrorEntity,{lifecycle:'active'}>;
export function title(entity:MirrorEntity):string {
 if(entity.lifecycle==='deleted')return 'Elemento eliminado';
 return 'title' in entity.payload?entity.payload.title:'name' in entity.payload?entity.payload.name:'';
}
export function active(entities:readonly MirrorEntity[]):ActiveMirrorEntity[]{return entities.filter((e):e is ActiveMirrorEntity=>e.lifecycle==='active');}
export function isTask(entity:ActiveMirrorEntity){return entity.kind==='CalendarItem'&&!entity.payload.isEvent&&!entity.payload.dueComponents;}
export function isReminder(entity:ActiveMirrorEntity){return entity.kind==='CalendarItem'&&!entity.payload.isEvent&&!!entity.payload.dueComponents;}
export function completed(entity:ActiveMirrorEntity){return entity.kind==='CalendarItem'&&entity.payload.completed;}
export function matches(entity:ActiveMirrorEntity,query:string){
 const p=entity.payload;const text=[title(entity),'notes' in p?p.notes:'','body' in p?p.body:'','captureText' in p?p.captureText:''].join(' ').toLocaleLowerCase('es');
 return text.includes(query.trim().toLocaleLowerCase('es'));
}
export function onDay(entity:ActiveMirrorEntity,day:string,zone='Europe/Madrid'):boolean {
 if(entity.kind==='TimeBlock')return spans(entity.payload.start,entity.payload.end,day,zone);
 if(entity.kind!=='CalendarItem')return false;
 const p=entity.payload;if(!p.isEvent)return !p.completed&&p.dueComponents?.date===day;
 if(p.allDay&&p.startComponents&&p.end){const civilZone=p.startComponents.timeZone??zone;return p.startComponents.date<=day&&dateInZone(new Date(Date.parse(p.end)-1).toISOString(),civilZone)>=day;}
 return !!p.start&&!!p.end&&spans(p.start,p.end,day,zone);
}
function spans(start:string,end:string,day:string,zone:string){return dateInZone(start,zone)<=day&&dateInZone(new Date(Date.parse(end)-1).toISOString(),zone)>=day;}
export function timeLabel(entity:ActiveMirrorEntity,zone='Europe/Madrid'):string {
 if(entity.kind==='CalendarItem'){
  const p=entity.payload;if(p.allDay)return 'Todo el día';
  if(p.start)return instantLabel(p.start,zone);
  if(p.dueComponents)return [p.dueComponents.date,p.dueComponents.time??''].filter(Boolean).join(' · ')+(p.dueComponents.timeZone?'':' · hora local');
 }
 if(entity.kind==='TimeBlock')return instantLabel(entity.payload.start,zone);
 return '';
}
export function instantLabel(value:string,zone='Europe/Madrid') {return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(value));}
export function mirrorRadar(entities:readonly MirrorEntity[],now:string,zone='Europe/Madrid') {
 const items=active(entities),today=dateInZone(now,zone);
 // Floating civil due dates expire after the civil day, never converted using guessed offsets.
 const overdue=items.filter(e=>e.kind==='CalendarItem'&&!e.payload.isEvent&&!e.payload.completed&&e.payload.dueComponents&&e.payload.dueComponents.date<today);
 const intervals=items.flatMap<{entity:ActiveMirrorEntity;start:string;end:string}>(e=>e.kind==='TimeBlock'?[{entity:e,start:e.payload.start,end:e.payload.end}]:e.kind==='CalendarItem'&&e.payload.isEvent&&!e.payload.allDay&&e.payload.start&&e.payload.end&&!e.payload.url?.startsWith('miagenda://timeblock/')?[{entity:e,start:e.payload.start,end:e.payload.end}]:[]).sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
 const conflicts:{first:ActiveMirrorEntity;second:ActiveMirrorEntity;start:string;end:string}[]=[];
 for(let i=0;i<intervals.length;i++)for(let j=i+1;j<intervals.length&&intervals[j].start<intervals[i].end;j++){
  const a=intervals[i],b=intervals[j];if(a.entity.id!==b.entity.id)conflicts.push({first:a.entity,second:b.entity,start:a.start>b.start?a.start:b.start,end:a.end<b.end?a.end:b.end});
 }
 return {overdue,conflicts,tomorrow:addDays(today,1)};
}
