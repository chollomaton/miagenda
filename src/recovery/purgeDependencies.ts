import {entityLabelIDs,updateEntity} from '../models/entities';
import type {Entity} from '../models/entities';
export function references(entity:Entity,id:string){return entityLabelIDs(entity).includes(id)||(entity.kind!=='Template'&&(entity.fields.parentTaskId===id||entity.fields.parentLabelId===id))}
/** Reverse dependency closure. Deleted dependents join the proposal; active ones block it. */
export function purgeDependencies(entities:Entity[],ids:string[]){
 const expanded=new Set(ids),active=new Map<string,Entity>(),deleted=new Map<string,Entity>();
 const queue=[...expanded];
 for(let index=0;index<queue.length;index++)for(const entity of entities){
  if(!references(entity,queue[index])||expanded.has(entity.id))continue;
  if(entity.lifecycle==='active')active.set(entity.id,entity);
  else {deleted.set(entity.id,entity);expanded.add(entity.id);queue.push(entity.id)}
 }
 return {activeBlockers:[...active.values()],deletedDependencies:[...deleted.values()],expandedPurgeSet:[...expanded]};
}
/** Explicit label recovery; preserves every other label and the entity lifecycle. */
export function resolveDeletedLabel(entities:Entity[],id:string,writerID:string){
 if(!entities.some(e=>e.id===id&&e.kind==='Label'&&e.lifecycle==='deleted'))throw Error('DELETED_LABEL_REQUIRED');
 return entities.filter(e=>references(e,id)).map(e=>{
  const labelIDs=entityLabelIDs(e).filter(label=>label!==id);
  if(e.kind==='Template')return updateEntity(e,{definition:{...e.fields.definition,values:{...e.fields.definition.values,labelIDs}}},writerID);
  return updateEntity(e,{labelIDs,...(e.fields.parentLabelId===id?{parentLabelId:null}:{})},writerID);
 });
}
