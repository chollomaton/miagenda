import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MirrorPairingPanel} from '../src/mirror/MirrorPairingPanel';
import type {ProductionOwnerPairing} from '../src/mirror/productionPairing';
const secret='a'.repeat(64);
function service(confirm:()=>Promise<void>,preview=vi.fn(async()=>({publisherUID:'synthetic',expiresAt:new Date(Date.now()+60000)}))){return {preview,confirm,status:vi.fn(),revoke:vi.fn()} as unknown as ProductionOwnerPairing;}
it('requires explicit owner review and confirmation before any write',async()=>{
 const confirm=vi.fn(async()=>{}),s=service(confirm);render(<MirrorPairingPanel service={s} initialSecret={secret}/>);
 expect(confirm).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Confirmar y reemplazar Mac anterior'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Revisar vinculación'}));await screen.findByRole('button',{name:'Confirmar y reemplazar Mac anterior'});expect(confirm).not.toHaveBeenCalled();
});
it('announces authorization only after commit completes and prevents duplicate submissions',async()=>{
 let finish!:()=>void;const confirm=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));render(<MirrorPairingPanel service={service(confirm)} initialSecret={secret}/>);
 fireEvent.click(screen.getByRole('button',{name:'Revisar vinculación'}));const approve=await screen.findByRole('button',{name:'Confirmar y reemplazar Mac anterior'});fireEvent.click(approve);
 expect(approve).toBeDisabled();expect(screen.queryByText(/Mac autorizado/)).not.toBeInTheDocument();fireEvent.click(approve);expect(confirm).toHaveBeenCalledOnce();finish();await screen.findByText(/Mac autorizado/);expect(screen.getByLabelText('Código de vinculación')).toHaveValue('');
});
it('a denied transaction never reports success and retains the code for an explicit retry',async()=>{
 const confirm=vi.fn().mockRejectedValueOnce(Error('permission-denied')).mockResolvedValueOnce(undefined);render(<MirrorPairingPanel service={service(confirm)} initialSecret={secret}/>);
 fireEvent.click(screen.getByRole('button',{name:'Revisar vinculación'}));fireEvent.click(await screen.findByRole('button',{name:'Confirmar y reemplazar Mac anterior'}));await screen.findByText(/No se pudo completar/);expect(screen.queryByText(/Mac autorizado/)).not.toBeInTheDocument();expect(screen.getByLabelText('Código de vinculación')).toHaveValue(secret);
 fireEvent.click(screen.getByRole('button',{name:'Confirmar y reemplazar Mac anterior'}));await screen.findByText(/Mac autorizado/);expect(confirm).toHaveBeenCalledTimes(2);
});
it('without an owner session review fails without attempting a grant write',async()=>{
 const confirm=vi.fn(async()=>{});const preview=vi.fn(async()=>{throw Error('OWNER_AUTH_REQUIRED');});render(<MirrorPairingPanel service={service(confirm,preview)} initialSecret={secret}/>);
 fireEvent.click(screen.getByRole('button',{name:'Revisar vinculación'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('No se pudo completar'));expect(confirm).not.toHaveBeenCalled();
});
