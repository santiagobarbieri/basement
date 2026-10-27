import {renderModel} from './renderer.js';
import {dimensions} from './geometry.js';
import {createGifEncoder} from './gif-encode.js';
self.onmessage=async({data:state})=>{try{
 const {width,height}=dimensions(state),scale=Math.min(2400/Math.max(width,height),Math.sqrt(4e6/(width*height))),target={width:Math.round(width*scale),height:Math.round(height*scale)};
 const fps=state.contour.fps,count=state.contour.jitter>0?fps*2:1;let encoder;
 for(let i=0;i<count;i++){const {canvas}=await renderModel({...state,motionTime:(i+.01)*1000/fps},1000,target);const pixels=canvas.getContext('2d').getImageData(0,0,target.width,target.height).data;encoder??=createGifEncoder(target.width,target.height,pixels,Math.round(100/fps));encoder.add(pixels);self.postMessage({progress:Math.round((i+1)/count*100)})}
 self.postMessage({blob:encoder.finish()});
 }catch(error){self.postMessage({error:error.message})}};
