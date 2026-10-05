import {fireEvent,render,screen,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {Dashboard} from '../src/components/Dashboard';
import {createEntity,defaults} from '../src/models/entities';
import {App} from '../src/app/App';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
it('Dashboard shows counts and opens both original entities without writes',async()=>{
 const store=new AgendaStore(new MemoryPersistence());await store.boot();
 const a=await store.create('Task',{title:'Tarea Radar',due:'2000-01-01T08:00:00.000Z'});
 await store.service.scheduleTask(a.id,'2000-01-01T08:00:00.000Z',60,'Europe/Madrid');
 await store.create('Event',{title:'Evento Radar',start:'2000-01-01T08:30:00.000Z',end:'2000-01-01T09:30:00.000Z'});
 const before=store.snapshot();render(<App providedStore={store}/>);
 const region=within(screen.getByRole('region',{name:'Radar'}));fireEvent.click(region.getByText('1 vencidos · 1 conflictos'));
 for(const [title,index] of [['Tarea Radar',0],['Tarea Radar',1],['Evento Radar',0]] as const){fireEvent.click(region.getAllByRole('button',{name:title})[index]);expect(screen.getByLabelText('Título')).toHaveValue(title);fireEvent.click(screen.getByRole('button',{name:'Cerrar'}))}
 await store.flush();expect(store.snapshot()).toEqual(before);
});
it('shows a neutral empty state and derives new counts on rerender',()=>{
 const props={entities:[],today:'2026-10-05',prefs:defaults(),onOpen:vi.fn(),onCreate:vi.fn(),onNavigate:vi.fn(),renderList:()=>null,onMessage:vi.fn()};
 const {rerender}=render(<Dashboard {...props}/>);expect(screen.getByText('Sin pendientes urgentes')).toBeInTheDocument();
 rerender(<Dashboard {...props} entities={[createEntity('Reminder',{title:'Aviso',due:'2000-01-01T08:00:00.000Z'})]}/>);expect(screen.getByText('1 vencidos · 0 conflictos')).toBeInTheDocument();
});
