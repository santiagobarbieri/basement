import {ChromeSurface,rebuild} from './engine.js';
import {exportGeometry,exportState} from './document-bounds.js';
self.onmessage=async({data:input})=>{
 const state=input;
 try{
  const region=exportGeometry(state),canvas=new OffscreenCanvas(region.width,region.height);
  const surface=new ChromeSurface(canvas,{resolution:2,infinite:!!state.infinite,originX:region.x,originY:region.y,logicalWidth:960,logicalHeight:850});
  const rendered=exportState(state);rebuild(surface,rendered.strokes,state.scene);surface.render(state.scene,rendered.strokes.map(s=>s.settings));
  const blob=await canvas.convertToBlob({type:'image/png'});self.postMessage({blob});
 }catch(error){self.postMessage({error:error.message})}
};
