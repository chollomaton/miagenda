// Activation is explicit and only requested after the current editing flow closes.
export function watchWaiting(registration: ServiceWorkerRegistration, notify: (worker: ServiceWorker) => void) {
 const inspect = () => { if (registration.waiting) notify(registration.waiting); };
 const observed = new Set<ServiceWorker>();
 const track = () => {
  inspect();
  const worker = registration.installing;
  if (worker && !observed.has(worker)) { observed.add(worker); worker.addEventListener('statechange', inspect); }
 };
 registration.addEventListener('updatefound', track); track();
 return () => { registration.removeEventListener('updatefound', track); for (const worker of observed) worker.removeEventListener('statechange', inspect); };
}
export function editingOpen() {
 return !!document.querySelector('[role="dialog"], .label-inline .editor, [data-update-blocked="true"]') ||
  !!document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
}
export function requestSafeUpdate(worker: ServiceWorker, container: ServiceWorkerContainer, flush:()=>Promise<void>, reload:()=>void, fail:(message:string)=>void) {
 let requested=false,disposed=false,activated=false,reloaded=false;
 const activate=async()=>{
  if(disposed||reloaded||editingOpen())return;
  if(activated){reloaded=true;reload();return;}
  if(requested)return;
  requested=true;
  try{await flush();if(disposed)return;if(editingOpen()){requested=false;return;}worker.postMessage({type:'ACTIVATE_WHEN_SAFE'});}
  catch{requested=false;fail('No se pudo guardar. Cierra el editor y vuelve a intentarlo.');}
 };
 const changed=()=>{if(!requested)return;activated=true;void activate();};
 const message=(event:MessageEvent)=>{if(event.source===worker&&event.data?.type==='UPDATE_BLOCKED')fail('Cierra las otras pestañas de Mi Agenda y vuelve a intentarlo.');};
 container.addEventListener('controllerchange',changed);container.addEventListener('message',message);
 const observer=new MutationObserver(()=>void activate());observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('focusout',activate);void activate();
 return ()=>{disposed=true;observer.disconnect();document.removeEventListener('focusout',activate);container.removeEventListener('controllerchange',changed);container.removeEventListener('message',message);};
}
