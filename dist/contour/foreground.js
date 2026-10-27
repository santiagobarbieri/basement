export async function detectForeground(source,onStatus=()=>{}){
 if(source.foreground||source.hasAlpha)return source;
 const image=await createImageBitmap(await(await fetch(source.data)).blob());
 const scale=Math.min(1,512/Math.max(image.width,image.height)),canvas=new OffscreenCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale))),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let transparent=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]<128)transparent++;
 if(transparent>pixels.length/4*.005)return {...source,hasAlpha:true};
 return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./foreground-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=async({data})=>{if(data.status){onStatus(data.status);return;}worker.terminate();if(data.error){reject(Error(data.error));return;}
 try{const reader=new FileReader();reader.onload=()=>resolve({...source,foreground:reader.result,detection:'ormbg-q8-v1'});reader.onerror=()=>reject(Error('No se pudo guardar la máscara'));reader.readAsDataURL(data.blob);}catch(error){reject(error)}};
 worker.onerror=()=>{worker.terminate();reject(Error('No se pudo iniciar la detección de figuras'));};worker.postMessage({image:source.data});
 });
}
