import {toolTransforms,transformPoint} from './symmetry.js';
import {normalizeEndoState} from './endo-model.js';
function visibleLayerIds(state){return Array.isArray(state.layers)?new Set(state.layers.filter(layer=>layer.kind!=='adjustment'&&layer.visible!==false&&(layer.opacity??1)>0).map(layer=>layer.id)):null;}
function visibleStroke(stroke,visible){return !visible||visible.has(stroke.layerId??'layer-1');}
export function documentBounds(state){
  const visible=visibleLayerIds(state);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const stroke of state.strokes??[]){
    if(!stroke.points?.length||stroke.operation==='erase'||!visibleStroke(stroke,visible))continue;
    const transforms=toolTransforms(stroke.tool,960,850,stroke.points[0]),pad=stroke.settings.width+16;
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const point of stroke.points)for(const transform of transforms){const p=transformPoint(point,transform);left=Math.min(left,p.x-pad);top=Math.min(top,p.y-pad);right=Math.max(right,p.x+pad);bottom=Math.max(bottom,p.y+pad);}
    const repeat=stroke.tool?.mode!=='none'&&stroke.tool?.region;
    if(repeat){left=Math.max(left,repeat.x);top=Math.max(top,repeat.y);right=Math.min(right,repeat.x+repeat.width);bottom=Math.min(bottom,repeat.y+repeat.height);}
    const layer=state.layers?.find(layer=>layer.id===stroke.layerId),frame=state.frameVersion===1&&state.frames?.find(frame=>frame.id===layer?.frameId);
    if(frame){left=Math.max(left,frame.x);top=Math.max(top,frame.y);right=Math.min(right,frame.x+frame.width);bottom=Math.min(bottom,frame.y+frame.height);}
    if(!(right>left&&bottom>top))continue;x0=Math.min(x0,left);y0=Math.min(y0,top);x1=Math.max(x1,right);y1=Math.max(y1,bottom);
  }
  if(!Number.isFinite(x0))return {x:0,y:0,width:960,height:850};
  return {x:Math.floor(x0),y:Math.floor(y0),width:Math.ceil(x1)-Math.floor(x0),height:Math.ceil(y1)-Math.floor(y0)};
}
function selectedFrame(state){return state.frames.find(frame=>frame.id===state.exportTarget)||state.frames.find(frame=>frame.id===state.activeFrameId)||state.frames[0];}
export function exportState(input){
  const state=normalizeEndoState(input),frame=selectedFrame(state),layers=state.layers.filter(layer=>layer.frameId===frame.id),ids=new Set(layers.map(layer=>layer.id));
  return {...state,frames:[structuredClone(frame)],activeFrameId:frame.id,activeLayerId:layers.some(layer=>layer.id===state.activeLayerId)?state.activeLayerId:layers.find(layer=>layer.kind==='paint').id,layers,strokes:state.strokes.filter(stroke=>ids.has(stroke.layerId)),exportTarget:frame.id};
}
export function exportGeometry(input){
  const state=exportState(input),frame=state.frames[0],width=frame.width*2,height=frame.height*2;
  if(width>4096||height>4096||width*height>16777216)throw Error('El frame supera el límite de exportación.');
  return {x:frame.x,y:frame.y,width,height,name:frame.name,frameId:frame.id,background:frame.background};
}
