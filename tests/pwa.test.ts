import {it,expect} from 'vitest';
import {runInNewContext} from 'node:vm';
import {generateWorker} from '../scripts/service-worker';
function worker(){let handler!:(e:{request:{url:string;method:string};respondWith:()=>void})=>void;runInNewContext(generateWorker(['./','./index.html','./assets/app.js'],'test'),{URL,self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/app/'},addEventListener:(name:string,fn:typeof handler)=>{if(name==='fetch')handler=fn}},caches:{open:async()=>({match:async()=>null})},fetch:async()=>({})});return handler}
for(const [url,method] of [['https://api.apple-cloudkit.com/database/1/private','GET'],['https://example.test/cloudkit/private','GET'],['https://example.test/app/api/tasks','GET'],['https://example.test/app/index.html?token=opaque','GET'],['https://example.test/app/assets/app.js','POST']])it('does not intercept private or unlisted request '+url,()=>{let intercepted=false;worker()({request:{url,method},respondWith:()=>{intercepted=true}});expect(intercepted).toBe(false)});
it('serves the known app shell',()=>{let intercepted=false;worker()({request:{url:'https://example.test/app/assets/app.js',method:'GET'},respondWith:()=>{intercepted=true}});expect(intercepted).toBe(true)});

it('supports the prescribed responsive breakpoints and accessibility preferences',async()=>{const {readFile}=await import('node:fs/promises');const css=await readFile('src/styles/base.css','utf8');expect(css).toContain('max-width:1099px');expect(css).toContain('max-width:699px');expect(css).toContain('prefers-reduced-motion');expect(css).toContain('focus-visible');expect(css).toContain('safe-area-inset-bottom');expect(css).toContain('100dvh')});
it('includes installable raster icons and mobile safe-area viewport',async()=>{const {readFile}=await import('node:fs/promises');const manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));expect(manifest.name).toBe('Mi Agenda');expect(manifest.icons.map((i:{sizes:string})=>i.sizes)).toEqual(expect.arrayContaining(['192x192','512x512']));expect(await readFile('index.html','utf8')).toContain('viewport-fit=cover')});

it('SW update bypasses stale HTTP cache when installing the new shell',async()=>{
 let install!:(event:{waitUntil:(promise:Promise<unknown>)=>void})=>void;
 const stored=new Map<string,string>();
 runInNewContext(generateWorker(['./','./index.html','./assets/new.js'],'new'),{
  URL,Request,self:{registration:{scope:'https://example.test/app/'},addEventListener:(name:string,fn:typeof install)=>{if(name==='install')install=fn}},
  caches:{open:async()=>({addAll:async(inputs:(string|Request)[])=>{
   for(const input of inputs){const request=input instanceof Request?input:new Request(new URL(input,'https://example.test/app/'));stored.set(request.url,request.cache==='reload'?'current release':'stale HTTP response')}
  }})}
 });
 let pending:Promise<unknown>|undefined;install({waitUntil:p=>{pending=p}});await pending;
 expect([...stored.entries()]).toEqual([
  ['https://example.test/app/','current release'],
  ['https://example.test/app/index.html','current release'],
  ['https://example.test/app/assets/new.js','current release']
 ]);
});

it('opens cached shell offline and excludes Firebase, query and private routes',async()=>{
 let fetchHandler!:(event:{request:{url:string;method:string};respondWith:(p:Promise<unknown>)=>void})=>void;
 const cached={body:'offline shell'};
 runInNewContext(generateWorker(['./','./index.html'],'offline'),{URL,self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/miagenda/'},addEventListener:(name:string,fn:typeof fetchHandler)=>{if(name==='fetch')fetchHandler=fn}},caches:{open:async()=>({match:async()=>cached})},fetch:async()=>{throw Error('offline')}});
 let response:Promise<unknown>|undefined;fetchHandler({request:{url:'https://example.test/miagenda/',method:'GET'},respondWith:p=>{response=p}});expect(await response).toEqual(cached);
 for(const url of ['https://firestore.googleapis.com/v1/data','https://example.test/miagenda/?token=secret','https://example.test/miagenda/private','https://example.test/miagenda/api']){response=undefined;fetchHandler({request:{url,method:'GET'},respondWith:p=>{response=p}});expect(response).toBeUndefined()}
});
for(const windows of [1,2])it('activates only explicit request from the sole open client: '+windows,async()=>{
 let message!:(e:{data:{type:string};source:{id:string;postMessage:(data:unknown)=>void};waitUntil:(p:Promise<unknown>)=>void})=>void;
 let activated=0,blocked=0,pending:Promise<unknown>|undefined;
 runInNewContext(generateWorker(['./'],'test'),{self:{registration:{scope:'https://example.test/miagenda/'},addEventListener:(name:string,fn:typeof message)=>{if(name==='message')message=fn},clients:{matchAll:async()=>Array.from({length:windows},(_,i)=>({id:String(i),url:'https://example.test/miagenda/'}))},skipWaiting:()=>{activated++}},URL});
 const event={data:{type:'unrelated'},source:{id:'0',postMessage:()=>{blocked++}},waitUntil:(p:Promise<unknown>)=>{pending=p}};
 message(event);expect(activated).toBe(0);expect(pending).toBeUndefined();message({...event,data:{type:'ACTIVATE_WHEN_SAFE'}});await pending;expect(activated).toBe(windows===1?1:0);expect(blocked).toBe(windows===2?1:0);
});
