import {RepositoryError} from '../repositories/AgendaRepository';
import type {CloudKitZoneTransport,CloudRecord} from './CloudGateway';

type ObjectValue=Record<string,unknown>;
export interface CloudKitConfig {containerIdentifier:string;apiToken:string;environment:'development'|'production'}
export type CloudKitDevelopmentConfig=CloudKitConfig & {environment:'development'};
const object=(value:unknown):ObjectValue=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new RepositoryError('server');return value as ObjectValue};
function check(value:ObjectValue){
 const codes:Record<string,RepositoryError['code']>={AUTHENTICATION_REQUIRED:'authentication',AUTHENTICATION_FAILED:'authentication',ACCESS_DENIED:'permission',NOT_AUTHORIZED:'permission',CONFLICT:'conflict',ZONE_NOT_FOUND:'zoneMissing',CHANGE_TOKEN_EXPIRED:'tokenExpired',THROTTLED:'rateLimit',QUOTA_EXCEEDED:'permission',BAD_REQUEST:'invalidRecord',VALIDATING_REFERENCE_ERROR:'invalidRecord'};
 if(value.serverErrorCode)throw new RepositoryError(codes[String(value.serverErrorCode)]??'server',typeof value.retryAfter==='number'?value.retryAfter*1000:0);
}
/** One instance per authenticated session. Tokens stay in memory; all requests serialize token rotation. */
export class CloudKitWebTransport implements CloudKitZoneTransport {
 private token:string;private active=true;private tail:Promise<unknown>=Promise.resolve();
 private readonly base:string;private readonly apiToken:string;
 constructor(config:CloudKitConfig,webAuthToken:string,private readonly request:typeof fetch=fetch){
  if(!['development','production'].includes(config.environment)||!/^iCloud\.[A-Za-z0-9.-]+$/.test(config.containerIdentifier)||!config.apiToken.trim()||!webAuthToken.trim())throw Error('CLOUDKIT_CONFIG_REQUIRED');
  this.base=`https://api.apple-cloudkit.com/database/1/${encodeURIComponent(config.containerIdentifier)}/${config.environment}/private/`;
  this.apiToken=config.apiToken;this.token=webAuthToken;
 }
 invalidate(){this.active=false;this.token=''}
 private call(path:string,body?:ObjectValue):Promise<ObjectValue>{
  const run=this.tail.then(async()=>{
   if(!this.active)throw new RepositoryError('authentication');
   const url=new URL(path,this.base);url.searchParams.set('ckAPIToken',this.apiToken);url.searchParams.set('ckWebAuthToken',this.token);
   let response:Response;
   try{response=await this.request(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'omit',redirect:'error'})}catch{throw new RepositoryError('network')}
   if(!this.active)throw new RepositoryError('authentication');
   let result:ObjectValue;try{result=object(await response.json())}catch{throw new RepositoryError('server')}
   if(!this.active)throw new RepositoryError('authentication');
   if(typeof result.ckWebAuthToken==='string')this.token=result.ckWebAuthToken;
   check(result);if(!response.ok)throw new RepositoryError(response.status===401?'authentication':response.status===403?'permission':'server');return result;
  });this.tail=run.catch(()=>{});return run;
 }
 private entries(result:ObjectValue,key:string){const list=result[key];if(!Array.isArray(list))throw new RepositoryError('server');return list.map(object)}
 private zone(zone:string){if(zone!=='MiAgendaWeb')throw new RepositoryError('permission');return {zoneName:zone}}
 async currentUser(){const result=await this.call('users/current');if(typeof result.userRecordName!=='string'||!result.userRecordName)throw new RepositoryError('authentication');return result.userRecordName}
 async ensureZone(){const result=await this.call('zones/modify',{operations:[{operationType:'create',zone:{zoneID:this.zone('MiAgendaWeb')}}]});const zones=this.entries(result,'zones');if(zones.length!==1)throw new RepositoryError('server');check(zones[0])}
 async fetchRecord(id:string){
  const result=await this.call('records/lookup',{zoneID:this.zone('MiAgendaWeb'),records:[{recordName:id}]});const records=this.entries(result,'records');if(records.length!==1)throw new RepositoryError('server');const record=records[0];if(record.serverErrorCode==='NOT_FOUND')return null;check(record);if(record.recordName!==id)throw new RepositoryError('server');return record as unknown as CloudRecord;
 }
 async fetchRecordZoneChanges(zone:string,syncToken?:string){
  const result=await this.call('changes/zone',{zones:[{zoneID:this.zone(zone),...(syncToken===undefined?{}:{syncToken})}]});const zones=this.entries(result,'zones');if(zones.length!==1)throw new RepositoryError('server');const page=zones[0];check(page);
  if(typeof page.syncToken!=='string'||typeof page.moreComing!=='boolean')throw new RepositoryError('server');
  const records=this.entries(page,'records');for(const record of records){check(record);if(record.deleted===true)throw new RepositoryError('invalidRecord')}
  return {records:records as unknown as CloudRecord[],syncToken:page.syncToken,moreComing:page.moreComing};
 }
 async saveRecords(records:CloudRecord[],options:{zone:string;operationID:string}){
  if(records.length!==1||!options.operationID)throw new RepositoryError('invalidRecord');
  const operations=records.map(record=>({operationType:record.recordChangeTag?'update':'create',record:{...record,fields:Object.fromEntries(Object.entries(record.fields).map(([key,field])=>[key,{value:typeof field.value==='boolean'?Number(field.value):field.value}]))}}));
  const result=await this.call('records/modify',{zoneID:this.zone(options.zone),atomic:true,operations});const saved=this.entries(result,'records');if(saved.length!==records.length)throw new RepositoryError('server');
  saved.forEach((record,index)=>{check(record);if(record.recordName!==records[index].recordName||typeof record.recordChangeTag!=='string')throw new RepositoryError('server')});
  return saved as unknown as CloudRecord[];
 }
}
