import fixture from './full-snapshot.json';
import {buildGeneration} from '../../../src/mirror/generation';
import {MemoryMirrorTransport} from '../../../src/mirror/transport';
import type {MirrorEntity,MirrorSourceInfo} from '../../../src/mirror/contract';
export const entities=fixture.entities as MirrorEntity[];
export const source=fixture.source as MirrorSourceInfo;
export const stamp='2026-10-08T12:00:00.000Z';
export async function setupTransport(id='g1',items=entities){const generation=await buildGeneration(items,source,id,stamp);const transport=new MemoryMirrorTransport(generation.state,new Map([[id,generation.manifest]]),generation.buckets,generation.objects);return {generation,transport};}
