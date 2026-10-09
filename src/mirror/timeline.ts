import {addDays,wallToUTC,overlapColumns} from '../utils/calendar';
import type {ActiveMirrorEntity} from './selectors';
export function mirrorTimeline(items:ActiveMirrorEntity[],day:string,zone='Europe/Madrid'){
 const start=Date.parse(wallToUTC(day+'T00:00:00',zone)),end=Date.parse(wallToUTC(addDays(day,1)+'T00:00:00',zone));
 const minutes=(end-start)/60000;
 const format=new Intl.DateTimeFormat('es',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const offset=new Intl.DateTimeFormat('es',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'});
 const hours=Array.from({length:Math.ceil(minutes/60)},(_,i)=>({minute:i*60,instant:start+i*3600000,label:format.format(start+i*3600000)}));
 const labels=hours.map(hour=>hour.label);for(const hour of hours)if(labels.filter(label=>label===hour.label).length>1)hour.label=offset.format(hour.instant);
 const raw=items.flatMap(entity=>{
  const range=entity.kind==='TimeBlock'?{start:entity.payload.start,end:entity.payload.end}:entity.kind==='CalendarItem'&&entity.payload.isEvent&&!entity.payload.allDay&&entity.payload.start&&entity.payload.end?{start:entity.payload.start,end:entity.payload.end}:null;
  if(!range)return [];const from=Math.max(start,Date.parse(range.start)),to=Math.min(end,Date.parse(range.end));if(to<=from)return [];
  return [{entity,start:new Date(from).toISOString(),end:new Date(to).toISOString(),minute:(from-start)/60000,duration:(to-from)/60000}];
 });
 const entries=overlapColumns(raw),columns=Math.max(1,...entries.map(e=>e.column+1));
 return {minutes,hours,entries,columns};
}
