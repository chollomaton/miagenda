import {expect,it,vi,beforeEach} from 'vitest';
import {firestoreMirrorTransport} from '../src/mirror/firestoreTransport';
import type {Firestore} from 'firebase/firestore/lite';
const sdk=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('firebase/firestore/lite',()=>({doc:(_db:unknown,...path:string[])=>path.join('/'),getDoc:sdk.read}));
beforeEach(()=>sdk.read.mockReset());
it('reuses immutable payloads, isolates mutations, and always rereads authority state',async()=>{
 sdk.read.mockResolvedValue({exists:()=>true,data:()=>({publisherID:'grant',payload:{value:'synthetic'}})});
 const t=firestoreMirrorTransport({} as Firestore,'owner',()=>true,()=>{});
 const first=await t.readObject('hash') as {value:string};first.value='changed';
 expect(await t.readObject('hash')).toEqual({value:'synthetic'});expect(sdk.read).toHaveBeenCalledTimes(1);
 await t.readState();await t.readState();expect(sdk.read).toHaveBeenCalledTimes(3);
});
it('never exposes cached content after session invalidation',async()=>{
 sdk.read.mockResolvedValue({exists:()=>true,data:()=>({publisherID:'grant',payload:{value:'synthetic'}})});
 let valid=true;const t=firestoreMirrorTransport({} as Firestore,'owner',()=>valid,()=>{});await t.readObject('hash');valid=false;
 await expect(t.readObject('hash')).rejects.toThrow('STALE_SESSION');
});
it('does not cache missing content and bounds retained immutable documents',async()=>{
 let exists=false;sdk.read.mockImplementation(async()=>({exists:()=>exists,data:()=>({publisherID:'grant',payload:{value:'synthetic'}})}));
 const t=firestoreMirrorTransport({} as Firestore,'owner',()=>true,()=>{});expect(await t.readObject('missing')).toBeNull();exists=true;expect(await t.readObject('missing')).toEqual({value:'synthetic'});
 for(let i=0;i<513;i++)await t.readObject(String(i));const count=sdk.read.mock.calls.length;await t.readObject('missing');expect(sdk.read.mock.calls.length).toBe(count+1);
});
