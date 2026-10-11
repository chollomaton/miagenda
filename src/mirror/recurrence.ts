import type {MirrorCivilTime,MirrorRecurrence} from './contract';
import {addDays,dateInZone,wallToUTC} from '../utils/calendar';
/** nativas events are already materialized. This projector is only for reminder civil dates.
 * Work and output are bounded, including counting occurrences before the visible window.
 * Unsupported selectors and exhausted budgets are explicit, never approximated.
 */
export interface RecurrenceProjection {dates:string[]; limitation:string|null}
export function projectReminder(anchor:MirrorCivilTime,r:MirrorRecurrence,from:string,to:string):RecurrenceProjection {
 const none=(limitation:string):RecurrenceProjection=>({dates:[],limitation});
 if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)return none('window-limit');
 if(Date.parse(to)-Date.parse(anchor.date)>40000*86400000)return none('scan-limit');
 if(r.yearWeeks?.length||r.yearDays?.length)return none('year-week-or-day-selector');
 if(r.frequency===1&&r.interval>1&&!r.firstWeekday)return none('missing-week-anchor');
 if(r.frequency===3&&r.weekNumbers.some(n=>n!==0)&&!r.months?.length)return none('year-ordinal-without-month');
 const initial=new Date(anchor.date+'T12:00:00Z'),start=+initial,dates:string[]=[];
 const weekday=(d:Date)=>d.getUTCDay()+1;
 const weekStart=(d:Date)=>+d-((weekday(d)-(r.firstWeekday||2)+7)%7)*86400000;
 const match=(day:string,includeBeforeAnchor=false)=>{
  const d=new Date(day+'T12:00:00Z'),delta=Math.round((+d-start)/86400000),monthDelta=(d.getUTCFullYear()-initial.getUTCFullYear())*12+d.getUTCMonth()-initial.getUTCMonth();
  if(delta<0&&!includeBeforeAnchor)return false;
  if(r.frequency===0)return delta%r.interval===0;
  if(r.frequency===1)return Math.round((weekStart(d)-weekStart(initial))/(7*86400000))%r.interval===0&&(r.weekdays.length?r.weekdays:[weekday(initial)]).includes(weekday(d));
  if(r.frequency===2&&monthDelta%r.interval!==0)return false;
  if(r.frequency===3&&((d.getUTCFullYear()-initial.getUTCFullYear())%r.interval!==0||!(r.months?.length?r.months:[initial.getUTCMonth()+1]).includes(d.getUTCMonth()+1)))return false;
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(),dom=d.getUTCDate();
  if(r.monthDays?.length&&!r.monthDays.some(n=>(n>0?n:last+n+1)===dom))return false;
  if(r.weekdays.length&&!r.weekdays.some((wd,i)=>wd===weekday(d)&&(r.weekNumbers[i]===0||r.weekNumbers[i]===Math.ceil(dom/7)||r.weekNumbers[i]===-Math.ceil((last-dom+1)/7))))return false;
  return !!(r.monthDays?.length||r.weekdays.length)||dom===initial.getUTCDate();
 };
 let count=0;
 for(let day=anchor.date,steps=0;day<=to;day=addDays(day,1),steps++){
  if(steps>=40000)return none('scan-limit');
  if(!match(day))continue;
  if(r.positions?.length){
   if(r.frequency<2)return none('positions-frequency');
   // BYSETPOS applies after all other filters in the recurrence period.
   const d=new Date(day+'T12:00:00Z'),first=r.frequency===2?day.slice(0,7)+'-01':day.slice(0,4)+'-01-01';
   const end=r.frequency===2?new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10):day.slice(0,4)+'-12-31';
   const candidates:string[]=[];
   for(let v=first;v<=end;v=addDays(v,1))if(match(v,true))candidates.push(v);
   if(!r.positions.some(n=>candidates[n>0?n-1:candidates.length+n]===day))continue;
  }
  let instant:string|null=null;
  if(anchor.time&&anchor.timeZone){try{instant=wallToUTC(day+'T'+anchor.time,anchor.timeZone);}catch{continue;}}
  if(r.endDate&&(instant?Date.parse(instant)>Date.parse(r.endDate):day>(anchor.timeZone?dateInZone(r.endDate,anchor.timeZone):r.endDate.slice(0,10))))break;
  count++;if(r.occurrenceCount&&count>r.occurrenceCount)break;
  if(day>=from){dates.push(day);if(dates.length>2000)return none('output-limit');}
 }
 return {dates,limitation:null};
}

export function recurrenceLabel(r:MirrorRecurrence):string {
 const days=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
 const parts=[`Cada ${r.interval} ${['día(s)','semana(s)','mes(es)','año(s)'][r.frequency]}`];
 if(r.weekdays.length)parts.push(r.weekdays.map((d,i)=>(r.weekNumbers[i]===-1?'último ':r.weekNumbers[i]?`${r.weekNumbers[i]}º `:'')+days[d-1]).join(', '));
 for(const [label,values] of [['días del mes',r.monthDays],['meses',r.months],['días del año',r.yearDays],['semanas del año',r.yearWeeks],['posiciones',r.positions]] as const)if(values?.length)parts.push(label+': '+values.join(', '));
 if(r.endDate)parts.push('hasta '+r.endDate.slice(0,10));
 if(r.occurrenceCount)parts.push(r.occurrenceCount+' veces');
 return parts.join(' · ');
}
