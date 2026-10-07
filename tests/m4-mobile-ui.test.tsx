import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {App} from '../src/app/App';
import {TaskScheduleDialog} from '../src/components/TaskScheduleDialog';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
import type {Task} from '../src/models/entities';
beforeEach(()=>vi.stubGlobal('innerWidth',393));
afterEach(()=>vi.unstubAllGlobals());
async function app(){const store=new AgendaStore(new MemoryPersistence(),undefined,'local-only');await store.boot();render(<App providedStore={store}/>);return store}
it('keeps QuickNote draft through keyboard viewport resize and saves on close',async()=>{
 const viewport=Object.assign(new EventTarget(),{height:852,offsetTop:0});vi.stubGlobal('visualViewport',viewport);
 const store=await app();fireEvent.click(screen.getByRole('button',{name:'Notas'}));fireEvent.click(screen.getByRole('button',{name:'Nueva nota'}));
 const note=await screen.findByLabelText('Nota');fireEvent.change(note,{target:{value:'Texto dictado con acentos y saltos\nSegunda línea'}});
 act(()=>{viewport.height=390;viewport.offsetTop=40;viewport.dispatchEvent(new Event('resize'))});expect(note).toHaveValue('Texto dictado con acentos y saltos\nSegunda línea');expect(document.documentElement.style.getPropertyValue('--visible-height')).toBe('390px');
 fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(store.entities.find(e=>e.kind==='QuickNote')?.fields.text).toContain('Segunda línea');
});
it('keeps capture literal draft, restores focus and opens details without persistence',async()=>{
 const store=await app();const trigger=screen.getByRole('button',{name:'Buscar en toda Mi Agenda'});trigger.focus();fireEvent.keyDown(window,{key:'k',ctrlKey:true});fireEvent.click(screen.getByRole('option',{name:'Captura rápida'}));
 const input=screen.getByLabelText('Qué quieres recordar');expect(input).toHaveFocus();fireEvent.change(input,{target:{value:'nota Texto dictado mañana'}});fireEvent.click(screen.getByRole('button',{name:'Editar detalles'}));expect(screen.getByLabelText('Nota')).toHaveValue('Texto dictado mañana');expect(store.entities).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(store.entities[0]?.fields.text).toBe('Texto dictado mañana'));
});
it('navigates settings recovery and sync from accessible mobile navigation',async()=>{
 await app();const nav=screen.getByRole('navigation',{name:'Navegación móvil'});expect(within(nav).getByRole('button',{name:'Hoy'})).toHaveAttribute('aria-current','page');fireEvent.click(within(nav).getByRole('button',{name:'Más'}));fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
 fireEvent.click(screen.getByRole('button',{name:'Datos y recuperación'}));expect(screen.getByRole('heading',{name:'Papelera'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Comprobar integridad'}));expect(screen.getByRole('alert')).toHaveTextContent('0 avisos');
});
it('schedules with presets, custom duration and unschedules without drag on 393px',async()=>{
 const store=new AgendaStore(new MemoryPersistence());await store.boot();const task=await store.create('Task',{title:'Móvil'});const close=vi.fn();const view=render(<TaskScheduleDialog task={task as Task} store={store} timezone="Europe/Madrid" date="2026-10-07" onClose={close}/>);
 for(const n of [30,60,90]){fireEvent.click(screen.getByRole('button',{name:n+' min'}));expect(screen.getByLabelText('Duración en minutos')).toHaveValue(n)}
 fireEvent.click(screen.getByRole('button',{name:'Personalizada'}));expect(screen.getByLabelText('Duración en minutos')).toHaveFocus();fireEvent.change(screen.getByLabelText('Duración en minutos'),{target:{value:'45'}});fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(close).toHaveBeenCalled());expect((store.entities[0] as Task).fields.scheduledDurationMinutes).toBe(45);
 view.rerender(<TaskScheduleDialog task={store.entities[0] as Task} store={store} timezone="Europe/Madrid" date="2026-10-07" onClose={close}/>);fireEvent.click(screen.getByRole('button',{name:'Quitar planificación'}));await waitFor(()=>expect((store.entities[0] as Task).fields.scheduledStartAt).toBeNull());
});
it('rejects nonexistent DST wall time and preserves schedule draft',async()=>{
 const store=new AgendaStore(new MemoryPersistence());await store.boot();const task=await store.create('Task',{title:'DST'});render(<TaskScheduleDialog task={task as Task} store={store} timezone="Europe/Madrid" date="2026-03-29" onClose={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Hora'),{target:{value:'02:30'}});fireEvent.click(screen.getByRole('button',{name:'Guardar'}));expect(await screen.findByRole('alert')).toHaveTextContent('Esta hora no existe');expect(screen.getByLabelText('Hora')).toHaveValue('02:30');expect((store.entities[0] as Task).fields.scheduledStartAt).toBeFalsy();
});
it('changes event date, time and duration through the editor without dragging',async()=>{
 const store=await app();fireEvent.click(within(screen.getByRole('navigation',{name:'Navegación móvil'})).getByRole('button',{name:'Calendario'}));fireEvent.click(screen.getByRole('button',{name:'Nuevo evento'}));
 fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Evento móvil'}});fireEvent.change(screen.getByLabelText('Inicio'),{target:{value:'2026-10-08T10:00'}});fireEvent.change(screen.getByLabelText('Fin'),{target:{value:'2026-10-08T11:00'}});fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 fireEvent.change(screen.getByLabelText('Fecha calendario'),{target:{value:'2026-10-08'}});fireEvent.click(screen.getByRole('button',{name:/Evento móvil/}));fireEvent.change(screen.getByLabelText('Inicio'),{target:{value:'2026-10-09T12:00'}});fireEvent.change(screen.getByLabelText('Fin'),{target:{value:'2026-10-09T13:30'}});fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await waitFor(()=>expect(store.entities[0].fields.start).toBe('2026-10-09T10:00:00.000Z'));expect(store.entities[0].fields.end).toBe('2026-10-09T11:30:00.000Z');
});
