import type {PairingEvent} from './pairingDiagnostic';
const allowed=new Set(['review-clicked','review-success','review-denied','review-error','web-fragment-seen','fragment-missing','owner-session-restored','owner-session-missing','approval-clicked','txn-start','txn-committed','txn-denied','txn-error','txn-pending','challenge-unavailable','grant-observed','grant-absent','network-offline','network-online']);
const codes=new Set(['permission-denied','unavailable','deadline-exceeded','OWNER_AUTH_REQUIRED','STALE_SESSION','CHALLENGE_UNAVAILABLE','INVALID_CHALLENGE','unknown']);
export interface DiagnosticRecord {event:PairingEvent;correlation:string;iso:string;monotonic:number;side:'web';environment:'local'|'configured';code?:string;phase?:string}
let records:DiagnosticRecord[]=[];
let expires=Date.now()+15*60_000;
const listeners=new Set<()=>void>();
export const subscribe=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
export function clear(){records=[];expires=Date.now()+15*60_000;listeners.forEach(fn=>fn());}
export function snapshot(){if(Date.now()>=expires&&records.length)clear();return records;}
export function emit(event:PairingEvent,correlation='',code?:string,phase?:'owner'|'challenge-read'|'grant-read'|'commit'){
 if(!allowed.has(event)||correlation!==''&&!/^[a-f0-9]{64}$/.test(correlation))return;
 snapshot();records=[...records.slice(-255),{event,correlation,iso:new Date().toISOString(),monotonic:performance.now(),side:'web',environment:['localhost','127.0.0.1'].includes(globalThis.location?.hostname)?'local':'configured',...(code?{code:codes.has(code)?code:'unknown'}:{}),...(phase&&['owner','challenge-read','grant-read','commit'].includes(phase)?{phase}:{})}];listeners.forEach(fn=>fn());
}
export function exportEvidence(){return JSON.stringify({schema:1,records:snapshot()},null,2);}
if(typeof window!=='undefined'){
 window.setInterval(()=>{snapshot();},1000);
 window.addEventListener('pagehide',clear);
 window.addEventListener('offline',()=>emit('network-offline'));
 window.addEventListener('online',()=>emit('network-online'));
}
