import {diagnostic,diagnosticCorrelation,diagnosticError} from './pairingDiagnostic';
import {doc,getDoc,runTransaction,serverTimestamp,Timestamp} from 'firebase/firestore/lite';
import type {Firestore} from 'firebase/firestore/lite';
import type {Auth} from 'firebase/auth';
import {sha256} from './canonical';

export interface PairingPreview {publisherUID:string;expiresAt:Date}
/** Uses ordinary client credentials and rules. No admin API or external authority. */
export class ProductionOwnerPairing {
 private activeDiagnosticCorrelation='';
 constructor(private db:Firestore,private auth:Auth,private enabled:boolean){}
 private owner(){const user=this.auth.currentUser;if(!this.enabled||!user||!user.providerData.some(p=>p.providerId==='google.com'))throw Error('OWNER_AUTH_REQUIRED');return user.uid;}
 private async challenge(secret:string){if(!/^[0-9a-f]{64}$/.test(secret))throw Error('INVALID_CHALLENGE');return await sha256(secret);}
 async preview(secret:string):Promise<PairingPreview>{
  const correlation=diagnostic?await diagnosticCorrelation(secret):'';this.activeDiagnosticCorrelation=correlation;diagnostic?.emit('review-clicked',correlation);
  try {
  const owner=this.owner();const id=await this.challenge(secret),snapshot=await getDoc(doc(this.db,'mirrorPairing',id)),c=snapshot.data();
  if(this.owner()!==owner)throw Error('STALE_SESSION');
  if(!c||c.consumedAt!==null||!(c.expiresAt instanceof Timestamp)||c.expiresAt.toMillis()<=Date.now())throw Error('CHALLENGE_UNAVAILABLE');
  diagnostic?.emit('review-success',correlation);return {publisherUID:c.publisherUID,expiresAt:c.expiresAt.toDate()};
  }catch(error){const code=diagnosticError(error);diagnostic?.emit(code==='permission-denied'?'review-denied':'review-error',correlation,code,'challenge-read');throw error;}
 }
 async confirm(secret:string){
  const correlation=diagnostic?await diagnosticCorrelation(secret):'';this.activeDiagnosticCorrelation=correlation;diagnostic?.emit('approval-clicked',correlation);
  let phase:'owner'|'challenge-read'|'grant-read'|'commit'='owner';
  let pending:ReturnType<typeof setTimeout>|undefined;
  try {
  const owner=this.owner(),id=await this.challenge(secret),challenge=doc(this.db,'mirrorPairing',id),grant=doc(this.db,'users',owner,'mirrorControl','grant');
  diagnostic?.emit('owner-session-restored',correlation);diagnostic?.emit('txn-start',correlation);
  if(diagnostic)pending=setTimeout(()=>diagnostic?.emit('txn-pending',correlation),10_000);
  await runTransaction(this.db,async tx=>{
   if(this.owner()!==owner)throw Error('STALE_SESSION');
   phase='challenge-read';const c=(await tx.get(challenge)).data();phase='grant-read';await tx.get(grant);
   if(!c||c.publisherUID===owner||c.consumedAt!==null||c.expiresAt.toMillis()<=Date.now())throw Error('CHALLENGE_UNAVAILABLE');
   if(this.owner()!==owner)throw Error('STALE_SESSION');
   tx.update(challenge,{ownerUID:owner,consumedAt:serverTimestamp()});
   phase='commit';tx.set(grant,{ownerUID:owner,publisherUID:c.publisherUID,publisherID:id,challengeID:id,revokedAt:null,leaseExpiresAt:Timestamp.fromMillis(Date.now()+55*60000)});
  });
  diagnostic?.emit('txn-committed',correlation);
  }catch(error){const code=diagnosticError(error);diagnostic?.emit(code==='permission-denied'?'txn-denied':code==='OWNER_AUTH_REQUIRED'?'owner-session-missing':code==='CHALLENGE_UNAVAILABLE'?'challenge-unavailable':'txn-error',correlation,code,phase);throw error;}finally{if(pending!==undefined)clearTimeout(pending);}
 }
 async status(){const owner=this.owner();const result=(await getDoc(doc(this.db,'users',owner,'mirrorControl','grant'))).data()??null;diagnostic?.emit(result?'grant-observed':'grant-absent',this.activeDiagnosticCorrelation);return result;}
 async revoke(publisherID:string){
  const owner=this.owner(),ref=doc(this.db,'users',owner,'mirrorControl','grant');
  await runTransaction(this.db,async tx=>{const grant=(await tx.get(ref)).data();if(this.owner()!==owner||grant?.publisherID!==publisherID)throw Error('STALE_PUBLISHER');tx.update(ref,{revokedAt:serverTimestamp()});});
 }
}
