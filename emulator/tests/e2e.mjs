import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const native=process.argv[2];if(!native)throw Error('Pass isolated native repository');
const scratch=resolve('work/emulator-e2e');await mkdir(scratch,{recursive:true});
const authURL='http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:';
async function identity(email){const body={email,password:'synthetic-emulator-only',returnSecureToken:true};let r=await fetch(authURL+'signUp?key=synthetic-emulator-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)r=await fetch(authURL+'signInWithPassword?key=synthetic-emulator-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert(r.ok);return r.json();}
async function request(token,action,body){const r=await fetch('http://127.0.0.1:18081/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,action);return r.json();}
function run(executable,args,env={}){const r=spawnSync(executable,args,{env:{...process.env,...env},encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr||r.stdout);}
// Each repetition starts with an empty synthetic Firestore, so write-count assertions are exact.
assert((await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-miagenda-mirror/databases/(default)/documents',{method:'DELETE'})).ok);
const owner=await identity('owner@example.test'),publisher=await identity('publisher@example.test');assert.notEqual(owner.localId,publisher.localId);
const c=await request(publisher.idToken,'begin',{ownerUID:owner.localId});await request(owner.idToken,'claim',{challenge:c.challenge});const grant=await request(owner.idToken,'confirm',{challenge:c.challenge});
const input=JSON.parse(await readFile(new URL('../../tests/fixtures/mirror/full-snapshot.json',import.meta.url),'utf8'));
const task=structuredClone(input.entities.find(e=>e.kind==='CalendarItem'&&!e.payload.isEvent&&!e.payload.completed));task.id='synthetic-undated-task';task.payload.title='Tarea sintética sin fecha';task.payload.externalID='synthetic-undated-task';task.payload.dueComponents=null;input.entities.push(task);
const prefix=resolve(native,'MirrorPublisher/.build/debug');
async function generation(id,changed=false){const fixture=structuredClone(input);if(changed)fixture.entities.find(e=>e.kind==='QuickNote'&&e.lifecycle==='active').payload.title='Nota segunda generación';const source=resolve(scratch,id+'-input.json'),output=resolve(scratch,id+'.json');await writeFile(source,JSON.stringify(fixture));run(prefix+'/mirror-fixture-publish',[source,output,grant.publisherID,id,new Date().toISOString()]);const receipt=resolve(scratch,id+'-receipt.json');run(prefix+'/mirror-emulator-publish',[output,owner.localId,receipt],{MIAGENDA_EMULATOR:'1',MIAGENDA_EMULATOR_ID_TOKEN:publisher.idToken});const result=JSON.parse(await readFile(receipt,'utf8'));assert.equal(result.result,'published');return {output,result};}
const id='swift-e2e-'+Date.now();const first=await generation(id+'-g1');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const externalAttempts=[];await page.route('https://**',route=>{const url=new URL(route.request().url());externalAttempts.push(url.origin+url.pathname);return route.abort();});const errors=[],origins=new Set();page.on('request',r=>{if(/^https?:/.test(r.url()))origins.add(new URL(r.url()).origin);});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:15173/miagenda/?mirrorEmulator=1');
 await page.getByRole('searchbox',{name:'Buscar en iCloud'}).waitFor();
 await page.getByRole('button',{name:/Ideas para clase/}).first().waitFor({timeout:20000});
 assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('button',{name:/^Online$|^Guardar$|^Nuevo$|^Eliminar$/}).count(),0);assert.equal(await page.getByRole('checkbox').count(),0);
 const nav=page.getByRole('navigation',{name:'Secciones'});
 const expected={Tareas:'Tarea sintética sin fecha',Recordatorios:'Preparar clase',Calendario:'2026-10-01',Notas:'Ideas para clase',Etiquetas:'Clases',Radar:'Radar',Plantillas:'Clase semanal'};
 for(const [section,text]of Object.entries(expected)){await nav.getByRole('button',{name:new RegExp('^'+section)}).click();assert((await page.locator('main').innerText()).includes(text),section);}
 await nav.getByRole('button',{name:/^Dashboard/}).click();await page.getByRole('searchbox',{name:'Buscar en iCloud'}).fill('Ideas para clase');await page.getByRole('button',{name:/Ideas para clase/}).click();const detail=page.getByRole('dialog',{name:'Detalle de Ideas para clase'});await detail.waitFor();assert((await detail.innerText()).includes('Una pregunta para empezar'));assert.equal(await detail.locator('input,textarea,select,form').count(),0);await detail.getByRole('button',{name:'Cerrar detalle'}).click();await page.getByRole('searchbox',{name:'Buscar en iCloud'}).fill('');
 const second=await generation(id+'-g2',true);assert.equal(second.result.writes,4);assert.equal(second.result.state.previousGeneration,first.result.state.currentGeneration);
 await page.getByRole('button',{name:'Actualizar copia'}).click();await nav.getByRole('button',{name:/^Notas/}).click();await page.getByRole('button',{name:/Nota segunda generación/}).waitFor({timeout:20000});
 await nav.getByRole('button',{name:/^Ajustes/}).click();await page.getByRole('button',{name:'Fuente y sincronización'}).click();assert((await page.locator('main').innerText()).includes(id+'-g2'));
 await page.screenshot({path:resolve(scratch,'online.png'),fullPage:true});
 // Keep the app server available; disconnect both data services and exercise a full reload.
 await page.route('http://127.0.0.1:18080/**',route=>route.abort());await page.route('http://127.0.0.1:19099/**',route=>route.abort());await page.reload();
 await page.getByRole('button',{name:/Nota segunda generación/}).first().waitFor({timeout:20000});await page.getByText(/Sin conexión · copia de/).first().waitFor();
 await page.screenshot({path:resolve(scratch,'offline.png'),fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(externalAttempts,[]);for(const origin of origins)assert(/^http:\/\/127\.0\.0\.1:(15173|18080|19099)$/.test(origin),'Unexpected external request: '+origin);
 await writeFile(resolve(scratch,'result.json'),JSON.stringify({result:'PASS',first:first.result,second:second.result,sections:['Dashboard',...Object.keys(expected)],search:true,detailReadonly:true,offlineReload:true,errors},null,2));
 process.stdout.write('PASS Swift → Firestore Emulator → habitual web reader; sections, search, readonly detail, generation update and offline reload\n');
}finally{await browser.close();}
