import {clone, merge, validate} from '../models/entities';
import type {Entity} from '../models/entities';
export interface ChangePage { entities:Entity[]; cursor:string; moreComing:boolean; quarantine?:unknown[] }
export interface AgendaRepository {fetch(id:string):Promise<Entity|null>;fetchChanges(cursor?:string):Promise<ChangePage>;save(entity:Entity,operationID:string):Promise<Entity>}
export class RepositoryError extends Error {constructor(public code:'authentication'|'network'|'rateLimit'|'conflict'|'server'|'invalidRecord'|'zoneMissing'|'tokenExpired'|'permission'|'unknown',public retryAfter=0){super(code)}}
export class MemoryRepository implements AgendaRepository {
 private entities=new Map<string,Entity>();private changes:Entity[]=[];private applied=new Map<string,{input:string;result:Entity}>();
 constructor(private pageSize=100){}
 async fetch(id:string){return clone(this.entities.get(id)??null)}
 async fetchChanges(cursor='0'):Promise<ChangePage>{const offset=Number(cursor);if(!Number.isSafeInteger(offset)||offset<0||offset>this.changes.length)throw new RepositoryError('tokenExpired');const entities=this.changes.slice(offset,offset+this.pageSize);return clone({entities,cursor:String(offset+entities.length),moreComing:offset+entities.length<this.changes.length})}
 async save(entity:Entity,operationID:string){validate(entity);const input=JSON.stringify(entity),old=this.applied.get(operationID);if(old){if(old.input!==input)throw Error('OPERATION_REUSE');return clone(old.result)}const existing=this.entities.get(entity.id),result=existing?merge(existing,entity):clone(entity);this.entities.set(result.id,result);this.changes.push(result);this.applied.set(operationID,{input,result});return clone(result)}
}

export {MemoryRepository as MemoryAgendaRepository};
