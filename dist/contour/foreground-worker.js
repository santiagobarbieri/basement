import {pipeline,env} from './vendor/transformers.min.js';
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=new URL('./models/',import.meta.url).href;env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;env.backends.onnx.wasm.numThreads=1;
let segmenter;
self.onmessage=async({data})=>{try{
 self.postMessage({status:'Preparando detección de figuras…'});
 segmenter??=await pipeline('background-removal','onnx-community/ormbg-ONNX',{dtype:'q8',device:'wasm'});
 self.postMessage({status:'Separando figura y fondo…'});
 const output=await segmenter(data.image);const blob=await output[0].toBlob();self.postMessage({blob});
 }catch(error){self.postMessage({error:error.message})}};
