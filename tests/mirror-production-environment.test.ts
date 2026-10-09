import {describe,it,expect} from 'vitest';
import {productionMirrorEnvironment} from '../src/mirror/productionEnvironment';
const config={apiKey:'synthetic-public-key',projectId:'demo-miagenda-mirror',authDomain:'demo-miagenda-mirror.firebaseapp.com',appId:'synthetic'};
describe('production mirror capability',()=>{
 it('is off by default',()=>expect(productionMirrorEnvironment({},false,'example.test',config)).toBeNull());
 it('preprod requires debug, fixed loopback, demo project and synthetic key',()=>{
  const env={VITE_MIRROR_ENABLED:'1',VITE_MIRROR_ENVIRONMENT:'preprod'};
  expect(productionMirrorEnvironment(env,true,'127.0.0.1',config)?.mode).toBe('preprod');
  expect(()=>productionMirrorEnvironment(env,false,'127.0.0.1',config)).toThrow();
  expect(()=>productionMirrorEnvironment(env,true,'example.test',config)).toThrow();
  expect(()=>productionMirrorEnvironment(env,true,'127.0.0.1',{...config,projectId:'other'})).toThrow();
 });
 it('production rejects ambiguous environments and requires an additional dev opt-in',()=>{
  const env={VITE_MIRROR_ENABLED:'1',VITE_MIRROR_ENVIRONMENT:'production'},production={...config,projectId:'example-production'};
  expect(()=>productionMirrorEnvironment(env,true,'example.test',production)).toThrow();
  expect(()=>productionMirrorEnvironment({...env,FIRESTORE_EMULATOR_HOST:'localhost'},false,'example.test',production)).toThrow();
  expect(()=>productionMirrorEnvironment(env,false,'example.test',config)).toThrow();
  expect(productionMirrorEnvironment(env,false,'example.test',production)?.mode).toBe('production');
 });
});

import {normalMirrorEnvironment} from '../src/mirror/normalEnvironment';
it('normal entrypoint refuses real dev connections unless separately enabled',()=>{
 const env={VITE_FIREBASE_API_KEY:'public',VITE_FIREBASE_AUTH_DOMAIN:'example.test',VITE_FIREBASE_PROJECT_ID:'example-project',VITE_FIREBASE_APP_ID:'public-app'};
 expect(normalMirrorEnvironment(env,true).config).toBeNull();
 expect(normalMirrorEnvironment({...env,VITE_MIRROR_ALLOW_PRODUCTION_DEV:'1'},true).config?.projectId).toBe('example-project');
 expect(normalMirrorEnvironment(env,false).pairingEnabled).toBe(false);
 expect(()=>normalMirrorEnvironment({...env,VITE_MIRROR_ENABLED:'1',VITE_MIRROR_ENVIRONMENT:'preprod'},false)).toThrow();
});
