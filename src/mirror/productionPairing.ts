import {doc,getDoc,runTransaction,serverTimestamp,Timestamp} from 'firebase/firestore/lite';
import type {Firestore} from 'firebase/firestore/lite';
import type {Auth} from 'firebase/auth';
import {sha256} from './canonical';

export interface PairingPreview {publisherUID:string;expiresAt:Date}
/** Uses ordinary client credentials and rules. No admin API or external authority. */
export class ProductionOwnerPairing {
 constructor(private db:Firestore,private auth:Auth,private enabled:boolean){}
 private owner(){const user=this.auth.currentUser;if(!this.enabled||!user||!user.providerData.some(p=>p.providerId==='google.com'))throw Error('OWNER_AUTH_REQUIRED');return user.uid;}
 private async challenge(secret:string){if(!/^[0-9a-f]{64}$/.test(secret))throw Error('INVALID_CHALLENGE');return await sha256(secret);}
 async preview(secret:string):Promise<PairingPreview>{
  const owner=this.owner();const id=await this.challenge(secret),snapshot=await getDoc(doc(this.db,'mirrorPairing',id)),c=snapshot.data();
  if(this.owner()!==owner)throw Error('STALE_SESSION');
  if(!c||c.consumedAt!==null||!(c.expiresAt instanceof Timestamp)||c.expiresAt.toMillis()<=Date.now())throw Error('CHALLENGE_UNAVAILABLE');
  return {publisherUID:c.publisherUID,expiresAt:c.expiresAt.toDate()};
 }
 async confirm(secret:string){
  const owner=this.owner(),id=await this.challenge(secret),challenge=doc(this.db,'mirrorPairing',id),grant=doc(this.db,'users',owner,'mirrorControl','grant');
  await runTransaction(this.db,async tx=>{
   if(this.owner()!==owner)throw Error('STALE_SESSION');
   const c=(await tx.get(challenge)).data();await tx.get(grant);
   if(!c||c.publisherUID===owner||c.consumedAt!==null||c.expiresAt.toMillis()<=Date.now())throw Error('CHALLENGE_UNAVAILABLE');
   if(this.owner()!==owner)throw Error('STALE_SESSION');
   tx.update(challenge,{ownerUID:owner,consumedAt:serverTimestamp()});
   tx.set(grant,{ownerUID:owner,publisherUID:c.publisherUID,publisherID:id,challengeID:id,revokedAt:null,leaseExpiresAt:Timestamp.fromMillis(Date.now()+55*60000)});
  });
 }
 async status(){const owner=this.owner();return (await getDoc(doc(this.db,'users',owner,'mirrorControl','grant'))).data()??null;}
 async revoke(publisherID:string){
  const owner=this.owner(),ref=doc(this.db,'users',owner,'mirrorControl','grant');
  await runTransaction(this.db,async tx=>{const grant=(await tx.get(ref)).data();if(this.owner()!==owner||grant?.publisherID!==publisherID)throw Error('STALE_PUBLISHER');tx.update(ref,{revokedAt:serverTimestamp()});});
 }
}
