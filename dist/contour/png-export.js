import { renderModel } from './renderer.js';
export function exportPng(state) {
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{worker.terminate();data.blob?resolve(data.blob):reject(new Error(data.error));};
    worker.onerror=()=>{worker.terminate();reject(new Error('No se pudo generar PNG'));};worker.postMessage({id:1,export:true,state});
  });
  return renderModel(state,Infinity).then(({canvas})=>canvas.convertToBlob?canvas.convertToBlob({type:'image/png'}):new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo generar PNG')),'image/png')));
}
