import 'fake-indexeddb/auto';
import {describe,it,expect,vi} from 'vitest';
import {createEntity,updateEntity,merge,clone,validate} from '../src/models/entities';
import type {TemplateDefinition,Template,Entity} from '../src/models/entities';
import {serialize,deserialize,diffFields,normalizeTemplateFields} from '../src/models/serialization';
import {templateToDraft} from '../src/models/templateDraft';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence,IndexedDBPersistence} from '../src/offline/Persistence';
import {encode,decode,CloudKitRepository,MockCloudGateway} from '../src/cloud/CloudGateway';
import {firebaseDocument,firebaseRecord} from '../src/cloud/FirebaseCloudTransport';
import {exportBackup,parseBackup,importBackup,backupEntities} from '../src/backup/backup';
import {integrity} from '../src/recovery/integrity';
import {select} from '../src/search/selectors';
import {occurrences} from '../src/utils/calendar';
const task:TemplateDefinition={targetKind:'Task',values:{title:'Call',notes:'Details',labelIDs:[],priority:2}};
const reminder:TemplateDefinition={targetKind:'Reminder',values:{title:'Review',alerts:[15]},recurrence:{frequency:'weekly',interval:2,weekdays:[1],monthDay:null,count:3}};
const event:TemplateDefinition={targetKind:'Event',values:{title:'Meeting',location:'Office',url:'https://example.com',alerts:[5]},durationMinutes:45};
const template=(definition:TemplateDefinition=task)=>createEntity('Template',{name:'Reusable',definition});
async function store(persistence=new MemoryPersistence()){const s=new AgendaStore(persistence,'test');await s.boot();return s;}
function invalid(definition:unknown){expect(()=>template(definition as TemplateDefinition)).toThrow();}
function current(s:AgendaStore,id:string):Template{const e=s.entities.find(e=>e.id===id);if(e?.kind!=='Template')throw Error('Template required');return e;}
async function hash(entities:Entity[]){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(entities))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
describe('Template domain',()=>{
 it.each([task,reminder,event])('accepts %j with only own fields and clocks',definition=>{const e=template(definition);validate(e);expect(Object.keys(e.fields).sort()).toEqual(['definition','name']);expect(Object.keys(e.fieldClocks).sort()).toEqual(['definition','lifecycle','name']);expect(deserialize(serialize(e))).toEqual(e);expect(e.schemaVersion).toBe(1);});
 it.each(['QuickNote','Note','Label','Subtask','Preferences','Other'])('rejects target %s',targetKind=>invalid({targetKind,values:{}}));
 it.each(['scheduledStartAt','scheduledDurationMinutes','scheduledTimezone','due'])('rejects Task default %s',key=>invalid({targetKind:'Task',values:{[key]:key.includes('Duration')?30:'2026-10-05T09:00:00.000Z'}}));
 it.each(['start','end','startDate','endDate'])('rejects Event absolute %s',key=>invalid({targetKind:'Event',values:{[key]:'2026-10-05T09:00:00.000Z'}}));
 it.each(['id','schemaVersion','createdAt','updatedAt','fieldClocks','lifecycle','completed','completedAt','parentTaskId','parentLabelId','theme','extra'])('rejects metadata or extra default %s',key=>invalid({targetKind:'Task',values:{[key]:'invalid'}}));
 it.each([0,-1,NaN,Infinity,-Infinity])('rejects duration %s',durationMinutes=>invalid({...event,durationMinutes}));
 it('strictly validates definition, fields, recurrence and clocks',()=>{
  invalid({...task,extra:true});invalid({...task,recurrence:reminder.targetKind==='Reminder'?reminder.recurrence:null});
  invalid({...reminder,values:{priority:1}});
  for(const key of ['until','exceptions','extra'])invalid({...reminder,recurrence:{...(reminder.targetKind==='Reminder'?reminder.recurrence:{}),[key]:null}});
  invalid({...reminder,recurrence:undefined});invalid({...task,values:{title:undefined}});invalid({...task,values:{labelIDs:['missing']}});invalid({...event,values:{alerts:[-1]}});invalid({...task,values:{priority:4}});invalid({...event,values:{url:'javascript:alert(1)'}});
  const e=template();for(const mutation of [(t:Template)=>Object.assign(t.fields,{title:'extra'}),(t:Template)=>Object.assign(t.fieldClocks,{title:t.fieldClocks.name}),(t:Template)=>delete t.fieldClocks.definition,(t:Template)=>{t.fieldClocks.name.logical=-1;},(t:Template)=>{t.fields.name=' ';}]){const t=clone(e);mutation(t);expect(()=>validate(t)).toThrow();}
 });
 it('merges definition atomically and name independently',()=>{
  const base=template(),a=updateEntity(base,{definition:reminder},'a'),b=updateEntity(base,{name:'New name',definition:event},'b');
  a.fieldClocks.definition={physicalMilliseconds:Date.now()+1000,logical:0,writerID:'a'};
  const result=merge(a,b);expect(result.fields).toEqual({name:'New name',definition:reminder});expect(merge(b,a)).toEqual(result);
  if(a.kind!=='Template')throw Error('Template required');a.fields.definition.values.title='Mutated source';expect(result.fields).toEqual({name:'New name',definition:reminder});
 });
 it('normalizes and diffs own fields without materializing historical defaults',()=>{const e=template();expect(normalizeTemplateFields({name:'  Name '})).toEqual({name:'Name'});expect(diffFields(e.fields,clone(e.fields))).toEqual({});expect(diffFields(e.fields,{...e.fields,definition:event})).toEqual({definition:event});expect(Object.hasOwn(createEntity('Task').fields,'definition')).toBe(false);});
 it('clones definitions on create/edit/merge and returns a pure independent draft',async()=>{
  const persistence=new MemoryPersistence(),s=await store(persistence),writes=vi.spyOn(persistence,'save'),definition=clone(task),e=template(definition);const before=s.snapshot();const draft=templateToDraft(e);const created=createEntity('Task',draft.fields);
  draft.fields.title='Draft edit';draft.fields.labelIDs?.push(crypto.randomUUID());expect(e.fields.definition).toEqual(task);expect(created.fields.title).toBe('Call');
  definition.values.title='External edit';expect(e.fields.definition).toEqual(task);
  const edited=updateEntity(e,{definition:event},'other');expect(created.fields.title).toBe('Call');expect(created.fields.labelIDs).toEqual([]);expect(e.fields.definition).toEqual(task);expect((edited as Template).fields.definition).toEqual(event);expect(s.snapshot()).toEqual(before);expect(writes).not.toHaveBeenCalled();
  expect(templateToDraft(template(reminder))).toMatchObject({kind:'Reminder',recurrence:{frequency:'weekly'}});expect(templateToDraft(template(event))).toMatchObject({kind:'Event',durationMinutes:45});
 });
});
describe('Template persistence and cloud',()=>{
 it('CRUD, no-op and outbox use normal operations; undo/redo preserve fields',async()=>{
  const s=await store(),e=await s.create('Template',{name:'Reusable',definition:task});expect(s.outbox).toHaveLength(1);
  const before=s.snapshot();await s.patch(e.id,{name:'Reusable',definition:clone(task)});expect(s.snapshot()).toEqual(before);
  await s.patch(e.id,{name:'Renamed',definition:event});expect(s.outbox).toHaveLength(2);expect(current(s,e.id).fields).toEqual({name:'Renamed',definition:event});
  await s.undo();expect(current(s,e.id).fields).toEqual({name:'Reusable',definition:task});await s.redo();expect(current(s,e.id).fields).toEqual({name:'Renamed',definition:event});
  await s.service.delete(e.id);expect(current(s,e.id).lifecycle).toBe('deleted');await s.service.restore(e.id);expect(current(s,e.id).lifecycle).toBe('active');expect(s.outbox.map(o=>o.payload.lifecycle)).toEqual(['active','active','active','active','deleted','active']);expect(s.outbox.every(o=>o.entityKind==='Template')).toBe(true);
  await s.undo();expect(current(s,e.id).lifecycle).toBe('deleted');await s.redo();expect(current(s,e.id).lifecycle).toBe('active');
 });
 it('IndexedDB reload preserves Template, tombstone and every pending operation',async()=>{
  const identity=crypto.randomUUID(),a=new AgendaStore(new IndexedDBPersistence(identity));await a.boot();const e=await a.create('Template',{name:'Name',definition:reminder});await a.patch(e.id,{definition:event});await a.service.delete(e.id);
  const b=new AgendaStore(new IndexedDBPersistence(identity));await b.boot();expect(b.entities).toEqual(a.entities);expect(b.outbox).toEqual(a.outbox);await b.service.restore(e.id);const c=new AgendaStore(new IndexedDBPersistence(identity));await c.boot();expect(c.entities).toEqual(b.entities);expect(c.outbox).toHaveLength(4);
 });
 it.each(['active','deleted'] as const)('cloud and Firebase roundtrip preserve %s payload and reject identity mismatches',lifecycle=>{
  const e=updateEntity(template(event),{},'writer',lifecycle),record=encode(e),doc=firebaseDocument(record,'operation');expect(decode(record)).toEqual(e);expect(decode(firebaseRecord('Template__'+e.id,doc))).toEqual(e);expect(Object.keys(record.fields).sort()).toEqual(['createdAt','fieldClocksJSON','lifecycle','payloadJSON','schemaVersion','updatedAt']);
  expect(()=>firebaseRecord('Task__'+e.id,doc)).toThrow();expect(()=>firebaseRecord('Template__'+e.id,{...doc,kind:'Task'})).toThrow();expect(()=>firebaseRecord('Template__'+e.id,{...doc,entityId:crypto.randomUUID()})).toThrow();
 });
 it('generic cloud repository saves and fetches Templates',async()=>{const repository=new CloudKitRepository(new MockCloudGateway()),e=template();expect(await repository.save(e,'op')).toMatchObject(e);expect(await repository.fetch(e.id)).toMatchObject(e);});
});
describe('Template backups and references',()=>{
 it('Backup V2 explicitly groups Templates and checks checksum/count before integrity',async()=>{
  const e=template(),b=await exportBackup([e,createEntity('Task')]);expect(b.format).toBe('MiAgendaBackupV2');expect(b.formatVersion).toBe(2);expect(b.entityCount).toBe(2);expect(b.templates).toEqual([e]);expect(b.checksum).toBe(await hash(backupEntities(b)));expect(await parseBackup(JSON.stringify(b))).toEqual(b);
  await expect(parseBackup(JSON.stringify({...b,entityCount:1}))).rejects.toThrow('INVALID_BACKUP');const broken=clone(b);(broken.templates[0] as Template).fields.name='Modified';await expect(parseBackup(JSON.stringify(broken))).rejects.toThrow('CHECKSUM_FAILED');
 });
 it('historical V1 checksum uses original bytes/order, with no templates or normalization',async()=>{
  const e=createEntity('Task',{title:'  Historic  '}),v2=await exportBackup([e]);const {templates,...groups}=v2;expect(templates).toEqual([]);const v1={...groups,format:'MiAgendaBackupV1',formatVersion:1,checksum:await hash([e])};
  const parsed=await parseBackup(JSON.stringify(v1));expect(parsed).toEqual(v1);expect(backupEntities(parsed)).toEqual([e]);expect(Object.hasOwn(parsed,'templates')).toBe(false);const s=await store();await importBackup(s,parsed,'merge');expect(s.entities[0].fields.title).toBe('  Historic  ');
  await expect(parseBackup(JSON.stringify({...v1,tasks:[{...e,fields:{...e.fields,title:'Historic'}}]}))).rejects.toThrow('CHECKSUM_FAILED');
  await expect(parseBackup(JSON.stringify({...v1,tasks:[{...e,fields:{...e.fields,extra:true}}]}))).rejects.toThrow('CHECKSUM_FAILED');
 });
 it('merge and replace treat Templates normally and keep a V2 safety backup',async()=>{
  const s=await store(),original=template(),extra=template(event);await s.commit([original,extra]);const incoming=updateEntity(original,{definition:reminder},'remote');const b=await exportBackup([incoming]);await importBackup(s,b,'merge');expect(current(s,original.id).fields.definition).toEqual(reminder);expect(current(s,extra.id).lifecycle).toBe('active');
  const previous=await importBackup(s,b,'replace','REEMPLAZAR');expect(previous.formatVersion).toBe(2);expect(current(s,extra.id).lifecycle).toBe('deleted');expect(current(s,original.id).fields.definition).toEqual(reminder);
  const fresh=await store();await importBackup(fresh,b,'replace','REEMPLAZAR');expect(fresh.entities).toEqual([incoming]);
 });
 it('deleted Labels remain referenced; missing Labels report an orphan without mutation',async()=>{
  const label=createEntity('Label'),e=template({...task,values:{...task.values,labelIDs:[label.id]}}),deleted=updateEntity(label,{},'writer','deleted'),before=clone(e);expect(integrity([e,deleted]).issues).toEqual([{id:e.id,code:'DELETED_LABEL_REFERENCE',status:'WARNING'}]);expect(integrity([e]).issues).toEqual([{id:e.id,code:'ORPHAN_LABEL',status:'WARNING'}]);expect(e).toEqual(before);
  const s=await store();await s.commit([e,deleted]);for(const o of [...s.outbox])await s.remote([],undefined,o.operationID);await expect(s.purge([label.id],'PURGAR')).rejects.toThrow('PURGE_NOT_ACKNOWLEDGED');expect(current(s,e.id)).toEqual(before);
 });
 it('global search and calendar exclude Template',()=>{const e=template(),t=createEntity('Task',{title:'Reusable'});expect(select([e,t])).toEqual([t]);expect(select([e,t],{query:'Reusable'})).toEqual([t]);expect(select([e],{kind:'Template'})).toEqual([]);expect(select([updateEntity(e,{},'writer','deleted')],{trash:true})).toEqual([]);expect(occurrences(e,'2026-01-01','2026-12-31')).toEqual([]);});
});
