import {describe,it,expect} from 'vitest';
import {safeURL} from '../src/models/entities';
import {createHash} from 'node:crypto';
import fixture from './fixtures/mirror/full-snapshot.json';
import golden from './fixtures/mirror/golden-hashes.json';
import {canonicalJSON,sha256} from '../src/mirror/canonical';
import {buildGeneration} from '../src/mirror/generation';
import {validateEntity,validateSnapshot} from '../src/mirror/validation';
import type {MirrorEntity,MirrorSourceInfo} from '../src/mirror/contract';
export const entities=fixture.entities as MirrorEntity[];
export const source=fixture.source as MirrorSourceInfo;
export const stamp='2026-10-08T12:00:00.000Z';
describe('mirror canonical wire',()=>{
 it('preserves exact Apple contact references as inert text and rejects other opaque URLs',()=>{
  const entity=structuredClone(entities.find(e=>e.kind==='CalendarItem'&&e.lifecycle==='active')!);
  if(entity.kind!=='CalendarItem'||entity.lifecycle!=='active')throw Error('fixture');
  const contact='addressbook://00000000-0000-0000-0000-000000000001:ABPerson';
  entity.payload.url=contact;expect(()=>validateEntity(entity)).not.toThrow();expect(safeURL(contact)).toBe('');
  for(const url of [contact+'/extra','addressbook://invalid:ABPerson','javascript:alert(1)','file:///private/example']){
   entity.payload.url=url;expect(()=>validateEntity(entity)).toThrow('INVALID_URL');
  }
 });

 it('sorts keys, normalizes undefined/null and -0 with UTF-8 golden hash',async()=>{
  const value={z:undefined,b:'á🌍',a:-0};expect(canonicalJSON(value)).toBe('{"a":0,"b":"á🌍","z":null}');
  expect(await sha256(value)).toBe(createHash('sha256').update('{"a":0,"b":"á🌍","z":null}','utf8').digest('hex'));
 });
 it('matches SHA256 known-answer vector for canonical null',async()=>{expect(await sha256(null)).toBe('74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b');});
 it('sorts only documented numeric sets and preserves paired recurrence weekdays',()=>{
  expect(canonicalJSON({months:[12,1,1],weekdays:[4,2],weekNumbers:[1,0]})).toBe('{"months":[1,12],"weekNumbers":[1,0],"weekdays":[4,2]}');
 });
 it.each([NaN,Infinity,new Date(),new Map(),()=>{}])('rejects non-JSON values %s',value=>expect(()=>canonicalJSON(value)).toThrow());
 it('rejects depth/cycles rather than hanging',()=>{const value:Record<string,unknown>={};value.self=value;expect(()=>canonicalJSON(value)).toThrow('MIRROR_TOO_DEEP');});
 it('validates every native-shaped fixture preserving non-UUID IDs',()=>{for(const entity of entities)expect(()=>validateEntity(entity)).not.toThrow();expect(entities[4].id).toBe('clases');});
 it('produces identical root for reordered entities and source scopes',async()=>{
  const a=await buildGeneration(entities,source,'a',stamp),b=await buildGeneration([...entities].reverse(),source,'b',stamp);
  expect(a.rootHash).toBe(golden.rootHash);expect(a.manifest.buckets[0].hash).toBe(golden.bucketHash);expect(a.rootHash).toBe(b.rootHash);expect(await validateSnapshot({manifest:a.manifest,entities})).toEqual({valid:true,issues:[]});
 });
 it('binds source context to root and detects content changes',async()=>{
  const a=await buildGeneration(entities,source,'a',stamp),b=await buildGeneration(entities,{...source,publisherID:'other'},'b',stamp);
  expect(a.rootHash).not.toBe(b.rootHash);const changed=structuredClone(entities);if(changed[0].lifecycle==='active'&&changed[0].kind==='CalendarItem')changed[0].payload.title+='!';
  expect((await validateSnapshot({manifest:a.manifest,entities:changed})).issues).toContain('ROOT_HASH_MISMATCH');
 });
 it('rejects duplicate IDs and missing references',async()=>{
  expect(()=>validateEntity({...entities[4],payload:{...entities[4].payload,parent:'viajes'}})).toThrow('UNKNOWN_FIELDS');
  await expect(buildGeneration([...entities,entities[0]],source,'a',stamp)).rejects.toThrow('DUPLICATE_ID');
  await expect(buildGeneration(entities.filter(e=>e.kind!=='Label'),source,'a',stamp)).rejects.toThrow('MISSING_LABEL');
  await expect(buildGeneration(entities.filter(e=>e.id!=='reminder|apple-001'),source,'a',stamp)).rejects.toThrow('MISSING_TASK');
 });
 it('rejects invalid calendar ranges, dates and recurrence pairs',()=>{
  const e=structuredClone(entities[3]);if(e.lifecycle==='active'&&e.kind==='CalendarItem'){e.payload.end=e.payload.start;expect(()=>validateEntity(e)).toThrow('INVALID_RANGE');}
  const t=structuredClone(entities[0]);if(t.lifecycle==='active'&&t.kind==='CalendarItem'){t.payload.dueComponents!.date='2026-02-30';expect(()=>validateEntity(t)).toThrow('INVALID_CIVIL_DATE');}
  const r=structuredClone(entities[2]);if(r.lifecycle==='active'&&r.kind==='CalendarItem'){r.payload.recurrence[0].weekNumbers=[];expect(()=>validateEntity(r)).toThrow('INVALID_WEEK_PAIRS');}
 });
 it('preserves Madrid DST elapsed duration without guessing civil offsets',()=>{
  const e=entities[3];if(e.lifecycle==='active'&&e.kind==='CalendarItem')expect(Date.parse(e.payload.end!)-Date.parse(e.payload.start!)).toBe(120*60000);
 });
});
