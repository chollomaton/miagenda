import {beforeEach,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
const state=vi.hoisted(()=>({mode:'ok',user:{uid:'private-owner',providerData:[{providerId:'google.com'}]}}));
vi.mock('../src/mirror/pairingDiagnostic',async()=>{
 const store=await import('../src/mirror/pairingDiagnosticStore');
 return {diagnostic:store,diagnosticCorrelation:async()=> 'b'.repeat(64),diagnosticError:(error:unknown)=>typeof error==='object'&&error!==null&&'code' in error?error.code:error instanceof Error?error.message:'unknown'};
});
vi.mock('firebase/firestore/lite',()=>({doc:()=>({}),serverTimestamp:()=>0,Timestamp:class {static fromMillis(value:number){return value;}},getDoc:vi.fn(),runTransaction:async(_db:unknown,callback:(tx:unknown)=>Promise<void>)=>{
 if(state.mode==='deny')throw {code:'permission-denied',message:'private-token'};
 if(state.mode==='offline')throw {code:'unavailable'};
 if(state.mode==='timeout')throw {code:'deadline-exceeded'};
 await callback({get:async()=>({data:()=>({publisherUID:'private-publisher',consumedAt:null,expiresAt:{toMillis:()=>state.mode==='expired'?0:Date.now()+60000}})}),update:()=>{},set:()=>{}});
}}));
import {ProductionOwnerPairing} from '../src/mirror/productionPairing';
import {clear,snapshot,emit,exportEvidence} from '../src/mirror/pairingDiagnosticStore';
import type {Firestore} from 'firebase/firestore/lite';
import type {Auth} from 'firebase/auth';
beforeEach(()=>{clear();state.mode='ok';vi.stubGlobal('crypto',webcrypto);});
const service=(signedIn=true)=>new ProductionOwnerPairing({} as Firestore,{currentUser:signedIn?state.user:null} as Auth,true);
it('records actual service checkpoints in order with no capability or identities',async()=>{
 await service().confirm('a'.repeat(64));
 expect(snapshot().map(r=>r.event)).toEqual(['approval-clicked','owner-session-restored','txn-start','txn-committed']);
 const output=exportEvidence();for(const sensitive of ['a'.repeat(64),'private-owner','private-publisher','private-token','publisherUID','ownerUID'])expect(output).not.toContain(sensitive);
});
it.each([['deny','txn-denied','permission-denied'],['offline','txn-error','unavailable'],['timeout','txn-error','deadline-exceeded'],['expired','challenge-unavailable','CHALLENGE_UNAVAILABLE']])('distinguishes %s',async(mode,event,code)=>{
 state.mode=mode;await expect(service().confirm('a'.repeat(64))).rejects.toBeDefined();expect(snapshot().map(r=>r.event)).toEqual(['approval-clicked','owner-session-restored','txn-start',event]);expect(snapshot().at(-1)).toMatchObject({event,code});expect(snapshot().some(r=>r.event==='txn-committed')).toBe(false);
});
it('distinguishes owner missing before transaction',async()=>{await expect(service(false).confirm('a'.repeat(64))).rejects.toThrow('OWNER_AUTH_REQUIRED');expect(snapshot().map(r=>r.event)).toEqual(['approval-clicked','owner-session-missing']);});
it('rejects arbitrary identifiers, redacts codes, bounds memory and clears TTL',()=>{
 emit('txn-error','email@example.test','secret');expect(snapshot()).toHaveLength(0);
 emit('txn-error','b'.repeat(64),'secret-token');expect(snapshot()[0].code).toBe('unknown');
 for(let i=0;i<300;i++)emit('txn-start');expect(snapshot()).toHaveLength(256);
 vi.spyOn(Date,'now').mockReturnValue(Date.now()+16*60000);expect(snapshot()).toHaveLength(0);vi.restoreAllMocks();
});

it('records missing owner at the review button without a transaction',async()=>{await expect(service(false).preview('a'.repeat(64))).rejects.toThrow('OWNER_AUTH_REQUIRED');expect(snapshot().map(r=>r.event)).toEqual(['review-clicked','review-error']);expect(snapshot().at(-1)?.code).toBe('OWNER_AUTH_REQUIRED');});
