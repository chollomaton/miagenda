import type {AgendaEntity} from '../models/entities';
export function AlertField({alerts,onChange}:{alerts:number[];onChange:(alerts:number[])=>void}){
 return <label>Aviso (minutos antes)<input type="number" min="0" max="525600" value={alerts[0]??0} onChange={e=>onChange([Number(e.target.value),...alerts.slice(1)])}/></label>;
}
export function LabelSelector({labels,selected,onChange}:{labels:AgendaEntity[];selected:string[];onChange:(ids:string[])=>void}){
 return <fieldset><legend>Etiquetas</legend>{labels.length?labels.map(e=><label className="check" key={e.id}><input type="checkbox" checked={selected.includes(e.id)} onChange={v=>onChange(v.target.checked?[...selected,e.id]:selected.filter(id=>id!==e.id))}/>{e.fields.title}</label>):<p className="muted">Crea etiquetas desde su sección.</p>}</fieldset>;
}
