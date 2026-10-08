import {sha256} from './canonical';
/** Server-facing contracts only. No client grants itself publisher authority. */
export interface MirrorPublisherGrant {ownerUID:string;publisherUID:string;publisherID:string;leaseExpiresAt:string;revokedAt:string|null}
export interface MirrorPairingChallengeRecord {challengeHash:string;publisherUID:string;expiresAt:string;consumedAt:string|null}
export interface MirrorPairingService {
 begin(publisherUID:string):Promise<{challenge:string;expiresAt:string}>;
 confirm(challenge:string):Promise<MirrorPublisherGrant>;
 revoke(publisherID:string):Promise<void>;
}
export async function createLocalPairingChallenge(publisherUID:string,now=Date.now()) {
 if(!publisherUID)throw Error('PUBLISHER_ID_REQUIRED');
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const challenge=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
 const record:MirrorPairingChallengeRecord={challengeHash:await sha256(challenge),publisherUID,expiresAt:new Date(now+5*60000).toISOString(),consumedAt:null};
 return {challenge,record};
}
/** Executable local policy specification, NOT a replacement for server rules. */
export function mirrorPolicy(action:'read-mirror'|'write-mirror'|'manage-publisher'|'write-online',callerUID:string|null,ownerUID:string,grant:MirrorPublisherGrant|null,now=Date.now()):boolean {
 if(!callerUID||!ownerUID)return false;
 if(action==='read-mirror'||action==='manage-publisher'||action==='write-online')return callerUID===ownerUID;
 return !!grant&&grant.ownerUID===ownerUID&&grant.publisherUID!==ownerUID&&callerUID===grant.publisherUID&&grant.revokedAt===null&&Number.isFinite(Date.parse(grant.leaseExpiresAt))&&Date.parse(grant.leaseExpiresAt)>now;
}
export async function validateLocalPairingChallenge(challenge:string,record:MirrorPairingChallengeRecord,now=Date.now()):Promise<boolean> {
 return /^[0-9a-f]{64}$/.test(challenge)&&record.consumedAt===null&&Number.isFinite(Date.parse(record.expiresAt))&&Date.parse(record.expiresAt)>now&&await sha256(challenge)===record.challengeHash;
}
