import './pairingDiagnostic.css';
import {useSyncExternalStore} from 'react';
import {diagnostic} from './pairingDiagnostic';
export function PairingDiagnosticPanel(){
 const records=useSyncExternalStore(diagnostic?.subscribe??(()=>()=>{}),()=>diagnostic?.snapshot()??empty);
 if(!diagnostic)return null;
 const labels:Record<string,string>={'web-fragment-seen':'Web recibió enlace','owner-session-restored':'Sesión del propietario lista','approval-clicked':'Aprobación enviada','txn-committed':'Aprobación confirmada en servidor'};
 return <aside className="pairing-diagnostic-panel" aria-label="Diagnóstico temporal de vinculación"><h3>Diagnóstico temporal · 15 minutos</h3><ol>{records.map((record,i)=><li key={i}>{labels[record.event]??record.event}{record.code?' · '+record.code:''}</li>)}</ol><button onClick={()=>{const url=URL.createObjectURL(new Blob([diagnostic?.exportEvidence()??''],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='pairing-diagnostic.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Exportar diagnóstico</button><button onClick={()=>diagnostic?.clear()}>Borrar diagnóstico</button></aside>;
}
const empty:never[]=[];
