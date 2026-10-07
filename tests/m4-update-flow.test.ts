import {expect,it,vi} from 'vitest';
import {waitFor} from '@testing-library/react';
import {requestSafeUpdate} from '../src/pwa/updates';
function fixture(flush=vi.fn(async()=>{})){
 const container=new EventTarget() as ServiceWorkerContainer,worker={postMessage:vi.fn()} as unknown as ServiceWorker,reload=vi.fn(),fail=vi.fn();
 const stop=requestSafeUpdate(worker,container,flush,reload,fail);return {container,worker,reload,fail,stop,flush};
}
for(const cls of ['dialog','quick-capture','template','note'])it('defers activation and reload until '+cls+' closes, preserves draft',async()=>{
 const editor=document.createElement('div');editor.setAttribute('role','dialog');editor.innerHTML='<input value="borrador">';document.body.append(editor);
 const f=fixture();expect(f.worker.postMessage).not.toHaveBeenCalled();expect((editor.firstChild as HTMLInputElement).value).toBe('borrador');
 f.container.dispatchEvent(new Event('controllerchange'));expect(f.reload).not.toHaveBeenCalled();editor.remove();
 await waitFor(()=>expect(f.worker.postMessage).toHaveBeenCalledWith({type:'ACTIVATE_WHEN_SAFE'}));expect(f.flush).toHaveBeenCalledTimes(1);expect(f.reload).not.toHaveBeenCalled();
 f.container.dispatchEvent(new Event('controllerchange'));expect(f.reload).toHaveBeenCalledTimes(1);f.stop();
});
it('checks again after persistence and defers controller change when a new editor opens',async()=>{
 let resolve!:()=>void;const f=fixture(vi.fn(()=>new Promise<void>(r=>{resolve=r})));
 const editor=document.createElement('div');editor.setAttribute('role','dialog');document.body.append(editor);resolve();await Promise.resolve();expect(f.worker.postMessage).not.toHaveBeenCalled();editor.remove();
 await waitFor(()=>expect(f.flush).toHaveBeenCalledTimes(2));resolve();await waitFor(()=>expect(f.worker.postMessage).toHaveBeenCalled());
 document.body.append(editor);f.container.dispatchEvent(new Event('controllerchange'));expect(f.reload).not.toHaveBeenCalled();editor.remove();await waitFor(()=>expect(f.reload).toHaveBeenCalledOnce());f.stop();
});
it('does not activate or reload after failed persistence',async()=>{const f=fixture(vi.fn(async()=>{throw Error('disk')}));await waitFor(()=>expect(f.fail).toHaveBeenCalled());expect(f.worker.postMessage).not.toHaveBeenCalled();expect(f.reload).not.toHaveBeenCalled();f.stop()});
it('removes listeners on teardown and ignores unrelated activation',async()=>{const f=fixture();f.stop();await Promise.resolve();f.container.dispatchEvent(new Event('controllerchange'));expect(f.reload).not.toHaveBeenCalled();expect(f.worker.postMessage).not.toHaveBeenCalled()});
