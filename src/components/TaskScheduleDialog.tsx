import {useState} from 'react';
import {Dialog} from './Dialog';
import {civil} from '../models/entities';
import type {Task} from '../models/entities';
import type {AgendaStore} from '../stores/AgendaStore';
import {wallTime,wallToUTC} from '../utils/calendar';
import '../styles/task-schedule.css';
export function TaskScheduleDialog({task,store,timezone,date,onClose}:{task:Task;store:AgendaStore;timezone:string;date:string;onClose:()=>void}){
 const zone=task.fields.scheduledTimezone??timezone;
 const initial=task.fields.scheduledStartAt?wallTime(task.fields.scheduledStartAt,zone):date+'T09:00';
 const [day,setDay]=useState(initial.slice(0,10)),[time,setTime]=useState(initial.slice(11)),[duration,setDuration]=useState(String(task.fields.scheduledDurationMinutes??60));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(remove=false){
  if(busy)return;
  setError('');setBusy(true);
  try{
   if(remove)await store.service.unscheduleTask(task.id);
   else {
    const minutes=Number(duration);
    if(!civil(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isFinite(minutes)||minutes<=0)throw Error('INVALID_INPUT');
    const start=wallToUTC(day+'T'+time,zone);
    const current=store.entities.find(e=>e.id===task.id);
    if(current?.kind!=='Task')throw Error('NOT_FOUND');
    const startChanged=current.fields.scheduledStartAt!==start||current.fields.scheduledTimezone!==zone;
    const durationChanged=current.fields.scheduledDurationMinutes!==minutes;
    // ScheduleTask updates the full schedule in one commit, including simultaneous edits.
    if(!current.fields.scheduledStartAt||(startChanged&&durationChanged))await store.service.scheduleTask(task.id,start,minutes,zone);
    else if(startChanged)await store.service.moveScheduledTask(task.id,start,zone);
    else if(durationChanged)await store.service.resizeScheduledTask(task.id,minutes);
   }
   onClose();
  }catch(e){setError(e instanceof Error&&e.message==='NONEXISTENT_LOCAL_TIME'?'Esta hora no existe en la zona seleccionada.':'No se pudo guardar. Revisa la fecha, hora y duración.')}finally{setBusy(false)}
 }
 return <Dialog label={task.fields.scheduledStartAt?'Modificar planificación':'Planificar tarea'} onClose={()=>{if(!busy)onClose()}}><form className="task-schedule" onSubmit={e=>{e.preventDefault();void submit()}}>
 <h2>{task.fields.scheduledStartAt?'Modificar planificación':'Planificar tarea'}</h2>
 <p>{task.fields.title}</p><p className="muted">Zona horaria: {zone}</p>
 <div className="form-row"><label>Fecha<input type="date" required value={day} disabled={busy} onChange={e=>setDay(e.target.value)}/></label><label>Hora<input type="time" required value={time} disabled={busy} onChange={e=>setTime(e.target.value)}/></label></div>
 <fieldset disabled={busy}><legend>Duración</legend><div className="toolbar">{[30,60,90].map(n=><button type="button" key={n} aria-pressed={duration===String(n)} onClick={()=>setDuration(String(n))}>{n} min</button>)}<button type="button" aria-pressed={![30,60,90].includes(Number(duration))} onClick={()=>{setDuration('');document.getElementById('schedule-duration')?.focus()}}>Personalizada</button></div><label>Duración en minutos<input id="schedule-duration" type="number" required min="0.001" step="any" value={duration} onChange={e=>setDuration(e.target.value)}/></label></fieldset>
 {error&&<p role="alert">{error}</p>}<footer>{task.fields.scheduledStartAt&&<button type="button" disabled={busy} onClick={()=>void submit(true)}>Quitar planificación</button>}<button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={busy}>Guardar</button></footer>
 </form></Dialog>
}
