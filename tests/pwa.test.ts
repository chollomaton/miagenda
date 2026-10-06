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
