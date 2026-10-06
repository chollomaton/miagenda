import {beforeEach,expect,it,vi} from 'vitest';
import {FirebaseRuntime} from '../src/cloud/FirebaseRuntime';
import {firebaseConfig} from '../src/cloud/FirebaseConfig';
import {MemoryPersistence} from '../src/offline/Persistence';
import {AgendaSession} from '../src/auth/AgendaSession';
const sdk=vi.hoisted(()=>({auth:{currentUser:null as {uid:string}|null},popup:vi.fn(),changed:vi.fn(),signOut:vi.fn(),stop:vi.fn()}));
vi.mock('firebase/app',()=>({initializeApp:vi.fn(()=>({}))}));
vi.mock('firebase/auth',()=>({
 browserLocalPersistence:{},getAuth:()=>sdk.auth,
 GoogleAuthProvider:class {providerId='google.com';scopes:string[]=[]},
 setPersistence:vi.fn(async()=>{}),signInWithPopup:sdk.popup,signOut:sdk.signOut,
 onAuthStateChanged:(_auth:unknown,changed:(user:null)=>void)=>{sdk.changed.mockImplementation(changed);changed(null);return sdk.stop}
}));
vi.mock('firebase/firestore',()=>({initializeFirestore:()=>({}),memoryLocalCache:()=>({})}));
const config={apiKey:'fixture',authDomain:'fixture.firebaseapp.com',projectId:'fixture',appId:'fixture'};
beforeEach(()=>{vi.clearAllMocks();sdk.auth.currentUser=null});
it('missing or incomplete config stays unavailable',async()=>{
 for(const env of [{},{VITE_CLOUD_BACKEND:'firebase'},{VITE_FIREBASE_API_KEY:'fixture'}]){
  expect(firebaseConfig(env)).toBeNull();const runtime=new FirebaseRuntime(firebaseConfig(env));await runtime.start();await runtime.login();expect(runtime.state).toBe('unavailable');
 }
 expect(sdk.popup).not.toHaveBeenCalled();
});
it('accepts complete config and rejects each missing variable',()=>{
 const env={VITE_CLOUD_BACKEND:'firebase',VITE_FIREBASE_API_KEY:config.apiKey,VITE_FIREBASE_AUTH_DOMAIN:config.authDomain,VITE_FIREBASE_PROJECT_ID:config.projectId,VITE_FIREBASE_APP_ID:config.appId};
 expect(firebaseConfig(env)).toEqual(config);
 for(const key of ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID'])expect(firebaseConfig({...env,[key]:''})).toBeNull();
});
it('uses Google popup without extra scopes; auth observer owns session transitions',async()=>{
 sdk.popup.mockResolvedValueOnce({});const runtime=new FirebaseRuntime(config);await runtime.start();await runtime.login();
 expect(sdk.popup).toHaveBeenCalledWith(sdk.auth,expect.objectContaining({providerId:'google.com',scopes:[]}));expect(runtime.state).toBe('signedOut');runtime.dispose();
});
it.each(['auth/popup-closed-by-user','auth/popup-blocked','auth/cancelled-popup-request','auth/network-request-failed'])('allows retry after %s',async code=>{
 sdk.popup.mockRejectedValueOnce({code}).mockResolvedValueOnce({});const runtime=new FirebaseRuntime(config);await runtime.start();await runtime.login();expect(runtime.state).toBe('signedOut');await runtime.login();expect(sdk.popup).toHaveBeenCalledTimes(2);runtime.dispose();
});
it('marks fatal configuration errors unavailable',async()=>{
 sdk.popup.mockRejectedValueOnce({code:'auth/invalid-api-key'});const runtime=new FirebaseRuntime(config);await runtime.start();await runtime.login();expect(runtime.state).toBe('unavailable');runtime.dispose();
});
it.each(['logout','dispose','observer'])('ignores popup errors after %s changes the generation',async action=>{
 let reject!:(error:unknown)=>void;sdk.popup.mockImplementationOnce(()=>new Promise((_resolve,no)=>{reject=no}));
 const runtime=new FirebaseRuntime(config);await runtime.start();const login=runtime.login();
 if(action==='logout')await runtime.logout();else if(action==='dispose')runtime.dispose();else sdk.changed(null);
 const revision=runtime.revision;reject({code:'auth/invalid-api-key'});await login;expect(runtime.state).toBe('signedOut');expect(runtime.revision).toBe(revision);runtime.dispose();
});
it('keeps a newly signed-in session when an older popup rejects',async()=>{
 let reject!:(error:unknown)=>void;sdk.popup.mockImplementationOnce(()=>new Promise((_resolve,no)=>{reject=no}));
 const runtime=new FirebaseRuntime(config,()=>new MemoryPersistence());await runtime.start();const login=runtime.login();
 sdk.auth.currentUser={uid:'fixture-user'};sdk.changed(sdk.auth.currentUser);
 await vi.waitFor(()=>expect(runtime.state).toBe('signedIn'));const session=runtime.session;
 reject({code:'auth/popup-closed-by-user'});await login;expect(runtime.session).toBe(session);expect(runtime.state).toBe('signedIn');runtime.dispose();
});
it('does not restore a session whose attachment finishes after logout',async()=>{
 let release!:()=>void;const attach=vi.spyOn(AgendaSession.prototype,'attach').mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve}));
 try{
  const runtime=new FirebaseRuntime(config,()=>new MemoryPersistence());await runtime.start();sdk.auth.currentUser={uid:'fixture-user'};sdk.changed(sdk.auth.currentUser);
  await vi.waitFor(()=>expect(attach).toHaveBeenCalled());await runtime.logout();release();await Promise.resolve();await Promise.resolve();
  expect(runtime.session).toBeNull();expect(runtime.state).toBe('signedOut');runtime.dispose();
 }finally{attach.mockRestore()}
});
