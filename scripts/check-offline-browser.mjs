/* global navigator, indexedDB, btoa, crypto, TextEncoder, localStorage, document, caches, console */
// Run after a normal production build configured with the synthetic offline-fixture Firebase project.
// PLAYWRIGHT_MODULE points to an existing playwright-core install; no browser dependency is bundled.
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const builtJS=await Promise.all((await readdir('dist/assets')).filter(n=>n.endsWith('.js')).map(n=>readFile('dist/assets/'+n,'utf8')));
assert(builtJS.some(text=>text.includes('offline-fixture-key')),'Build with the documented synthetic Firebase configuration first');
const fixture=JSON.parse(await readFile('tests/fixtures/mirror/swift-generation.json','utf8'));
let updateVersion=false;
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(!path.startsWith('/miagenda/')){res.writeHead(404).end();return;}
 const relative=path.slice('/miagenda/'.length)||'index.html';
 if(relative==='__seed.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local fixture setup</title>');return;}
 if(relative.includes('..')){res.writeHead(400).end();return;}
 const file=await readFile('dist/'+relative);
 res.setHeader('Content-Type',relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.webmanifest')?'application/manifest+json':relative.endsWith('.png')?'image/png':'text/html');
 res.setHeader('Cache-Control','no-store');res.end(relative==='service-worker.js'&&updateVersion?file.toString().replace("miagenda-shell-","miagenda-shell-update-"):file);
 }catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/miagenda/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({serviceWorkers:'allow'});
await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
const results={cycles:[],externalNetwork:'blocked',fixtureEntities:Object.keys(fixture.objects).length};
try{
 let page=await context.newPage();page.on('pageerror',e=>console.error('PAGE',e.message));await page.goto(url);
 await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistrations())[0]?.active?.state==='activated',null,{timeout:15000});
 assert.equal(await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).length),1);
 await page.getByRole('dialog',{name:'Conectar Mi Agenda'}).waitFor({timeout:15000});
 await page.goto(url+'__seed.html');
 // Only the local synthetic Firebase persistence record is seeded. Nothing is sent to Firebase.
 await page.evaluate(async({fixture})=>{
  const put=(name,version,store,keyPath,key,value)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,version);r.onupgradeneeded=()=>r.result.createObjectStore(store,keyPath?{keyPath}:undefined);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(store,'readwrite');if(keyPath)tx.objectStore(store).put(value);else tx.objectStore(store).put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  const owner='offline-owner',scope='offline-fixture:'+owner,publisher=fixture.manifest.source.publisherID;
  const token=btoa(JSON.stringify({alg:'none'}))+'.'+btoa(JSON.stringify({sub:owner,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400,aud:'offline-fixture'}))+'.fixture';
  const user={uid:owner,emailVerified:false,isAnonymous:false,providerData:[{providerId:'google.com',uid:owner}],stsTokenManager:{refreshToken:'synthetic-refresh',accessToken:token,expirationTime:Date.now()+86400000},createdAt:String(Date.now()),lastLoginAt:String(Date.now()),apiKey:'offline-fixture-key',appName:'miagenda-firebase'};
  const authKey='firebase:authUser:offline-fixture-key:miagenda-firebase';
  await put('firebaseLocalStorageDb',1,'firebaseLocalStorage','fbase_key',null,{fbase_key:authKey,value:user});
  await put('miagenda-icloud-mirror-v1:'+JSON.stringify([scope,publisher]),1,'generations',null,'active',{revision:1,current:{manifest:fixture.manifest,entities:Object.values(fixture.objects)},previous:null});
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  localStorage.setItem('miagenda-mirror-locator-v1:'+hash,JSON.stringify({version:1,publisherID:publisher,generationID:fixture.manifest.generationID}));
 },{fixture});
 await page.goto(url);try{await page.waitForFunction(()=>document.querySelector('.mirror-meta')?.textContent.includes('Sin conexión · copia de'),null,{timeout:15000});}catch(error){console.error(await page.locator('body').innerText());console.error(await page.evaluate(async()=>await indexedDB.databases()));throw error;}
 results.registration=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return {scope:r.scope,active:r.active.scriptURL,controlled:!!navigator.serviceWorker.controller};});
 assert.equal(results.registration.scope,url);assert.equal(results.registration.controlled,true);
 updateVersion=true;await page.evaluate(()=>{void navigator.serviceWorker.ready.then(r=>r.update());});
 await page.getByRole('button',{name:'Actualizar',exact:true}).waitFor({timeout:15000});
 await page.getByRole('button',{name:'Actualizar',exact:true}).click();
 await page.waitForFunction(async()=> (await navigator.serviceWorker.getRegistrations())[0]?.active?.state==='activated'&&!document.querySelector('.update-notice'));
 await page.waitForFunction(()=>document.querySelector('.mirror-meta')?.textContent.includes('copia de'));results.update='PASS explicit safe activation and reload';
 results.precache=await page.evaluate(async()=>{const names=await caches.keys();return Promise.all(names.map(async name=>({name,urls:(await(await caches.open(name)).keys()).map(r=>r.url)})));});
 assert(results.precache.length===1);assert(results.precache[0].urls.some(u=>u.endsWith('/index.html')));
 assert(results.precache[0].urls.every(u=>u.startsWith(url)&&!u.includes('?')));
 results.cachePrivacy=await page.evaluate(async()=>{for(const name of await caches.keys()){const cache=await caches.open(name);for(const request of await cache.keys()){if(request.headers.has('Authorization'))throw Error('PRIVATE_HEADER_IN_SHELL');const text=await(await cache.match(request)).text();for(const marker of ['synthetic-refresh','offline-owner','Ideas para clase'])if(text.includes(marker))throw Error('PRIVATE_DATA_IN_SHELL');}}return 'PASS static responses only; no synthetic token, owner or mirror content';});
 for(let cycle=1;cycle<=5;cycle++){
  await page.close();await context.setOffline(true);page=await context.newPage();
  await page.goto(cycle%2?url:url+'notes');
  await page.waitForFunction(()=>document.querySelector('.mirror-meta')?.textContent.includes('Sin conexión · copia de'));
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.reload();await page.waitForFunction(()=>document.querySelector('.mirror-meta')?.textContent.includes('Sin conexión · copia de'));
  await page.getByRole('button',{name:'Notas rápidas',exact:true}).click();await page.getByRole('button',{name:/Ideas para clase/}).waitFor();
  results.cycles.push({cycle,coldStart:'PASS',refresh:'PASS',mirror:'PASS',path:cycle%2?'root':'notes'});
 }
 await context.setOffline(false);await page.reload();await page.waitForFunction(()=>document.querySelector('.mirror-meta')?.textContent.includes('copia de'));
 results.recoveryShell='PASS (remote Firebase revalidation deliberately blocked)';
 await page.goto(url+'__seed.html');
 // A different authenticated owner cannot see the previous owner's validated cache.
 await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('firebaseLocalStorageDb',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('firebaseLocalStorage','readwrite'),s=tx.objectStore('firebaseLocalStorage'),q=s.get('firebase:authUser:offline-fixture-key:miagenda-firebase');q.onsuccess=()=>{const record=q.result;record.value.uid='other-offline-owner';s.put(record);};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});});
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('.mirror-meta')?.textContent.includes('Aún sin copia'));
 results.otherOwner='PASS';
 await page.goto(url+'__seed.html');
 await page.evaluate(async()=>{await new Promise(resolve=>{const r=indexedDB.open('firebaseLocalStorageDb',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('firebaseLocalStorage','readwrite');tx.objectStore('firebaseLocalStorage').clear();tx.oncomplete=()=>{db.close();resolve();};};});});
 await context.setOffline(true);await page.goto(url);await page.getByRole('dialog',{name:'Conectar Mi Agenda'}).waitFor();assert(await page.getByRole('button',{name:'Entrar con Google'}).isDisabled());assert(await page.locator('.mirror-meta').textContent().then(t=>t.includes('Aún sin copia')));results.logout='PASS';
 console.log(JSON.stringify(results,null,2));
}finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
