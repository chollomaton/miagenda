import {validate} from '../models/entities';
import type {Entity,Template} from '../models/entities';
import {normalize} from '../search/selectors';

export type CommandId='task.new'|'reminder.new'|'event.new'|'note.new'|'calendar.today'|'quickCapture.open';
export interface Command {id:CommandId;label:string;execute:()=>void;keywords?:readonly string[]}
const definitions:ReadonlyArray<{id:CommandId;label:string;keywords?:readonly string[]}>=[
 {id:'task.new',label:'Nueva tarea'},
 {id:'reminder.new',label:'Nuevo recordatorio'},
 {id:'event.new',label:'Nuevo evento'},
 {id:'note.new',label:'Nueva nota'},
 {id:'quickCapture.open',label:'Captura rápida',keywords:['captura','rápida','crear']},
 {id:'calendar.today',label:'Ir a Hoy'},
];
export function createCommandRegistry(callbacks:Record<CommandId,()=>void>):Command[]{
 return definitions.map(command=>({...command,execute:callbacks[command.id]}));
}
export function matchingCommands(commands:Command[],query:string):Command[]{
 return commands.filter(command=>[command.label,...(command.keywords??[])].some(value=>normalize(value).includes(normalize(query))));
}

// The supplied entities belong to the current store/account scope; never cache these actions.
export function templateCommands(entities:Entity[],query:string,onApply:(template:Template)=>void){
 const term=normalize(query);
 if(!term)return [];
 return entities.flatMap(template=>{
  if(template.kind!=='Template'||template.lifecycle!=='active'||!normalize(template.fields.name).includes(term))return [];
  try{validate(template)}catch{return []}
  return [{id:'template.apply:'+template.id,label:'Crear desde plantilla: '+template.fields.name,execute:()=>onApply(template)}];
 });
}
