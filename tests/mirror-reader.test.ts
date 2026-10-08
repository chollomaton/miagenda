import {describe,it,expect} from 'vitest';
import 'fake-indexeddb/auto';
import {MemoryMirrorCache,IndexedDBMirrorCache} from '../src/mirror/cache';
import {MirrorReader,freshnessLabel} from '../src/mirror/reader';
import {buildGeneration} from '../src/mirror/generation';
import {entities,source,stamp,setupTransport} from './fixtures/mirror/helpers';
import {canonicalJSON} from '../src/mirror/canonical';
describe('generation reader integrity and isolation',()=>{
 async function setup(){const {generation,transport}=await setupTransport();const cache=new MemoryMirrorCache(),reader=new MirrorReader(transport,cache,source.publisherID,()=>true,()=>Date.parse(stamp)+60000);return {generation,transport,cache,reader};}
 it('activates valid generation with structurally absent mutation APIs',async()=>{
  const {reader,cache}=await setup();expect(await reader.refresh()).toEqual({valid:true,issues:[]});expect(reader.entities).toHaveLength(entities.length);
  expect(Object.keys(reader.capabilities).filter(k=>reader.capabilities[k as keyof typeof reader.capabilities])).toEqual(['read']);
  for(const api of ['commands','outbox','push','save','create','complete','patch','service'])expect(api in reader).toBe(false);
  expect((await cache.load()).current?.manifest.generationID).toBe('g1');
 });
 it.each(['incomplete','object-hash','root-hash','unknown-schema','entity-count','bucket-hash','publisher','manifest-id','state-hash'])('retains current after %s candidate',async(mode)=>{
  const {reader,cache,transport}=await setup();await reader.refresh();const old=canonicalJSON(await cache.load());const next=await buildGeneration(entities,source,'g2',stamp);
  transport.generations.set('g2',next.manifest);transport.state={...next.state,previousGeneration:'g1'};
  switch(mode){
   case 'incomplete':transport.objects.delete([...next.objects.keys()][0]);break;
   case 'object-hash':{const e=structuredClone(entities[0]);if(e.lifecycle==='active'&&e.kind==='CalendarItem')e.payload.title='CORRUPT';transport.objects.set([...next.objects.keys()][0],e);break;}
   case 'root-hash':next.manifest.rootHash='a'.repeat(64);transport.state.rootHash=next.manifest.rootHash;break;
   case 'unknown-schema':Object.assign(next.manifest,{mirrorSchemaVersion:999});break;
   case 'entity-count':next.manifest.entityCount++;break;
   case 'bucket-hash':transport.buckets.delete(next.manifest.buckets[0].hash);break;
   case 'publisher':transport.state.publisherID='revoked';break;
   case 'manifest-id':next.manifest.generationID='other';break;
   case 'state-hash':transport.state.rootHash='b'.repeat(64);break;
  }
  expect((await reader.refresh()).valid).toBe(false);expect(reader.manifest?.generationID).toBe('g1');expect(canonicalJSON(await cache.load())).toBe(old);
 });
 it('offline boot revalidates cached generation',async()=>{
  const {reader,cache,transport}=await setup();await reader.refresh();transport.offline=true;const next=new MirrorReader(transport,cache,source.publisherID);await next.boot();expect(next.entities).toEqual(reader.entities);expect(next.freshness.status).toBe('offline');expect((await next.refresh()).issues).toEqual(['MIRROR_OFFLINE']);expect(next.entities).toEqual(reader.entities);
 });
 it('keeps current and previous atomically',async()=>{
  const {reader,cache,transport}=await setup();await reader.refresh();const next=await buildGeneration(entities,source,'g2',stamp);transport.generations.set('g2',next.manifest);transport.state={...next.state,previousGeneration:'g1'};expect((await reader.refresh()).valid).toBe(true);const record=await cache.load();expect(record.current?.manifest.generationID).toBe('g2');expect(record.previous?.manifest.generationID).toBe('g1');
 });
 it('does not activate when pointer changes during download',async()=>{
  const {reader,transport,cache}=await setup();let calls=0;const read=transport.readState.bind(transport);transport.readState=async()=>{const state=await read();if(++calls===2&&state)return {...state,currentGeneration:'g2'};return state;};expect((await reader.refresh()).issues).toEqual(['GENERATION_CHANGED']);expect((await cache.load()).current).toBeNull();
 });
 it('detachment invalidates in-flight download and later calls',async()=>{
  const {reader,transport,cache}=await setup();const original=transport.readObject.bind(transport);transport.readObject=async hash=>{reader.detach();return original(hash);};expect((await reader.refresh()).issues).toEqual(['STALE_SESSION']);expect((await cache.load()).current).toBeNull();expect(reader.entities).toEqual([]);expect((await reader.refresh()).issues).toEqual(['STALE_SESSION']);
 });
 it('returned objects cannot mutate live generation',async()=>{const {reader}=await setup();await reader.refresh();const copy=reader.entities;copy[0].id='changed';expect(reader.entities[0].id).not.toBe('changed');const manifest=reader.manifest!;manifest.rootHash='changed';expect(reader.manifest?.rootHash).not.toBe('changed');});
 it('revalidation falls back to previous corrupt cached generation',async()=>{
  const {reader,cache,transport}=await setup();await reader.refresh();const old=await cache.load();const corrupted=structuredClone(old.current!);corrupted.manifest.generationID='corrupt-g2';corrupted.manifest.rootHash='a'.repeat(64);await cache.activate(corrupted,old.revision,()=>true);const next=new MirrorReader(transport,cache,source.publisherID);await next.boot();expect(next.entities).toHaveLength(entities.length);expect(next.manifest?.rootHash).toBe(old.current!.manifest.rootHash);
 });
 it('stale cache revision and invalid session abort IndexedDB activation',async()=>{
  const {generation}=await setupTransport();const cache=new IndexedDBMirrorCache(crypto.randomUUID(),source.publisherID);const snapshot={manifest:generation.manifest,entities};await cache.activate(snapshot,0,()=>true);
  await expect(cache.activate(snapshot,0,()=>true)).rejects.toThrow('MIRROR_CACHE_CHANGED');await expect(cache.activate(snapshot,1,()=>false)).rejects.toThrow('STALE_SESSION');expect((await cache.load()).revision).toBe(1);await cache.close();
 });
 it('IndexedDB persists current/previous and separates owner/publisher scopes',async()=>{
  const owner=crypto.randomUUID();const a=new IndexedDBMirrorCache(owner,'publisher-a'),b=new IndexedDBMirrorCache(owner,'publisher-b'),c=new IndexedDBMirrorCache('other-'+owner,'publisher-a');const {generation}=await setupTransport();await a.activate({manifest:generation.manifest,entities},0,()=>true);
  expect((await b.load()).current).toBeNull();expect((await c.load()).current).toBeNull();await a.close();const reopened=new IndexedDBMirrorCache(owner,'publisher-a');expect((await reopened.load()).current?.manifest.generationID).toBe('g1');await Promise.all([reopened.close(),b.close(),c.close()]);
 });
 it('has fresh/stale/offline/empty Spanish labels',()=>{
  expect(freshnessLabel({status:'empty',publishedAt:null,ageMilliseconds:null})).toContain('sin copia');expect(freshnessLabel({status:'fresh',publishedAt:stamp,ageMilliseconds:60000})).toBe('Actualizada hace 1 min');expect(freshnessLabel({status:'stale',publishedAt:stamp,ageMilliseconds:9999999})).toContain('Última actualización');expect(freshnessLabel({status:'offline',publishedAt:stamp,ageMilliseconds:1})).toContain('Sin conexión');
 });
});
