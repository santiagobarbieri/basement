import {toolTransforms,transformPoint} from './symmetry.js';
// Endo documents keep editable world-space gestures inside finite, independent frames.
export const DEFAULT_LAYER_ID = 'layer-1';
export const DEFAULT_FRAME_ID = 'frame-1';
export const FRAME_VERSION = 1;
export const MIN_FRAME_SIZE = 64;
export const MAX_FRAME_SIZE = 2048;
export const MAX_FRAMES = 32;
export const MAX_LAYERS = 512;
// Migration may expand valid old per-layer filter stacks into separate layers.
const MAX_DOCUMENT_LAYERS = 1024;
export const MAX_FILTERS = 8;
const filterTypes = new Set(['threshold', 'dither', 'grayscale', 'invert']);
const modes = new Set(['none', 'mandala', 'mirror', 'grid', 'mosaic']);
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const finite = (value,min,max) => Number.isFinite(value) && value >= min && value <= max;
const fail = message => { throw Error(message); };
const clone = value => structuredClone(value);
const absent = (value,fallback) => value === undefined ? fallback : value;
const newId = () => crypto.randomUUID();
export function createFrame(name='Frame 1',id=newId(),options={}) {
  return {id,name,x:options.x??0,y:options.y??0,width:options.width??960,height:options.height??850,background:options.background??null};
}
export function createLayer(name='Layer 1',id=newId(),frameId=DEFAULT_FRAME_ID) {
  return {id,name,frameId,kind:'paint',visible:true,locked:false,opacity:1,filters:[]};
}
export function createAdjustmentLayer(type='threshold',id=newId(),frameId=DEFAULT_FRAME_ID,name) {
  const label={threshold:'Threshold',dither:'Dither',grayscale:'Grayscale',invert:'Invert'}[type]||type;
  return {id,name:name??label,frameId,kind:'adjustment',visible:true,locked:false,opacity:1,filters:[],filter:{id:newId(),type,enabled:true,amount:128,scale:2}};
}
export function validateRegion(region) {
  if(region==null)return;
  if(typeof region!=='object'||!finite(region.x,-1e7,1e7)||!finite(region.y,-1e7,1e7)||!finite(region.width,1,1e7)||!finite(region.height,1,1e7))fail('The repetition area is invalid.');
}
function validateTool(tool={}) {
  if(typeof tool!=='object'||!modes.has(tool.mode??'none'))fail('The repetition mode is invalid.');
  validateRegion(tool.region);
  for(const [key,min,max]of [['count',2,16],['columns',1,6],['rows',1,6]])if(tool[key]!==undefined&&(!Number.isInteger(tool[key])||!finite(tool[key],min,max)))fail('The repetition settings are invalid.');
  if(tool.axes!==undefined&&!['vertical','horizontal','both'].includes(tool.axes))fail('The mirror axis is invalid.');
}
const normalizeFilter=filter=>({...filter,enabled:absent(filter.enabled,true),amount:absent(filter.amount,128),scale:absent(filter.scale,2)});
function validateFilter(filter) {
  if(!filter||!identifier(filter.id)||!filterTypes.has(filter.type)||typeof filter.enabled!=='boolean'||!finite(filter.amount,0,255)||!Number.isInteger(filter.scale)||!finite(filter.scale,1,64))fail('The Artboard contains an invalid filter.');
}
function metadata(layer,index,frameId) {
  return {id:absent(layer.id,index===0?DEFAULT_LAYER_ID:undefined),name:absent(layer.name,'Layer '+(index+1)),frameId:absent(layer.frameId,frameId),kind:absent(layer.kind,'paint'),visible:absent(layer.visible,true),locked:absent(layer.locked,false),opacity:absent(layer.opacity,1),filters:(layer.filters??[]).map(normalizeFilter),...(layer.filter?{filter:normalizeFilter(layer.filter)}:{}),...(layer.clipToLayerId!==undefined?{clipToLayerId:layer.clipToLayerId}:{})};
}
function legacyFrame(source) {
  let left=0,top=0,right=960,bottom=850;
  for(const stroke of source.strokes??[]){
    const points=stroke.points??[];if(!points.length)continue;
    const transforms=toolTransforms(stroke.tool,960,850,points[0]);
    for(const point of points){
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
      const pad=Number(stroke.settings?.width)||0;
      for(const transform of transforms){const p=transformPoint(point,transform);left=Math.min(left,p.x-pad);top=Math.min(top,p.y-pad);right=Math.max(right,p.x+pad);bottom=Math.max(bottom,p.y+pad);}
    }
  }
  const width=Math.max(MIN_FRAME_SIZE,Math.min(MAX_FRAME_SIZE,Math.ceil(right-left))),height=Math.max(MIN_FRAME_SIZE,Math.min(MAX_FRAME_SIZE,Math.ceil(bottom-top)));
  return {...createFrame('Frame 1',DEFAULT_FRAME_ID,{x:Math.floor(left),y:Math.floor(top),width,height}),...(right-left>MAX_FRAME_SIZE||bottom-top>MAX_FRAME_SIZE?{legacyOverflow:true}:{})};
}
function migrateLegacy(source) {
  const previous=Array.isArray(source.frames)?source.frames:[];
  const main=legacyFrame(source),ids=new Set([main.id]);if(previous.length)source.legacyExportAreas=clone(previous);
  source.frames=[main];
  // Former export crops become empty frames; source gestures stay in their original frame.
  for(const frame of previous){
    if(source.frames.length>=MAX_FRAMES)break;
    let id=frame.id;if(!identifier(id)||ids.has(id))id='legacy-frame-'+source.frames.length;ids.add(id);
    source.frames.push(createFrame(frame.name||'Frame '+(source.frames.length+1),id,{x:frame.x,y:frame.y,width:Math.max(MIN_FRAME_SIZE,Math.min(MAX_FRAME_SIZE,frame.width)),height:Math.max(MIN_FRAME_SIZE,Math.min(MAX_FRAME_SIZE,frame.height)),background:null}));
  }
  source.layers=source.layers.map(layer=>({...layer,frameId:main.id,kind:layer.kind??'paint'}));
  for(const frame of source.frames.slice(1)){const base='frame-layer-'+frame.id.slice(0,70);let id=base,n=1;while(source.layers.some(layer=>layer.id===id))id=base+'-'+n++;source.layers.push(createLayer('Layer 1',id,frame.id));}
  source.activeFrameId=main.id;source.frameVersion=FRAME_VERSION;
  return source;
}
export function normalizeEndoState(input) {
  if(!input||typeof input!=='object')fail('Missing Endo Artboard settings.');
  if(input.layers!==undefined&&(!Array.isArray(input.layers)||!input.layers.length||input.layers.length>MAX_DOCUMENT_LAYERS))fail('The Artboard layers are invalid.');
  if(input.strokes!==undefined&&(!Array.isArray(input.strokes)||input.strokes.length>10000))fail('The Artboard contains invalid strokes.');
  const source=clone(input),framed=source.frameVersion===FRAME_VERSION;
  if(!framed&&source.frames!==undefined){
    if(!Array.isArray(source.frames)||source.frames.length>50)fail('The legacy export areas are invalid.');
    const legacyIds=new Set();for(const frame of source.frames){if(!frame||!identifier(frame.id)||legacyIds.has(frame.id)||typeof frame.name!=='string'||frame.name.length>80||![frame.x,frame.y,frame.width,frame.height].every(Number.isFinite)||frame.width<=0||frame.height<=0||[frame.x,frame.y,frame.width,frame.height].some(value=>Math.abs(value)>1e7))fail('The legacy export areas are invalid.');legacyIds.add(frame.id);}
  }
  if(source.frameVersion!==undefined&&!framed)fail('The Artboard frame format is not supported.');
  source.layers=(source.layers??[createLayer('Layer 1',DEFAULT_LAYER_ID)]).map((layer,i)=>{
    if(!layer||typeof layer!=='object'||(layer.filters!==undefined&&(!Array.isArray(layer.filters)||layer.filters.length>MAX_FILTERS)))fail('The Artboard layers are invalid.');
    return metadata(layer,i,framed?undefined:DEFAULT_FRAME_ID);
  });
  source.strokes=(source.strokes??[]).map((stroke,index)=>({...stroke,number:absent(stroke.number,index+1),layerId:absent(stroke.layerId,source.layers[0].id),operation:absent(stroke.operation,'paint'),settings:{...stroke.settings},tool:clone(stroke.tool??{mode:'none'}),points:(stroke.points??[]).map(point=>({...point}))}));
  if(!framed)migrateLegacy(source);
  else source.frames=(source.frames??[]).map(frame=>({...frame,background:absent(frame.background,null)}));
  const converted=[];
  for(const layer of source.layers){
    if(layer.kind==='adjustment'&&layer.filters.length)fail('An adjustment layer cannot contain a legacy filter stack.');
    const filters=layer.kind==='paint'?layer.filters:[];layer.filters=[];converted.push(layer);
    for(const [index,filter]of filters.entries()){
      const base=layer.id.slice(0,65)+'-adjustment-'+index;let id=base,n=1;while(source.layers.some(item=>item.id===id)||converted.some(item=>item.id===id))id=base+'-'+n++;
      converted.push({...createAdjustmentLayer(filter.type,id,layer.frameId),filter,clipToLayerId:layer.id});
    }
  }
  source.layers=converted;
  source.activeFrameId=absent(source.activeFrameId,source.frames[0]?.id);
  source.activeLayerId=absent(source.activeLayerId,[...source.layers].reverse().find(layer=>layer.frameId===source.activeFrameId&&layer.kind==='paint')?.id);
  source.tool={mode:'none',count:8,axes:'vertical',columns:3,rows:3,...source.tool};
  source.nextNumber=Math.max(source.nextNumber??1,...source.strokes.map(stroke=>(stroke.number??0)+1));
  source.infinite=true;
  return validateNormalized(source);
}
function validateNormalized(state) {
  if(!Array.isArray(state.frames)||!state.frames.length||state.frames.length>MAX_FRAMES)fail('The Artboard must contain between 1 and 32 frames.');
  const frameIds=new Set();
  for(const frame of state.frames){
    if(!frame||!identifier(frame.id)||frameIds.has(frame.id)||typeof frame.name!=='string'||!frame.name.trim()||frame.name.length>80||!finite(frame.x,-1e7,1e7)||!finite(frame.y,-1e7,1e7)||!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||!finite(frame.width,MIN_FRAME_SIZE,MAX_FRAME_SIZE)||!finite(frame.height,MIN_FRAME_SIZE,MAX_FRAME_SIZE)||(frame.background!==null&&!/^#[0-9a-f]{6}$/i.test(frame.background||'')))fail('The Artboard contains an invalid frame. Frames must be 64–2048 px per side.');
    frameIds.add(frame.id);
  }
  if(!frameIds.has(state.activeFrameId))fail('The active frame is invalid.');
  if(!Array.isArray(state.layers)||!state.layers.length||state.layers.length>MAX_DOCUMENT_LAYERS)fail('The Artboard layers are invalid.');
  const ids=new Set();
  for(const layer of state.layers){
    if(!identifier(layer.id)||ids.has(layer.id)||typeof layer.name!=='string'||!layer.name.trim()||layer.name.length>80||!frameIds.has(layer.frameId)||!['paint','adjustment'].includes(layer.kind)||typeof layer.visible!=='boolean'||typeof layer.locked!=='boolean'||!finite(layer.opacity,0,1)||layer.filters.length)fail('The Artboard contains an invalid layer.');
    ids.add(layer.id);if(layer.kind==='adjustment')validateFilter(layer.filter);else if(layer.filter!==undefined)fail('A paint layer cannot contain an adjustment.');
  }
  for(const frame of state.frames)if(!state.layers.some(layer=>layer.frameId===frame.id&&layer.kind==='paint'))fail('Each frame needs a paint layer.');
  for(const layer of state.layers)if(layer.clipToLayerId!==undefined){const target=state.layers.find(item=>item.id===layer.clipToLayerId);if(layer.kind!=='adjustment'||!target||target.kind!=='paint'||target.frameId!==layer.frameId)fail('The filter clipping target is invalid.');}
  const active=state.layers.find(layer=>layer.id===state.activeLayerId);
  if(!active||active.frameId!==state.activeFrameId)fail('The active layer does not belong to the active frame.');
  if(!Array.isArray(state.strokes)||state.strokes.length>10000||!state.scene||!state.defaults)fail('Missing Artboard settings.');
  for(const value of [...Object.values(state.scene),...Object.values(state.defaults)])if(typeof value==='number'&&!Number.isFinite(value))fail('The Artboard settings contain an invalid number.');
  validateTool(state.tool);
  let total=0;const numbers=new Set();
  for(const stroke of state.strokes){
    if(!Number.isInteger(stroke.number)||stroke.number<1||numbers.has(stroke.number))fail('The stroke identifiers are invalid.');numbers.add(stroke.number);
    const layer=state.layers.find(item=>item.id===stroke.layerId);
    if(!layer||layer.kind!=='paint'||!['paint','erase'].includes(stroke.operation))fail('A stroke references an invalid paint layer or operation.');
    if(!Array.isArray(stroke.points)||!stroke.settings||!finite(stroke.settings.width,Number.MIN_VALUE,100))fail('The Artboard contains invalid strokes.');
    validateTool(stroke.tool);for(const value of Object.values(stroke.settings))if(typeof value==='number'&&!Number.isFinite(value))fail('The Artboard stroke settings contain an invalid number.');
    for(const key of ['primary','shadow','contrast'])if(!/^#[0-9a-f]{6}$/i.test(stroke.settings[key]||''))fail('The Artboard contains invalid colors.');
    total+=stroke.points.length;for(const point of stroke.points)if(![point.x,point.y,point.time,point.pressure].every(Number.isFinite)||Math.abs(point.x)>1e7||Math.abs(point.y)>1e7)fail('The Artboard contains invalid coordinates.');
  }
  if(total>1000000)fail('The Artboard contains too many points.');
  if(!Number.isInteger(state.nextNumber)||state.nextNumber<1)fail('The stroke numbering is invalid.');
  return state;
}
export function validateEndoState(input){return normalizeEndoState(input);}
export function activeFrame(state){return state.frames.find(frame=>frame.id===state.activeFrameId)||state.frames[0];}
export function getFrameForLayer(state,layerId){const layer=state.layers.find(item=>item.id===layerId);return state.frames.find(frame=>frame.id===layer?.frameId);}
export function frameLayers(state,frameId=state.activeFrameId){return state.layers.filter(layer=>layer.frameId===frameId);}
function selectFrame(state,id){state.activeFrameId=id;state.activeLayerId=[...state.layers].reverse().find(layer=>layer.frameId===id&&layer.kind==='paint').id;state.selected=null;state.selection=[];return state;}
export function addFrame(input,{id=newId(),name,x,y,width=960,height=850,background=null}={}){
  const state=normalizeEndoState(input);if(state.frames.length>=MAX_FRAMES)fail('The Artboard already has 32 frames.');
  const previous=activeFrame(state);state.frames.push(createFrame(name??'Frame '+(state.frames.length+1),id,{x:x??previous.x+previous.width+80,y:y??previous.y,width,height,background}));
  state.layers.push(createLayer('Layer 1',newId(),id));return normalizeEndoState(selectFrame(state,id));
}
export function removeFrame(input,id){
  const state=normalizeEndoState(input),index=state.frames.findIndex(frame=>frame.id===id);if(index<0)return state;if(state.frames.length===1)fail('Keep at least one frame.');
  const removed=new Set(state.layers.filter(layer=>layer.frameId===id).map(layer=>layer.id));state.layers=state.layers.filter(layer=>!removed.has(layer.id));state.strokes=state.strokes.filter(stroke=>!removed.has(stroke.layerId));state.frames.splice(index,1);
  return selectFrame(state,state.activeFrameId===id?state.frames[Math.min(index,state.frames.length-1)].id:state.activeFrameId);
}
export function moveFrame(input,id,position){
  const state=normalizeEndoState(input),frame=state.frames.find(item=>item.id===id);if(!frame)return state;
  const x=position.x??frame.x,y=position.y??frame.y,dx=x-frame.x,dy=y-frame.y,ids=new Set(frameLayers(state,id).map(layer=>layer.id));frame.x=x;frame.y=y;
  state.strokes=state.strokes.map(stroke=>ids.has(stroke.layerId)?translateStroke(stroke,dx,dy):stroke);return normalizeEndoState(state);
}
export function resizeFrame(input,id,size){
  const state=normalizeEndoState(input),frame=state.frames.find(item=>item.id===id);if(!frame)return state;
  for(const key of ['x','y','width','height'])if(size[key]!==undefined)frame[key]=size[key];return normalizeEndoState(state);
}
export function duplicateFrame(input,id,{newFrameId=newId(),dx,dy=0}={}){
  const state=normalizeEndoState(input),frame=state.frames.find(item=>item.id===id);if(!frame)return state;if(state.frames.length>=MAX_FRAMES)fail('The Artboard already has 32 frames.');
  dx??=frame.width+80;state.frames.push({...clone(frame),id:newFrameId,name:(frame.name+' Copy').slice(0,80),x:frame.x+dx,y:frame.y+dy});
  const map=new Map();for(const layer of frameLayers(state,id)){const copy=clone(layer);copy.id=newId();copy.frameId=newFrameId;if(copy.filter)copy.filter.id=newId();map.set(layer.id,copy.id);state.layers.push(copy);}
  for(const layer of frameLayers(state,newFrameId))if(layer.clipToLayerId)layer.clipToLayerId=map.get(layer.clipToLayerId);
  const copies=state.strokes.filter(stroke=>map.has(stroke.layerId)).map(stroke=>({...translateStroke(stroke,dx,dy),layerId:map.get(stroke.layerId),number:state.nextNumber++}));state.strokes.push(...copies);
  return normalizeEndoState(selectFrame(state,newFrameId));
}
export function addLayer(input,{name,id=newId()}={}){
  const state=normalizeEndoState(input);if(state.layers.length>=MAX_LAYERS)fail('The Artboard already has 512 layers.');
  state.layers.push(createLayer(name??'Layer '+(frameLayers(state).filter(layer=>layer.kind==='paint').length+1),id,state.activeFrameId));state.activeLayerId=id;return state;
}
export function addAdjustmentLayer(input,type,{id=newId(),name}={}){
  const state=normalizeEndoState(input);if(state.layers.length>=MAX_LAYERS)fail('The Artboard already has 512 layers.');
  const layer=createAdjustmentLayer(type,id,state.activeFrameId,name),index=state.layers.findIndex(item=>item.id===state.activeLayerId);state.layers.splice(index+1,0,layer);state.activeLayerId=id;return normalizeEndoState(state);
}
export function removeLayer(input,id){
  const state=normalizeEndoState(input),index=state.layers.findIndex(layer=>layer.id===id);if(index<0)return state;const frameId=state.layers[index].frameId;
  state.layers.splice(index,1);state.strokes=state.strokes.filter(stroke=>stroke.layerId!==id);state.layers=state.layers.filter(layer=>layer.clipToLayerId!==id);
  if(!state.layers.some(layer=>layer.frameId===frameId&&layer.kind==='paint'))state.layers.push(createLayer('Layer 1',newId(),frameId));
  if(state.activeLayerId===id||!state.layers.some(layer=>layer.id===state.activeLayerId))selectFrame(state,state.activeFrameId);return state;
}
export function reorderLayer(input,id,delta){
  const state=normalizeEndoState(input),layer=state.layers.find(item=>item.id===id);if(!layer)return state;
  const positions=state.layers.map((item,index)=>item.frameId===layer.frameId?index:-1).filter(index=>index>=0),index=positions.findIndex(position=>state.layers[position].id===id),target=Math.max(0,Math.min(positions.length-1,index+Math.trunc(delta)));
  if(index!==target){const items=positions.map(position=>state.layers[position]),[moved]=items.splice(index,1);if(moved.kind==='adjustment')delete moved.clipToLayerId;items.splice(target,0,moved);positions.forEach((position,i)=>state.layers[position]=items[i]);}return state;
}
export function translateStroke(stroke,dx,dy){
  const translated=clone(stroke);translated.points=translated.points.map(point=>({...point,x:point.x+dx,y:point.y+dy}));
  if(translated.tool?.mode&&translated.tool.mode!=='none'){const region=translated.tool.region??{x:0,y:0,width:960,height:850};translated.tool.region={...region,x:region.x+dx,y:region.y+dy};}return translated;
}
export function duplicateLayer(input,id,{newLayerId=newId()}={}){
  const state=normalizeEndoState(input),index=state.layers.findIndex(layer=>layer.id===id);if(index<0)return state;if(state.layers.length>=MAX_LAYERS)fail('The Artboard already has 512 layers.');
  const layer=clone(state.layers[index]);layer.id=newLayerId;layer.name=(layer.name+' Copy').slice(0,80);if(layer.filter)layer.filter.id=newId();state.layers.splice(index+1,0,layer);
  for(const stroke of state.strokes.filter(stroke=>stroke.layerId===id))state.strokes.push({...clone(stroke),layerId:layer.id,number:state.nextNumber++});state.activeLayerId=layer.id;state.selected=null;state.selection=[];return state;
}
export function duplicateSelectedStrokes(input,indices,{dx=20,dy=20,targetLayerId}={}){
  const state=normalizeEndoState(input),chosen=new Set(indices),added=[];if(targetLayerId&&!state.layers.some(layer=>layer.id===targetLayerId&&layer.kind==='paint'))fail('The destination layer is invalid.');
  for(const [index,stroke]of state.strokes.entries())if(chosen.has(index)){const copy=translateStroke(stroke,dx,dy);copy.number=state.nextNumber++;if(targetLayerId)copy.layerId=targetLayerId;added.push(copy);}
  state.selection=added.map((_,index)=>state.strokes.length+index);state.strokes.push(...added);state.selected=state.selection.at(-1)??null;return state;
}
export function moveSelectionToLayer(input,indices,targetLayerId){
  const state=normalizeEndoState(input),target=state.layers.find(layer=>layer.id===targetLayerId&&layer.kind==='paint');if(!target)fail('The destination layer is invalid.');
  for(const index of new Set(indices))if(state.strokes[index])state.strokes[index].layerId=targetLayerId;state.activeLayerId=targetLayerId;state.activeFrameId=target.frameId;return state;
}
