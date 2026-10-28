// Regenerate with python3 scripts/build-precache.py after changing dist/.
const BUILD = 'ee44a400421003cb2684cc720e7f4252fb0af963265e1bb24e4e49af68570391';
const digest=async buffer=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(b=>b.toString(16).padStart(2,'0')).join('');
// Validate a complete release without storing an offline copy. Open documents
// keep their loaded code until an explicit update from the hub.
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch('/precache.json',{cache:'no-store'});
 if(!response.ok)throw Error('The version index is unavailable.');
 const manifest=await response.json();if(manifest.hash!==BUILD)throw Error('Incomplete release.');
 for(const entry of manifest.files){
  const url=new URL(entry.url,self.location.origin);
  if(url.origin!==self.location.origin)throw Error('Unexpected external resource.');
  const file=await fetch(url.href,{cache:'no-store'});
  if(!file.ok||file.type==='opaque'||await digest(await file.arrayBuffer())!==entry.hash)throw Error('Incomplete resource: '+entry.url);
 }
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Remove only the former Basement application caches; never user documents.
 for(const name of await caches.keys())if(/^basement-app-[a-f0-9]{64}$/.test(name))await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='GET_BUILD')event.ports[0]?.postMessage({build:BUILD});
 if(event.data?.type==='APPLY_UPDATE')event.waitUntil((async()=>{
  const reply=event.ports[0],source=event.source;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  if(!source||!['/hub/','/hub/index.html'].includes(new URL(source.url).pathname)||windows.some(client=>client.id!==source.id)){
   reply?.postMessage({ok:false,error:'Close all other Basement tabs and Studios, then update from the hub.'});return;
  }
  reply?.postMessage({ok:true});await self.skipWaiting();
 })());
});
// Deliberately no fetch handler or runtime cache: new visits need a connection.
