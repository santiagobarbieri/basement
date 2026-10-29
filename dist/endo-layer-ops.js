import {normalizeEndoState,createLayer,MAX_LAYERS} from './endo-model.js';

const clone=value=>structuredClone(value);
const localLayers=state=>state.layers.filter(layer=>layer.frameId===state.activeFrameId);
const selectedLayers=(state,ids)=>{const chosen=new Set(ids);return localLayers(state).filter(layer=>chosen.has(layer.id));};
function clearStrokeSelection(state){state.selected=null;state.selection=[];}

// These operations own a normalized copy and preserve every surviving identifier.
// Deleting a paint layer also deletes its attached legacy adjustments, matching
// removeLayer: releasing a clipped adjustment would change unrelated artwork.
export function deleteLayers(input,ids){
 const state=normalizeEndoState(input),chosen=selectedLayers(state,ids).filter(layer=>!layer.locked);
 if(!chosen.length)return state;
 const removed=new Set(chosen.map(layer=>layer.id));
 for(const layer of state.layers)if(removed.has(layer.clipToLayerId))removed.add(layer.id);
 const insertion=state.layers.findIndex(layer=>removed.has(layer.id));
 state.layers=state.layers.filter(layer=>!removed.has(layer.id));
 state.strokes=state.strokes.filter(stroke=>!removed.has(stroke.layerId));
 let local=localLayers(state);
 if(!local.some(layer=>layer.kind==='paint')){
  const empty=createLayer('Layer 1',crypto.randomUUID(),state.activeFrameId);
  state.layers.splice(Math.min(insertion,state.layers.length),0,empty);local=localLayers(state);
 }
 if(!state.layers.some(layer=>layer.id===state.activeLayerId))state.activeLayerId=[...local].reverse().find(layer=>layer.kind==='paint').id;
 state.selectedLayerIds=(input.selectedLayerIds??ids).filter(id=>local.some(layer=>layer.id===id));
 if(!state.selectedLayerIds.length)state.selectedLayerIds=[state.activeLayerId];
 clearStrokeSelection(state);return normalizeEndoState(state);
}

export function duplicateLayers(input,ids){
 const state=normalizeEndoState(input),chosen=selectedLayers(state,ids);
 if(!chosen.length)return state;
 if(state.layers.length+chosen.length>MAX_LAYERS)throw Error('The Project already has 512 layers.');
 const mapping=new Map(chosen.map(layer=>[layer.id,crypto.randomUUID()]));
 const copies=chosen.map(layer=>{
  const copy=clone(layer);copy.id=mapping.get(layer.id);copy.name=(copy.name+' Copy').slice(0,80);
  if(copy.filter)copy.filter.id=crypto.randomUUID();
  if(mapping.has(copy.clipToLayerId))copy.clipToLayerId=mapping.get(copy.clipToLayerId);
  return copy;
 });
 const insertion=Math.max(...chosen.map(layer=>state.layers.indexOf(layer)))+1;
 state.layers.splice(insertion,0,...copies);
 const strokes=state.strokes.filter(stroke=>mapping.has(stroke.layerId));
 for(const stroke of strokes)state.strokes.push({...clone(stroke),layerId:mapping.get(stroke.layerId),number:state.nextNumber++});
 state.activeLayerId=mapping.get(state.activeLayerId)??copies.at(-1).id;
 state.selectedLayerIds=copies.map(layer=>layer.id);clearStrokeSelection(state);return normalizeEndoState(state);
}

// before uses document order (bottom to top), as the existing reorder-layer
// action does. Slots occupied by another artboard never change.
export function reorderLayers(input,ids,targetId,before=true){
 const state=normalizeEndoState(input),local=localLayers(state),target=local.find(layer=>layer.id===targetId);
 if(!target)return state;
 const chosen=selectedLayers(state,ids).filter(layer=>!layer.locked),moving=new Set(chosen.map(layer=>layer.id));
 if(!chosen.length||moving.has(targetId))return state;
 const positions=state.layers.map((layer,index)=>layer.frameId===state.activeFrameId?index:-1).filter(index=>index>=0);
 const remaining=local.filter(layer=>!moving.has(layer.id)),index=remaining.findIndex(layer=>layer.id===targetId)+(before?0:1);
 for(const layer of chosen)if(layer.kind==='adjustment'&&layer.clipToLayerId&&!moving.has(layer.clipToLayerId))delete layer.clipToLayerId;
 remaining.splice(index,0,...chosen);positions.forEach((position,i)=>state.layers[position]=remaining[i]);
 state.selectedLayerIds=(input.selectedLayerIds??ids).filter(id=>local.some(layer=>layer.id===id));
 clearStrokeSelection(state);return normalizeEndoState(state);
}
