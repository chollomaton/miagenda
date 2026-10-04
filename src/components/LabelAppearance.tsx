import {useState,type CSSProperties} from 'react';
import type {Fields} from '../models/entities';
import {Icon,type IconName} from './Icon';
import {FilterPill} from './ListScreen';
export const labelSymbols:Record<string,IconName>={tag:'labels','tag.fill':'labels',calendar:'calendar',checklist:'tasks','bell.fill':'reminders','square.and.pencil':'notes','archivebox.fill':'completed'};
export function LabelAppearance({fields,onColor,onIcon}:{fields:Fields;onColor:(color:string)=>void;onIcon:(icon:string)=>void}){
 const [preview,setPreview]=useState('Tarea');
 const color=/^#[0-9a-f]{6}$/i.test(fields.color)?fields.color:'var(--accent)';
 return <div className="label-appearance" style={{'--preview-color':color} as CSSProperties}>
 <section className="label-editor-section"><h3>Apariencia</h3><div className="label-colors" role="group" aria-label="Colores de etiqueta">{['#2f7df6','#34c759','#ff9500','#ff375f','#af52de','#00a6b2'].map(value=><button type="button" className="label-color" key={value} aria-label={'Color '+value} aria-pressed={fields.color.toLowerCase()===value} onClick={()=>onColor(value)}><span style={{background:value}}/></button>)}</div><label>Color personalizado<input type="color" value={fields.color} onChange={e=>onColor(e.target.value)}/></label><label>Icono<input maxLength={10} value={fields.icon} onChange={e=>onIcon(e.target.value)}/></label></section>
 <section className="label-editor-section"><h3>Vista previa</h3><div className="filter-pills" role="group" aria-label="Tipo de vista previa">{['Tarea','Recordatorio','Calendario'].map(value=><FilterPill key={value} selected={preview===value} onClick={()=>setPreview(value)}>{value}</FilterPill>)}</div><div className={'label-preview '+(preview==='Calendario'?'label-calendar-preview':'')}>
 {preview==='Calendario'?<span className="label-calendar-indicator"/>:<Icon name={preview==='Tarea'?'tasks':'reminders'}/>}
 <div><strong>{preview==='Calendario'?'Evento de ejemplo':preview==='Tarea'?'Tarea de ejemplo':'Recordatorio de ejemplo'}</strong><div className={preview==='Calendario'?'label-mini-card':'label-preview-tag'}><Icon name={labelSymbols[fields.icon]??'labels'}/>{fields.title||'Tu etiqueta'}</div></div></div></section></div>;
}
