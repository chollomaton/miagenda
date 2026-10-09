import {civil, utc, safeURL} from '../models/entities';
import {canonicalJSON,sha256} from './canonical';
import {buildContent} from './generation';
import type {MirrorEntity, MirrorGenerationManifest, MirrorSnapshot, MirrorSourceInfo, MirrorState, MirrorValidationResult} from './contract';
const kinds = ['CalendarItem','Label','QuickNote','Template','TimeBlock'];
const hash = /^[0-9a-f]{64}$/;
function require(condition: unknown, code: string): asserts condition {if (!condition) throw Error(code);}
function record(value: unknown): Record<string,unknown> {require(value && typeof value === 'object' && !Array.isArray(value),'INVALID_OBJECT'); return value as Record<string,unknown>;}
function keys(value: unknown, allowed: string[]) {const r=record(value); require(Object.keys(r).sort().join(',') === [...allowed].sort().join(','),'UNKNOWN_FIELDS');return r;}
function text(value: unknown, max=100000): asserts value is string {require(typeof value === 'string' && value.length<=max,'INVALID_TEXT');}
function id(value: unknown): asserts value is string {text(value,2000);require(value.length>0 && ![...value].some(char => char.charCodeAt(0)<32),'INVALID_ID');}
function date(value: unknown) {require(utc(value),'INVALID_DATE');}
function optionalDate(value: unknown) {if(value!==null)date(value);}
function bool(value: unknown) {require(typeof value==='boolean','INVALID_BOOLEAN');}
function integer(value: unknown,min:number,max:number) {require(Number.isSafeInteger(value) && (value as number)>=min && (value as number)<=max,'INVALID_INTEGER');}
function list(value: unknown): unknown[] {require(Array.isArray(value) && value.length<=100000,'INVALID_ARRAY');return value;}
function civilTime(value:unknown) {if(value===null)return;const t=keys(value,['date','time','timeZone']); require(civil(t.date),'INVALID_CIVIL_DATE');require(t.time===null||typeof t.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t.time),'INVALID_CIVIL_TIME');if(t.timeZone!==null){text(t.timeZone,100);new Intl.DateTimeFormat('es',{timeZone:t.timeZone});}}
function recurrence(value: unknown) {
 const r=keys(value,['frequency','interval','endDate','occurrenceCount','weekdays','weekNumbers','monthDays','yearDays','yearWeeks','months','positions']);
 integer(r.frequency,0,3);integer(r.interval,1,1000);optionalDate(r.endDate);integer(r.occurrenceCount,0,1000000);
 const weekdays=list(r.weekdays), weeks=list(r.weekNumbers);require(weekdays.length===weeks.length,'INVALID_WEEK_PAIRS');weekdays.forEach(v=>integer(v,1,7));weeks.forEach(v=>integer(v,-53,53));
 for(const [key,max] of [['monthDays',31],['yearDays',366],['yearWeeks',53],['months',12],['positions',366]] as const)if(r[key]!==null)list(r[key]).forEach(v=>{integer(v,key==='months'?1:-max,max);require(v!==0,'INVALID_RECURRENCE');});
}
function metadata(value: unknown) {
 if(value===null)return;
 const m=keys(value,['labelID','isPinned','isFavorite','courseMode','subtasks','parts','estimatedDurationMinutes']);if(m.labelID!==null)id(m.labelID);bool(m.isPinned);bool(m.isFavorite);if(m.courseMode!==null)text(m.courseMode,500);
 if(m.estimatedDurationMinutes!==null)integer(m.estimatedDurationMinutes,1,525600);
 const subIDs=new Set<string>(), partIDs=new Set<string>();
 for(const sub of list(m.subtasks)){const s=keys(sub,['id','title','isDone']);id(s.id);require(!subIDs.has(s.id),'DUPLICATE_SUBTASK');subIDs.add(s.id);text(s.title,500);bool(s.isDone);}
 for(const part of list(m.parts)){const p=keys(part,['id','title','time']);id(p.id);require(!partIDs.has(p.id),'DUPLICATE_PART');partIDs.add(p.id);text(p.title,500);optionalDate(p.time);}
}
export function validateEntity(value: unknown): asserts value is MirrorEntity {
 const e=keys(value,['id','kind','lifecycle','payload']);id(e.id);require(kinds.includes(e.kind as string),'UNKNOWN_KIND');require(e.lifecycle==='active'||e.lifecycle==='deleted','INVALID_LIFECYCLE');
 if(e.lifecycle==='deleted'){require(e.payload===null,'INVALID_TOMBSTONE');return;}
 const p=record(e.payload);
 switch(e.kind){
 case 'Label': keys(p,['name','colorToken','symbol']);text(p.name,500);text(p.colorToken,40);text(p.symbol,100);break;
 case 'QuickNote': keys(p,['title','body','isPinned','isFavorite','createdAt','modifiedAt']);text(p.title,500);text(p.body);bool(p.isPinned);bool(p.isFavorite);date(p.createdAt);date(p.modifiedAt);require((p.modifiedAt as string)>=(p.createdAt as string),'INVALID_DATE_ORDER');break;
 case 'Template':keys(p,['name','captureText','updatedAt']);text(p.name,500);text(p.captureText);date(p.updatedAt);break;
 case 'TimeBlock': keys(p,['taskID','title','start','end','updatedAt']);id(p.taskID);text(p.title,500);date(p.start);date(p.end);date(p.updatedAt);require((p.end as string)>(p.start as string),'INVALID_RANGE');break;
 case 'CalendarItem':
  keys(p,['externalID','calendarID','calendarTitle','isEvent','title','notes','location','url','start','end','allDay','dueComponents','startComponents','completed','completionDate','priority','alarms','recurrence','readOnly','modifiedAt','metadata']);
  if(p.externalID!==null)id(p.externalID);id(p.calendarID);text(p.calendarTitle,500);text(p.title,500);text(p.notes);if(p.location!==null)text(p.location,2000);
  if(p.url!==null){text(p.url,4000);require(!p.url||!!safeURL(p.url)||/^miagenda:\/\/(timeblock|task)\/[a-zA-Z0-9-]+$/.test(p.url),'INVALID_URL');}
  for(const key of ['isEvent','allDay','completed','readOnly'])bool(p[key]);
  for(const key of ['start','end','completionDate'])optionalDate(p[key]);date(p.modifiedAt);integer(p.priority,0,9);
  if(p.isEvent)require(p.start!==null&&p.end!==null&&(p.end as string)>(p.start as string),'INVALID_RANGE');
  civilTime(p.dueComponents);civilTime(p.startComponents);metadata(p.metadata);
  list(p.alarms).forEach(v=>{const a=keys(v,['absolute','relative']);optionalDate(a.absolute);require(Number.isSafeInteger(a.relative),'INVALID_ALARM');});
  list(p.recurrence).forEach(recurrence);break;
 }
}
export function validateSource(value:unknown):asserts value is MirrorSourceInfo {
 const s=keys(value,['source','sourceSchemaVersion','publisherAppVersion','publisherID','calendarScope']);require(s.source==='apple-agenda'&&s.sourceSchemaVersion===3,'UNKNOWN_SOURCE_SCHEMA');id(s.publisherID);text(s.publisherAppVersion,100);require(!!s.publisherAppVersion,'INVALID_APP_VERSION');
 list(s.calendarScope).forEach(v=>{const r=keys(v,['start','end']);date(r.start);date(r.end);require((r.end as string)>(r.start as string),'INVALID_SCOPE');});
}
export function validateManifest(value:unknown):asserts value is MirrorGenerationManifest {
 const m=keys(value,['mirrorSchemaVersion','generationID','source','rootHash','entityCount','buckets','capturedAt','publishedAt']);require(m.mirrorSchemaVersion===1,'UNKNOWN_MIRROR_SCHEMA');id(m.generationID);require(!String(m.generationID).includes('/'),'INVALID_GENERATION');validateSource(m.source);require(hash.test(m.rootHash as string),'INVALID_HASH');integer(m.entityCount,0,100000);date(m.capturedAt);date(m.publishedAt);require((m.publishedAt as string)>=(m.capturedAt as string),'INVALID_DATE_ORDER');
 const seen=new Set<string>();let count=0;
 for(const item of list(m.buckets)){const b=keys(item,['hash','entityCount']);require(typeof b.hash==='string'&&hash.test(b.hash)&&!seen.has(b.hash),'INVALID_BUCKET_HASH');seen.add(b.hash);integer(b.entityCount,1,256);count+=b.entityCount as number;}
 require(count===m.entityCount,'INVALID_COUNT');
}
export function validateState(value:unknown):asserts value is MirrorState {
 const s=keys(value,['mirrorSchemaVersion','currentGeneration','previousGeneration','publisherID','publishedAt','rootHash']);require(s.mirrorSchemaVersion===1,'UNKNOWN_MIRROR_SCHEMA');id(s.currentGeneration);require(!s.currentGeneration.includes('/'),'INVALID_GENERATION');if(s.previousGeneration!==null){id(s.previousGeneration);require(!s.previousGeneration.includes('/')&&s.previousGeneration!==s.currentGeneration,'INVALID_PREVIOUS_GENERATION');}id(s.publisherID);date(s.publishedAt);require(typeof s.rootHash==='string'&&hash.test(s.rootHash),'INVALID_HASH');
}
export function validateRelations(entities:MirrorEntity[]) {
 const byID=new Map<string,MirrorEntity>();
 for(const e of entities){validateEntity(e);require(!byID.has(e.id),'DUPLICATE_ID');byID.set(e.id,e);}
 for(const e of entities){if(e.lifecycle==='deleted')continue;
  if(e.kind==='CalendarItem'&&e.payload.metadata?.labelID){const label=byID.get(e.payload.metadata.labelID);require(label?.kind==='Label'&&label.lifecycle==='active','MISSING_LABEL');}
  if(e.kind==='TimeBlock'){const task=byID.get(e.payload.taskID);require(task?.kind==='CalendarItem'&&task.lifecycle==='active'&&!task.payload.isEvent,'MISSING_TASK');}
 }
}
export async function validateSnapshot(snapshot:MirrorSnapshot):Promise<MirrorValidationResult> {
 try{validateManifest(snapshot.manifest);validateRelations(snapshot.entities);const m=snapshot.manifest;require(snapshot.entities.length===m.entityCount,'INVALID_COUNT');
  const content=await buildContent(snapshot.entities,m.source);
  require(content.rootHash===m.rootHash,'ROOT_HASH_MISMATCH');
  require(canonicalJSON(content.bucketReferences)===canonicalJSON(m.buckets),'BUCKET_HASH_MISMATCH');return {valid:true,issues:[]};
 }catch(error){return {valid:false,issues:[error instanceof Error?error.message:'INVALID_SNAPSHOT']};}
}
export {sha256};
