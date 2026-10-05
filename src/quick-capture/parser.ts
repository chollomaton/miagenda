import {normalize} from '../search/selectors';
import {addDays, dateInZone} from '../utils/calendar';
import type {CaptureKind, QuickCaptureOptions, QuickCaptureResult} from './types';

/** Extracts metadata without changing the input or creating domain entities.
 * Dates/times are local wall values. Review candidates are never selected.
 * Parsing the same input/options always produces the same result.
 */
export function parseQuickCapture(input: string, options: QuickCaptureOptions): QuickCaptureResult {
 const result: QuickCaptureResult = {status:'exact',kind:'task',title:'',date:null,time:null,endTime:null,priority:null,labelIDs:[],candidates:{dates:[],times:[],priorities:[],labelIDs:[]},issues:[]};
 const review = (issue: string) => {if(result.status !== 'invalid') result.status='needsReview';result.issues.push(issue)};
 const invalid = (issue: string) => {result.status='invalid';result.issues.push(issue)};
 let text=input.trim();
 const prefix=/^(tarea|recordatorio|evento|nota)(?=\s|$)/iu.exec(text);
 if(prefix){result.kind=({tarea:'task',recordatorio:'reminder',evento:'event',nota:'note'} as Record<string,CaptureKind>)[prefix[1].toLowerCase()];text=text.slice(prefix[0].length).trim()}
 if(result.kind==='note'){result.title=text;if(!text) invalid('emptyTitle');return result}
 let today: string;
 try {today=dateInZone(new Date(options.now).toISOString(),options.timezone)} catch {invalid('invalidContext');result.title=text;return result}
 // Replace only recognized spans; unknown metadata remains visible in the title.
 text=text.replace(/#([\p{L}\p{N}_-]+)/gu,(token,name:string)=>{
  const matches=options.labels.filter(label=>normalize(label.name)===normalize(name));
  const ids=[...new Set(matches.map(label=>label.id))];
  if(ids.length!==1){review(ids.length?'ambiguousLabel':'unknownLabel');result.candidates.labelIDs.push(...ids);return token}
  result.labelIDs.push(ids[0]);return ' ';
 });
 const priorities: Array<'alta'|'media'|'baja'>=[];
 text=text.replace(/!(alta|media|baja)(?![\p{L}\p{N}_])/giu,(_,p:string)=>{priorities.push(p.toLowerCase() as 'alta'|'media'|'baja');return ' '});
 result.candidates.priorities=[...new Set(priorities)];
 if(result.candidates.priorities.length>1) review('multiplePriorities');else result.priority=priorities[0]??null;
 text=text.replace(/\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(\d{1,2})(?=\s|$)/giu,'$1 a las $2');
 const days=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
 text=text.replace(/(?<![\p{L}\p{N}:.])(?<!de la )(?:pasado\s+mañana|mañana|hoy|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|\d{1,2}([/-])\d{1,2}(?:\1\d{4})?)(?![\p{L}\p{N}/-])/giu,(token:string)=>{
  const value=normalize(token);let date: string;
  if(value==='hoy'||value==='manana'||value==='pasado manana') date=addDays(today,value==='hoy'?0:value==='manana'?1:2);
  else if(days.includes(value)){const weekday=new Date(today+'T12:00:00Z').getUTCDay();date=addDays(today,(days.indexOf(value)-weekday+7)%7||7)}
  else {
   const parts=value.split(/[/-]/).map(Number);const [day,month]=parts;let year=parts[2]??Number(today.slice(0,4));
   const format=()=>`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   date=format();if(parts.length===2&&date<today){year++;date=format()}
   const d=new Date(date+'T12:00:00Z');
   if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==date){invalid('impossibleDate');return ' '}
  }
  result.candidates.dates.push(date);return ' ';
 });
 if(result.candidates.dates.length>1) review('multipleDates');else result.date=result.candidates.dates[0]??null;
 const times: string[][]=[];
 const clock=(hour:number,minute:number)=>{
  if(hour>23||minute>59){invalid('impossibleTime');return null}
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 };
 const explicit='\\d{1,2}(?:[:.]\\d{2}|h)';
 if(result.kind==='event') text=text.replace(new RegExp(`(?<![\\p{L}\\p{N}])(${explicit})\\s*(?:-|a)\\s*(${explicit})(?![\\p{L}\\p{N}])`,'giu'),(_,a:string,b:string)=>{
  const parse=(v:string)=>{const p=v.replace('h',':00').split(/[:.]/).map(Number);return clock(p[0],p[1])};
  const start=parse(a),end=parse(b);if(start&&end){if(end<=start) invalid('invertedRange');times.push([start]);result.endTime=end}return ' ';
 });
 text=text.replace(/(?<![\p{L}\p{N}])(?:a\s+las\s+)?(\d{1,2})(?:([:.])(\d{2})|(h))?(?:\s+de\s+la\s+(mañana|tarde|noche))?(?![\p{L}\p{N}])/giu,(token:string,h:string,separator:string,m:string,suffix:string,period:string)=>{
  const explicitTime=!!(separator||suffix||period||/^a\s+las/iu.test(token));
  // Bare numbers remain title text unless immediately following a weekday.
  if(!explicitTime) return token;
  let hour=Number(h);const minute=Number(m??0);
  if(period){if(hour<1||hour>12){invalid('impossibleTime');return ' '}hour=hour%12+(normalize(period)==='manana'?0:12)}
  const time=clock(hour,minute);if(time){if(!separator&&!suffix&&!period&&hour>=1&&hour<=12){times.push([clock(hour%12,0)!,clock(hour%12+12,0)!]);review('ambiguousHour')}else times.push([time])}return ' ';
 });
 result.candidates.times=times.flat();
 if(times.length>1){review('multipleTimes');result.endTime=null}else if(times[0]?.length===1)result.time=times[0][0];
 result.labelIDs=[...new Set(result.labelIDs)];result.candidates.labelIDs=[...new Set(result.candidates.labelIDs)];
 result.title=text.replace(/\s+/g,' ').trim();if(!result.title) invalid('emptyTitle');
 return result;
}
