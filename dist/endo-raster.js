// Portable, synchronous lossless pixels. Runs are [count:uint16 LE, R,G,B,A].
// Literal mode avoids expansion on textured artwork. Neither mode uses URLs.
const MAX_PIXELS=4096*4096;
const fail=()=>{throw Error('The layer raster is invalid.');};
const bytesToBase64=bytes=>{let value='';for(let i=0;i<bytes.length;i+=32768)value+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(value);};
function base64Bytes(value){try{const s=atob(value),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return bytes;}catch{fail();}}
export function validateRaster(raster){
 if(!raster||!Number.isInteger(raster.width)||!Number.isInteger(raster.height)||raster.width<1||raster.height<1||raster.width>4096||raster.height>4096||raster.width*raster.height>MAX_PIXELS||!['rgba','rgba-rle'].includes(raster.encoding)||typeof raster.data!=='string'||raster.data.length>Math.ceil(MAX_PIXELS*4/3)*4||raster.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(raster.data))fail();
 for(const key of ['logicalWidth','logicalHeight'])if(raster[key]!==undefined&&(!Number.isFinite(raster[key])||raster[key]<=0||raster[key]>2048))fail();for(const key of ['x','y'])if(raster[key]!==undefined&&(!Number.isFinite(raster[key])||Math.abs(raster[key])>1e7))fail();
 const bytes=base64Bytes(raster.data),count=raster.width*raster.height;
 if(raster.encoding==='rgba'){if(bytes.length!==count*4)fail();}
 else{if(bytes.length%6)fail();let n=0;for(let i=0;i<bytes.length;i+=6){const run=bytes[i]|bytes[i+1]<<8;if(!run)fail();n+=run;if(n>count)fail();}if(n!==count)fail();}
 return raster;
}
export function encodeRaster(pixels,width,height,options={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||pixels.length!==width*height*4)fail();
 const raw=new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength),runs=[];
 for(let i=0;i<raw.length;){let n=1;while(n<65535&&i+n*4<raw.length&&raw[i]===raw[i+n*4]&&raw[i+1]===raw[i+n*4+1]&&raw[i+2]===raw[i+n*4+2]&&raw[i+3]===raw[i+n*4+3])n++;runs.push(n&255,n>>8,raw[i],raw[i+1],raw[i+2],raw[i+3]);i+=n*4;if(runs.length>=raw.length)return{width,height,...options,encoding:'rgba',data:bytesToBase64(raw)};}
 return{width,height,...options,encoding:'rgba-rle',data:bytesToBase64(Uint8Array.from(runs))};
}
const decoded=new Map();
export function decodeRaster(raster){
 const key=raster.data;let entry=decoded.get(key);if(entry&&entry.width===raster.width&&entry.height===raster.height&&entry.encoding===raster.encoding)return entry.pixels;
 validateRaster(raster);const bytes=base64Bytes(raster.data),pixels=new Uint8ClampedArray(raster.width*raster.height*4);
 if(raster.encoding==='rgba')pixels.set(bytes);else{let j=0;for(let i=0;i<bytes.length;i+=6){const n=bytes[i]|bytes[i+1]<<8;for(let k=0;k<n;k++){pixels[j++]=bytes[i+2];pixels[j++]=bytes[i+3];pixels[j++]=bytes[i+4];pixels[j++]=bytes[i+5];}}}
 // Avoid retaining full rasters from every Undo state forever.
 if(decoded.size>=8)decoded.delete(decoded.keys().next().value);decoded.set(key,{width:raster.width,height:raster.height,encoding:raster.encoding,pixels});return pixels;
}

const rasterKeys=new WeakMap();
export function rasterSignature(raster){
 if(!raster)return null;let entry=rasterKeys.get(raster);
 if(!entry||entry.data!==raster.data){let hash=2166136261;for(let i=0;i<raster.data.length;i++)hash=Math.imul(hash^raster.data.charCodeAt(i),16777619);entry={data:raster.data,hash:hash>>>0};rasterKeys.set(raster,entry);}
 return[raster.width,raster.height,raster.encoding,raster.logicalWidth,raster.logicalHeight,raster.x,raster.y,raster.data.length,entry.hash];
}
