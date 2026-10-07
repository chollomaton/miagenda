import type {AgendaStore} from '../stores/AgendaStore';
import {purgeDependencies} from '../recovery/purgeDependencies';
export function TrashRecovery({store,onMessage}:{store:AgendaStore;onMessage:(message:string)=>void}){
 const run=(work:Promise<unknown>)=>void work.catch(()=>onMessage('No se pudo guardar la recuperación. Vuelve a comprobar las dependencias.'));
 return <><h4>Papelera</h4>{store.mode==='sync-enabled'&&<p>Los eliminados sincronizados se conservan para evitar reapariciones desde otros dispositivos.</p>}{store.entities.filter(e=>e.lifecycle==='deleted').map(entity=>{
  const dependencies=purgeDependencies(store.entities,[entity.id]);
  return <div className="trash-item" key={entity.id}><span>{entity.kind==='Template'?entity.fields.name:entity.fields.title||'Sin título'}</span><button onClick={()=>run(store.service.restore(entity.id))}>Restaurar</button>{store.mode==='local-only'&&<>
   {dependencies.activeBlockers.length>0&&<span>Hay {dependencies.activeBlockers.length} elementos activos que lo necesitan. Restáuralo o resuelve sus referencias antes de purgar.</span>}
   {entity.kind==='Label'&&(dependencies.activeBlockers.length>0||dependencies.deletedDependencies.length>0)&&<button onClick={()=>{if(window.confirm('¿Quitar esta etiqueta de todos los elementos y plantillas que la usan y desvincular sus etiquetas hijas? Las demás etiquetas se conservarán.'))run(store.resolveLabelReferences(entity.id))}}>Resolver referencias de etiqueta</button>}
   <button disabled={dependencies.activeBlockers.length>0} onClick={()=>{if(window.confirm(`¿PURGAR definitivamente ${dependencies.expandedPurgeSet.length} elementos eliminados${dependencies.deletedDependencies.length?' junto con sus dependencias eliminadas':''}? Esta operación no se puede deshacer.`))run(store.purge(dependencies.expandedPurgeSet,'PURGAR'))}}>{dependencies.deletedDependencies.length?'Purgar conjunto':'Purgar'}</button>
  </>}</div>
 })}</>;
}
