import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {createEntity} from '../src/models/entities';
import type {Task} from '../src/models/entities';
import {occurrences,overlapColumns,scheduledTaskBlock,timelineCoversDate} from '../src/utils/calendar';
import {CalendarTimeline} from '../src/views/CalendarTimeline';
import {TaskScheduleDialog} from '../src/components/TaskScheduleDialog';
import {App} from '../src/app/App';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
const zone='Europe/Madrid',start='2026-10-05T08:00:00.000Z';
async function fixture(scheduled=false){const store=new AgendaStore(new MemoryPersistence());await store.boot();const task=await store.create('Task',{title:'Trabajo profundo',due:'2026-10-05T16:00:00.000Z'});if(scheduled)await store.service.scheduleTask(task.id,start,60,zone);return {store,task:store.entities.find(e=>e.id===task.id)! as Task}}
function dialog(task:Task,store:AgendaStore,onClose=vi.fn()){render(<TaskScheduleDialog task={task} store={store} timezone={zone} date="2026-10-05" onClose={onClose}/>);return onClose}
function save(){fireEvent.click(screen.getByRole('button',{name:'Guardar'}))}
async function settled(store:AgendaStore){await act(async()=>{await store.flush()})}
describe('derived schedule and mixed timeline',()=>{
 it('derives a non-persisted block only from valid active incomplete non-recurring scheduling',async()=>{
  const {store,task}=await fixture();expect(scheduledTaskBlock(task)).toBeNull();
  await store.service.scheduleTask(task.id,start,60,zone);
  const get=()=>scheduledTaskBlock(store.entities.find(e=>e.id===task.id)!);
  expect(get()).toMatchObject({kind:'scheduled-task',taskId:task.id,startAt:start,endAt:'2026-10-05T09:00:00.000Z',durationMinutes:60,timezone:zone});
  await store.complete(task.id,true);expect(get()).toBeNull();await store.service.reopen(task.id);expect(get()).not.toBeNull();
  await store.service.delete(task.id);expect(get()).toBeNull();await store.service.restore(task.id);expect(get()).not.toBeNull();
  const legacy=structuredClone(store.entities.find(e=>e.id===task.id)!);legacy.fields.recurrence={frequency:'daily',interval:1,weekdays:[],monthDay:null,count:null,until:null,exceptions:[]};expect(scheduledTaskBlock(legacy)).toBeNull();
  if(legacy.kind==='Task'){legacy.fields.recurrence=null;legacy.fields.scheduledDurationMinutes=-1;expect(scheduledTaskBlock(legacy)).toBeNull()}
 });
 it('lays out Event/Task and Task/Task overlaps, opens original task and disables task drag/resize',async()=>{
  const {task}=await fixture(true),block=scheduledTaskBlock(task)!;
  const event=createEntity('Event',{title:'Reunión',start,end:'2026-10-05T09:00:00.000Z'}),eventOccurrence=occurrences(event,'2026-10-05','2026-10-05')[0];
  const second={...block,taskId:'second',key:'second'};const items=[eventOccurrence,block,second];
  expect(overlapColumns(items).map(o=>o.column)).toEqual([0,1,2]);expect(timelineCoversDate(block,'2026-10-05',zone)).toBe(true);
  const onOpenTask=vi.fn();render(<CalendarTimeline items={items} date="2026-10-05" timezone={zone} hour24 onOpen={vi.fn()} onOpenTask={onOpenTask} onCreate={vi.fn()} onChange={vi.fn()} onError={vi.fn()}/>);
  const buttons=screen.getAllByRole('button',{name:'✓ 10:00 Trabajo profundo'});expect(buttons[0]).toHaveAttribute('draggable','false');fireEvent.click(buttons[0]);expect(onOpenTask).toHaveBeenCalledWith(task.id);
  expect(screen.getAllByRole('button',{name:/Ampliar 15 minutos/})).toHaveLength(1);
 });
});
describe('schedule command paths and validation',()=>{
 it('schedules date/time/60 minutes using ScheduleTask',async()=>{const {task,store}=await fixture();const command=vi.spyOn(store.service,'scheduleTask');const close=dialog(task,store);fireEvent.change(screen.getByLabelText('Hora'),{target:{value:'10:00'}});save();await waitFor(()=>expect(close).toHaveBeenCalled());expect(command).toHaveBeenCalledWith(task.id,start,60,zone);expect(scheduledTaskBlock(store.entities[0])).not.toBeNull()});
 it('resizes only duration while keeping start',async()=>{const {task,store}=await fixture(true);const command=vi.spyOn(store.service,'resizeScheduledTask');dialog(task,store);fireEvent.click(screen.getByRole('button',{name:'90 min'}));save();await settled(store);expect(command).toHaveBeenCalledWith(task.id,90);expect((store.entities[0] as Task).fields.scheduledStartAt).toBe(start)});
 it('moves only date/time while keeping duration',async()=>{const {task,store}=await fixture(true);const command=vi.spyOn(store.service,'moveScheduledTask');dialog(task,store);fireEvent.change(screen.getByLabelText('Fecha'),{target:{value:'2026-10-06'}});save();await settled(store);expect(command).toHaveBeenCalledWith(task.id,'2026-10-06T08:00:00.000Z',zone);expect((store.entities[0] as Task).fields.scheduledDurationMinutes).toBe(60)});
 it('updates start and duration atomically with one outbox operation',async()=>{const {task,store}=await fixture(true);const count=store.outbox.length,command=vi.spyOn(store.service,'scheduleTask');dialog(task,store);fireEvent.change(screen.getByLabelText('Hora'),{target:{value:'11:00'}});fireEvent.click(screen.getByRole('button',{name:'30 min'}));save();await settled(store);expect(command).toHaveBeenCalledWith(task.id,'2026-10-05T09:00:00.000Z',30,zone);expect(store.outbox).toHaveLength(count+1)});
 it('unschedules without changing task identity or due',async()=>{const {task,store}=await fixture(true);dialog(task,store);fireEvent.click(screen.getByRole('button',{name:'Quitar planificación'}));await settled(store);expect(store.entities[0].id).toBe(task.id);expect(store.entities[0].fields.due).toBe(task.fields.due);expect(scheduledTaskBlock(store.entities[0])).toBeNull()});
 it('cancel and unchanged save perform zero mutation/outbox',async()=>{const {task,store}=await fixture(true);const before=store.snapshot();const close=dialog(task,store);fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(close).toHaveBeenCalled();expect(store.snapshot()).toEqual(before);save();await settled(store);expect(store.snapshot()).toEqual(before)});
 it.each(['date','time','duration','dst'])('rejects invalid %s without mutation',async mode=>{const {task,store}=await fixture();const before=store.snapshot();dialog(task,store);
  if(mode==='date')fireEvent.change(screen.getByLabelText('Fecha'),{target:{value:''}});
  if(mode==='time')fireEvent.change(screen.getByLabelText('Hora'),{target:{value:''}});
  if(mode==='duration')fireEvent.change(screen.getByLabelText('Duración en minutos'),{target:{value:'0'}});
  if(mode==='dst'){fireEvent.change(screen.getByLabelText('Fecha'),{target:{value:'2026-03-29'}});fireEvent.change(screen.getByLabelText('Hora'),{target:{value:'02:30'}})}
  fireEvent.submit(screen.getByRole('button',{name:'Guardar'}).closest('form')!);await screen.findByRole('alert');expect(store.snapshot()).toEqual(before);
 });
});
it('Task editor schedules, renders Day/Week, opens the original and reflects complete/delete/reopen/restore',async()=>{
 const {task,store}=await fixture();render(<App providedStore={store}/>);
 fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Tareas'}));fireEvent.click(screen.getByRole('button',{name:/^Trabajo profundo/}));expect(screen.getByRole('button',{name:'Planificar…'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Planificar…'}));const schedule=screen.getByRole('dialog',{name:'Planificar tarea'});fireEvent.change(within(schedule).getByLabelText('Fecha'),{target:{value:'2026-10-05'}});fireEvent.change(within(schedule).getByLabelText('Hora'),{target:{value:'10:00'}});fireEvent.click(within(schedule).getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Planificar tarea'})).toBeNull());
 expect(screen.getByRole('button',{name:'Modificar…'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Calendario'}));fireEvent.click(screen.getByRole('button',{name:'Día'}));fireEvent.change(screen.getByLabelText('Fecha calendario'),{target:{value:'2026-10-05'}});
 const blockName='✓ 10:00 Trabajo profundo';expect(await screen.findByRole('button',{name:blockName})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'18:00 Trabajo profundo'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:blockName}));expect(screen.getByLabelText('Título')).toHaveValue(task.fields.title);fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));
 fireEvent.click(screen.getByRole('button',{name:'Semana'}));expect(await screen.findByRole('button',{name:blockName})).toBeInTheDocument();
 await act(()=>store.complete(task.id,true));expect(screen.queryByRole('button',{name:blockName})).toBeNull();await act(()=>store.service.reopen(task.id));expect(await screen.findByRole('button',{name:blockName})).toBeInTheDocument();
 await act(()=>store.service.delete(task.id));expect(screen.queryByRole('button',{name:blockName})).toBeNull();await act(()=>store.service.restore(task.id));expect(await screen.findByRole('button',{name:blockName})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:blockName}));fireEvent.click(screen.getByRole('button',{name:'Quitar planificación'}));await settled(store);fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));expect(screen.queryByRole('button',{name:blockName})).toBeNull();expect(store.entities[0].fields.due).toBe(task.fields.due);
},15000);
it('recurrent Task editor explains guard and offers no scheduling action',async()=>{const {task,store}=await fixture();await store.patch(task.id,{recurrence:{frequency:'daily',interval:1,weekdays:[],monthDay:null,count:null,until:null,exceptions:[]}});render(<App providedStore={store}/>);fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Tareas'}));fireEvent.click(screen.getByRole('button',{name:/^Trabajo profundo/}));expect(screen.getByText('Las tareas recurrentes todavía no pueden planificarse en el calendario.')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Planificar…'})).toBeNull()});

it.each([390,1280])('Day/Week smoke at viewport width %s keeps controls and task dialog available',async width=>{
 Object.defineProperty(window,'innerWidth',{value:width,configurable:true});
 const {store}=await fixture(true);render(<App providedStore={store}/>);
 fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name:'Calendario'}));
 fireEvent.change(screen.getByLabelText('Fecha calendario'),{target:{value:'2026-10-05'}});
 for(const view of ['Día','Semana']){
  fireEvent.click(screen.getByRole('button',{name:view}));
  await waitFor(()=>expect(document.querySelectorAll('.timeline')).toHaveLength(view==='Día'?1:7));
  fireEvent.click(screen.getByRole('button',{name:'✓ 10:00 Trabajo profundo'}));
  screen.getByRole('button',{name:'Modificar…'}).focus();fireEvent.click(screen.getByRole('button',{name:'Modificar…'}));
  expect(screen.getByRole('dialog',{name:'Modificar planificación'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
  expect(screen.getByRole('button',{name:'Modificar…'})).toHaveFocus();
  fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));
 }
});
