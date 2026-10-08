import {canonicalJSON,sha256} from './canonical';
import {validateRelations,validateSource} from './validation';
import type {MirrorBucketManifest,MirrorEntity,MirrorGenerationManifest,MirrorSourceInfo,MirrorState} from './contract';
export const entityKey=(e:{id:string;kind:string})=>canonicalJSON([e.kind,e.id]);
export async function buildContent(entities:MirrorEntity[],source:MirrorSourceInfo) {
 validateRelations(entities);validateSource(source);
 const sorted=[...entities].sort((a,b)=>entityKey(a)<entityKey(b)?-1:entityKey(a)>entityKey(b)?1:0);
 const objects=new Map<string,MirrorEntity>(),buckets=new Map<string,MirrorBucketManifest>();
 const references=await Promise.all(sorted.map(async e=>{const hash=await sha256(e);objects.set(hash,structuredClone(e));return {id:e.id,kind:e.kind,hash};}));
 const bucketReferences=[];
 for(let i=0;i<references.length;i+=256){const bucket:MirrorBucketManifest={mirrorSchemaVersion:1,entities:references.slice(i,i+256)};const hash=await sha256(bucket);buckets.set(hash,bucket);bucketReferences.push({hash,entityCount:bucket.entities.length});}
 const normalizedSource={...source,calendarScope:[...source.calendarScope].sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:a.end<b.end?-1:a.end>b.end?1:0)};
 const rootHash=await sha256({mirrorSchemaVersion:1,source:normalizedSource,entityCount:entities.length,buckets:bucketReferences});
 return {objects,buckets,bucketReferences,rootHash};
}
/** Local fixture/publisher scaffold only; not connected to production. */
export async function buildGeneration(entities:MirrorEntity[],source:MirrorSourceInfo,generationID:string,capturedAt:string,publishedAt=capturedAt) {
 const content=await buildContent(entities,source);
 const manifest:MirrorGenerationManifest={mirrorSchemaVersion:1,generationID,source:structuredClone(source),rootHash:content.rootHash,entityCount:entities.length,buckets:content.bucketReferences,capturedAt,publishedAt};
 const state:MirrorState={mirrorSchemaVersion:1,currentGeneration:generationID,previousGeneration:null,publisherID:source.publisherID,publishedAt,rootHash:content.rootHash};
 return {...content,manifest,state};
}
