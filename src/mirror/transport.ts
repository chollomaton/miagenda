import type {MirrorBucketManifest,MirrorEntity,MirrorGenerationManifest,MirrorState} from './contract';
/** This interface has no publication API and cannot be passed to SyncEngine. */
export interface MirrorReadTransport {
 readState():Promise<unknown>;
 readGeneration(id:string):Promise<unknown>;
 readBucket(hash:string):Promise<unknown>;
 readObject(hash:string):Promise<unknown>;
}
export class MirrorOfflineError extends Error {constructor(){super('MIRROR_OFFLINE');}}
/** Local test adapter. Publication stores are fixture setup, never reader commands. */
export class MemoryMirrorTransport implements MirrorReadTransport {
 offline=false;
 constructor(public state:MirrorState|null,public generations=new Map<string,MirrorGenerationManifest>(),public buckets=new Map<string,MirrorBucketManifest>(),public objects=new Map<string,MirrorEntity>()){}
 private read(value:unknown){if(this.offline)throw new MirrorOfflineError();return structuredClone(value);}
 async readState(){return this.read(this.state);}
 async readGeneration(id:string){return this.read(this.generations.get(id)??null);}
 async readBucket(hash:string){return this.read(this.buckets.get(hash)??null);}
 async readObject(hash:string){return this.read(this.objects.get(hash)??null);}
}
