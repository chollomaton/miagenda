import {expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {watchWaiting,editingOpen} from '../src/pwa/updates';
it('aligns installation identity, scope, start and shortcuts at GitHub Pages',async()=>{
 const m=JSON.parse(await readFile('public/manifest.webmanifest','utf8')),base='https://example.test/miagenda/manifest.webmanifest';
 expect(m.name).toBe('Mi Agenda');expect(m.short_name).toBe('Mi Agenda');expect(m.display).toBe('standalone');
 for(const field of ['id','scope','start_url'])expect(new URL(m[field],base).pathname).toBe('/miagenda/');
 expect(m.shortcuts.map((s:{url:string})=>new URL(s.url,base).search)).toEqual(['?action=new-task','?action=new-reminder','?action=new-event','?action=today']);
 expect(m.icons.filter((i:{type:string})=>i.type==='image/png').map((i:{sizes:string})=>i.sizes)).toEqual(['192x192','512x512']);
 for(const icon of m.icons.filter((i:{type:string})=>i.type==='image/png')){
  const png=await readFile('public/'+icon.src);expect(png.readUInt32BE(16)+'x'+png.readUInt32BE(20)).toBe(icon.sizes);
 }
 expect(await readFile('index.html','utf8')).toContain('apple-touch-icon');
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
