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
