import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {App} from '../src/app/App';
import {BackupControls} from '../src/components/BackupControls';
import {exportBackup} from '../src/backup/backup';
import * as files from '../src/backup/backupFiles';
import {encodeBackupZIP} from '../src/backup/zip';
import {createEntity} from '../src/models/entities';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});
async function fixture(inApp=false){
 const store=new AgendaStore(new MemoryPersistence());await store.boot();const existing=await store.create('Task',{title:'Keep'});
 const message=vi.fn(),zip=vi.spyOn(files,'downloadBackupZIP').mockResolvedValue(),json=vi.spyOn(files,'downloadBackup').mockImplementation(()=>{});
 const save=vi.spyOn(store.persistence,'save');
 const view=render(inApp?<App providedStore={store}/>:<BackupControls store={store} onMessage={message}/>);
 if(inApp){fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));fireEvent.click(screen.getByRole('button',{name:'Datos y recuperación'}))}
 return {store,existing,message,zip,json,save,...view};
}
async function incoming(zip=true){
 const backup=await exportBackup([createEntity('Task',{title:'Incoming'})]);
 const text=JSON.stringify(backup);return zip?new File([await encodeBackupZIP(text)],'backup.zip',{type:'application/zip'}):new File([text],'backup.json',{type:'application/json'});
}
function upload(file:File){fireEvent.change(screen.getByLabelText('Importar backup'),{target:{files:[file]}})}
it('integrates ZIP and legacy JSON export in settings without writes',async()=>{
 const {zip,json,save}=await fixture(true);
 fireEvent.click(screen.getByRole('button',{name:'Exportar backup ZIP'}));await waitFor(()=>expect(zip).toHaveBeenCalledTimes(1));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Exportar JSON'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Exportar JSON'}));await waitFor(()=>expect(json).toHaveBeenCalledTimes(1));
 expect(zip.mock.calls[0][0].checksum).toBe(json.mock.calls[0][0].checksum);expect(zip.mock.calls[0][0].tasks).toEqual(json.mock.calls[0][0].tasks);expect(save).not.toHaveBeenCalled();expect(screen.getByLabelText('Importar backup')).toHaveAttribute('accept','application/zip,.zip,application/json,.json');
});
it.each([false,true])('previews and cancels valid backup without mutation, ZIP=%s',async zip=>{
 const {store,save}=await fixture(),before=store.snapshot();upload(await incoming(zip));
 expect(await screen.findByText('Backup validado: 1 elementos.')).toBeInTheDocument();
 expect(screen.getByText(/Combinar: 1 nuevos, 0 existentes/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Guardar copia y reemplazar'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(screen.queryByText(/Backup validado/)).toBeNull();expect(save).not.toHaveBeenCalled();expect(store.snapshot()).toEqual(before);
});
it('merges ZIP only after explicit confirmation through the existing import flow',async()=>{
 const {store,existing,zip}=await fixture();upload(await incoming());await screen.findByText(/Backup validado/);
 fireEvent.click(screen.getByRole('button',{name:'Combinar'}));await waitFor(()=>expect(store.entities).toHaveLength(2));
 expect(store.entities.find(e=>e.id===existing.id)?.lifecycle).toBe('active');expect(zip).not.toHaveBeenCalled();
});
it('requires exact REEMPLAZAR and completes the safety ZIP before mutating',async()=>{
 const {store,existing,zip,save}=await fixture();upload(await incoming());await screen.findByText(/Backup validado/);
 fireEvent.change(screen.getByLabelText('Escribe REEMPLAZAR'),{target:{value:'reemplazar'}});expect(screen.getByRole('button',{name:'Guardar copia y reemplazar'})).toBeDisabled();
 let release!:()=>void;zip.mockImplementation(()=>new Promise<void>(resolve=>{release=resolve}));
 fireEvent.change(screen.getByLabelText('Escribe REEMPLAZAR'),{target:{value:'REEMPLAZAR'}});fireEvent.click(screen.getByRole('button',{name:'Guardar copia y reemplazar'}));
 await waitFor(()=>expect(zip).toHaveBeenCalledTimes(1));expect(save).not.toHaveBeenCalled();expect(store.entities).toHaveLength(1);
 expect(zip.mock.calls[0][0].tasks[0].id).toBe(existing.id);expect(screen.getByRole('button',{name:'Guardar copia y reemplazar'})).toBeDisabled();
 await act(async()=>{release()});await waitFor(()=>expect(store.entities.find(e=>e.id===existing.id)?.lifecycle).toBe('deleted'));expect(screen.queryByText(/Backup validado/)).toBeNull();
});
it('failed safety copy prevents replacement and preserves the entire snapshot',async()=>{
 const {store,zip,save,message}=await fixture(),before=store.snapshot();zip.mockRejectedValueOnce(Error('download failed'));
 upload(await incoming());await screen.findByText(/Backup validado/);fireEvent.change(screen.getByLabelText('Escribe REEMPLAZAR'),{target:{value:'REEMPLAZAR'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar copia y reemplazar'}));await waitFor(()=>expect(message).toHaveBeenCalledWith(expect.stringContaining('Los datos anteriores se conservan')));
 expect(save).not.toHaveBeenCalled();expect(store.snapshot()).toEqual(before);expect(await store.persistence.load()).toEqual(before);
});
it('rejects invalid selection and clears an earlier valid preview and confirmation',async()=>{
 const {store,save,message}=await fixture(),before=store.snapshot();upload(await incoming());await screen.findByText(/Backup validado/);
 fireEvent.change(screen.getByLabelText('Escribe REEMPLAZAR'),{target:{value:'REEMPLAZAR'}});upload(new File(['PK broken'],'bad.zip'));
 await waitFor(()=>expect(message).toHaveBeenCalledWith(expect.stringContaining('no es válido')));expect(screen.queryByRole('button',{name:'Combinar'})).toBeNull();expect(store.snapshot()).toEqual(before);expect(save).not.toHaveBeenCalled();
 upload(await incoming(false));await screen.findByText(/Backup validado/);expect(screen.getByLabelText('Escribe REEMPLAZAR')).toHaveValue('');
});
it('ignores a late file parse after controls unmount',async()=>{
 const {message,unmount}=await fixture();let release!:(value:Awaited<ReturnType<typeof exportBackup>>)=>void;
 vi.spyOn(files,'parseBackupFile').mockImplementation(()=>new Promise(resolve=>{release=resolve}));upload(new File(['{}'],'backup.json'));unmount();
 await act(async()=>{release(await exportBackup([]))});expect(message).not.toHaveBeenCalled();
});
it('invalid ZIP in settings reports a useful error and leaves data untouched',async()=>{
 const {store,save}=await fixture(true),before=store.snapshot();upload(new File(['broken'],'bad.zip'));
 expect(await screen.findByText('El backup no es válido o está dañado. No se han importado datos.')).toBeInTheDocument();
 expect(within(screen.getByRole('main')).queryByText(/Backup validado/)).toBeNull();expect(store.snapshot()).toEqual(before);expect(save).not.toHaveBeenCalled();
});
