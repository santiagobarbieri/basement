import {toolTransforms,transformPoint} from './symmetry.js';
export function documentBounds(state){
 if(!state.infinite||!state.strokes.length)return {x:0,y:0,width:960,height:850};
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const stroke of state.strokes){if(!stroke.points.length)continue;const transforms=toolTransforms(stroke.tool,960,850,stroke.points[0]),pad=stroke.settings.width+16;
  for(const point of stroke.points)for(const t of transforms){const p=transformPoint(point,t);x0=Math.min(x0,p.x-pad);y0=Math.min(y0,p.y-pad);x1=Math.max(x1,p.x+pad);y1=Math.max(y1,p.y+pad);}
 }
 if(!Number.isFinite(x0))return {x:0,y:0,width:960,height:850};
 return {x:Math.floor(x0),y:Math.floor(y0),width:Math.ceil(x1)-Math.floor(x0),height:Math.ceil(y1)-Math.floor(y0)};
}

export function exportState(state){
 if(state.exportTarget==='selection'){
  const ids=new Set(state.selection||[]),strokes=state.strokes.filter((_,i)=>ids.has(i));
  if(!strokes.length)throw Error('Seleccioná uno o más trazos para exportar.');
  return {...state,infinite:true,strokes};
 }
 return state;
}
export function exportGeometry(original){
 const state=exportState(original),frame=(state.frames||[]).find(f=>f.id===state.exportTarget);
 const bounds=frame?{x:frame.x,y:frame.y,width:Math.ceil(frame.width),height:Math.ceil(frame.height)}:documentBounds(state),width=bounds.width*2,height=bounds.height*2;
 if(!(width>0&&height>0)||![bounds.x,bounds.y,width,height].every(Number.isFinite))throw Error('El área de exportación no es válida.');
 if(width>8192||height>8192||width*height>16000000)throw Error('El área es demasiado grande para PNG. Elegí un marco más pequeño o exportá una selección.');
 return {...bounds,width,height,...(frame?{name:frame.name}:{})};
}
