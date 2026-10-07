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

import 'fake-indexeddb/auto';
import {afterEach} from 'vitest';
import {createElement} from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {CloudApp} from '../src/app/CloudApp';
import {MemoryRepository,RepositoryError} from '../src/repositories/AgendaRepository';
afterEach(()=>vi.unstubAllEnvs());
it('M3C runtime remembers expiration; popup for the same current Google user reattaches and resumes',async()=>{
 const disks=new Map<string,MemoryPersistence>();const runtime=new FirebaseRuntime(config,scope=>{if(!disks.has(scope))disks.set(scope,new MemoryPersistence());return disks.get(scope)!});await runtime.start();sdk.auth.currentUser={uid:'A'};sdk.changed(sdk.auth.currentUser);await vi.waitFor(()=>expect(runtime.state).toBe('signedIn'));
 const store=runtime.session!.store!;store.repository.connectSync(null);await store.create('Task',{title:'pending A'});runtime.session!.auth.expire();expect(runtime.sessionExpired).toBe(true);expect(runtime.state).toBe('signedOut');sdk.popup.mockResolvedValueOnce({});await runtime.login();await vi.waitFor(()=>expect(runtime.state).toBe('signedIn'));expect(runtime.sessionExpired).toBe(false);expect(runtime.session!.store!.outbox).toHaveLength(1);const remote=new MemoryRepository();runtime.session!.store!.repository.connectSync(null);await new (await import('../src/sync/SyncEngine')).SyncEngine(runtime.session!.store!,remote,runtime.session!.auth).sync();expect(runtime.session!.store!.outbox).toEqual([]);expect((await remote.fetchChanges()).entities[0].fields.title).toBe('pending A');await runtime.logout();expect(runtime.sessionExpired).toBe(false);runtime.dispose();
});
it('M3C first sync expiration cannot leave runtime signed in with a detached store',async()=>{
 const original=AgendaSession.prototype.attach,remote=new MemoryRepository();vi.spyOn(remote,'fetchChanges').mockRejectedValue(new RepositoryError('authentication'));
 const attach=vi.spyOn(AgendaSession.prototype,'attach').mockImplementation(function(this:AgendaSession){return original.call(this,remote,window)});
 const runtime=new FirebaseRuntime(config,()=>new MemoryPersistence());try{await runtime.start();sdk.auth.currentUser={uid:'A'};sdk.changed(sdk.auth.currentUser);await vi.waitFor(()=>expect(runtime.sessionExpired).toBe(true));expect(runtime.state).toBe('signedOut');expect(runtime.session).toBeNull()}finally{runtime.dispose();attach.mockRestore()}
});
it('M3C CloudApp expiration shows an attention alert and re-login action',async()=>{
 for(const [key,value] of Object.entries({VITE_CLOUD_BACKEND:'firebase',VITE_FIREBASE_API_KEY:config.apiKey,VITE_FIREBASE_AUTH_DOMAIN:config.authDomain,VITE_FIREBASE_PROJECT_ID:config.projectId,VITE_FIREBASE_APP_ID:config.appId}))vi.stubEnv(key,value);
 const original=FirebaseRuntime.prototype.start;const start=vi.spyOn(FirebaseRuntime.prototype,'start').mockImplementation(function(this:FirebaseRuntime){return original.call(this)});const currentRuntime=()=>start.mock.contexts[0] as FirebaseRuntime;
 try{render(createElement(CloudApp));const runtime=currentRuntime();await waitFor(()=>expect(runtime.state).toBe('signedOut')); sdk.auth.currentUser={uid:'A'};await act(async()=>{sdk.changed(sdk.auth.currentUser)});await waitFor(()=>expect(runtime.state).toBe('signedIn'));await act(async()=>{runtime.session!.auth.expire()});expect(screen.getByRole('alert')).toHaveTextContent('Tu sesión ha caducado. Vuelve a entrar para continuar sincronizando.');sdk.popup.mockResolvedValueOnce({});fireEvent.click(screen.getByRole('button',{name:'Entrar con Google'}));await waitFor(()=>expect(runtime.state).toBe('signedIn'));expect(screen.queryByText(/Tu sesión ha caducado/)).toBeNull()}finally{currentRuntime()?.dispose();start.mockRestore()}
});
