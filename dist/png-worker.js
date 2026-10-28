import {renderLayerDocument} from './endo-renderer.js';
import {exportGeometry,exportState} from './document-bounds.js';
self.onmessage=async({data:input})=>{
 const state=input;
 try{
  const region=exportGeometry(state),canvas=new OffscreenCanvas(region.width,region.height);
  const rendered=exportState(state);
  renderLayerDocument(canvas,rendered.strokes,state.scene,rendered.layers,{resolution:2,infinite:!!state.infinite,originX:region.x,originY:region.y,logicalWidth:960,logicalHeight:850});
  const blob=await canvas.convertToBlob({type:'image/png'});self.postMessage({blob});
 }catch(error){self.postMessage({error:error.message})}
};
