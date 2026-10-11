import {sha256} from './canonical';
import {IndexedDBMirrorCache} from './cache';
import {MirrorReader} from './reader';
import type {MirrorReadTransport} from './transport';
import {MirrorOfflineError} from './transport';
import {validateState} from './validation';
function availableStorage():Storage|null {try{return localStorage;}catch{return null;}}
interface Locator {version:1;publisherID:string;generationID:string}
/** A locator is never authority: auth scopes it, and the reader verifies every cached byte. */
export class LocalMirrorSession {
 private reader:MirrorReader|null=null;
 private caches=new Set<IndexedDBMirrorCache>();
 private key='';private stopped=false;private tail:Promise<unknown>=Promise.resolve();
 private alive=()=>!this.stopped&&this.valid();
 private readerCaches=new WeakMap<MirrorReader,IndexedDBMirrorCache>();
 private release(reader:MirrorReader){const cache=this.readerCaches.get(reader);if(cache){this.caches.delete(cache);void cache.close().catch(()=>{});}}
 private downloads=new WeakMap<MirrorReader,MirrorReader['refresh']>();
 constructor(private ownerScope:string,private transport:MirrorReadTransport,private valid:()=>boolean,private adopt:(reader:MirrorReader)=>void,private storage:Storage|null=availableStorage()){}
 private locator():Locator|null {try{const value:unknown=JSON.parse(this.storage?.getItem(this.key)??'null');if(!value||typeof value!=='object')return null;const v=value as Locator;return Object.keys(v).sort().join(',')==='generationID,publisherID,version'&&v.version===1&&typeof v.publisherID==='string'&&v.publisherID.length>0&&v.publisherID.length<=2000&&typeof v.generationID==='string'&&v.generationID.length>0&&v.generationID.length<=2000&&!v.generationID.includes('/')?v:null;}catch{return null;}}
 private make(publisherID:string){const cache=new IndexedDBMirrorCache(this.ownerScope,publisherID);this.caches.add(cache);const reader=new MirrorReader(this.transport,cache,publisherID,this.alive);this.readerCaches.set(reader,cache);this.downloads.set(reader,reader.refresh.bind(reader));reader.refresh=async()=>await this.refresh()??{valid:false,issues:['MIRROR_UNAVAILABLE']};return reader;}
 private remember(reader:MirrorReader){const m=reader.manifest;if(!this.alive()||!m)return;try{this.storage?.setItem(this.key,JSON.stringify({version:1,publisherID:m.source.publisherID,generationID:m.generationID}));}catch{/* Storage may be disabled; validated data still works in this session. */}}
 async boot(){this.key='miagenda-mirror-locator-v1:'+await sha256(this.ownerScope);if(!this.alive())return;
  const location=this.locator();let publishers=location?[location.publisherID]:[];
  // Upgrade recovery: pre-locator caches can be located without contacting Firebase.
  if(!location&&typeof indexedDB.databases==='function')try{const databases=await indexedDB.databases();publishers=databases.flatMap(({name})=>{if(!name?.startsWith('miagenda-icloud-mirror-v1:'))return [];try{const scope:unknown=JSON.parse(name.slice('miagenda-icloud-mirror-v1:'.length));return Array.isArray(scope)&&scope.length===2&&scope[0]===this.ownerScope&&typeof scope[1]==='string'&&scope[1].length>0&&scope[1].length<=2000?[scope[1]]:[];}catch{return [];}}).slice(0,32);}catch{/* Enumeration is optional, and never a substitute for auth. */}
  let best:MirrorReader|null=null;
  for(const publisher of publishers){if(!this.alive())break;const reader=this.make(publisher);await reader.boot();if(!this.alive()){reader.detach();this.release(reader);break;}if(reader.manifest&&(!best?.manifest||reader.manifest.publishedAt>best.manifest.publishedAt)){if(best)this.release(best);best=reader;}else this.release(reader);}
  if(best&&this.alive()){this.reader=best;this.adopt(best);this.remember(best);}else if(best){best.detach();this.release(best);}
 }
 refresh(){const result=this.tail.then(()=>this.download()).catch(error=>{if(this.alive()&&error instanceof MirrorOfflineError)this.reader?.markOffline();throw error;});this.tail=result.catch(()=>{});return result;}
 private async download(){if(!this.alive())return;const state=await this.transport.readState();if(!this.alive()||state===null)return;validateState(state);
  const replacement=this.reader?.manifest?.source.publisherID!==state.publisherID;
  const candidate=replacement?this.make(state.publisherID):this.reader!;
  const result=await this.downloads.get(candidate)!();if(!this.alive()){candidate.detach();return;}
  if(result.valid){if(replacement){if(this.reader){this.reader.detach();this.release(this.reader);}this.reader=candidate;this.adopt(candidate);}this.remember(candidate);}else if(replacement){candidate.detach();this.release(candidate);}
  return result;
 }
 dispose(){this.stopped=true;this.reader?.detach();for(const cache of this.caches)void cache.close().catch(()=>{});this.caches.clear();}
}
