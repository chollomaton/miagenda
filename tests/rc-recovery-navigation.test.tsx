import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {App} from '../src/app/App';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';
it('RC Papelera shortcut mounts recovery backup controls as well as trash',async()=>{
 const store=new AgendaStore(new MemoryPersistence(),undefined,'local-only');await store.boot();
 render(<App providedStore={store}/>);
 fireEvent.click(screen.getByRole('button',{name:'Papelera'}));
 expect(await screen.findByRole('button',{name:'Exportar backup ZIP'})).toBeVisible();
 expect(screen.getByRole('heading',{name:'Datos y recuperación'})).toBeVisible();
});
