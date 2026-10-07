import {validate,entityLabelIDs} from '../models/entities';
import type {Entity} from '../models/entities';
export interface Issue {id:string;code:string;status:'WARNING'|'QUARANTINED'}
export function integrity(values:unknown[]):{entities:Entity[];issues:Issue[];quarantine:{code:string;entity:unknown}[]} {
 const entities:Entity[]=[],issues:Issue[]=[],quarantine:{code:string;entity:unknown}[]=[];
 const ids=new Set<string>();
 for(const value of values){
  try{validate(value);if(ids.has(value.id))throw Error('DUPLICATE_ID');ids.add(value.id);entities.push(value)}
  catch{quarantine.push({code:'INVALID_RECORD',entity:value});issues.push({id:'unknown',code:'INVALID_RECORD',status:'QUARANTINED'})}
 }
 const warn=(id:string,code:string)=>issues.push({id,code,status:'WARNING'});
 if(entities.filter(e=>e.kind==='Preferences'&&e.lifecycle==='active').length>1)warn('preferences','DUPLICATE_PREFERENCES');
 const map=new Map(entities.map(e=>[e.id,e]));
 for(const e of entities){
  if(e.lifecycle==='deleted')continue;
  const parent=e.kind==='Subtask'?e.fields.parentTaskId:e.kind==='Label'?e.fields.parentLabelId:null;
  const parentEntity=parent?map.get(parent):undefined;
  if(parent&&parentEntity?.kind!==(e.kind==='Subtask'?'Task':'Label'))warn(e.id,'ORPHAN_PARENT');
  else if(parentEntity?.lifecycle==='deleted')warn(e.id,'DELETED_PARENT_REFERENCE');
  if(entityLabelIDs(e).some(id=>map.get(id)?.kind!=='Label'))warn(e.id,'ORPHAN_LABEL');
  if(entityLabelIDs(e).some(id=>map.get(id)?.kind==='Label'&&map.get(id)?.lifecycle==='deleted'))warn(e.id,'DELETED_LABEL_REFERENCE');
  const visited=new Set([e.id]);let p=e.kind==='Template'?null:e.fields.parentLabelId;
  while(p){
   if(visited.has(p)){warn(e.id,'LABEL_CYCLE');break}
   visited.add(p);const ancestor=map.get(p);p=ancestor&&ancestor.kind!=='Template'?ancestor.fields.parentLabelId:null;
  }
 }
 return {entities,issues,quarantine};
}
/** Missing references/cycles remain structural errors for backups. Tombstone references and
 * multiple active preferences are recoverable warnings; no repair occurs during inspection. */
export function blocksBackup(report:ReturnType<typeof integrity>){return report.quarantine.length>0||report.issues.some(i=>i.code==='ORPHAN_PARENT'||i.code==='ORPHAN_LABEL'||i.code==='LABEL_CYCLE')}
export function integrityMessage(entities:Entity[],quarantineCount:number){
 const report=integrity(entities),warnings=report.issues.filter(i=>i.status==='WARNING');
 const descriptions:Record<string,string>={DELETED_PARENT_REFERENCE:'Hay elementos activos cuyo padre está en la papelera.',DELETED_LABEL_REFERENCE:'Hay elementos o plantillas que usan etiquetas eliminadas.',DUPLICATE_PREFERENCES:'Hay varias preferencias activas; se conservan sin consolidarlas.',ORPHAN_PARENT:'Hay referencias a padres ausentes.',ORPHAN_LABEL:'Hay referencias a etiquetas ausentes.',LABEL_CYCLE:'Hay un ciclo en la jerarquía de etiquetas.'};
 return `${warnings.length} avisos · ${quarantineCount+report.quarantine.length} datos dañados. ${[...new Set(warnings.map(i=>descriptions[i.code]))].join(' ')}`;
}
