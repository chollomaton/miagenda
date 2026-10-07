import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {UpdateNotice} from '../src/pwa/UpdateNotice';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks()});
async function notice(){
 vi.stubEnv('PROD',true);
 const worker=Object.assign(new EventTarget(),{postMessage:vi.fn()}) as unknown as ServiceWorker;
 const reg=Object.assign(new EventTarget(),{waiting:worker,installing:null}) as unknown as ServiceWorkerRegistration;
 const container=Object.assign(new EventTarget(),{register:vi.fn(async()=>reg)}) as unknown as ServiceWorkerContainer;
 vi.stubGlobal('navigator',Object.create(navigator,{serviceWorker:{value:container}}));
 const flush=vi.fn(async()=>{});render(<UpdateNotice flush={flush}/>);act(()=>window.dispatchEvent(new Event('load')));
 await screen.findByText('Hay una nueva versión de Mi Agenda.');return {worker,reg,container,flush};
}
it('announces waiting politely and never activates on detection',async()=>{
 const f=await notice();expect(screen.getByRole('status')).toHaveAttribute('aria-live','polite');expect(screen.getByRole('button',{name:'Actualizar'})).toBeEnabled();expect(f.worker.postMessage).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Actualizar'}));await waitFor(()=>expect(f.worker.postMessage).toHaveBeenCalledWith({type:'ACTIVATE_WHEN_SAFE'}));expect(f.flush).toHaveBeenCalledOnce();
});
it('offers defer action with an existing draft and does not touch its text',async()=>{
 const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML='<textarea>borrador</textarea>';document.body.append(dialog);
 try{const f=await notice();fireEvent.click(screen.getByRole('button',{name:'Actualizar al terminar'}));expect(screen.getByRole('status')).toHaveTextContent('al terminar');expect(f.worker.postMessage).not.toHaveBeenCalled();expect(dialog.querySelector('textarea')?.value).toBe('borrador');dialog.remove();await waitFor(()=>expect(f.worker.postMessage).toHaveBeenCalled());}finally{dialog.remove()}
});
it('reports another tab blocking activation and lets user retry',async()=>{
 const f=await notice();fireEvent.click(screen.getByRole('button',{name:'Actualizar'}));await waitFor(()=>expect(f.worker.postMessage).toHaveBeenCalled());
 act(()=>f.container.dispatchEvent(new MessageEvent('message',{source:f.worker,data:{type:'UPDATE_BLOCKED'}})));
 expect(screen.getByRole('alert')).toHaveTextContent('otras pestañas');expect(screen.getByRole('button',{name:'Actualizar'})).toBeEnabled();
});
