import {renderLayerDocument} from './endo-renderer.js';
// Optional single-frame draft worker. The editor normally keeps its active
// frame incremental in FrameSurface; this worker never reconstructs the page.
self.onmessage=async({data})=>{
 try{
  const frame=data.frame||data.frames?.find(item=>item.id===data.activeFrameId);
  if(!frame)throw Error('Choose a frame to preview.');
  const layers=(data.layers||[]).filter(layer=>layer.frameId===frame.id),ids=new Set(layers.map(layer=>layer.id));
  const strokes=(data.strokes||[]).filter(stroke=>ids.has(stroke.layerId));
  const resolution=Math.max(.001,Math.min((data.view?.scale||1)*.65,Math.sqrt(1_200_000/(frame.width*frame.height))));
  const canvas=new OffscreenCanvas(Math.max(1,Math.ceil(frame.width*resolution)),Math.max(1,Math.ceil(frame.height*resolution)));
  renderLayerDocument(canvas,strokes,data.scene,layers,{resolution,infinite:true,originX:frame.x,originY:frame.y,logicalWidth:960,logicalHeight:850,frame});
  const bitmap=await createImageBitmap(canvas);self.postMessage({id:data.id,bitmap,frameId:frame.id,resolution,samples:canvas.width*canvas.height},[bitmap]);
 }catch(error){self.postMessage({id:data.id,error:error.message});}
};
