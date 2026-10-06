export function generateWorker(shell:string[],version:string){return `const CACHE='miagenda-shell-${version}';const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('miagenda-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.search)return;const allowed=SHELL.map(p=>new URL(p,self.registration.scope).href);if(!allowed.includes(u.href))return;e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));});
`}
