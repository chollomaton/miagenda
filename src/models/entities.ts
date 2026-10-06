export const kinds = ['Task','Subtask','Reminder','Event','QuickNote','Label','Preferences','Template'] as const;
export type Kind = typeof kinds[number];
export type HybridClock = Clock;
export interface Clock { physicalMilliseconds: number; logical: number; writerID: string }
export interface Recurrence { frequency: 'daily'|'weekly'|'monthly'|'yearly'; interval: number; weekdays: number[]; monthDay: number|null; until: string|null; count: number|null; exceptions: string[] }
export interface Fields {
 title: string; notes: string; text: string; completed: boolean; completedAt: string|null; priority: number; pinned: boolean; labelIDs: string[]; sortOrder: number;
 parentTaskId: string|null; parentLabelId: string|null; due: string|null; start: string|null; end: string|null; allDay: boolean; startDate: string|null; endDate: string|null; timezone: string;
 location: string; url: string; alerts: number[]; recurrence: Recurrence|null; color: string; icon: string;
 theme: 'system'|'light'|'dark'; weekStart: number; hour24: boolean; calendarView: 'Día'|'Semana'|'Mes'|'Agenda'; eventDuration: number; defaultAlert: number; density: 'comfortable'|'compact'; language: string;
}
export interface TaskScheduling { scheduledStartAt?: string|null; scheduledDurationMinutes?: number|null; scheduledTimezone?: string|null }
export const schedulingKeys = ['scheduledStartAt','scheduledDurationMinutes','scheduledTimezone'] as const;
export type EditableFields = Fields & TaskScheduling;
interface BaseEntity { id: string; kind: Kind; schemaVersion: 1; createdAt: string; updatedAt: string; lifecycle: 'active'|'deleted'; fieldClocks: Record<string,Clock>; }
export type AgendaEntity = BaseEntity & ({kind:'Task';fields:EditableFields}|{kind:Exclude<Kind,'Task'|'Template'>;fields:Fields});
export interface TemplateValues {title?:string;notes?:string;labelIDs?:string[]}
export type TemplateRecurrence = Omit<Recurrence,'until'|'exceptions'>;
export type TemplateDefinition =
 | {targetKind:'Task';values:TemplateValues & {priority?:number}}
 | {targetKind:'Reminder';values:TemplateValues & {alerts?:number[]};recurrence?:TemplateRecurrence}
 | {targetKind:'Event';values:TemplateValues & {location?:string;url?:string;alerts?:number[]};durationMinutes?:number};
// Legacy fields are forbidden at the type level and never materialized on Templates.
export type TemplateFields = {name:string;definition:TemplateDefinition} & Partial<Record<keyof EditableFields,never>>;
export type Template = BaseEntity & {kind:'Template';fields:TemplateFields};
export type Entity = AgendaEntity | Template;
export type EntityPatch = Partial<EditableFields & Pick<TemplateFields,'name'|'definition'>>;

export type Task = Entity & {kind:'Task'}; export type Subtask = Entity & {kind:'Subtask'}; export type Reminder = Entity & {kind:'Reminder'}; export type Event = Entity & {kind:'Event'}; export type QuickNote = Entity & {kind:'QuickNote'}; export type Label = Entity & {kind:'Label'}; export type Preferences = Entity & {kind:'Preferences'};
export const clone = <T,>(v:T):T => structuredClone(v);
export function compare(a:Clock,b:Clock):number {return a.physicalMilliseconds-b.physicalMilliseconds || a.logical-b.logical || (a.writerID<b.writerID?-1:a.writerID>b.writerID?1:0)}
export function nextClock(writerID:string, clocks:Clock[], now=Date.now()):Clock { const max=clocks.reduce<Clock>((a,b)=>compare(a,b)>0?a:b,{physicalMilliseconds:0,logical:0,writerID}); return {physicalMilliseconds:Math.max(now,max.physicalMilliseconds),logical:now>max.physicalMilliseconds?0:max.logical+1,writerID}; }
export function defaults():Fields {return {title:'',notes:'',text:'',completed:false,completedAt:null,priority:0,pinned:false,labelIDs:[],sortOrder:0,parentTaskId:null,parentLabelId:null,due:null,start:null,end:null,allDay:false,startDate:null,endDate:null,timezone:'Europe/Madrid',location:'',url:'',alerts:[0],recurrence:null,color:'#3478f6',icon:'●',theme:'system',weekStart:1,hour24:true,calendarView:'Mes',eventDuration:60,defaultAlert:15,density:'comfortable',language:'es'};}
export function createEntity(kind:'Template',fields:TemplateFields,writerID?:string):Template;
export function createEntity(kind:Exclude<Kind,'Template'>,fields?:Partial<EditableFields>,writerID?:string):AgendaEntity;
export function createEntity(kind:Kind,fields:EntityPatch,writerID?:string):Entity;
export function createEntity(kind:Kind, fields:EntityPatch={}, writerID='local'):Entity {const now=new Date().toISOString(), f=clone(kind==='Template'?fields:{...defaults(),...fields}); const clock=nextClock(writerID,[]); const entity={id:crypto.randomUUID(),kind,schemaVersion:1,createdAt:now,updatedAt:now,lifecycle:'active',fields:f,fieldClocks:Object.fromEntries([...Object.keys(f),'lifecycle'].map(k=>[k,clock]))} as Entity; validate(entity); return entity;}
export function updateEntity(entity:Entity, patch:EntityPatch,writerID:string,lifecycle=entity.lifecycle):Entity {const e=clone(entity); const clock=nextClock(writerID,Object.values(e.fieldClocks)); for(const key of Object.keys(patch) as (keyof EntityPatch)[]) {if(!(entity.kind==='Template'?['name','definition'].includes(key):key in defaults())&&!(entity.kind==='Task'&&schedulingKeys.includes(key as typeof schedulingKeys[number])))throw Error('UNKNOWN_FIELD');if(JSON.stringify((e.fields as EntityPatch)[key])===JSON.stringify(patch[key])||(schedulingKeys.includes(key as typeof schedulingKeys[number])&&(e.fields as EntityPatch).scheduledStartAt==null&&patch.scheduledStartAt==null&&(e.fields as EntityPatch)[key]==null&&patch[key]==null))continue; Object.assign(e.fields,{[key]:clone(patch[key])}); e.fieldClocks[key]=clock;} if(lifecycle!==e.lifecycle){e.lifecycle=lifecycle;e.fieldClocks.lifecycle=clock;} if(Object.keys(e.fieldClocks).some(key=>(!entity.fieldClocks[key]||compare(e.fieldClocks[key],entity.fieldClocks[key])!==0)))e.updatedAt=new Date(clock.physicalMilliseconds).toISOString(); validate(e);return e;}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function civil(s:unknown):s is string {if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
export function utc(s:unknown):s is string{return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;}
export function safeURL(s:string):string {if(!s)return '';try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}}
export function validate(value:unknown):asserts value is Entity {
 if(!value||typeof value!=='object')throw Error('INVALID_ENTITY'); const e=value as Entity;if(Object.keys(e).sort().join(',')!==['id','kind','schemaVersion','createdAt','updatedAt','lifecycle','fieldClocks','fields'].sort().join(','))throw Error('UNKNOWN_METADATA');
 if(!uuid.test(e.id)||!kinds.includes(e.kind)||e.schemaVersion!==1||!utc(e.createdAt)||!utc(e.updatedAt)||!['active','deleted'].includes(e.lifecycle)||!e.fields||!e.fieldClocks)throw Error('INVALID_SCHEMA');
 if(e.kind==='Template'){validateTemplate(e);return;}
 const f=e.fields as EditableFields,d=defaults();
 const optional:readonly typeof schedulingKeys[number][]=e.kind==='Task'?schedulingKeys:[];
 const fieldKeys=Object.keys(f),clockKeys=Object.keys(e.fieldClocks);
 if(clockKeys.some(k=>k!=='lifecycle'&&!(k in d)&&!optional.includes(k as typeof schedulingKeys[number]))||[...Object.keys(d),'lifecycle'].some(k=>!clockKeys.includes(k)))throw Error('UNKNOWN_CLOCK');
 if(fieldKeys.some(k=>!(k in d)&&!optional.includes(k as typeof schedulingKeys[number]))||Object.keys(d).some(k=>!fieldKeys.includes(k)))throw Error('UNKNOWN_FIELDS');
 const present=schedulingKeys.filter(k=>Object.hasOwn(f,k));
 const clocks=schedulingKeys.filter(k=>Object.hasOwn(e.fieldClocks,k));
 if(present.length||clocks.length){
  if(e.kind!=='Task'||present.length!==3||clocks.length!==3)throw Error('INVALID_SCHEDULING');
  if(f.scheduledStartAt===null){if(f.scheduledDurationMinutes!==null||f.scheduledTimezone!==null)throw Error('INVALID_SCHEDULING');}
  else {
   if(!utc(f.scheduledStartAt)||typeof f.scheduledDurationMinutes!=='number'||!Number.isFinite(f.scheduledDurationMinutes)||f.scheduledDurationMinutes<=0||typeof f.scheduledTimezone!=='string'||!f.scheduledTimezone||/^[+-]/.test(f.scheduledTimezone))throw Error('INVALID_SCHEDULING');
   try{new Intl.DateTimeFormat('en',{timeZone:f.scheduledTimezone}).format()}catch{throw Error('INVALID_SCHEDULING')}
  }
 }
 for(const key of Object.keys(d) as (keyof Fields)[]) {const v=f[key];if(typeof d[key]==='string'&&(typeof v!=='string'||v.length>100000))throw Error('INVALID_TEXT');if(typeof d[key]==='boolean'&&typeof v!=='boolean')throw Error('INVALID_BOOLEAN');if(typeof d[key]==='number'&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('INVALID_NUMBER');}
 if(f.title.length>500||f.icon.length>20||f.location.length>2000||f.url.length>4000)throw Error('TEXT_TOO_LONG');
 if(!Array.isArray(f.labelIDs)||f.labelIDs.some(id=>!uuid.test(id))||!Array.isArray(f.alerts)||f.alerts.some(n=>!Number.isInteger(n)||n<0||n>525600))throw Error('INVALID_LIST');
 for(const id of [f.parentTaskId,f.parentLabelId])if(id!==null&&!uuid.test(id))throw Error('INVALID_REFERENCE');
 for(const s of [f.start,f.end,f.due,f.completedAt])if(s!==null&&!utc(s))throw Error('INVALID_DATE');
 for(const s of [f.startDate,f.endDate])if(s!==null&&!civil(s))throw Error('INVALID_CIVIL_DATE');
 try {new Intl.DateTimeFormat('en',{timeZone:f.timezone}).format()}catch{throw Error('INVALID_TIMEZONE')}
 if(!Number.isInteger(f.priority)||f.priority<0||f.priority>3||![0,1].includes(f.weekStart)||!['system','light','dark'].includes(f.theme)||!['Día','Semana','Mes','Agenda'].includes(f.calendarView)||!['comfortable','compact'].includes(f.density)||f.eventDuration<5||f.eventDuration>1440||f.defaultAlert<0)throw Error('INVALID_PREFERENCE');
 if(f.url&&!safeURL(f.url))throw Error('INVALID_URL');if(!/^#[0-9a-f]{6}$/i.test(f.color))throw Error('INVALID_COLOR');
 if(e.kind==='Subtask'&&!f.parentTaskId)throw Error('MISSING_PARENT');
 if(e.kind==='Event'&& (f.allDay?(!f.startDate||!f.endDate||f.endDate<=f.startDate):(!f.start||!f.end||f.end<=f.start)))throw Error('INVALID_EVENT_RANGE');
 if(e.kind==='Reminder'&&!f.due)throw Error('MISSING_DUE');
 for(const key of clockKeys){const c=e.fieldClocks[key];if(!c||Object.keys(c).sort().join(',')!=='logical,physicalMilliseconds,writerID'||!Number.isSafeInteger(c.physicalMilliseconds)||c.physicalMilliseconds<0||!Number.isSafeInteger(c.logical)||c.logical<0||typeof c.writerID!=='string'||!c.writerID||c.writerID.length>200)throw Error('INVALID_CLOCK');}
 if(f.recurrence){const r=f.recurrence;if(!['daily','weekly','monthly','yearly'].includes(r.frequency)||!Number.isInteger(r.interval)||r.interval<1||r.interval>366||!Array.isArray(r.weekdays)||r.weekdays.some(v=>!Number.isInteger(v)||v<0||v>6)||r.monthDay!==null&&(!Number.isInteger(r.monthDay)||r.monthDay<1||r.monthDay>31)||r.count!==null&&(!Number.isInteger(r.count)||r.count<1||r.count>10000)||r.until!==null&&!civil(r.until)||!Array.isArray(r.exceptions)||r.exceptions.some(v=>!civil(v)))throw Error('INVALID_RECURRENCE');}
}
export function merge(a:Entity,b:Entity):Entity {validate(a);validate(b);if(a.id!==b.id||a.kind!==b.kind||a.createdAt!==b.createdAt)throw Error('IDENTITY_CONFLICT');const out=clone(a);for(const key of new Set([...Object.keys(a.fields),...Object.keys(b.fields)])){
 const ac=a.fieldClocks[key],bc=b.fieldClocks[key];
 const af=a.fields as unknown as Record<string,unknown>,bf=b.fields as unknown as Record<string,unknown>;
 if(bc&&(!ac||compare(bc,ac)>0||(compare(bc,ac)===0&&JSON.stringify(bf[key])>JSON.stringify(af[key])))){
  Object.assign(out.fields,{[key]:clone(bf[key])});out.fieldClocks[key]=clone(bc);
 }
}
// Derived unscheduled values keep the winning clocks; historical snapshots stay absent.
if(out.kind==='Task'&&out.fields.scheduledStartAt==null){
 for(const key of schedulingKeys)if(Object.hasOwn(out.fields,key))Object.assign(out.fields,{[key]:null});
}
if(compare(b.fieldClocks.lifecycle,a.fieldClocks.lifecycle)>0||(compare(b.fieldClocks.lifecycle,a.fieldClocks.lifecycle)===0&&b.lifecycle==='deleted')){out.lifecycle=b.lifecycle;out.fieldClocks.lifecycle=clone(b.fieldClocks.lifecycle);}out.updatedAt=a.updatedAt>b.updatedAt?a.updatedAt:b.updatedAt;validate(out);return out;}

function validateClock(c:Clock){if(!c||Object.keys(c).sort().join(',')!=='logical,physicalMilliseconds,writerID'||!Number.isSafeInteger(c.physicalMilliseconds)||c.physicalMilliseconds<0||!Number.isSafeInteger(c.logical)||c.logical<0||typeof c.writerID!=='string'||!c.writerID||c.writerID.length>200)throw Error('INVALID_CLOCK');}
function strictKeys(value:unknown,allowed:string[],required:string[]=[]):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))throw Error('INVALID_TEMPLATE');}
function validateTemplate(e:Template){
 strictKeys(e.fields,['name','definition'],['name','definition']);
 strictKeys(e.fieldClocks,['name','definition','lifecycle'],['name','definition','lifecycle']);
 Object.values(e.fieldClocks).forEach(validateClock);
 if(typeof e.fields.name!=='string'||!e.fields.name.trim()||e.fields.name.length>500)throw Error('INVALID_TEMPLATE_NAME');
 const d=e.fields.definition;
 strictKeys(d,['targetKind','values',...(d?.targetKind==='Reminder'?['recurrence']:d?.targetKind==='Event'?['durationMinutes']:[])],['targetKind','values']);
 if(!['Task','Reminder','Event'].includes(d.targetKind))throw Error('INVALID_TEMPLATE_TARGET');
 const extras=d.targetKind==='Task'?['priority']:d.targetKind==='Reminder'?['alerts']:['location','url','alerts'];
 strictKeys(d.values,['title','notes','labelIDs',...extras]);
 const v=d.values as Record<string,unknown>;
 for(const key of ['title','notes','location','url'])if(Object.hasOwn(v,key)&&(typeof v[key]!=='string'||(v[key] as string).length>({title:500,notes:100000,location:2000,url:4000}[key as 'title'|'notes'|'location'|'url'])))throw Error('INVALID_TEMPLATE_TEXT');
 if(Object.hasOwn(v,'labelIDs')&&(!Array.isArray(v.labelIDs)||v.labelIDs.some(id=>typeof id!=='string'||!uuid.test(id))))throw Error('INVALID_LIST');
 if(Object.hasOwn(v,'alerts')&&(!Array.isArray(v.alerts)||v.alerts.some(n=>!Number.isInteger(n)||n<0||n>525600)))throw Error('INVALID_LIST');
 if(Object.hasOwn(v,'priority')&&(!Number.isInteger(v.priority)||(v.priority as number)<0||(v.priority as number)>3))throw Error('INVALID_PRIORITY');
 if(v.url&&!safeURL(v.url as string))throw Error('INVALID_URL');
 if(d.targetKind==='Event'&&Object.hasOwn(d,'durationMinutes')&&(typeof d.durationMinutes!=='number'||!Number.isFinite(d.durationMinutes)||d.durationMinutes<=0))throw Error('INVALID_DURATION');
 if(d.targetKind==='Reminder'&&Object.hasOwn(d,'recurrence')){
  const r=d.recurrence;strictKeys(r,['frequency','interval','weekdays','monthDay','count'],['frequency','interval','weekdays','monthDay','count']);
  if(!['daily','weekly','monthly','yearly'].includes(r.frequency as string)||!Number.isInteger(r.interval)||(r.interval as number)<1||(r.interval as number)>366||!Array.isArray(r.weekdays)||r.weekdays.some(v=>!Number.isInteger(v)||v<0||v>6)||r.monthDay!==null&&(!Number.isInteger(r.monthDay)||(r.monthDay as number)<1||(r.monthDay as number)>31)||r.count!==null&&(!Number.isInteger(r.count)||(r.count as number)<1||(r.count as number)>10000))throw Error('INVALID_RECURRENCE');
 }
}
export function entityLabelIDs(e:Entity):string[]{return e.kind==='Template'?e.fields.definition.values.labelIDs??[]:e.fields.labelIDs;}
