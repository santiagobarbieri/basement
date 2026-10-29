import {normalizeEndoState} from './endo-model.js';
import {renderLayerPreview} from './endo-renderer.js';
import {encodeRaster} from './endo-raster.js';

const local=state=>state.layers.filter(layer=>layer.frameId===state.activeFrameId);
function targets(state,ids){const chosen=new Set(ids);return local(state).filter(layer=>chosen.has(layer.id));}
function writable(items){
 if(!items.length)throw Error('Select a drawing layer.');
 if(items.some(layer=>layer.locked))throw Error('Unlock the selected layers first.');
 if(items.some(layer=>!layer.visible))throw Error('Show the selected layers first.');
}
function dependencies(state,items){
 const ids=new Set(items.map(layer=>layer.id));
 for(const layer of state.layers)if(ids.has(layer.clipToLayerId))ids.add(layer.id);
 return ids;
}
function bitmap(state,ids){
 const frame=state.frames.find(frame=>frame.id===state.activeFrameId);
 // Match the existing 2x PNG export, independent from the working quality.
 const rendered=renderLayerPreview(state,[...ids],{width:frame.width*2,height:frame.height*2,includeBackground:false});
 return encodeRaster(rendered.image.data,frame.width*2,frame.height*2,{logicalWidth:frame.width,logicalHeight:frame.height});
}
function bakedLayer(layer,raster){
 const copy={...layer,kind:'paint',opacity:1,filters:[],raster};
 delete copy.blending;delete copy.filter;delete copy.clipToLayerId;return copy;
}
function finish(state,selected){
 state.activeLayerId=selected.at(-1);state.selectedLayerIds=selected;state.selected=null;state.selection=[];
 return normalizeEndoState(state);
}
export function rasterizeLayers(input,ids){
 const state=normalizeEndoState(input),items=targets(state,ids);writable(items);
 if(items.some(layer=>layer.kind!=='paint'))throw Error('Merge an adjustment with its drawing layer to rasterize its effect.');
 const selected=[];
 for(const layer of items){
  const included=dependencies(state,[layer]);
  if(state.layers.some(item=>included.has(item.id)&&item.locked))throw Error('Unlock the layer and its clipped adjustments first.');
  const unattenuated={...state,layers:state.layers.map(item=>item.id===layer.id?{...item,opacity:1}:item)};
  const raster=bitmap(unattenuated,included),index=state.layers.findIndex(item=>item.id===layer.id);
  state.layers[index]={...bakedLayer(layer,raster),opacity:layer.opacity};
  state.layers=state.layers.filter(item=>item.id===layer.id||!included.has(item.id));
  state.strokes=state.strokes.filter(stroke=>!included.has(stroke.layerId));selected.push(layer.id);
 }
 return finish(state,selected);
}
export function canMergeLayers(input,ids){
 const items=targets(input,ids);if(items.length<2||items.some(layer=>layer.locked||!layer.visible)||!items.some(layer=>layer.kind==='paint'))return false;
 const included=dependencies(input,items),ordered=local(input);
 if(ordered.some(layer=>included.has(layer.id)&&layer.locked))return false;
 for(const layer of items){
  if(layer.kind!=='adjustment'||layer.clipToLayerId||layer.filter?.enabled===false||layer.opacity===0)continue;
  if(ordered.slice(0,ordered.indexOf(layer)).some(below=>below.kind==='paint'&&below.visible&&below.opacity!==0&&!included.has(below.id)))return false;
 }
 const positions=ordered.map((layer,index)=>included.has(layer.id)?index:-1).filter(index=>index>=0);
 return positions.length>0&&positions.at(-1)-positions[0]+1===positions.length;
}
export function mergeLayerSelection(input,ids){
 const state=normalizeEndoState(input),items=targets(state,ids);writable(items);
 if(!canMergeLayers(state,ids))throw Error('Select adjacent, visible layers in the same artboard to merge them.');
 const included=dependencies(state,items),raster=bitmap(state,included),base=items.find(layer=>layer.kind==='paint');
 const merged=bakedLayer(base,raster),index=state.layers.findIndex(layer=>included.has(layer.id));
 state.layers=state.layers.filter(layer=>!included.has(layer.id));state.layers.splice(index,0,merged);
 state.strokes=state.strokes.filter(stroke=>!included.has(stroke.layerId));
 return finish(state,[merged.id]);
}
