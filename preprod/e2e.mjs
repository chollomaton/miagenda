import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../emulator/node_modules/playwright/index.mjs';
const native=process.argv[2];assert(native);
assert.equal(process.env.MIAGENDA_PREPROD,'1');
const scratch=resolve('work/preprod');await mkdir(scratch,{recursive:true});
assert((await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-miagenda-mirror/databases/(default)/documents',{method:'DELETE'})).ok);
function probe(){
 const child=spawn(resolve(native,'MirrorPublisher/.build/debug/mirror-preprod-probe'),[resolve('tests/fixtures/mirror/full-snapshot.json')],{env:{...process.env,MIAGENDA_PREPROD_PROBE:'1'},stdio:['pipe','pipe','pipe']});
 const queued=[],pending=[];let failure='';child.stderr.on('data',data=>{failure+=data;});
 createInterface({input:child.stdout}).on('line',line=>{const value=JSON.parse(line);if(pending.length)pending.shift().resolve(value);else queued.push(value);});
 child.on('exit',code=>{if(code)for(const wait of pending)wait.reject(Error('Native probe failed: '+failure.slice(-1000)));});
 const next=()=>queued.length?Promise.resolve(queued.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native probe response timeout')),45000);pending.push({resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});});
 return {child,next,async command(action){child.stdin.write(action+'\n');return next();}};
}
const first=probe();const initial=await first.next();
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),external=[],errors=[];
await page.route('https://**',route=>{external.push(new URL(route.request().url()).origin);return route.abort();});page.on('pageerror',e=>errors.push(e.message));
async function pair(url){const target=new URL(url);target.searchParams.set('mirrorPreprod','1');await page.goto(target.href);await page.getByRole('button',{name:'Revisar vinculación'}).click();await page.getByRole('button',{name:'Confirmar y reemplazar Mac anterior'}).click();await page.getByText('Mac autorizado. Confirma la vinculación en el Mac para iniciar la copia.').waitFor();assert.equal(new URL(page.url()).hash,'');}
let second;
try{
 await pair(initial.pairingURL);assert.equal((await first.command('accept')).result,'accepted');
 process.stdout.write('STEP paired\n');const published=await first.command('publish');assert.equal(published.result,'published');process.stdout.write('STEP published\n');
 await page.getByRole('button',{name:'Actualizar copia'}).click();await page.getByRole('navigation',{name:'Secciones'}).getByRole('button',{name:'Dashboard',exact:true}).click();await page.getByRole('button',{name:/Ideas para clase/}).first().waitFor({timeout:10000});
 assert.equal((await first.command('restart')).result,'restored');assert.equal((await first.command('refresh')).result,'refreshed');
 process.stdout.write('STEP refreshed\n');const update=await first.command('update');assert.equal(update.result,'published');
 await page.getByRole('button',{name:'Actualizar copia'}).click();await page.getByRole('button',{name:/Nota preprod actualizada/}).first().waitFor();
 // Reload with data services unavailable; app assets remain available.
 await page.route('http://127.0.0.1:18080/**',r=>r.abort());await page.route('http://127.0.0.1:19099/**',r=>r.abort());await page.reload();await page.getByRole('button',{name:/Nota preprod actualizada/}).first().waitFor();await page.getByText(/Sin conexión · copia de/).first().waitFor();
 await page.unroute('http://127.0.0.1:18080/**');await page.unroute('http://127.0.0.1:19099/**');
 process.stdout.write('STEP offline reload\n');second=probe();await pair((await second.next()).pairingURL);assert.equal((await second.command('accept')).result,'accepted');
 assert.equal((await first.command('publish')).result,'denied');assert.equal((await first.command('refresh')).result,'denied');
 assert.equal((await second.command('publish')).result,'published');
 assert.equal((await second.command('revoke')).result,'revoked');assert.equal((await second.command('publish')).result,'denied');assert.equal((await second.command('restart')).result,'denied');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await page.screenshot({path:resolve(scratch,'settings.png'),fullPage:true});
 await writeFile(resolve(scratch,'result.json'),JSON.stringify({result:'PASS',nativeAuth:true,ownerGoogleSynthetic:true,pairing:true,firstPublish:published.count,refresh:true,reconnectRestored:true,update:true,offlineReload:true,replace:true,oldPublisherDenied:true,revoke:true,externalRequests:external.length,pageErrors:errors},null,2));
 process.stdout.write('PASS preprod: native REST anonymous Auth → Rules pairing → native stage/CAS → usual web reader → refresh/update/offline/replacement/revoke\n');
}catch(error){await writeFile(resolve(scratch,'failure.txt'),await page.locator('body').innerText());await page.screenshot({path:resolve(scratch,'failure.png'),fullPage:true});throw error;}finally{first.child.kill();second?.child.kill();await browser.close();}
