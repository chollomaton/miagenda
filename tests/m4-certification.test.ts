import {expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {watchWaiting,editingOpen} from '../src/pwa/updates';
it('aligns installation identity, scope, start and shortcuts at GitHub Pages',async()=>{
 const m=JSON.parse(await readFile('public/manifest.webmanifest','utf8')),base='https://example.test/miagenda/manifest.webmanifest';
 expect(m.name).toBe('Mi Agenda');expect(m.short_name).toBe('Mi Agenda');expect(m.display).toBe('standalone');
 for(const field of ['id','scope','start_url'])expect(new URL(m[field],base).pathname).toBe('/miagenda/');
 expect(m.id).toBe('/miagenda/?app-id=1.1.0');
 expect(m.start_url).toBe('./?pwa=1.1.0');expect(m.scope).toBe('./');
 const publicManifest='https://chollomaton.github.io/miagenda/manifest.webmanifest';
 for(const value of [m.id,m.start_url,m.scope,...m.shortcuts.map((s:{url:string})=>s.url)]){
  const url=new URL(value,publicManifest);
  expect(url.origin).toBe('https://chollomaton.github.io');expect(url.pathname).toBe('/miagenda/');
 }
 expect(new URL(m.id,publicManifest).href).not.toBe(new URL('/miagenda/',publicManifest).href);
 expect(m.shortcuts.map((s:{url:string})=>new URL(s.url,base).search)).toEqual(['?action=new-task','?action=new-reminder','?action=new-event','?action=today']);
 expect(m.icons.map((i:{src:string})=>i.src)).toEqual(['icons/miagenda-192-v2.png','icons/miagenda-512-v2.png','icons/miagenda-maskable-512-v2.png']);
 expect(m.icons.filter((i:{type:string})=>i.type==='image/png').map((i:{sizes:string})=>i.sizes)).toEqual(['192x192','512x512','512x512']);
 for(const icon of m.icons.filter((i:{type:string})=>i.type==='image/png')){
  const png=await readFile('public/'+icon.src);expect(png.readUInt32BE(16)+'x'+png.readUInt32BE(20)).toBe(icon.sizes);
 }
 expect(await readFile('index.html','utf8')).toContain('apple-touch-icon');
 expect(await readFile('index.html','utf8')).toContain('rel="manifest" href="./manifest.webmanifest?install=1.1.0"');
});
it('detects already waiting and newly installed workers, removes listeners',()=>{
 const reg=new EventTarget() as ServiceWorkerRegistration;
 const installing=new EventTarget() as ServiceWorker;
 Object.assign(reg,{waiting:null,installing});const notify=vi.fn();const stop=watchWaiting(reg,notify);
 Object.assign(reg,{waiting:installing});installing.dispatchEvent(new Event('statechange'));expect(notify).toHaveBeenCalledWith(installing);
 stop();notify.mockClear();installing.dispatchEvent(new Event('statechange'));expect(notify).not.toHaveBeenCalled();
 watchWaiting(reg,notify)();expect(notify).toHaveBeenCalledWith(installing);
});
for(const html of ['<div role="dialog"><input value="draft"></div>','<div class="label-inline"><form class="editor template-editor"></form></div>','<div data-update-blocked="true">Backup pendiente</div>'])it('blocks update with editing flow '+html,()=>{
 const node=document.createElement('div');node.innerHTML=html;document.body.append(node);expect(editingOpen()).toBe(true);node.remove();expect(editingOpen()).toBe(false);
});
it('blocks focused settings and backup input',()=>{const input=document.createElement('textarea');document.body.append(input);input.focus();expect(editingOpen()).toBe(true);input.remove();expect(editingOpen()).toBe(false)});
it('fits quick capture into the visual viewport instead of forcing full keyboard height',async()=>{
 const css=await readFile('src/quick-capture/quick-capture.css','utf8');expect(css).not.toContain('min-height:100dvh');expect(css).toContain('min-height:0');
});
it('protects mobile input zoom, touch controls and scrolling at 393px',async()=>{
 const css=await readFile('src/styles/responsive.css','utf8');expect(css).toContain('input,textarea,select,.list-screen .toolbar select{font-size:16px}');expect(css).toContain('min-height:44px');expect(css).toContain('safe-area-inset-top');expect(css).toContain('safe-area-inset-bottom');expect(css).toContain('--visible-height,100dvh');expect(css).toContain('overflow:auto');expect(css).toContain('.bottom-nav');
});

it('uses the native Apple icon at its declared 180px size',async()=>{
 const html=await readFile('index.html','utf8');
 expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="./icons/miagenda-touch-1.1.0.png"');
 const links=[...html.matchAll(/<link\b[^>]*rel="apple-touch-icon"[^>]*>/g)];
 expect(links).toHaveLength(1);
 const href=links[0][0].match(/href="([^"]+)"/)?.[1];
 expect(href).toBe('./icons/miagenda-touch-1.1.0.png');
 expect(href).not.toMatch(/agenda-native|apple-touch-icon\.png|\?|\.svg/);
 const png=await readFile('public/'+href!.slice(2));
 expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
 expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([180,180]);
 expect(png[25]).toBe(2); // RGB: iOS receives no transparent corners
});
it('keeps the exact native original and a separate opaque maskable derivative',async()=>{
 const {createHash}=await import('node:crypto');
 const original=await readFile('public/icons/agenda-native-original.png');
 expect(createHash('sha256').update(original).digest('hex')).toBe('05ef17ffb13c190fed256f77185542e1580da18d8abcbb959e8fe749bf465fde');
 const manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
 expect(manifest.icons.filter((icon:{purpose:string})=>icon.purpose==='maskable')).toEqual([{src:'icons/miagenda-maskable-512-v2.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]);
 const mask=await readFile('public/icons/miagenda-maskable-512-v2.png');expect(mask[25]).toBe(2);
 expect(manifest.icons.some((icon:{type:string})=>icon.type==='image/svg+xml')).toBe(false);
});
it('changes the shell version when only icon bytes change',async()=>{
 const {shellVersion}=await import('../scripts/shell-version');
 const icon=await readFile('public/icons/miagenda-512-v2.png'),changed=Buffer.from(icon);changed[changed.length-1]^=1;
 expect(shellVersion([icon],'worker')).not.toBe(shellVersion([changed],'worker'));
 expect(shellVersion([icon],'worker')).toBe(shellVersion([icon],'worker'));
 const build=await readFile('scripts/build-shell.mjs','utf8');expect(build).toContain('manifest.icons.map');expect(build).toContain('./icons/miagenda-touch-1.1.0.png');
});
it('keeps every maskable artwork pixel within the central 80% circle',async()=>{
 const {inflateSync}=await import('node:zlib');
 const png=await readFile('public/icons/miagenda-maskable-512-v2.png');
 const chunks:Buffer[]=[];
 for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=12+length}
 const raw=inflateSync(Buffer.concat(chunks)),width=512,stride=width*3,pixels=Buffer.alloc(width*stride);
 for(let y=0;y<width;y++){
  const filter=raw[y*(stride+1)];expect(filter).toBeLessThanOrEqual(4);
  for(let x=0;x<stride;x++){
   const pos=y*stride+x,a=x>=3?pixels[pos-3]:0,b=y?pixels[pos-stride]:0,c=y&&x>=3?pixels[pos-stride-3]:0;
   const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
   const predictor=[0,a,b,Math.floor((a+b)/2),pa<=pb&&pa<=pc?a:pb<=pc?b:c][filter];
   pixels[pos]=(raw[y*(stride+1)+1+x]+predictor)&255;
  }
 }
 let artwork=0,outside=0;
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const p=(y*width+x)*3;
  if(pixels[p]===23&&pixels[p+1]===24&&pixels[p+2]===29)continue;
  artwork++;if(Math.hypot(x+0.5-256,y+0.5-256)>512*0.4)outside++;
 }
 expect(artwork).toBeGreaterThan(1000);expect(outside).toBe(0);
});

it('serves opaque versioned manifest icons for installation',async()=>{
 const manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
 for(const icon of manifest.icons){
  expect(icon.src).not.toMatch(/agenda-native|\?|\.svg/);
  const png=await readFile('public/'+icon.src);
  expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
  expect(png[25]).toBe(2);
  expect(png.readUInt32BE(16)+'x'+png.readUInt32BE(20)).toBe(icon.sizes);
 }
});
