import {renderLayerDocument} from './endo-renderer.js';
import {exportGeometry,exportState} from './document-bounds.js';
self.onmessage=async({data:state})=>{
 try{
  const region=exportGeometry(state),rendered=exportState(state),frame=rendered.frames.find(item=>item.id===rendered.activeFrameId),canvas=new OffscreenCanvas(region.width,region.height);
  renderLayerDocument(canvas,rendered.strokes,state.scene,rendered.layers,{resolution:2,infinite:true,originX:region.x,originY:region.y,logicalWidth:960,logicalHeight:850,frame});
  const blob=await canvas.convertToBlob({type:'image/png'});self.postMessage({blob});
 }catch(error){self.postMessage({error:error.message});}
};
