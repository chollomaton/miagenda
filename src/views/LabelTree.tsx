import {Icon} from '../components/Icon';
import {labelSymbols} from '../components/LabelAppearance';
import type {Entity} from '../models/entities';
export function LabelTree({labels,entities,onOpen,onFilter}:{labels:Entity[];entities:Entity[];onOpen:(e:Entity)=>void;onFilter:(id:string)=>void}){

 function branch(parent:string|null,visited:Set<string>):React.ReactNode{return labels.filter(e=>(labels.some(l=>l.id===e.fields.parentLabelId)?e.fields.parentLabelId:null)===parent).filter(e=>!visited.has(e.id)).map(e=><li key={e.id}><div className="toolbar"><span className="label-glyph" style={{background:`color-mix(in srgb, ${/^#[0-9a-f]{6}$/i.test(e.fields.color)?e.fields.color:'var(--accent)'} 10%, transparent)`}}><Icon name={labelSymbols[e.fields.icon]??'labels'} color={e.fields.color}/></span><button onClick={()=>onOpen(e)}>{e.fields.title||'Sin título'}</button><button onClick={()=>onFilter(e.id)}>Ver tareas · {entities.filter(v=>v.fields.labelIDs.includes(e.id)).length} elementos</button></div><ul>{branch(e.id,new Set([...visited,e.id]))}</ul></li>)}
 return <ul className="label-tree" aria-label="Jerarquía de etiquetas">{branch(null,new Set())}</ul>
}
