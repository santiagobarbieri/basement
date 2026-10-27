export function exportGif(state,onProgress=()=>{}) {
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./gif-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   if(data.progress!==undefined){onProgress(data.progress);return;}
   worker.terminate();data.blob?resolve(data.blob):reject(new Error(data.error));
  };
  worker.onerror=()=>{worker.terminate();reject(new Error('No se pudo generar GIF'));};
  worker.postMessage(state);
 });
}
