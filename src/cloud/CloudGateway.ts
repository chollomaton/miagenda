import {clone,merge,validate} from '../models/entities';
import type {Entity} from '../models/entities';
import {RepositoryError} from '../repositories/AgendaRepository';
import type {AgendaRepository,ChangePage} from '../repositories/AgendaRepository';
export interface CloudRecord {recordName:string;recordType:string;recordChangeTag?:string;fields:{[key:string]:{value:string|number|boolean};schemaVersion:{value:number};payloadJSON:{value:string}}}
export interface CloudGateway {database:'private';zone:'MiAgendaWeb';fetch(id:string):Promise<CloudRecord|null>;changes(token?:string):Promise<{records:CloudRecord[];syncToken:string;moreComing:boolean}>;save(record:CloudRecord,operationID:string):Promise<CloudRecord>}
export function encode(entity:Entity,recordChangeTag?:string):CloudRecord{validate(entity);return {recordName:entity.id,recordType:'MA_'+entity.kind,recordChangeTag,fields:{schemaVersion:{value:1},lifecycle:{value:entity.lifecycle},createdAt:{value:entity.createdAt},updatedAt:{value:entity.updatedAt},fieldClocksJSON:{value:JSON.stringify(entity.fieldClocks)},payloadJSON:{value:JSON.stringify(entity)},...Object.fromEntries(Object.entries(entity.kind==='Template'?{}:{parentTaskId:entity.fields.parentTaskId,parentLabelId:entity.fields.parentLabelId,dueAt:entity.fields.due,startAt:entity.fields.start,endAt:entity.fields.end,civilDate:entity.fields.startDate,completed:entity.fields.completed,pinned:entity.fields.pinned,sortOrder:entity.fields.sortOrder}).filter(([,value])=>value!==null).map(([key,value])=>[key,{value:value!}]))}}}
export function decode(record:CloudRecord):Entity{const entity:unknown=JSON.parse(record.fields.payloadJSON.value);validate(entity);if(record.recordName!==entity.id||record.recordType!=='MA_'+entity.kind||record.fields.schemaVersion.value!==1)throw new RepositoryError('invalidRecord');return entity}
export class CloudKitRepository implements AgendaRepository {
 private tags=new Map<string,string>();private operations=new Map<string,string>();quarantine:CloudRecord[]=[];
 constructor(private gateway:CloudGateway){if(gateway.database!=='private'||gateway.zone!=='MiAgendaWeb')throw Error('PRIVATE_ZONE_REQUIRED')}
 private read(r:CloudRecord){try{const e=decode(r);if(r.recordChangeTag)this.tags.set(e.id,r.recordChangeTag);return e}catch{throw new RepositoryError('invalidRecord')}}
 async fetch(id:string){const r=await this.gateway.fetch(id);return r?this.read(r):null}
 async fetchChanges(cursor?:string):Promise<ChangePage>{const p=await this.gateway.changes(cursor);const entities:Entity[]=[];for(const r of p.records){try{entities.push(this.read(r))}catch{this.quarantine.push(clone(r))}}return {entities,cursor:p.syncToken,moreComing:p.moreComing,quarantine:this.quarantine.splice(0)}}
 async save(entity:Entity,operationID:string){const input=JSON.stringify(entity),previous=this.operations.get(operationID);if(previous&&previous!==input)throw Error('OPERATION_REUSE');this.operations.set(operationID,input);let current=clone(entity);for(let attempt=0;attempt<4;attempt++){try{return this.read(await this.gateway.save(encode(current,this.tags.get(entity.id)),operationID))}catch(e){if(!(e instanceof RepositoryError)||e.code!=='conflict')throw e;const remote=await this.fetch(entity.id);if(remote)current=merge(remote,current)}}throw new RepositoryError('conflict')}
}
export class MockCloudGateway implements CloudGateway {
 database='private' as const;zone='MiAgendaWeb' as const;records=new Map<string,CloudRecord>();log:CloudRecord[]=[];applied=new Map<string,CloudRecord>();failure:RepositoryError|null=null;
 constructor(public pageSize=2){}
 async fetch(id:string){return clone(this.records.get(id)??null)}
 async changes(token='0'){const n=Number(token);if(!Number.isInteger(n)||n<0||n>this.log.length)throw new RepositoryError('tokenExpired');const records=this.log.slice(n,n+this.pageSize);return clone({records,syncToken:String(n+records.length),moreComing:n+records.length<this.log.length})}
 async save(record:CloudRecord,operationID:string){if(this.failure)throw this.failure;const previous=this.applied.get(operationID);if(previous)return clone(previous);const old=this.records.get(record.recordName);if(old&&old.recordChangeTag!==record.recordChangeTag)throw new RepositoryError('conflict');decode(record);const saved={...clone(record),recordChangeTag:String(this.log.length+1)};this.records.set(record.recordName,saved);this.log.push(saved);this.applied.set(operationID,saved);return clone(saved)}
}

export interface CloudKitZoneTransport {
 fetchRecord(id:string):Promise<CloudRecord|null>;
 fetchRecordZoneChanges(zone:string,syncToken?:string):Promise<{records:CloudRecord[];syncToken:string;moreComing:boolean}>;
 saveRecords(records:CloudRecord[],options:{zone:string;operationID:string}):Promise<CloudRecord[]>;
}
export class CloudKitGateway implements CloudGateway {
 readonly database='private' as const;readonly zone='MiAgendaWeb' as const;
 constructor(private transport:CloudKitZoneTransport){}
 fetch(id:string){return this.transport.fetchRecord(id)}
 changes(token?:string){return this.transport.fetchRecordZoneChanges(this.zone,token)}
 async save(record:CloudRecord,operationID:string){const records=await this.transport.saveRecords([record],{zone:this.zone,operationID});if(records.length!==1)throw new RepositoryError('server');return records[0]}
}
