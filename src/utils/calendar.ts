import {utc} from '../models/entities';
import type {Entity,AgendaEntity} from '../models/entities';
export function dateInZone(utc:string|null,timezone:string){return utc?new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(utc)):''}
export function addDays(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function wallToUTC(local:string,timezone:string):string {const desired=Date.parse(local+'Z');if(!Number.isFinite(desired))throw Error('INVALID_DATE');let t=desired;for(let i=0;i<4;i++){const p=new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(t)).replace(' ','T');const delta=desired-Date.parse(p+'Z');if(!delta)return new Date(t).toISOString();t+=delta}throw Error('NONEXISTENT_LOCAL_TIME')}
export function wallTime(utc:string,timezone:string){return new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(utc)).replace(' ','T')}
export interface Occurrence {entity:AgendaEntity;date:string;start:string|null;end:string|null;key:string}
export function occurrences(entity:Entity,from:string,to:string):Occurrence[]{if(entity.kind==='Template')return [];const f=entity.fields,initial=f.allDay?f.startDate:dateInZone(f.start??f.due,f.timezone);if(!initial||entity.lifecycle==='deleted')return [];const r=f.recurrence,result:Occurrence[]=[];let n=0;const startDate=new Date(initial+'T12:00:00Z');for(let day=initial,steps=0;day<=to&&steps<200000;day=addDays(day,1),steps++){const d=new Date(day+'T12:00:00Z'),days=Math.round((+d-+startDate)/86400000),months=(d.getUTCFullYear()-startDate.getUTCFullYear())*12+d.getUTCMonth()-startDate.getUTCMonth();let match=day===initial;if(r){if(r.until&&day>r.until)break;if(r.frequency==='daily')match=days%r.interval===0;if(r.frequency==='weekly')match=Math.floor(days/7)%r.interval===0&&(r.weekdays.length?r.weekdays:[startDate.getUTCDay()]).includes(d.getUTCDay());if(r.frequency==='monthly')match=months%r.interval===0&&d.getUTCDate()===(r.monthDay??startDate.getUTCDate());if(r.frequency==='yearly')match=(d.getUTCFullYear()-startDate.getUTCFullYear())%r.interval===0&&d.getUTCMonth()===startDate.getUTCMonth()&&d.getUTCDate()===startDate.getUTCDate()}if(match){n++;if(r?.count&&n>r.count)break;if(day>=from&&!r?.exceptions.includes(day)){let start=f.start??f.due,end=f.end;if(start&&r){try{start=wallToUTC(day+'T'+wallTime(start,f.timezone).slice(11),f.timezone);end=f.end&&f.start?new Date(Date.parse(start)+Date.parse(f.end)-Date.parse(f.start)).toISOString():null}catch{continue}}result.push({entity,date:day,start,end,key:entity.id+':'+day})}}if(!r)break}return result}
export function overlapColumns<T extends {start:string|null;end:string|null}>(items:T[]){const ends:number[]=[];return [...items].sort((a,b)=>String(a.start).localeCompare(String(b.start))).map(item=>{const start=Date.parse(item.start??''),end=Date.parse(item.end??item.start??'')||start+60000;let column=ends.findIndex(v=>v<=start);if(column<0)column=ends.length;ends[column]=end;return {...item,column}})}

export function addMonths(date:string,amount:number){const d=new Date(date+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+amount);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)}
export function coversDate(o:Occurrence,date:string,timezone=o.entity.fields.timezone){if(o.entity.fields.allDay){const days=Math.max(1,(Date.parse(o.entity.fields.endDate!)-Date.parse(o.entity.fields.startDate!))/86400000);return date>=o.date&&date<addDays(o.date,days)}if(o.start&&o.end){const zone=timezone;return date>=dateInZone(o.start,zone)&&date<=dateInZone(new Date(Date.parse(o.end)-1).toISOString(),zone)}return o.start?dateInZone(o.start,timezone)===date:o.date===date}

export interface ScheduledTaskBlock {
 kind:'scheduled-task'; taskId:string; title:string; startAt:string; endAt:string;
 durationMinutes:number; timezone:string; start:string; end:string; key:string;
}
export type TimelineItem = Occurrence | ScheduledTaskBlock;
export function scheduledTaskBlock(entity:Entity):ScheduledTaskBlock|null {
 if(entity.kind!=='Task'||entity.lifecycle!=='active'||entity.fields.completed||entity.fields.recurrence)return null;
 const {scheduledStartAt:startAt,scheduledDurationMinutes:durationMinutes,scheduledTimezone:timezone}=entity.fields;
 if(!utc(startAt)||typeof durationMinutes!=='number'||!Number.isFinite(durationMinutes)||durationMinutes<=0||!timezone)return null;
 try {
  new Intl.DateTimeFormat('en',{timeZone:timezone}).format();
  const endAt=new Date(Date.parse(startAt)+durationMinutes*60000).toISOString();
  return {kind:'scheduled-task',taskId:entity.id,title:entity.fields.title,startAt,endAt,durationMinutes,timezone,start:startAt,end:endAt,key:'scheduled-task:'+entity.id};
 }catch{return null}
}
export function timelineCoversDate(item:TimelineItem,date:string,timezone:string) {
 if('entity' in item)return coversDate(item,date,timezone);
 return date>=dateInZone(item.startAt,timezone)&&date<=dateInZone(new Date(Date.parse(item.endAt)-1).toISOString(),timezone);
}
