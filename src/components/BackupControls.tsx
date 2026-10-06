import {useEffect,useRef,useState} from 'react';
import {exportBackup,importBackup,previewImport} from '../backup/backup';
import type {Backup} from '../backup/backup';
import {backupFileError,downloadBackup,downloadBackupZIP,parseBackupFile} from '../backup/backupFiles';
import type {AgendaStore} from '../stores/AgendaStore';

export function BackupControls({store,onMessage}:{store:AgendaStore;onMessage:(message:string)=>void}){
 const [backup,setBackup]=useState<Backup|null>(null),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++},[store]);
 async function read(file:File){
  const token=++generation.current;setBackup(null);setConfirmation('');setBusy(true);
  try{const parsed=await parseBackupFile(file);if(token===generation.current){setBackup(parsed);onMessage('')}}
  catch(error){if(token===generation.current)onMessage(backupFileError(error))}
  finally{if(token===generation.current)setBusy(false)}
 }
 async function perform(action:()=>Promise<void>){
  const token=generation.current;setBusy(true);
  try{await store.flush();if(token!==generation.current)return;await action()}
  catch{if(token===generation.current)onMessage('No se pudo completar la copia o la importación. Los datos anteriores se conservan.')}
  finally{if(token===generation.current)setBusy(false)}
 }
 async function apply(mode:'merge'|'replace'){
  if(!backup)return;
  const token=generation.current;
  if(mode==='replace'){
   await downloadBackupZIP(await exportBackup(store.entities));
   if(token!==generation.current)return;
  }
  await importBackup(store,backup,mode,confirmation);
  if(token===generation.current){setBackup(null);setConfirmation('');onMessage('Backup importado.')}
 }
 return <>
  <button disabled={busy} onClick={()=>void perform(async()=>{await downloadBackupZIP(await exportBackup(store.entities))})}>Exportar backup ZIP</button>
  <button disabled={busy} onClick={()=>void perform(async()=>{downloadBackup(await exportBackup(store.entities))})}>Exportar JSON</button>
  <label>Importar backup<input disabled={busy} type="file" accept="application/zip,.zip,application/json,.json" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void read(file)}}/></label>
  {busy&&<p role="status">Procesando backup…</p>}
  {backup&&<div className="notice">
   <p>Backup validado: {backup.entityCount} elementos.</p>
   <p>Combinar: {previewImport(store.entities,backup,'merge').create} nuevos, {previewImport(store.entities,backup,'merge').update} existentes. Reemplazar enviará {previewImport(store.entities,backup,'replace').delete} elementos a la papelera.</p>
   <button disabled={busy} onClick={()=>void perform(()=>apply('merge'))}>Combinar</button>
   <label>Escribe REEMPLAZAR<input disabled={busy} value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>
   <button disabled={busy||confirmation!=='REEMPLAZAR'} onClick={()=>void perform(()=>apply('replace'))}>Guardar copia y reemplazar</button>
   <button disabled={busy} onClick={()=>{generation.current++;setBackup(null);setConfirmation('')}}>Cancelar</button>
  </div>}
 </>;
}
