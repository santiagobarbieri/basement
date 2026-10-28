import {normalizeEndoState,activeFrame} from './endo-model.js';
export const MENT_VERSION = 2;
export function editableContent(input) {
  const state=normalizeEndoState(input);
  return {
    legacyExportAreas:state.legacyExportAreas?structuredClone(state.legacyExportAreas):undefined,frameVersion:state.frameVersion,frames:structuredClone(state.frames),activeFrameId:state.activeFrameId,
    view:state.view?{...state.view}:undefined,infinite:state.infinite===true,
    scene:{...state.scene},defaults:{...state.defaults},tool:structuredClone(state.tool),nextNumber:state.nextNumber,
    layers:structuredClone(state.layers),activeLayerId:state.activeLayerId,
    strokes:state.strokes.map(stroke=>({number:stroke.number,layerId:stroke.layerId,operation:stroke.operation,settings:{...stroke.settings},tool:structuredClone(stroke.tool),points:stroke.points.map(point=>({x:point.x,y:point.y,time:point.time,pressure:point.pressure,finish:point.finish===true}))})),
  };
}
export function documentSignature(state){const content=editableContent(state);delete content.view;return JSON.stringify(content);}
export function serializeMent(state,{id,name='ENDO',preview=null,savedAt=new Date().toISOString()}){
  const content=editableContent(state),frame=activeFrame(content);
  return JSON.stringify({format:'basement.ment',version:MENT_VERSION,savedAt,artboard:{
    id,name,studio:'endo',infinite:true,width:frame.width,height:frame.height,background:frame.background,
    layers:content.layers.map(layer=>{
      const strokes=content.strokes.filter(stroke=>stroke.layerId===layer.id);
      return {...layer,type:layer.kind==='adjustment'?'endo.adjustment':strokes.some(stroke=>stroke.settings.brush&&stroke.settings.brush!=='cromo')?'endo.surface':'endo.cromo',strokes};
    }),
    settings:{legacyExportAreas:content.legacyExportAreas,frameVersion:content.frameVersion,frames:content.frames,activeFrameId:content.activeFrameId,view:content.view,infinite:true,scene:content.scene,defaults:content.defaults,tool:content.tool,nextNumber:content.nextNumber,activeLayerId:content.activeLayerId,strokeOrder:content.strokes.map(stroke=>stroke.number)},preview,
  }});
}
