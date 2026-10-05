import {serialize,deserialize,migrate,diffFields} from '../src/models/serialization';
import {describe,it,expect} from 'vitest';
import {createEntity,updateEntity,merge,clone,validate,defaults,compare,nextClock,safeURL} from '../src/models/entities';
import type {Entity,Kind,Fields,Task,TaskScheduling} from '../src/models/entities';
import {MemoryRepository,RepositoryError} from '../src/repositories/AgendaRepository';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
import {AuthManager,localAuth} from '../src/auth/AuthManager';
import {SyncEngine} from '../src/sync/SyncEngine';
import {CloudKitRepository,MockCloudGateway,encode,decode} from '../src/cloud/CloudGateway';
import {integrity} from '../src/recovery/integrity';
import {exportBackup,parseBackup,importBackup} from '../src/backup/backup';
import {select} from '../src/search/selectors';
import {addDays,dateInZone,wallToUTC,occurrences,overlapColumns} from '../src/utils/calendar';
const task=()=>createEntity('Task',{title:'Synthetic task'},'a');
const event=()=>createEntity('Event',{title:'Synthetic event',start:'2026-03-28T08:00:00.000Z',end:'2026-03-28T09:00:00.000Z'},'a');
async function store(p=new MemoryPersistence()){const s=new AgendaStore(p,'writer');await s.boot();return s}
function edit(e:Entity,fields:Partial<Fields>,writer:string){return updateEntity(e,fields,writer)}
describe('V1 models and security',()=>{
 for(const kind of ['Task','Subtask','Reminder','Event','QuickNote','Label','Preferences'] as Kind[])it('roundtrips '+kind,()=>{const e=createEntity(kind,kind==='Event'?event().fields:kind==='Reminder'?{due:'2026-01-01T00:00:00.000Z'}:kind==='Subtask'?{parentTaskId:crypto.randomUUID()}:{});expect(()=>validate(JSON.parse(JSON.stringify(e)))).not.toThrow();expect(decode(encode(e))).toEqual(e)});
 for(const [name,mutate] of Object.entries({uuid:(e:Entity):unknown=>e.id='bad',schema:(e:Entity)=>Object.assign(e,{schemaVersion:2}),date:(e:Entity):unknown=>e.fields.due='2026-02-30T00:00:00.000Z',zone:(e:Entity):unknown=>e.fields.timezone='Moon/Sea',clock:(e:Entity):unknown=>e.fieldClocks.title.logical=-1,priority:(e:Entity):unknown=>e.fields.priority=4,color:(e:Entity):unknown=>e.fields.color='red',url:(e:Entity):unknown=>e.fields.url='javascript:alert(1)',array:(e:Entity):unknown=>e.fields.labelIDs=['bad'],bool:(e:Entity)=>Object.assign(e.fields,{pinned:1})}))it('rejects '+name,()=>{const e=task();mutate(e);expect(()=>validate(e)).toThrow()});
 it('rejects invalid timed range',()=>expect(()=>createEntity('Event',{...event().fields,end:'2026-03-27T08:00:00.000Z'})).toThrow());
 it('rejects invalid all-day range',()=>expect(()=>createEntity('Event',{allDay:true,startDate:'2026-02-29',endDate:'2026-03-01'})).toThrow());
 it('requires subtask parent',()=>expect(()=>createEntity('Subtask')).toThrow());
 it('requires reminder date',()=>expect(()=>createEntity('Reminder')).toThrow());
 it('rejects bad recurrence',()=>expect(()=>createEntity('Task',{recurrence:{frequency:'daily',interval:0,weekdays:[],monthDay:null,count:null,until:null,exceptions:[]}})).toThrow());
 for(const url of ['javascript:alert(1)','data:text/html,test','https://user:password@example.org','/relative','file:///tmp/a'])it('blocks URL '+url,()=>expect(safeURL(url)).toBe(''));
 it('allows https URL',()=>expect(safeURL('https://example.org')).toBe('https://example.org/'));
 it('hybrid clock survives backward time',()=>{const c=nextClock('b',[{physicalMilliseconds:500,logical:8,writerID:'a'}],10);expect(c).toEqual({physicalMilliseconds:500,logical:9,writerID:'b'})});
});
describe('field merge',()=>{
 it('preserves concurrent different fields',()=>{const e=task();const m=merge(edit(e,{title:'Changed'},'b'),edit(e,{priority:3},'c'));expect(m.fields.title).toBe('Changed');expect(m.fields.priority).toBe(3)});
 it('is commutative and idempotent',()=>{const e=task(),a=edit(e,{title:'A'},'b'),b=edit(e,{title:'B'},'c');expect(merge(a,b)).toEqual(merge(b,a));expect(merge(a,a)).toEqual(a)});
 it('does not resurrect on offline edit',()=>{const e=task(),deleted=updateEntity(e,{},'b','deleted'),offline=edit(e,{title:'Offline'},'c');expect(merge(deleted,offline).lifecycle).toBe('deleted')});
 it('explicit restore supersedes delete',()=>{const e=updateEntity(task(),{},'b','deleted'),restored=updateEntity(e,{},'c','active');expect(merge(e,restored).lifecycle).toBe('active')});
 it('ignores stale field response',()=>{const e=task(),newer=edit(e,{title:'New'},'b');expect(merge(newer,e).fields.title).toBe('New')});
 it('rejects identity collision',()=>expect(()=>merge(task(),task())).toThrow());
 it('writer tie is deterministic',()=>expect(compare({physicalMilliseconds:1,logical:1,writerID:'b'},{physicalMilliseconds:1,logical:1,writerID:'a'})).toBeGreaterThan(0));
});
describe('CRUD store persistence',()=>{
 it('creates, edits, completes, reopens, deletes, restores',async()=>{const s=await store(),e=await s.create('Task',{title:'Synthetic'});await s.patch(e.id,{priority:2});await s.complete(e.id,true);expect(s.entities[0].fields.completedAt).not.toBeNull();await s.complete(e.id,false);await s.patch(e.id,{},'deleted');expect(select(s.entities)).toHaveLength(0);await s.patch(e.id,{},'active');expect(s.entities[0].fields.priority).toBe(2)});
 it('duplicates task and independent subtasks',async()=>{const s=await store(),e=await s.create('Task');const child=await s.create('Subtask',{title:'Child',parentTaskId:e.id});const copy=await s.duplicate(e.id);expect(s.entities).toHaveLength(4);expect(s.entities.find(v=>v.kind==='Subtask'&&v.id!==child.id)?.fields.parentTaskId).toBe(copy.id)});
 it('parent completion does not complete children',async()=>{const s=await store(),e=await s.create('Task');await s.create('Subtask',{parentTaskId:e.id});await s.complete(e.id,true);expect(s.entities.find(v=>v.kind==='Subtask')?.fields.completed).toBe(false)});
 it('undo and redo deletion',async()=>{const s=await store(),e=await s.create('Task');await s.patch(e.id,{},'deleted');await s.undo();expect(s.entities[0].lifecycle).toBe('active');await s.redo();expect(s.entities[0].lifecycle).toBe('deleted')});
 it('undo creation uses a tombstone',async()=>{const s=await store();await s.create('Task');await s.undo();expect(s.entities[0].lifecycle).toBe('deleted')});
 it('parallel local edits preserve fields',async()=>{const s=await store(),e=await s.create('Task');await Promise.all([s.patch(e.id,{title:'Title'}),s.patch(e.id,{priority:3})]);expect(s.entities[0].fields).toMatchObject({title:'Title',priority:3})});
 it('writes entity and outbox together and survives reload',async()=>{const p=new MemoryPersistence(),s=await store(p);await s.create('Task');const next=await store(p);expect(next.entities).toHaveLength(1);expect(next.outbox).toHaveLength(1)});
 it('rolls back optimistic state on disk failure',async()=>{class Broken extends MemoryPersistence{override async save(){throw Error('disk')}}const s=await store(new Broken());await expect(s.create('Task')).rejects.toThrow();expect(s.entities).toHaveLength(0);expect(s.outbox).toHaveLength(0)});
 it('bulk edit is one undo action',async()=>{const s=await store();const a=await s.create('Task'),b=await s.create('Task');await s.bulk([a.id,b.id],{pinned:true});expect(s.entities.every(e=>e.fields.pinned)).toBe(true);await s.undo();expect(s.entities.every(e=>!e.fields.pinned)).toBe(true)});
 it('rejects label cycles',async()=>{const s=await store(),a=await s.create('Label'),b=await s.create('Label',{parentLabelId:a.id});await expect(s.patch(a.id,{parentLabelId:b.id})).rejects.toThrow('INVALID_RELATION')});
 it('keeps entities when deleting a label',async()=>{const s=await store(),l=await s.create('Label');const t=await s.create('Task',{labelIDs:[l.id]});await s.patch(l.id,{},'deleted');expect(s.entities.find(e=>e.id===t.id)?.lifecycle).toBe('active')});
 it('detaches private state',async()=>{const s=await store();await s.create('Task');s.detach();expect(s.entities).toHaveLength(0);expect(s.outbox).toHaveLength(0);await expect(s.create('Task')).rejects.toThrow('READ_ONLY')});
 it('quarantines a corrupt record without losing good records',async()=>{const p=new MemoryPersistence();await p.save({entities:[task(),{} as Entity],outbox:[],quarantine:[]});const s=await store(p);expect(s.entities).toHaveLength(1);expect(s.quarantine).toHaveLength(1)});
 it('recovers interrupted sending operations',async()=>{const p=new MemoryPersistence(),s=await store(p);await s.create('Task');await s.markOperation(s.outbox[0].operationID,{status:'sending'});const next=await store(p);expect(next.outbox[0].status).toBe('retry')});
});
describe('repository, CloudKit mock, sync and authentication',()=>{
 it('repository returns isolated data',async()=>{const r=new MemoryRepository(),e=task();await r.save(e,'op');const got=await r.fetch(e.id);got!.fields.title='bad';expect((await r.fetch(e.id))?.fields.title).not.toBe('bad')});
 it('idempotent replay and operation reuse rejection',async()=>{const r=new MemoryRepository(),e=task();await r.save(e,'op');await r.save(e,'op');expect((await r.fetchChanges()).entities).toHaveLength(1);await expect(r.save(edit(e,{title:'Different'},'b'),'op')).rejects.toThrow('OPERATION_REUSE')});
 it('paginates incremental records',async()=>{const r=new MemoryRepository(1);await r.save(task(),'1');await r.save(task(),'2');const first=await r.fetchChanges();expect(first.moreComing).toBe(true);expect((await r.fetchChanges(first.cursor)).moreComing).toBe(false)});
 it('codec rejects mismatched metadata',()=>{const r=encode(task());r.recordType='MA_Event';expect(()=>decode(r)).toThrow()});
 it('CloudKit saves with change tags and merges conflict',async()=>{const g=new MockCloudGateway(),a=new CloudKitRepository(g),b=new CloudKitRepository(g),e=task();await a.save(e,'create');const base=await b.fetch(e.id);await a.save(edit(e,{title:'A'},'a'),'editA');const result=await b.save(edit(base!,{priority:3},'b'),'editB');expect(result.fields).toMatchObject({title:'A',priority:3});expect(g.records.get(e.id)?.recordChangeTag).toBe('3')});
 it('CloudKit replay after lost response does not duplicate',async()=>{const g=new MockCloudGateway(),r=new CloudKitRepository(g),e=task();await r.save(e,'1');await r.save(e,'1');expect(g.log).toHaveLength(1)});
 it('CloudKit quarantines corrupt record',async()=>{const g=new MockCloudGateway(),r=new CloudKitRepository(g);g.log.push({...encode(task()),recordType:'bad'});const page=await r.fetchChanges();expect(page.entities).toHaveLength(0);expect(page.quarantine).toHaveLength(1)});
 it('sync drains durable outbox and paginated changes',async()=>{const s=await store(),auth=localAuth(),remote=new MemoryRepository(1);await auth.signIn();await remote.save(task(),'remote');await s.create('Task');await new SyncEngine(s,remote,auth).sync();expect(s.entities).toHaveLength(2);expect(s.outbox).toHaveLength(0);expect(s.status).toBe('ready')});
 it('sync recovers expired cursor',async()=>{const s=await store(),auth=localAuth(),r=new MemoryRepository();await auth.signIn();s.cursor='999';await r.save(task(),'remote');await new SyncEngine(s,r,auth).sync();expect(s.entities).toHaveLength(1);expect(s.cursor).toBe('1')});
 for(const code of ['network','rateLimit','permission','invalidRecord'] as const)it('classifies '+code,async()=>{const s=await store(),auth=localAuth(),g=new MockCloudGateway();await auth.signIn();await s.create('Task');g.failure=new RepositoryError(code,5000);await new SyncEngine(s,new CloudKitRepository(g),auth,()=>0).sync();expect(s.outbox[0].status).toBe(['permission','invalidRecord'].includes(code)?'permanentFailure':'retry');expect(s.outbox[0].nextAttemptAt).toBeGreaterThan(Date.now())});
 it('does not send later same-entity changes ahead of failed operation',async()=>{const s=await store(),auth=localAuth(),g=new MockCloudGateway();await auth.signIn();const e=await s.create('Task');await s.patch(e.id,{title:'second'});g.failure=new RepositoryError('network');await new SyncEngine(s,new CloudKitRepository(g),auth).sync();expect(s.outbox[0].attempts).toBe(1);expect(s.outbox[1].attempts).toBe(0)});
 it('rejects stale sign in response',async()=>{let resolve!:(v:string)=>void;const auth=new AuthManager({signIn:()=>new Promise(r=>resolve=r),signOut:async()=>{}});const pending=auth.signIn();await auth.signOut();resolve('A');await pending;expect(auth.identity).toBeNull();expect(auth.state).toBe('signedOut')});
 it('discards response after logout and new login',async()=>{const s=await store(),auth=localAuth(),e=task();await auth.signIn();let resolve!:(v:{entities:Entity[];cursor:string;moreComing:boolean})=>void;const remote={fetch:async()=>null,save:async(e:Entity)=>e,fetchChanges:()=>new Promise<{entities:Entity[];cursor:string;moreComing:boolean}>(r=>resolve=r)};const pending=new SyncEngine(s,remote,auth).sync();await auth.signOut();await auth.signIn();resolve({entities:[e],cursor:'1',moreComing:false});await pending;expect(s.entities).toHaveLength(0)});
});
describe('calendar dates recurrence search backup recovery',()=>{
 it('converts Madrid winter and summer',()=>{expect(wallToUTC('2026-01-10T09:00','Europe/Madrid')).toBe('2026-01-10T08:00:00.000Z');expect(wallToUTC('2026-07-10T09:00','Europe/Madrid')).toBe('2026-07-10T07:00:00.000Z')});
 it('rejects nonexistent spring DST time',()=>expect(()=>wallToUTC('2026-03-29T02:30','Europe/Madrid')).toThrow());
 it('accepts ambiguous fall DST consistently',()=>expect(dateInZone(wallToUTC('2026-10-25T02:30','Europe/Madrid'),'Europe/Madrid')).toBe('2026-10-25'));
 it('handles leap year',()=>{expect(addDays('2024-02-28',1)).toBe('2024-02-29');expect(addDays('2026-02-28',1)).toBe('2026-03-01')});
 it('recurrence maintains wall time across DST',()=>{const e=event();e.fields.recurrence={frequency:'daily',interval:1,weekdays:[],monthDay:null,count:3,until:null,exceptions:[]};const result=occurrences(e,'2026-03-28','2026-04-01');expect(result).toHaveLength(3);expect(result[1].start).toBe('2026-03-29T07:00:00.000Z')});
 it('recurrence exceptions and until',()=>{const e=event();e.fields.recurrence={frequency:'daily',interval:1,weekdays:[],monthDay:null,count:null,until:'2026-03-30',exceptions:['2026-03-29']};expect(occurrences(e,'2026-03-28','2026-04-10')).toHaveLength(2)});
 it('all-day civil date survives timezones',()=>{const e=createEntity('Event',{allDay:true,startDate:'2026-03-29',endDate:'2026-03-30',timezone:'America/Los_Angeles'});expect(occurrences(e,'2026-03-29','2026-03-29')[0].date).toBe('2026-03-29')});
 it('assigns columns to overlapping events',()=>{const a=occurrences(event(),'2026-03-28','2026-03-28')[0];const b={...a,key:'b'};expect(overlapColumns([a,b]).map(v=>v.column)).toEqual([0,1])});
 it('normalizes accents and ignores deleted results',()=>{const e=createEntity('QuickNote',{text:'Reunión sintética'});expect(select([e],{query:'reunion'})).toHaveLength(1);e.lifecycle='deleted';expect(select([e],{query:'reunion'})).toHaveLength(0)});
 it('reports orphan and duplicates',()=>{const e=task();e.fields.labelIDs=[crypto.randomUUID()];const report=integrity([e,clone(e)]);expect(report.issues.map(v=>v.code)).toEqual(['INVALID_RECORD','ORPHAN_LABEL'])});
 it('backup roundtrip excludes transport metadata',async()=>{const b=await exportBackup([task()]);expect(await parseBackup(JSON.stringify(b))).toEqual(b);expect(JSON.stringify(b)).not.toContain('recordChangeTag');expect(JSON.stringify(b)).not.toContain('outbox')});
 it('rejects corrupted checksum',async()=>{const b=await exportBackup([task()]);b.tasks[0].fields.title='tampered';await expect(parseBackup(JSON.stringify(b))).rejects.toThrow('CHECKSUM_FAILED')});
 it('rejects future backup schema',async()=>{const b=await exportBackup([]);await expect(parseBackup(JSON.stringify({...b,schemaVersion:2}))).rejects.toThrow('INVALID_BACKUP')});
 it('requires replace confirmation and supplies prior snapshot',async()=>{const s=await store();await s.create('Task');const b=await exportBackup([]);await expect(importBackup(s,b,'replace')).rejects.toThrow('CONFIRMATION_REQUIRED');const prior=await importBackup(s,b,'replace','REEMPLAZAR');expect(prior.entityCount).toBe(1);expect(s.entities[0].lifecycle).toBe('deleted')});
 it('backup merge preserves locally newer fields',async()=>{const s=await store(),e=await s.create('Task',{title:'old'}),b=await exportBackup([e]);await s.patch(e.id,{title:'new'});await importBackup(s,b,'merge');expect(s.entities[0].fields.title).toBe('new')});
 it('backup import rollback on storage failure',async()=>{const p=new MemoryPersistence(),s=await store(p);const b=await exportBackup([task()]);p.save=async()=>{throw Error('disk')};await expect(importBackup(s,b,'merge')).rejects.toThrow();expect(s.entities).toHaveLength(0)});
 it('default fields are independent',()=>{const a=defaults(),b=defaults();a.labelIDs.push('x');expect(b.labelIDs).toHaveLength(0)});
});
describe('additional regression coverage',()=>{
 it('rejects unknown metadata in imported entities',()=>expect(()=>validate({...task(),sessionToken:'synthetic'})).toThrow('UNKNOWN_METADATA'));
 it('rejects hidden fields inside field clocks',()=>{const e=task();e.fieldClocks.extra=e.fieldClocks.title;expect(()=>validate(e)).toThrow('UNKNOWN_CLOCK')});
 it('monthly recurrence skips nonexistent month dates',()=>{const e=createEntity('Event',{allDay:true,startDate:'2026-01-31',endDate:'2026-02-01',recurrence:{frequency:'monthly',interval:1,weekdays:[],monthDay:null,count:3,until:null,exceptions:[]}});expect(occurrences(e,'2026-01-01','2026-06-01').map(o=>o.date)).toEqual(['2026-01-31','2026-03-31','2026-05-31'])});
 it('weekly weekday selection and interval',()=>{const e=createEntity('Reminder',{due:'2026-09-21T08:00:00.000Z',recurrence:{frequency:'weekly',interval:2,weekdays:[1,3],monthDay:null,count:4,until:null,exceptions:[]}});expect(occurrences(e,'2026-09-21','2026-10-10').map(o=>o.date)).toEqual(['2026-09-21','2026-09-23','2026-10-05','2026-10-07'])});
 it('selector includes recurring reminders on future dates',()=>{const e=createEntity('Reminder',{due:'2026-09-21T08:00:00.000Z',recurrence:{frequency:'daily',interval:1,weekdays:[],monthDay:null,count:10,until:null,exceptions:[]}});expect(select([e],{date:'2026-09-26'})).toHaveLength(1)});
 it('does not display undated tasks in today selector',()=>expect(select([task()],{date:'2026-09-26'})).toHaveLength(0));
 it('sync authentication failure invalidates session',async()=>{const s=await store(),auth=localAuth(),g=new MockCloudGateway();await auth.signIn();await s.create('Task');g.failure=new RepositoryError('authentication');await new SyncEngine(s,new CloudKitRepository(g),auth).sync();expect(auth.state).toBe('expired');expect(s.outbox).toHaveLength(1)});
 it('quarantine travels durably with cursor',async()=>{const s=await store(),auth=localAuth(),g=new MockCloudGateway();await auth.signIn();g.log.push({...encode(task()),recordType:'bad'});await new SyncEngine(s,new CloudKitRepository(g),auth).sync();const disk=await s.persistence.load();expect(disk.cursor).toBe('1');expect(disk.quarantine).toHaveLength(1)});
 it('CloudKit rejects reusing operation ID for another edit',async()=>{const r=new CloudKitRepository(new MockCloudGateway()),e=task();await r.save(e,'same');await expect(r.save(edit(e,{title:'other'},'b'),'same')).rejects.toThrow('OPERATION_REUSE')});
 it('older logout completion cannot erase newer login state',async()=>{let resolve!:()=>void;const auth=new AuthManager({signIn:async()=> 'A',signOut:()=>new Promise<void>(r=>resolve=r)});await auth.signIn();const logout=auth.signOut();await auth.signIn();resolve();await logout;expect(auth.state).toBe('signedIn')});
});

// TB1 fixtures use explicit clocks so concurrency does not depend on wall time.
describe('Task scheduling core (TB1)',()=>{
 const keys=['scheduledStartAt','scheduledDurationMinutes','scheduledTimezone'] as const;
 const scheduled=()=>createEntity('Task',{scheduledStartAt:'2026-10-05T08:00:00.000Z',scheduledDurationMinutes:60,scheduledTimezone:'Europe/Madrid'},'a') as Task;
 const bump=(e:Task,key:typeof keys[number],writer='b')=>{e.fieldClocks[key]=nextClock(writer,Object.values(e.fieldClocks),0)};
 it('preserves historical validation serialization migration and decode',()=>{
  const e=task(),snapshot=JSON.stringify(e);validate(e);
  expect(serialize(e)).toBe(snapshot);expect(deserialize(snapshot)).toEqual(e);expect(migrate(e)).toEqual(e);expect(decode(encode(e))).toEqual(e);
  for(const key of keys){expect(Object.hasOwn(e.fields,key)).toBe(false);expect(Object.hasOwn(e.fieldClocks,key)).toBe(false)}
 });
 it('validates scheduled and modern unscheduled Tasks',()=>{
  const e=scheduled();expect(()=>validate(e)).not.toThrow();expect(deserialize(serialize(e))).toEqual(e);
  for(const key of keys)Object.assign(e.fields,{[key]:null});expect(()=>validate(e)).not.toThrow();
 });
 for(const key of keys){
  it('rejects partial fields '+key,()=>{const e=scheduled();delete e.fields[key];expect(()=>validate(e)).toThrow()});
  it('rejects missing clock '+key,()=>{const e=scheduled();delete e.fieldClocks[key];expect(()=>validate(e)).toThrow()});
 }
 for(const duration of [0,-1,NaN,Infinity])it('rejects duration '+duration,()=>{const e=scheduled();e.fields.scheduledDurationMinutes=duration;expect(()=>validate(e)).toThrow()});
 for(const zone of ['Moon/Sea','',null,'+01:00'])it('rejects timezone '+zone,()=>{const e=scheduled();e.fields.scheduledTimezone=zone;expect(()=>validate(e)).toThrow()});
 it('rejects invalid/non UTC start and null companions',()=>{
  for(const patch of [{scheduledStartAt:'2026-02-30T08:00:00.000Z'},{scheduledStartAt:'2026-10-05T08:00:00+02:00'},{scheduledDurationMinutes:null},{scheduledStartAt:null}]){
   const e=scheduled();Object.assign(e.fields,patch);expect(()=>validate(e)).toThrow();
  }
 });
 it('restricts fields to Task without changing defaults',()=>{
  for(const key of keys)expect(Object.hasOwn(defaults(),key)).toBe(false);
  const e=createEntity('QuickNote');Object.assign(e.fields,scheduled().fields);Object.assign(e.fieldClocks,scheduled().fieldClocks);expect(()=>validate(e)).toThrow();
 });
 it('combines independently moved start and resized duration',()=>{
  const base=scheduled(),a=clone(base),b=clone(base);a.fields.scheduledStartAt='2026-10-05T09:00:00.000Z';b.fields.scheduledDurationMinutes=90;bump(a,'scheduledStartAt');bump(b,'scheduledDurationMinutes');
  const m=merge(a,b) as Task;expect(m.fields).toMatchObject({scheduledStartAt:a.fields.scheduledStartAt,scheduledDurationMinutes:90,scheduledTimezone:'Europe/Madrid'});expect(m).toEqual(merge(b,a));
 });
 it('normalizes concurrent unschedule against newer resize without inventing clocks',()=>{
  const base=scheduled(),a=clone(base),b=clone(base);for(const key of keys){Object.assign(a.fields,{[key]:null});bump(a,key)}
  b.fields.scheduledDurationMinutes=90;b.fieldClocks.scheduledDurationMinutes=nextClock('c',Object.values(a.fieldClocks),0);
  const m=merge(a,b) as Task;expect(m.fields).toMatchObject({scheduledStartAt:null,scheduledDurationMinutes:null,scheduledTimezone:null});validate(m);expect(m).toEqual(merge(b,a));expect(m.fieldClocks.scheduledDurationMinutes).toEqual(b.fieldClocks.scheduledDurationMinutes);expect(m.updatedAt).toBe(base.updatedAt);expect(merge(m,m)).toEqual(m);
 });
 it('rejects merged planned start with null companions instead of inventing defaults',()=>{
  const base=scheduled(),a=clone(base),b=clone(base);for(const key of keys){Object.assign(a.fields,{[key]:null});bump(a,key)}
  b.fields.scheduledStartAt='2026-10-05T09:00:00.000Z';b.fieldClocks.scheduledStartAt=nextClock('c',Object.values(a.fieldClocks),0);
  expect(()=>merge(a,b)).toThrow('INVALID_SCHEDULING');expect(()=>merge(b,a)).toThrow('INVALID_SCHEDULING');
 });
 it('core updates can introduce optional clocks without throwing',()=>{
  const e=task(),scheduledFields=scheduled().fields;
  const updated=updateEntity(e,scheduledFields,'b');validate(updated);for(const key of keys)expect(updated.fieldClocks[key]).toBeDefined();
 });
 it('merges absent optional fields and clocks safely in both orders',()=>{
  const historical=task(),modern=scheduled();modern.id=historical.id;modern.createdAt=historical.createdAt;
  expect(merge(historical,modern)).toEqual(merge(modern,historical));expect((merge(historical,modern) as Task).fields.scheduledDurationMinutes).toBe(60);
  for(const key of keys)Object.assign(modern.fields,{[key]:null});expect(merge(historical,modern)).toEqual(merge(modern,historical));expect(merge(historical,historical)).toEqual(historical);
 });
 it('scopes missing/null diff equivalence to unscheduled scheduling',()=>{
  const e=task(),nulls:TaskScheduling={scheduledStartAt:null,scheduledDurationMinutes:null,scheduledTimezone:null};
  expect(diffFields(e.fields,{...e.fields,...nulls})).toEqual({});expect(updateEntity(e,nulls,'b')).toEqual(e);
  expect(diffFields(e.fields,{...e.fields,...nulls,title:'changed'})).toEqual({title:'changed'});
  expect(diffFields(scheduled().fields,{...scheduled().fields,...nulls})).toEqual(nulls);
 });
});
