import type {Entity} from '../models/entities';
import {addDays,dateInZone,occurrences,scheduledTaskBlock} from '../utils/calendar';

export const RECENT_WINDOW_MS=5*60_000;
const HORIZON_MS=24*60*60_000;
export interface Notice {key:string;at:number;title:string}
export function notificationCandidates(entities:Entity[],now:number):Notice[] {
 const result:Notice[]=[];
 for(const entity of entities){
  if(entity.lifecycle!=='active'||entity.kind==='Template'||entity.fields.completed)continue;
  if(!['Reminder','Event','Task'].includes(entity.kind))continue;
  const f=entity.fields;
  // Civil all-day dates do not define a notification instant.
  if(!f.allDay&&(f.start||f.due))for(const minutes of new Set(f.alerts)){
   const offset=minutes*60_000;
   const from=dateInZone(new Date(now-RECENT_WINDOW_MS+offset).toISOString(),f.timezone);
   const to=addDays(dateInZone(new Date(now+HORIZON_MS+offset).toISOString(),f.timezone),1);
   for(const occurrence of occurrences(entity,from,to))if(occurrence.start){
    const at=Date.parse(occurrence.start)-offset;
    if(at>=now-RECENT_WINDOW_MS&&at<=now+HORIZON_MS)result.push({key:entity.id+':'+occurrence.start+':alert:'+minutes,at,title:f.title});
   }
  }
  const block=scheduledTaskBlock(entity);
  if(block){const at=Date.parse(block.startAt);if(at>=now-RECENT_WINDOW_MS&&at<=now+HORIZON_MS)result.push({key:entity.id+':'+block.startAt+':block',at,title:f.title})}
 }
 return result.sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));
}
export function browserPermission():NotificationPermission|'unavailable' {
 return typeof Notification==='undefined'?'unavailable':Notification.permission;
}
export function showBrowserNotice(notice:Notice){new Notification(notice.title||'Mi Agenda',{tag:notice.key})}
/** One timer, current state at delivery, no persistence or remote transport. */
export class ForegroundNotificationScheduler {
 private timer:ReturnType<typeof setTimeout>|undefined;
 private running=false;
 private delivered=new Map<string,number>();
 constructor(private readonly entities:()=>Entity[],private readonly permission:()=>string=browserPermission,private readonly visible:()=>boolean=()=>document.visibilityState!=='hidden',private readonly show:(notice:Notice)=>void=showBrowserNotice,private readonly now:()=>number=Date.now){}
 start(){this.running=true;this.refresh()}
 stop(){this.running=false;this.clearTimer()}
 private clearTimer(){if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined}
 refresh=()=>{
  this.clearTimer();
  if(!this.running||!this.visible())return;
  const now=this.now();
  for(const [key,at] of this.delivered)if(at<now-RECENT_WINDOW_MS)this.delivered.delete(key);
  if(this.permission()!=='granted')return;
  const candidates=notificationCandidates(this.entities(),now);
  let shown=0;
  for(const notice of candidates){
   if(notice.at>now||this.delivered.has(notice.key))continue;
   // Consume excess missed notices too, so focus/re-render cannot create a storm.
   this.delivered.set(notice.key,notice.at);
   if(shown++<3)try{this.show(notice)}catch{/* Unsupported platform/constructor: keep agenda data intact. */}
  }
  const next=candidates.find(n=>n.at>now&&!this.delivered.has(n.key));
  this.timer=setTimeout(this.refresh,Math.max(1,Math.min(next?next.at-now:HORIZON_MS,60*60_000)));
 };
}
