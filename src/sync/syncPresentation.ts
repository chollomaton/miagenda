import type {AgendaStore} from '../stores/AgendaStore';

const permanentCauses=new Set(['permission','invalidRecord','zoneMissing']);
export function syncPresentation(store:AgendaStore){
 if(store.mode==='local-only')return {state:'local',title:'Agenda local',detail:'Guardada en este navegador',pending:0,permanent:0,attention:false,lastSync:null};
 const pending=store.outbox.length,permanent=store.outbox.filter(op=>op.status==='permanentFailure').length;
 const common={pending,permanent,lastSync:store.lastSync,attention:false};
 if(store.syncIssueCause==='authentication')return {...common,state:'auth',title:'Necesita atención',detail:'Tu sesión ha caducado. Vuelve a entrar para continuar sincronizando.',attention:true};
 if(permanent||permanentCauses.has(store.syncIssueCause??''))return {...common,state:'permanent',title:'Necesita atención',detail:permanent?`${permanent} cambios no se pudieron sincronizar`:'No se pudo acceder a tu agenda. Revisa tu cuenta y vuelve a intentarlo.',attention:true};
 if(store.status==='syncing')return {...common,state:'syncing',title:'Sincronizando…',detail:`${pending} cambios pendientes`};
 if(store.status==='offline'||store.syncIssueCause==='network')return {...common,state:'offline',title:'Sin conexión',detail:`${pending} cambios pendientes`};
 if(pending)return {...common,state:'pending',title:'Pendiente',detail:`${pending} cambios pendientes`};
 return {...common,state:'ready',title:'Sincronizada',detail:'Todo al día'};
}
export function lastSyncLabel(value:string|null){
 if(!value||!Number.isFinite(Date.parse(value)))return null;
 return 'Última sincronización: '+new Intl.DateTimeFormat('es',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
}

// Share concurrent UI requests and use the existing engine's own in-flight guard.
const requests=new WeakMap<AgendaStore,Promise<void>>();
export function synchronizeAgenda(store:AgendaStore){
 const running=requests.get(store);if(running)return running;
 const active=()=>store.status!=='signedOut';
 const request=(async()=>{await store.flush();if(!active())return;await store.refresh();if(!active())return;if(store.mode==='local-only')return;await store.repository.synchronize();await store.flush();if(active())await store.refresh()})().finally(()=>requests.delete(store));
 requests.set(store,request);return request;
}
