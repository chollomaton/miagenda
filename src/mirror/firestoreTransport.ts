import {doc,getDoc} from 'firebase/firestore/lite';
import type {Firestore} from 'firebase/firestore/lite';
import type {MirrorReadTransport} from './transport';
import {MirrorOfflineError} from './transport';
/** The same Firestore adapter is used for the normal runtime and the emulator. */
export function firestoreMirrorTransport(db:Firestore,ownerUID:string,valid:()=>boolean,onUnauthenticated:()=>void):MirrorReadTransport {
 // Content is immutable under Rules. Revalidate bytes in the reader, but avoid paying
 // a remote read for every entity on every poll. State always bypasses this bounded session cache.
 const immutable=new Map<string,{value:unknown;size:number}>();let bytes=0;
 const read=async(...segments:string[])=>{
  if(!valid())throw Error('STALE_SESSION');const key=segments.join('/');if(segments.length&&immutable.has(key))return structuredClone(immutable.get(key)!.value);let snapshot;
  try{snapshot=await getDoc(doc(db,'users',ownerUID,'icloudMirror','state',...segments));}
  catch(error){if((error as {code?:string}).code==='unauthenticated'&&valid())onUnauthenticated();if(!navigator.onLine||(error as {code?:string}).code==='unavailable'||(error as {code?:string}).code==='unknown'&&String((error as {message?:string}).message).includes('HTTP error has no status'))throw new MirrorOfflineError();throw error;}
  if(!valid())throw Error('STALE_SESSION');if(!snapshot.exists())return null;
  const data=snapshot.data(),value=segments.length&&Object.keys(data).sort().join(',')==='payload,publisherID'?data.payload:data;
  if(segments.length){const size=JSON.stringify(value).length;if(size<=4*1024*1024){while(immutable.size&&(immutable.size>=512||bytes+size>4*1024*1024)){const oldest=immutable.keys().next().value!;bytes-=immutable.get(oldest)!.size;immutable.delete(oldest);}immutable.set(key,{value:structuredClone(value),size});bytes+=size;}}
  return value;
 };
 return {readState:()=>read(),readGeneration:id=>read('generations',id),readBucket:hash=>read('buckets',hash),readObject:hash=>read('objects',hash)};
}
