import {useState} from 'react';
import type {FormEvent} from 'react';
import type {Template,TemplateDefinition,TemplateValues} from '../models/entities';
import {clone} from '../models/entities';
import type {AgendaStore} from '../stores/AgendaStore';
import {select} from '../search/selectors';
import {AlertField,LabelSelector} from './EntityFields';
const names={Task:'Tarea',Reminder:'Recordatorio',Event:'Evento'};
export function TemplatesPanel({store,onApply}:{store:AgendaStore;onApply:(template:Template)=>void}){
 const [selection,setSelection]=useState<string|null>(null);
 const selected=store.entities.find((e):e is Template=>e.kind==='Template'&&e.id===selection&&e.lifecycle==='active');
 const templates=store.entities.filter((e):e is Template=>e.kind==='Template'&&e.lifecycle==='active');
 const detail=selection==='new'||!!selected;
 return <section aria-label="Plantillas"><div className="toolbar"><h3>Plantillas</h3><button onClick={()=>setSelection('new')}>Nueva plantilla</button></div><div className={'templates-layout '+(detail?'show-detail':'')}><aside className="labels-sidebar" aria-label="Lista de plantillas">{templates.map(e=><button className="template-row" key={e.id} aria-pressed={selection===e.id} onClick={()=>setSelection(e.id)}><strong>{e.fields.name}</strong>{' '}<small>{names[e.fields.definition.targetKind]}</small></button>)}{!templates.length&&<p className="muted">Crea tu primera plantilla.</p>}</aside><div className="labels-detail">{detail?<TemplateEditor key={selected?.id??'new'} store={store} template={selected} onClose={()=>setSelection(null)} onSaved={setSelection} onApply={onApply}/>:<section className="card"><h3>Selecciona una plantilla</h3><p className="muted">Prepara los campos que reutilizas en tu agenda.</p></section>}</div></div></section>;
}
function TemplateEditor({store,template,onClose,onSaved,onApply}:{store:AgendaStore;template?:Template;onClose:()=>void;onSaved:(id:string)=>void;onApply:(template:Template)=>void}){
 const [name,setName]=useState(template?.fields.name??'');
 const [definition,setDefinition]=useState<TemplateDefinition>(()=>clone(template?.fields.definition??{targetKind:'Task',values:{}}));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const labels=select(store.entities,{kind:'Label'});
 const values=definition.values;
 const change=(patch:Partial<TemplateDefinition['values']>)=>setDefinition(d=>({...d,values:{...d.values,...patch}} as TemplateDefinition));
 function target(targetKind:TemplateDefinition['targetKind']){
  const common:TemplateValues={};
  for(const key of ['title','notes','labelIDs'] as const)if(values[key]!==undefined)Object.assign(common,{[key]:clone(values[key])});
  setDefinition({targetKind,values:common});
 }
 async function save(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  if(template){await store.patch(template.id,{name,definition});onSaved(template.id)}else{const created=await store.create('Template',{name,definition});onSaved(created.id)}
 }catch{setError('Revisa el nombre y los campos. No se ha guardado la plantilla.')}finally{setBusy(false)}}
 async function remove(){setBusy(true);setError('');try{await store.service.delete(template!.id);onClose()}catch{setError('No se pudo eliminar la plantilla.')}finally{setBusy(false)}}
 const unavailable=(values.labelIDs??[]).filter(id=>!labels.some(e=>e.id===id));
 return <div className="label-inline"><form className="editor template-editor" aria-label="Editor de plantilla" onSubmit={e=>void save(e)}><header><h4>{template?'Editar plantilla':'Nueva plantilla'}</h4><button type="button" onClick={onClose}>Cerrar plantilla</button></header><div className="editor-content"><button type="button" className="detail-back" onClick={onClose}>← Plantillas</button><label>Nombre<input required maxLength={500} value={name} onChange={e=>setName(e.target.value)}/></label><label>Tipo<select value={definition.targetKind} onChange={e=>target(e.target.value as TemplateDefinition['targetKind'])}>{Object.entries(names).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label><label>Título opcional<input maxLength={500} value={values.title??''} onChange={e=>change({title:e.target.value})}/></label><label>Notas<textarea rows={5} maxLength={100000} value={values.notes??''} onChange={e=>change({notes:e.target.value})}/></label>
 {definition.targetKind==='Task'&&<label>Prioridad<select value={definition.values.priority??0} onChange={e=>change({priority:Number(e.target.value)})}>{['Ninguna','Baja','Media','Alta'].map((v,i)=><option key={v} value={i}>{v}</option>)}</select></label>}
 {definition.targetKind==='Event'&&<><label>Lugar<input maxLength={2000} value={definition.values.location??''} onChange={e=>change({location:e.target.value})}/></label><label>Enlace<input type="url" maxLength={4000} value={definition.values.url??''} onChange={e=>change({url:e.target.value})}/></label><label>Duración (minutos)<input type="number" min="0.01" step="any" placeholder="Duración de Ajustes" value={definition.durationMinutes??''} onChange={e=>setDefinition({...definition,durationMinutes:e.target.value?Number(e.target.value):undefined})}/></label></>}
 {definition.targetKind!=='Task'&&<AlertField alerts={definition.values.alerts??[]} onChange={alerts=>change({alerts})}/>}
 {definition.targetKind==='Reminder'&&definition.recurrence&&<p className="muted">Repetición {definition.recurrence.frequency==='daily'?'diaria':definition.recurrence.frequency==='weekly'?'semanal':definition.recurrence.frequency==='monthly'?'mensual':'anual'} conservada. Puedes ajustarla al usar la plantilla.</p>}
 <LabelSelector labels={labels} selected={values.labelIDs??[]} onChange={labelIDs=>change({labelIDs})}/>{unavailable.length>0&&<p role="status">{unavailable.length} etiqueta(s) no disponible(s). Se conservan en la plantilla y se omiten al usarla.</p>}{error&&<p role="alert">{error}</p>}</div><footer>{template&&<><button type="button" disabled={busy} onClick={()=>void remove()}>Eliminar plantilla</button><button type="button" disabled={busy} onClick={()=>onApply(template)}>Usar plantilla</button></>}<button type="submit" className="primary" disabled={busy}>{busy?'Guardando…':'Guardar plantilla'}</button></footer>{template&&<p className="muted">Usar plantilla abre los últimos valores guardados. Guarda antes los cambios que quieras aplicar.</p>}</form></div>;
}
