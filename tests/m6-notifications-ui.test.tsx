import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {App} from '../src/app/App';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
import {useForegroundNotifications} from '../src/notifications/useForegroundNotifications';
const now='2026-10-07T08:00:00.000Z';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
function mockNotification(permission='default'){
 const show=vi.fn(),request=vi.fn(async()=>{BrowserNotification.permission='granted';return 'granted' as const});
 class BrowserNotification {static permission=permission;static requestPermission=request;constructor(title:string,options:unknown){show(title,options)}}
 vi.stubGlobal('Notification',BrowserNotification);return {show,request};
}
it('M6 settings request permission only on explicit click and show honest status',async()=>{
 const {request}=mockNotification();const store=new AgendaStore(new MemoryPersistence());await store.boot();
 render(<App providedStore={store}/>);expect(request).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));fireEvent.click(screen.getByRole('button',{name:'Sincronización'}));
 expect(screen.getByText('Estado: No autorizado')).toBeVisible();
 expect(screen.getByText('Los avisos se muestran mientras Mi Agenda está abierta. Las notificaciones con la app cerrada todavía no están habilitadas.')).toBeVisible();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Permiso del navegador'}))});
 expect(request).toHaveBeenCalledOnce();expect(screen.getByText('Estado: Permitido')).toBeVisible();
});
it('M6 settings safely show unavailable API',async()=>{
 vi.stubGlobal('Notification',undefined);const store=new AgendaStore(new MemoryPersistence());await store.boot();render(<App providedStore={store}/>);
 fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));fireEvent.click(screen.getByRole('button',{name:'Sincronización'}));expect(screen.getByText('Estado: No disponible')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Permiso del navegador'}));expect(screen.getByText('Este navegador no admite notificaciones.')).toBeVisible();
});
it.each(['local-only','sync-enabled'] as const)('M6 %s hook handles updates, focus, re-renders and unmount without duplicate timers',async mode=>{
 vi.useFakeTimers();vi.setSystemTime(now);const {show,request}=mockNotification('granted');const store=new AgendaStore(new MemoryPersistence(),undefined,mode);await store.boot();
 await store.create('Reminder',{title:'Primer aviso',due:'2026-10-07T08:00:01.000Z',alerts:[0]});
 function Host(){useForegroundNotifications(store,true);return null}
 const ui=render(<Host/>);for(let i=0;i<10;i++)ui.rerender(<Host/>);expect(vi.getTimerCount()).toBe(1);
 await act(async()=>{await store.patch(store.entities[0].id,{title:'Nuevo título',due:'2026-10-07T08:00:02.000Z'})});
 act(()=>vi.advanceTimersByTime(1000));expect(show).not.toHaveBeenCalled();act(()=>vi.advanceTimersByTime(1000));expect(show).toHaveBeenCalledWith('Nuevo título',expect.objectContaining({tag:expect.any(String)}));
 act(()=>{fireEvent.focus(window);document.dispatchEvent(new Event('visibilitychange'))});expect(show).toHaveBeenCalledOnce();expect(request).not.toHaveBeenCalled();
 await act(async()=>{await store.create('Reminder',{due:'2026-10-07T08:00:03.000Z',alerts:[0]});store.detach()});
 act(()=>vi.advanceTimersByTime(1000));expect(show).toHaveBeenCalledOnce();ui.unmount();expect(vi.getTimerCount()).toBe(0);
});
it('M6 adds no notification transport, secrets or private SW cache',()=>{
 const sw=readFileSync('scripts/service-worker.ts','utf8');
 expect(sw).not.toMatch(/showNotification|pushManager|firebase|messaging|vapid|notificationclick/i);
 for(const path of ['src/notifications/ForegroundNotificationScheduler.ts','src/notifications/useForegroundNotifications.ts']){
  const source=readFileSync(path,'utf8');expect(source).not.toMatch(/localStorage|indexedDB|fetch\(|token|secret|firebase|vapid/i);
 }
});
