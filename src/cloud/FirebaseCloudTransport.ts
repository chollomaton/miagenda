import {collection,doc,documentId,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,startAfter,Timestamp,where} from 'firebase/firestore';
import type {Firestore,QueryConstraint} from 'firebase/firestore';
import {decode,encode} from './CloudGateway';
import type {CloudGateway,CloudRecord} from './CloudGateway';
import {merge} from '../models/entities';
import {RepositoryError} from '../repositories/AgendaRepository';

export function firebaseError(error:unknown):RepositoryError {
 if(error instanceof RepositoryError)return error;
 const code=String((error as {code?:string})?.code??'').replace(/^(firestore|auth)\//,'');
 const codes:Record<string,RepositoryError['code']>={'unauthenticated':'authentication','user-token-expired':'authentication','permission-denied':'permission','unavailable':'network','network-request-failed':'network','resource-exhausted':'rateLimit','aborted':'conflict','deadline-exceeded':'network','invalid-argument':'invalidRecord','internal':'server'};
 return new RepositoryError(codes[code]??'unknown');
}
export function firebaseDocument(record:CloudRecord,operationID:string){
 const entity=decode(record);
 return {entityId:entity.id,kind:entity.kind,schemaVersion:1,payloadJSON:encode(entity).fields.payloadJSON.value,lastOperationId:operationID};
}
export function firebaseRecord(id:string,data:Record<string,unknown>):CloudRecord {
 try {
  if(data.schemaVersion!==1||typeof data.payloadJSON!=='string')throw Error();
  const record:CloudRecord={recordName:String(data.entityId),recordType:'MA_'+data.kind,fields:{schemaVersion:{value:1},payloadJSON:{value:data.payloadJSON}}};
  const entity=decode(record);
  if(id!==entity.kind+'__'+entity.id)throw Error();
  return encode(entity);
 }catch{throw new RepositoryError('invalidRecord')}
}
export interface FirebaseCursor {seconds:number;nanoseconds:number;id:string}
export function parseFirebaseCursor(token:string):FirebaseCursor|null {
 try{const c=JSON.parse(token);if(c===null)return null;if(!Number.isSafeInteger(c.seconds)||!Number.isInteger(c.nanoseconds)||c.nanoseconds<0||c.nanoseconds>=1e9||typeof c.id!=='string'||!c.id||c.id.includes('/'))throw Error();new Timestamp(c.seconds,c.nanoseconds);return c}catch{throw new RepositoryError('tokenExpired')}
}
/** Adapts the existing gateway/serializer. Only the transport cursor uses server time. */
export class FirebaseCloudTransport implements CloudGateway {
 readonly database='private' as const;readonly zone='MiAgendaWeb' as const;
 constructor(private db:Firestore,private uid:string,private valid:()=>boolean,private pageSize=100){if(!uid||uid.includes('/'))throw new RepositoryError('authentication')}
 private guard(){if(!this.valid())throw new RepositoryError('authentication')}
 private entities(){return collection(this.db,'users',this.uid,'entities')}
 private async guarded<T>(work:()=>Promise<T>):Promise<T>{this.guard();try{const result=await work();this.guard();return result}catch(error){throw firebaseError(error)}}
 fetch(id:string){return this.guarded(async()=>{const result=await getDocsFromServer(query(this.entities(),where('entityId','==',id),limit(2)));if(result.size>1)throw new RepositoryError('invalidRecord');const item=result.docs[0];return item?firebaseRecord(item.id,item.data()):null})}
 changes(token?:string){return this.guarded(async()=>{
  const cursor=token?parseFirebaseCursor(token):null;
  const constraints:QueryConstraint[]=[orderBy('remoteUpdatedAt'),orderBy(documentId())];
  if(cursor)constraints.push(startAfter(new Timestamp(cursor.seconds,cursor.nanoseconds),cursor.id));
  constraints.push(limit(this.pageSize));
  const result=await getDocsFromServer(query(this.entities(),...constraints));
  const records=result.docs.map(item=>firebaseRecord(item.id,item.data()));
  const last=result.docs.at(-1);let syncToken=token??'null';
  if(last){const stamp=last.data().remoteUpdatedAt;if(!(stamp instanceof Timestamp))throw new RepositoryError('invalidRecord');syncToken=JSON.stringify({seconds:stamp.seconds,nanoseconds:stamp.nanoseconds,id:last.id})}
  return {records,syncToken,moreComing:result.size===this.pageSize};
 })}
 save(record:CloudRecord,operationID:string){return this.guarded(async()=>{
  const incoming=decode(record);if(!operationID)throw new RepositoryError('invalidRecord');
  const ref=doc(this.entities(),incoming.kind+'__'+incoming.id);
  return runTransaction(this.db,async transaction=>{
   this.guard();const snapshot=await transaction.get(ref);this.guard();
   const old=snapshot.exists()?decode(firebaseRecord(snapshot.id,snapshot.data())):null;
   const merged=old?merge(old,incoming):incoming;
   const saved=encode(merged);
   // Replays and older operations cannot rewrite newer clocks or advance the cursor unnecessarily.
   if(!old||JSON.stringify(encode(old))!==JSON.stringify(saved))transaction.set(ref,{...firebaseDocument(saved,operationID),remoteUpdatedAt:serverTimestamp()});
   return saved;
  });
 })}
}
