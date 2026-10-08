import {describe,it,expect} from 'vitest';
import {createLocalPairingChallenge,mirrorPolicy,validateLocalPairingChallenge} from '../src/mirror/pairing';
const now=Date.parse('2026-10-08T12:00:00.000Z');
const grant={ownerUID:'owner',publisherUID:'publisher',publisherID:'mac',leaseExpiresAt:'2026-10-08T13:00:00.000Z',revokedAt:null};
describe('local pairing contract and policy specification',()=>{
 it('uses independent 256-bit challenges and retains only digest in record',async()=>{
  const a=await createLocalPairingChallenge('publisher',now),b=await createLocalPairingChallenge('publisher',now);expect(a.challenge).toMatch(/^[0-9a-f]{64}$/);expect(a.challenge).not.toBe(b.challenge);expect(JSON.stringify(a.record)).not.toContain(a.challenge);expect(a.record.expiresAt).toBe('2026-10-08T12:05:00.000Z');expect(await validateLocalPairingChallenge(a.challenge,a.record,now)).toBe(true);
 });
 it('rejects expiry, replay, invalid token and wrong digest',async()=>{
  const {challenge,record}=await createLocalPairingChallenge('publisher',now);expect(await validateLocalPairingChallenge(challenge,record,now+300000)).toBe(false);expect(await validateLocalPairingChallenge(challenge,{...record,consumedAt:new Date(now).toISOString()},now)).toBe(false);expect(await validateLocalPairingChallenge('wrong',record,now)).toBe(false);expect(await validateLocalPairingChallenge('a'.repeat(64),record,now)).toBe(false);
 });
 it('owner reads and manages publisher, but cannot write mirror',()=>{
  expect(mirrorPolicy('read-mirror','owner','owner',grant,now)).toBe(true);expect(mirrorPolicy('manage-publisher','owner','owner',grant,now)).toBe(true);expect(mirrorPolicy('write-mirror','owner','owner',grant,now)).toBe(false);
 });
 it('publisher writes only mirror of bound owner',()=>{
  expect(mirrorPolicy('write-mirror','publisher','owner',grant,now)).toBe(true);expect(mirrorPolicy('write-online','publisher','owner',grant,now)).toBe(false);expect(mirrorPolicy('write-mirror','publisher','other',grant,now)).toBe(false);expect(mirrorPolicy('manage-publisher','publisher','owner',grant,now)).toBe(false);
 });
 it('denies revoked/expired publishers, missing grant, third parties and signed-out users',()=>{
  expect(mirrorPolicy('write-mirror','publisher','owner',{...grant,revokedAt:new Date(now).toISOString()},now)).toBe(false);expect(mirrorPolicy('write-mirror','publisher','owner',grant,now+3600000)).toBe(false);expect(mirrorPolicy('write-mirror','publisher','owner',null,now)).toBe(false);
  for(const action of ['read-mirror','write-mirror','manage-publisher','write-online'] as const)for(const uid of [null,'third'])expect(mirrorPolicy(action,uid,'owner',grant,now)).toBe(false);
 });
});
