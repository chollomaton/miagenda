import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
import {MirrorRuntime} from '../src/mirror/MirrorRuntime';
import {setupTransport} from './fixtures/mirror/helpers';
const sdk=vi.hoisted(()=>({auth:{currentUser:null as {uid:string}|null},changed:null as null|((user:{uid:string}|null)=>void),read:vi.fn(),popup:vi.fn(),stop:vi.fn()}));
vi.mock('firebase/app',()=>({getApp:()=>({}),initializeApp:()=>({})}));
vi.mock('firebase/auth',()=>({getAuth:()=>sdk.auth,browserLocalPersistence:{},setPersistence:async()=>{},GoogleAuthProvider:class{},signInWithPopup:sdk.popup,onAuthStateChanged:(_auth:unknown,changed:(user:{uid:string}|null)=>void)=>{sdk.changed=changed;changed(sdk.auth.currentUser);return sdk.stop;}}));
vi.mock('firebase/firestore',()=>({getFirestore:()=>({}),doc:(_db:unknown,...path:string[])=>path.join('/'),getDoc:sdk.read}));
const config={apiKey:'fixture',authDomain:'fixture.firebaseapp.com',projectId:'fixture',appId:'fixture'};
beforeEach(()=>{localStorage.clear();sdk.auth.currentUser=null;sdk.read.mockReset();sdk.popup.mockReset();});
it('restores auth and reads only the mirror namespace without attaching editable sessions',async()=>{
 const {transport}=await setupTransport();sdk.auth.currentUser={uid:'owner'};
 sdk.read.mockImplementation(async(path:string)=>{expect(path).toMatch(/^users\/owner\/icloudMirror\/state/);const parts=path.split('/');const value=parts.length===4?await transport.readState():parts[4]==='generations'?await transport.readGeneration(parts[5]):parts[4]==='buckets'?await transport.readBucket(parts[5]):await transport.readObject(parts[5]);return {exists:()=>value!==null,data:()=>value};});
 const runtime=new MirrorRuntime(config);await runtime.start();await vi.waitFor(()=>expect(runtime.source.entities.length).toBeGreaterThan(0));expect(runtime.state).toBe('signedIn');expect(sdk.popup).not.toHaveBeenCalled();expect(runtime.source.capabilities).toEqual({read:true,create:false,update:false,delete:false,push:false});sdk.auth.currentUser=null;sdk.changed!(null);expect(runtime.source.entities).toEqual([]);runtime.dispose();
});
it('does not read Firestore without a session and invokes login only explicitly',async()=>{
 const runtime=new MirrorRuntime(config);await runtime.start();expect(runtime.state).toBe('signedOut');expect(sdk.read).not.toHaveBeenCalled();await runtime.login();expect(sdk.popup).toHaveBeenCalledOnce();runtime.dispose();
});
it('retains an empty readonly dashboard when publication is absent or denied',async()=>{
 sdk.auth.currentUser={uid:'owner-without-publication'};sdk.read.mockResolvedValue({exists:()=>false});const runtime=new MirrorRuntime(config);await runtime.start();await vi.waitFor(()=>expect(sdk.read).toHaveBeenCalled());expect(runtime.state).toBe('signedIn');expect(runtime.source.manifest).toBeNull();runtime.dispose();
});
it('an explicit unauthenticated response hides cached data and returns to the minimal gate',async()=>{
 const {transport}=await setupTransport();sdk.auth.currentUser={uid:'expired-token-owner'};
 sdk.read.mockImplementation(async(path:string)=>{const parts=path.split('/');const value=parts.length===4?await transport.readState():parts[4]==='generations'?await transport.readGeneration(parts[5]):parts[4]==='buckets'?await transport.readBucket(parts[5]):await transport.readObject(parts[5]);return {exists:()=>value!==null,data:()=>value};});
 const first=new MirrorRuntime(config);await first.start();await vi.waitFor(()=>expect(first.source.entities.length).toBeGreaterThan(0));first.dispose();
 sdk.read.mockRejectedValue({code:'unauthenticated'});const restored=new MirrorRuntime(config);await restored.start();await vi.waitFor(()=>expect(restored.state).toBe('signedOut'));expect(restored.source.entities).toEqual([]);expect(sdk.popup).not.toHaveBeenCalled();restored.dispose();
});
