import {readFile,writeFile,mkdtemp,rm,chmod} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {chromium} from 'playwright';
// Personal inputs are explicitly supplied, never committed, logged or screenshotted.
const [native,inputPath,reportPath]=process.argv.slice(2);
assert(process.env.MIAGENDA_EMULATOR==='1'&&native&&inputPath&&reportPath,'Explicit local input required');
const input=JSON.parse(await readFile(inputPath,'utf8'));
const scratch=await mkdtemp(resolve(dirname(inputPath),'e2e-'));await chmod(scratch,0o700);
const authURL='http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:';
async function identity(email){const body=JSON.stringify({email,password:'synthetic-emulator-only',returnSecureToken:true});let r=await fetch(authURL+'signUp?key=synthetic-emulator-key',{method:'POST',headers:{'Content-Type':'application/json'},body});if(!r.ok)r=await fetch(authURL+'signInWithPassword?key=synthetic-emulator-key',{method:'POST',headers:{'Content-Type':'application/json'},body});assert(r.ok,'Local identity failed');return r.json();}
async function request(token,action,body){const r=await fetch('http://127.0.0.1:18081/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});assert(r.status===200,'Local authority rejected '+action);return r.json();}
function run(executable,args,env={}){const r=spawnSync(executable,args,{env:{...process.env,...env},encoding:'utf8',timeout:120000});assert(r.status===0,'Local executable failed; status='+r.status+' signal='+r.signal+' code='+(r.error?.code??'none')+' adapter='+executable.split('/').pop());}
let browser;
try{
 assert((await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-miagenda-mirror/databases/(default)/documents',{method:'DELETE'})).ok);
 const owner=await identity('owner@example.test'),publisher=await identity('publisher@example.test');
 const challenge=await request(publisher.idToken,'begin',{ownerUID:owner.localId});await request(owner.idToken,'claim',{challenge:challenge.challenge});const grant=await request(owner.idToken,'confirm',{challenge:challenge.challenge});
 const prefix=resolve(native,'MirrorPublisher/.build/debug');
 async function publish(id,changed=false){const fixture=structuredClone(input);if(changed)fixture.entities.push({id:'local-real-input-test-note',kind:'QuickNote',lifecycle:'active',payload:{title:'TEST LOCAL PROVIDER',body:'Synthetic local update',isPinned:false,isFavorite:false,createdAt:'2026-10-09T12:00:00.000Z',modifiedAt:'2026-10-09T12:00:00.000Z'}});const source=resolve(scratch,id+'-input.json'),wire=resolve(scratch,id+'-wire.json'),receipt=resolve(scratch,id+'-receipt.json');await writeFile(source,JSON.stringify(fixture),{mode:0o600});run(prefix+'/mirror-fixture-publish',[source,wire,grant.publisherID,id,new Date().toISOString()]);run(prefix+'/mirror-emulator-publish',[wire,owner.localId,receipt],{MIAGENDA_EMULATOR:'1',MIAGENDA_EMULATOR_ID_TOKEN:publisher.idToken});return JSON.parse(await readFile(receipt,'utf8'));}
 const id='real-input-'+Date.now();const first=await publish(id+'-g1');assert(first.result==='published');const noop=await publish(id+'-noop');assert(noop.result==='unchanged');
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let errors=0,external=0;const origins=new Set();page.on('pageerror',()=>errors++);page.on('request',r=>{if(/^https?:/.test(r.url()))origins.add(new URL(r.url()).origin);});await page.route('https://**',route=>{external++;return route.abort();});
 await page.goto('http://127.0.0.1:15173/miagenda/?mirrorEmulator=1');await page.getByRole('searchbox',{name:'Buscar en iCloud'}).waitFor();
 const nav=page.getByRole('navigation',{name:'Secciones'});await nav.getByRole('button',{name:/^Ajustes/}).click();await page.getByRole('button',{name:'Fuente y sincronización'}).click();await page.getByText(input.entities.length+' elementos consultables',{exact:true}).waitFor({timeout:120000});const sections=['Dashboard','Tareas','Recordatorios','Calendario','Notas','Etiquetas','Radar','Plantillas','Ajustes'];for(const section of sections){await nav.getByRole('button',{name:new RegExp('^'+section)}).click();assert(await page.locator('main').count()===1,'Missing section');}
 assert(await page.getByRole('button',{name:/^Online$|^Guardar$|^Nuevo$|^Eliminar$/}).count()===0,'Mutation action exposed');
 const second=await publish(id+'-g2',true);assert(second.result==='published');assert(second.state.previousGeneration===first.state.currentGeneration,'Previous generation mismatch');
 await page.getByRole('button',{name:'Actualizar copia'}).click();await nav.getByRole('button',{name:/^Notas/}).click();await page.getByRole('button',{name:/TEST LOCAL PROVIDER/}).first().waitFor({timeout:120000});
 await page.getByRole('searchbox',{name:'Buscar en iCloud'}).fill('TEST LOCAL PROVIDER');await page.getByRole('button',{name:/TEST LOCAL PROVIDER/}).first().click();const detail=page.getByRole('dialog');await detail.waitFor();assert(await detail.locator('input,textarea,select,form').count()===0);await detail.getByRole('button',{name:'Cerrar detalle'}).click();await page.getByRole('searchbox',{name:'Buscar en iCloud'}).fill('');
 await page.route('http://127.0.0.1:18080/**',route=>route.abort());await page.route('http://127.0.0.1:19099/**',route=>route.abort());await page.reload();await page.getByRole('button',{name:/TEST LOCAL PROVIDER/}).first().waitFor({timeout:120000});await page.getByText(/Sin conexión · copia de/).first().waitFor();
 assert(errors===0&&external===0,'Browser error or external request');for(const origin of origins)assert(/^http:\/\/127\.0\.0\.1:(15173|18080|19099)$/.test(origin),'Nonlocal request');
 await writeFile(reportPath,JSON.stringify({status:'PASS',inputEntities:input.entities.length,sections,firstPublish:true,noop:true,sandboxUpdate:true,previousGeneration:true,search:true,detailReadonly:true,offlineReload:true,errors,externalRequests:external,firstRoot:first.state.rootHash,secondRoot:second.state.rootHash},null,2));process.stdout.write('PASS real-input Emulator → habitual reader; no-op, sandbox update, sections, search, readonly detail, offline\n');
}finally{if(browser)await browser.close();await rm(scratch,{recursive:true,force:true});}
