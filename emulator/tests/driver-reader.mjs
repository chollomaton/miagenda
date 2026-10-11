import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const [authPath,reportPath]=process.argv.slice(2);
assert(process.env.MIAGENDA_EMULATOR==='1'&&authPath&&reportPath);
const auth=JSON.parse(await readFile(authPath,'utf8'));
let status;
for(let attempt=0;attempt<120;attempt++){
 const response=await fetch('http://127.0.0.1:18081/status',{signal:AbortSignal.timeout(15000),method:'POST',headers:{Authorization:'Bearer '+auth.publisher.idToken,'Content-Type':'application/json'},body:JSON.stringify({ownerUID:auth.owner.localId})});assert(response.ok);status=await response.json();
 if(status.state?.publisherID===auth.grant.publisherID)break;
 await new Promise(resolve=>setTimeout(resolve,1000));
}
assert(status.state?.publisherID===auth.grant.publisherID,'Native driver has not published for the current grant');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});let errors=0,external=0;page.on('pageerror',()=>errors++);await page.route('https://**',route=>{external++;return route.abort();});
 await page.goto('http://127.0.0.1:15173/miagenda/?mirrorEmulator=1');const nav=page.getByRole('navigation',{name:'Secciones'});await nav.getByRole('button',{name:/^Ajustes/}).click();await page.getByRole('button',{name:'Fuente y sincronización'}).click();await page.getByText(status.state.currentGeneration,{exact:true}).waitFor({timeout:120000});
 const text=await page.locator('main').innerText();const count=Number(text.match(/(\d+) elementos consultables/)?.[1]);assert(count>0,'Native generation not loaded');
 for(const section of ['Dashboard','Tareas','Recordatorios','Calendario','Notas','Etiquetas','Radar','Plantillas'])await nav.getByRole('button',{name:new RegExp('^'+section)}).click();
 if(process.env.MIAGENDA_DRIVER_SANDBOX==='1'){
  assert(count===142,'Auxiliary active count mismatch');await nav.getByRole('button',{name:/^Plantillas/}).click();await page.getByRole('button',{name:/TEST LOCAL TEMPLATE/}).waitFor();await nav.getByRole('button',{name:/^Calendario/}).click();await page.getByRole('button',{name:/TEST LOCAL BLOCK/}).first().waitFor();await nav.getByRole('button',{name:/^Notas/}).click();await page.getByRole('button',{name:/TEST LOCAL DRIVER/}).first().click();await page.getByRole('dialog').waitFor();assert(await page.getByRole('dialog').locator('input,textarea,select,form').count()===0);await page.getByRole('button',{name:'Cerrar detalle'}).click();
 }
 await page.route('http://127.0.0.1:18080/**',route=>route.abort());await page.route('http://127.0.0.1:19099/**',route=>route.abort());await page.reload();await page.getByText(/Sin conexión · copia de/).first().waitFor({timeout:120000});assert(errors===0&&external===0);
 await writeFile(reportPath,JSON.stringify({status:'PASS',nativeContinuousDriver:true,webUsualReader:true,entityCount:count,generation:status.state.currentGeneration,rootHash:status.state.rootHash,offlineReload:true,errors,externalRequests:external},null,2));process.stdout.write('PASS live DEBUG Apple provider → continuous native driver → Emulator → web → offline\n');
}finally{await browser.close();}
