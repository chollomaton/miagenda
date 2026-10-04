import {normalizeFields} from '../models/serialization';
import {createEntity,updateEntity} from '../models/entities';
import type {Entity,Fields,Kind} from '../models/entities';
import type {LocalAgendaRepository} from '../repositories/LocalAgendaRepository';
import {addDays,dateInZone,wallToUTC} from '../utils/calendar';
export class AgendaService {
 constructor(private repository:LocalAgendaRepository){}
 async create(kind:Kind,fields:Partial<Fields>={}){const e=createEntity(kind,normalizeFields(fields),this.repository.writerID);await this.repository.commit([e]);return e}
 async patch(id:string,fields:Partial<Fields>,lifecycle?:Entity['lifecycle']){await this.repository.commit(()=>{const e=this.repository.entities.find(e=>e.id===id);if(!e)throw Error('NOT_FOUND');return [updateEntity(e,fields,this.repository.writerID,lifecycle)]})}
 async bulk(ids:string[],patch:Partial<Fields>,lifecycle?:Entity['lifecycle']){await this.repository.commit(()=>this.repository.entities.filter(e=>ids.includes(e.id)).map(e=>updateEntity(e,patch,this.repository.writerID,lifecycle)))}
 async complete(id:string,completed:boolean){await this.patch(id,{completed,completedAt:completed?new Date().toISOString():null})}
 async duplicate(id:string){await this.repository.flush();const original=this.repository.entities.find(e=>e.id===id);if(!original)throw Error('NOT_FOUND');const copy=createEntity(original.kind,{...original.fields,title:original.fields.title+' (copia)'},this.repository.writerID);const children=original.kind==='Task'?this.repository.entities.filter(e=>e.kind==='Subtask'&&e.fields.parentTaskId===id&&e.lifecycle==='active').map(e=>createEntity('Subtask',{...e.fields,parentTaskId:copy.id},this.repository.writerID)):[];await this.repository.commit([copy,...children]);return copy}

 delete(id:string){return this.patch(id,{},'deleted')}
 restore(id:string){return this.patch(id,{},'active')}
 reopen(id:string){return this.complete(id,false)}
 pin(id:string,pinned:boolean){return this.patch(id,{pinned})}
 priority(ids:string[],priority:number){return this.bulk(ids,{priority})}
 labels(ids:string[],labelIDs:string[]){return this.bulk(ids,{labelIDs})}
 reorder(ids:string[]){return this.repository.commit(()=>ids.map((id,sortOrder)=>{const e=this.repository.entities.find(e=>e.id===id);if(!e)throw Error('NOT_FOUND');return updateEntity(e,{sortOrder},this.repository.writerID)}))}
 schedule(ids:string[],offset:0|1,timezone:string,now=new Date().toISOString()){const due=wallToUTC(addDays(dateInZone(now,timezone),offset)+'T09:00',timezone);return this.bulk(ids,{due})}
 deleteCompleted(){return this.bulk(this.repository.entities.filter(e=>['Task','Subtask','Reminder'].includes(e.kind)&&e.fields.completed&&e.lifecycle==='active').map(e=>e.id),{},'deleted')}
}
