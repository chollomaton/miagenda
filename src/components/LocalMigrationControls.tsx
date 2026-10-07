import {useSyncExternalStore} from 'react';
import type {LocalFirebaseMigration} from '../migration/LocalFirebaseMigration';

const phaseErrors={read:'No se pudieron leer los datos guardados.',backup:'No se pudo crear o validar la copia de seguridad.',download:'No se pudo iniciar la descarga del ZIP. No se han importado datos.',import:'No se pudo combinar la copia con la agenda de tu cuenta.',marker:'No se pudo guardar el estado de la copia. Los datos copiados pueden permanecer pendientes en este dispositivo.',sync:'No se pudo completar la sincronización. Vuelve a intentarlo con conexión.'};

export function LocalMigrationControls({migration,manual=false}:{migration:LocalFirebaseMigration;manual?:boolean}){
 useSyncExternalStore(migration.subscribe,()=>migration.revision);
 const run=(action:Promise<unknown>)=>{void action.catch(()=>{})};
 if(!manual&&!migration.offer&&!migration.busy&&!migration.error&&!migration.copied&&migration.marker?.status!=='pending')return null;
 return <section className="card" aria-label="Copiar agenda local" data-update-blocked={migration.busy}>
  {(manual||migration.offer)&&<><h3>{manual?'Copiar datos locales a mi cuenta':'Tienes datos guardados en este navegador'}</h3><p>Hay {migration.count} elementos en tu Agenda local. Puedes copiarlos a tu cuenta para tenerlos también disponibles con sincronización. Tus datos locales no se borrarán.</p><p>Antes de copiar los datos descargaremos automáticamente una copia de seguridad.</p><button className="primary" disabled={migration.busy||!migration.count||migration.marker?.status==='pending'} onClick={()=>run(migration.copy())}>{manual?'Copiar datos locales a mi cuenta':'Copiar a mi cuenta'}</button>{!manual&&<><button disabled={migration.busy} onClick={()=>run(migration.dismiss())}>Seguir separadas</button><button disabled={migration.busy} onClick={()=>migration.nowNot()}>Ahora no</button></>}</>}
  <div role="status">{migration.busy?<p>Copiando datos…</p>:migration.error?<><p>No se pudieron copiar los datos</p><p>La Agenda local no se ha modificado.</p><p>{migration.error==='INITIAL_SYNC_FAILED'?'No se pudo terminar la sincronización inicial. Vuelve a intentarlo con conexión.':migration.error==='STORAGE_WRITE_FAILED'?'No se pudo guardar el estado de la copia. Revisa el almacenamiento y vuelve a intentarlo.':migration.error==='NO_LOCAL_DATA'?'La Agenda local no contiene elementos que copiar.':phaseErrors[migration.phase]}</p></>:migration.marker?.status==='completed'?<p>Datos copiados y sincronizados</p>:migration.marker?.status==='pending'?<><p>Datos copiados en este dispositivo</p><p>Se terminarán de sincronizar cuando vuelva la conexión.</p>{!migration.busy&&<button onClick={()=>run(migration.copy())}>Reintentar sincronización</button>}</>:null}</div>
 </section>;
}
