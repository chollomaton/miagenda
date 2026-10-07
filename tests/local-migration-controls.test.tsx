import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {AuthManager} from '../src/auth/AuthManager';
import {AgendaSession} from '../src/auth/AgendaSession';
import {MemoryPersistence} from '../src/offline/Persistence';
import {MemoryRepository,RepositoryError} from '../src/repositories/AgendaRepository';
import {createEntity} from '../src/models/entities';
import {LocalFirebaseMigration} from '../src/migration/LocalFirebaseMigration';
import type {MigrationMarker} from '../src/migration/LocalFirebaseMigration';
import {LocalMigrationControls} from '../src/components/LocalMigrationControls';

async function setup(){
 const auth=new AuthManager({signIn:async()=> 'fixture',signOut:async()=>{}});await auth.signIn();
 const session=new AgendaSession(auth,()=>new MemoryPersistence()),remote=new MemoryRepository();await session.attach(remote);
 const source=new MemoryPersistence();await source.save({entities:[createEntity('Task')],outbox:[],quarantine:[]});
 const markers=new Map<string,unknown>();const metadata={readMetadata:async<T,>(key:string)=>markers.get(key) as T|undefined,writeMetadata:async<T,>(key:string,value:T,valid:()=>boolean)=>{if(!valid())throw Error('STALE_SESSION');markers.set(key,value)}};
 const download=vi.fn(async()=>{}),migration=new LocalFirebaseMigration(session,'fixture',source,metadata,download);await migration.initialize();return {migration,markers,download,remote};
}
it('only explicit click copies; notice shows backup and source guarantee, then synchronized success',async()=>{
 const f=await setup();render(<LocalMigrationControls migration={f.migration}/>);expect(f.download).not.toHaveBeenCalled();expect(screen.getByText('Tienes datos guardados en este navegador')).toBeVisible();expect(screen.getByText(/descargaremos automáticamente una copia de seguridad/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Copiar a mi cuenta'}));await screen.findByText('Datos copiados y sincronizados');expect(f.download).toHaveBeenCalledTimes(1);f.migration.dispose();
});
it.each(['Ahora no','Seguir separadas'])('%s closes notice; manual settings action survives',async choice=>{
 const f=await setup(),view=render(<LocalMigrationControls migration={f.migration}/>);fireEvent.click(screen.getByRole('button',{name:choice}));await waitFor(()=>expect(screen.queryByText('Tienes datos guardados en este navegador')).toBeNull());
 expect(f.markers.size).toBe(choice==='Ahora no'?0:1);if(choice==='Seguir separadas')expect((f.markers.get(f.migration.key) as MigrationMarker).status).toBe('dismissed');
 view.rerender(<LocalMigrationControls migration={f.migration} manual/>);expect(screen.getByRole('button',{name:'Copiar datos locales a mi cuenta'})).toBeEnabled();expect(f.download).not.toHaveBeenCalled();f.migration.dispose();
});
it('pending remote sync displays local success and reconnection message',async()=>{
 const f=await setup();vi.spyOn(f.remote,'save').mockRejectedValueOnce(new RepositoryError('network'));render(<LocalMigrationControls migration={f.migration}/>);
 fireEvent.click(screen.getByRole('button',{name:'Copiar a mi cuenta'}));await screen.findByText('Datos copiados en este dispositivo');expect(screen.getByText('Se terminarán de sincronizar cuando vuelva la conexión.')).toBeVisible();f.migration.dispose();
});
it('download error says source unchanged and offers retry',async()=>{
 const f=await setup();f.download.mockRejectedValueOnce(Error('DOWNLOAD_FAILED'));render(<LocalMigrationControls migration={f.migration}/>);fireEvent.click(screen.getByRole('button',{name:'Copiar a mi cuenta'}));await screen.findByText('No se pudieron copiar los datos');expect(screen.getByText('La Agenda local no se ha modificado.')).toBeVisible();expect(screen.getByRole('button',{name:'Copiar a mi cuenta'})).toBeEnabled();f.migration.dispose();
});
