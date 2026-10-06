import {civil,validate} from '../models/entities';
import type {AgendaEntity,Entity} from '../models/entities';
import {dateInZone,scheduledTaskBlock} from '../utils/calendar';

export interface RadarInterval {entity:AgendaEntity;start:string;end:string}
export interface RadarConflict {key:string;first:RadarInterval;second:RadarInterval;start:string;end:string}
// Civil dates expire only after their local day ends. Persisted due currently accepts UTC only.
export function isOverdue(due:string|null,now:string,timezone:string):boolean {
 if(!due)return false;
 return civil(due)?due<dateInZone(now,timezone):Date.parse(due)<Date.parse(now);
}
export function selectRadar(entities:readonly Entity[],now:string,timezone:string) {
 const active:AgendaEntity[]=[];
 for(const entity of entities){
  try{validate(entity)}catch{continue}
  if(entity.kind!=='Template'&&entity.lifecycle==='active'&&!entity.fields.completed)active.push(entity);
 }
 const overdueItems=active.filter(e=>(e.kind==='Task'||e.kind==='Reminder')&&isOverdue(e.fields.due,now,timezone));
 const intervals:RadarInterval[]=active.flatMap(entity=>{
  const block=scheduledTaskBlock(entity);
  if(block)return [{entity,start:block.startAt,end:block.endAt}];
  if(entity.kind==='Event'&&!entity.fields.allDay&&entity.fields.start&&entity.fields.end)return [{entity,start:entity.fields.start,end:entity.fields.end}];
  return [];
 }).sort((a,b)=>a.start.localeCompare(b.start)||a.entity.id.localeCompare(b.entity.id));
 const conflicts:RadarConflict[]=[];
 for(let i=0;i<intervals.length;i++)for(let j=i+1;j<intervals.length;j++){
  const first=intervals[i],second=intervals[j];
  if(second.start>=first.end)break;
  if(first.entity.id!==second.entity.id&&first.start<second.end&&second.start<first.end){
   conflicts.push({key:[first.entity.id,second.entity.id].sort().join(':'),first,second,start:first.start>second.start?first.start:second.start,end:first.end<second.end?first.end:second.end});
  }
 }
 return {overdueItems,conflicts,counts:{overdue:overdueItems.length,conflicts:conflicts.length}};
}
