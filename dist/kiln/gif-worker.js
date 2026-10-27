import {renderModel} from './renderer.js';
import {dimensions} from './geometry.js';
import {createGifEncoder} from './gif-encode.js';
self.onmessage=async ({data:state})=>{
 try {
  const original=dimensions(state),scale=Math.min(2400/Math.max(original.width,original.height),Math.sqrt(4_000_000/(original.width*original.height)));
  const target={width:Math.max(1,Math.round(original.width*scale)),height:Math.max(1,Math.round(original.height*scale))};
  let encoder;
  const speed=Math.max(.25,Math.min(3,state.tiles.speed??1));
  const count=state.tiles.motion&&(state.tiles.amount??100)>0?40:1;
  for(let i=0;i<count;i++){
   const {canvas}=await renderModel({...state,motionTime:i*100/speed},1000,target);
   const pixels=canvas.getContext('2d').getImageData(0,0,target.width,target.height).data;
   encoder??=createGifEncoder(target.width,target.height,pixels,Math.max(1,Math.round(10/speed)));
   encoder.add(pixels);
   self.postMessage({progress:Math.round((i+1)/count*100)});
  }
  self.postMessage({blob:encoder.finish()});
 }catch(error){self.postMessage({error:error.message})}
};
