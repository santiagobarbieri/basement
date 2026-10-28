import {toolTransforms, transformPoint} from './symmetry.js';
function visibleLayerIds(state) {
  return Array.isArray(state.layers) ? new Set(state.layers.filter(layer => layer.visible !== false && (layer.opacity ?? 1) > 0).map(layer => layer.id)) : null;
}
function visibleStroke(stroke, visible) { return !visible || visible.has(stroke.layerId ?? 'layer-1'); }
export function documentBounds(state) {
  if (!state.infinite || !state.strokes.length) return {x:0,y:0,width:960,height:850};
  const visible = visibleLayerIds(state);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for (const stroke of state.strokes) {
    if (!stroke.points.length || stroke.operation === 'erase' || !visibleStroke(stroke, visible)) continue;
    const transforms=toolTransforms(stroke.tool,960,850,stroke.points[0]),pad=stroke.settings.width+16;
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for (const point of stroke.points) for (const transform of transforms) {
      const p=transformPoint(point,transform);
      left=Math.min(left,p.x-pad);top=Math.min(top,p.y-pad);right=Math.max(right,p.x+pad);bottom=Math.max(bottom,p.y+pad);
    }
    const region=stroke.tool?.mode!=='none'&&stroke.tool?.region;
    if (region) { left=Math.max(left,region.x);top=Math.max(top,region.y);right=Math.min(right,region.x+region.width);bottom=Math.min(bottom,region.y+region.height); }
    if (!(right>left&&bottom>top)) continue;
    x0=Math.min(x0,left);y0=Math.min(y0,top);x1=Math.max(x1,right);y1=Math.max(y1,bottom);
  }
  if (!Number.isFinite(x0)) return {x:0,y:0,width:960,height:850};
  return {x:Math.floor(x0),y:Math.floor(y0),width:Math.ceil(x1)-Math.floor(x0),height:Math.ceil(y1)-Math.floor(y0)};
}

export function exportState(state) {
  if (state.exportTarget==='selection') {
    const selected=new Set(state.selection||[]),visible=visibleLayerIds(state);
    const paint=state.strokes.filter((stroke,index)=>selected.has(index)&&stroke.operation!=='erase'&&visibleStroke(stroke,visible));
    if (!paint.length) throw Error('Seleccioná uno o más trazos para exportar.');
    // Keep the original erase gestures of those layers so selected artwork
    // exports with the same holes as the editable composition.
    const layers=new Set(paint.map(stroke=>stroke.layerId??'layer-1'));
    const strokes=state.strokes.filter((stroke,index)=>visibleStroke(stroke,visible)&&(selected.has(index)||(stroke.operation==='erase'&&layers.has(stroke.layerId??'layer-1'))));
    return {...state,infinite:true,strokes};
  }
  return state;
}
export function exportGeometry(original) {
  const state=exportState(original),frame=(state.frames||[]).find(frame=>frame.id===state.exportTarget);
  const bounds=frame?{x:frame.x,y:frame.y,width:Math.ceil(frame.width),height:Math.ceil(frame.height)}:documentBounds(state),width=bounds.width*2,height=bounds.height*2;
  if (!(width>0&&height>0)||![bounds.x,bounds.y,width,height].every(Number.isFinite)) throw Error('El área de exportación no es válida.');
  if (width>8192||height>8192||width*height>16000000) throw Error('El área es demasiado grande para PNG. Elegí un marco más pequeño o exportá una selección.');
  return {...bounds,width,height,...(frame?{name:frame.name}:{})};
}
