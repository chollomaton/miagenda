import {doc,getDoc} from 'firebase/firestore/lite';
import type {Firestore} from 'firebase/firestore/lite';
import type {MirrorReadTransport} from './transport';
import {MirrorOfflineError} from './transport';
/** The same Firestore adapter is used for the normal runtime and the emulator. */
export function firestoreMirrorTransport(db:Firestore,ownerUID:string,valid:()=>boolean,onUnauthenticated:()=>void):MirrorReadTransport {
 const read=async(...segments:string[])=>{
  if(!valid())throw Error('STALE_SESSION');let snapshot;
  try{snapshot=await getDoc(doc(db,'users',ownerUID,'icloudMirror','state',...segments));}
  catch(error){if((error as {code?:string}).code==='unauthenticated'&&valid())onUnauthenticated();if(!navigator.onLine||(error as {code?:string}).code==='unavailable'||(error as {code?:string}).code==='unknown'&&String((error as {message?:string}).message).includes('HTTP error has no status'))throw new MirrorOfflineError();throw error;}
  if(!valid())throw Error('STALE_SESSION');if(!snapshot.exists())return null;
  const data=snapshot.data();return segments.length&&Object.keys(data).sort().join(',')==='payload,publisherID'?data.payload:data;
 };
 return {readState:()=>read(),readGeneration:id=>read('generations',id),readBucket:hash=>read('buckets',hash),readObject:hash=>read('objects',hash)};
}
