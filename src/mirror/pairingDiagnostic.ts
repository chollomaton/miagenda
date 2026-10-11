import {sha256} from './canonical';
export const diagnosticEnabled=(import.meta.env.DEV||import.meta.env.VITE_PAIRING_DIAGNOSTICS==='1')&&new URLSearchParams(globalThis.location?.search??'').get('pairingDiagnostic')==='1';
export type PairingEvent='review-clicked'|'review-success'|'review-denied'|'review-error'|'web-fragment-seen'|'fragment-missing'|'owner-session-restored'|'owner-session-missing'|'approval-clicked'|'txn-start'|'txn-committed'|'txn-denied'|'txn-error'|'txn-pending'|'challenge-unavailable'|'grant-observed'|'grant-absent'|'network-offline'|'network-online';
export const diagnostic=diagnosticEnabled?await import('./pairingDiagnosticStore'):null;
export async function diagnosticCorrelation(secret:string){return diagnostic?await sha256('miagenda-pairing-diagnostic-v1:'+await sha256(secret)):'';}
export function diagnosticError(error:unknown){const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):error instanceof Error?error.message:'';return ['permission-denied','unavailable','deadline-exceeded','OWNER_AUTH_REQUIRED','STALE_SESSION','CHALLENGE_UNAVAILABLE','INVALID_CHALLENGE'].includes(code)?code:'unknown';}
