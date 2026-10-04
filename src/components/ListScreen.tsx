import type {ReactNode} from 'react';
import {Icon, type IconName} from './Icon';
export function QuietAction({children,onClick}:{children:ReactNode;onClick:()=>void}){
 return <button type="button" className="quiet" onClick={onClick}><Icon name="plus"/>{children}</button>;
}
export function ScreenHeader({reminder,count,onCreate,title,subtitle,icon,action}:{reminder?:boolean;count?:number;onCreate?:()=>void;title?:string;subtitle?:string;icon?:IconName;action?:string}){
 if(title&&icon)return <header className="page-header"><span className="section-glyph page-glyph"><Icon name={icon}/></span><div className="page-title"><h2>{title}</h2><p className="muted">{subtitle}</p></div>{onCreate&&(icon==='labels'?<QuietAction onClick={onCreate}>{action}</QuietAction>:<button type="button" className="primary" onClick={onCreate}><Icon name="plus"/>{action}</button>)}</header>;
 return <header className="page-header list-header"><span className="section-glyph page-glyph"><Icon name={reminder?'reminders':'tasks'}/></span><div className="page-title"><h2>{reminder?'Recordatorios':'Tareas'} <span className="list-count">{count}</span></h2><p className="muted">{reminder?'Todo lo que tiene una fecha, ordenado para que no se te pase':'Organiza lo que quieres hacer, sin obligarte a poner fecha'}</p></div><QuietAction onClick={onCreate!}>{reminder?'Nuevo recordatorio':'Nueva tarea'}</QuietAction></header>;
}
export function FilterPill({children,selected,onClick}:{children:ReactNode;selected:boolean;onClick:()=>void}){
 return <button type="button" className="filter-pill" aria-pressed={selected} onClick={onClick}>{children}</button>;
}
export function SearchField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 return <label className="list-search"><Icon name="search"/><input type="search" aria-label="Filtrar" placeholder="Buscar…" value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
export function ListEmptyState({reminder,filtered,onCreate}:{reminder:boolean;filtered:boolean;onCreate:()=>void}){
 return <div className="list-empty"><Icon name={reminder?'reminders':'tasks'}/><h3>{filtered?'Sin resultados':reminder?'No hay recordatorios':'No hay tareas'}</h3><p>{filtered?'Prueba otra búsqueda o cambia los filtros.':reminder?'Añade un recordatorio para lo que tiene fecha.':'Crea una tarea y añade subtareas si lo necesitas.'}</p><QuietAction onClick={onCreate!}>{reminder?'Nuevo recordatorio':'Nueva tarea'}</QuietAction></div>;
}
