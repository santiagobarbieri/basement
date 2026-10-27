import {warp,drawMarble,mountMarble} from './runtime.js';
import {validate} from './engine.js';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeName=name=>(name.trim()||'Marble').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,80);
export function embedCode(name,type='html'){if(type==='video')return `<video src="${escape(encodeURIComponent(safeName(name)+'.webm'))}" autoplay muted loop playsinline style="width:100%;height:480px;object-fit:cover;display:block"></video>`;return `<iframe src="${escape(encodeURIComponent(safeName(name)+'.html'))}" title="Marble animation" style="width:100%;height:480px;border:0;display:block" loading="lazy"></iframe>`;}
export function animatedHTML(state,name='Marble',fit='cover'){
 state=validate(state);if(!['cover','contain'].includes(fit))throw Error('Ajuste inválido');const data=JSON.stringify(state).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)} · Marble</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:${state.bath.paper}}canvas{display:block;width:100%;height:100%}</style></head><body><canvas aria-label="Marmolado animado"></canvas><script>\n${warp.toString()}\n${drawMarble.toString()}\n${mountMarble.toString()}\nconst state=${data};mountMarble(document.querySelector('canvas'),state,${JSON.stringify(fit)});\n</script></body></html>`;
}
export function svg(state,seconds=0){state=validate(state);const n=v=>Math.round(v*100)/100;return `<svg xmlns="http://www.w3.org/2000/svg" width="${state.bath.width}" height="${state.bath.height}" viewBox="0 0 ${state.bath.width} ${state.bath.height}"><title>Marble</title><defs><clipPath id="bath"><rect width="${state.bath.width}" height="${state.bath.height}"/></clipPath></defs><g clip-path="url(#bath)"><rect width="100%" height="100%" fill="${state.bath.paper}"/>${state.shapes.map(s=>`<polygon fill="${s.ink||state.palette[s.color]}" points="${s.points.map(v=>{const p=warp(v,state.bath,state.motion,seconds);return n(p.x)+','+n(p.y);}).join(' ')}"/>`).join('')}</g></svg>`;}
export async function png(state,longSide=4096,seconds=0){state=validate(state);const scale=Math.min(longSide/Math.max(state.bath.width,state.bath.height),Math.sqrt(16e6/(state.bath.width*state.bath.height))),c=document.createElement('canvas');c.width=Math.round(state.bath.width*scale);c.height=Math.round(state.bath.height*scale);drawMarble(c.getContext('2d'),state,c.width,c.height,seconds);return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('No se pudo generar PNG'))));}
export function webmType(){return typeof MediaRecorder==='undefined'?null:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));}
export async function webm(state,onProgress=()=>{},longSide=1280){
 state=validate(state);const type=webmType();if(!type)throw Error('Este navegador no exporta WebM. Usá el HTML animado.');
 const scale=Math.min(1,longSide/Math.max(state.bath.width,state.bath.height)),c=document.createElement('canvas');c.width=Math.max(2,Math.round(state.bath.width*scale/2)*2);c.height=Math.max(2,Math.round(state.bath.height*scale/2)*2);const ctx=c.getContext('2d'),fps=30,chunks=[],stream=c.captureStream(fps),recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:5e6}),duration=state.motion.enabled?state.motion.duration:1;
 drawMarble(ctx,state,c.width,c.height,0);
 return new Promise((resolve,reject)=>{
  let timer,started=0,ended=false;const stopTracks=()=>{clearTimeout(timer);stream.getTracks().forEach(t=>t.stop());};
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>{ended=true;stopTracks();reject(e.error||Error('Falló la grabación WebM'));};recorder.onstop=()=>{stopTracks();const blob=new Blob(chunks,{type:'video/webm'});blob.size?resolve(blob):reject(Error('El video quedó vacío'));};
  function tick(){if(ended)return;const seconds=(performance.now()-started)/1000;if(seconds>=duration){ended=true;recorder.stop();return;}drawMarble(ctx,state,c.width,c.height,seconds);onProgress(Math.min(99,Math.round(seconds/duration*100)));timer=setTimeout(tick,1000/fps);}
  recorder.start();started=performance.now();tick();
 });
}
