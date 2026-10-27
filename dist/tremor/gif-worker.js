import {ChromeSurface,rebuild} from './engine.js';
import {encodeGif} from './gif-encode.js';
import {gifGeometry,exportState} from './gif-geometry.js';
self.onmessage=({data:input})=>{
 try{
  const geometry=gifGeometry(input),state=exportState(input),{width,height,resolution}=geometry,canvas=new OffscreenCanvas(width,height);
  const surface=new ChromeSurface(canvas,{resolution,infinite:!!state.infinite,originX:geometry.x,originY:geometry.y,logicalWidth:960,logicalHeight:850}),frames=[];
  const base=state.scene.frameTime||0;
  const strokes=state.strokes.map(s=>{const age=Math.max(0,base-(s.createdAt??base));return {...s,createdAt:0,settings:{...s.settings,settle:0,amount:(s.settings.amount||0)*(s.settings.settle>0?Math.exp(-age/1000*s.settings.settle/100/4):1)}}});
  for(let i=0;i<25;i++){
   const scene={...state.scene,frameTime:i*80};rebuild(surface,strokes,scene);surface.render(scene,strokes.map(s=>s.settings),true);
   if(scene.background==='color'){const ctx=surface.ctx;ctx.globalCompositeOperation='destination-over';ctx.fillStyle=scene.backgroundColor;ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='source-over';frames.push(ctx.getImageData(0,0,width,height).data)}else frames.push(surface.image.data.slice());
  }
  self.postMessage({blob:new Blob([encodeGif(frames,width,height,8)],{type:'image/gif'})});
 }catch(error){self.postMessage({error:error.message})}
};
