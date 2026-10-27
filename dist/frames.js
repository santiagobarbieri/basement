import {documentBounds} from './document-bounds.js';
import {restoreCamera} from './zoom.js';
export function createFrames({frames,art,viewport,camera,toWorld,getState,commit,onChange,onPaint,getSelection,getBusy}){
 const list=document.querySelector('#frame-list'),drawButton=document.querySelector('#draw-frame'),fromSelection=document.querySelector('#frame-from-selection'),target=document.querySelector('#export-target');
 let selectedFrame=null,drag=null;
 function create(region){if(frames.length>=50)return;commit(()=>{const frame={id:crypto.randomUUID(),name:'Area '+(frames.length+1),...region};frames.push(frame);selectedFrame=frame.id;target.value='all';});target.value=selectedFrame;onChange();}
 function refresh(){
  if(!frames.some(f=>f.id===selectedFrame))selectedFrame=null;
  drawButton.setAttribute('aria-pressed',String(viewport.dataset.mode==='frame'));drawButton.disabled=frames.length>=50||!!drag||getBusy();fromSelection.disabled=!getSelection().length||frames.length>=50||!!drag||getBusy();
  const current=target.value;target.replaceChildren();for(const [value,text] of [['all','Todo el contenido'],['selection','Selección de trazos'],...frames.map(f=>[f.id,f.name])]){const option=document.createElement('option');option.value=value;option.textContent=text;target.append(option)}target.value=[...target.options].some(o=>o.value===current)?current:'all';
  list.replaceChildren();
  for(const frame of frames){
   const row=document.createElement('div');row.className='frame-row';row.classList.toggle('active',frame.id===selectedFrame);
   const name=document.createElement('input');name.value=frame.name;name.maxLength=80;name.setAttribute('aria-label','Nombre del marco');
   name.addEventListener('focus',()=>{selectedFrame=frame.id;onPaint()});name.addEventListener('change',()=>commit(()=>{frame.name=name.value.trim()||'Area';}));
   const locate=document.createElement('button');locate.type='button';locate.textContent='↗';locate.title='Ver '+frame.name;locate.setAttribute('aria-label',locate.title);locate.addEventListener('click',()=>{selectedFrame=frame.id;const scale=Math.min(viewport.clientWidth/(frame.width+60),viewport.clientHeight/(frame.height+60),2);restoreCamera({scale,x:viewport.clientWidth/2-(frame.x+frame.width/2)*Math.max(.1,scale),y:viewport.clientHeight/2-(frame.y+frame.height/2)*Math.max(.1,scale)});target.value=frame.id;onChange()});
   const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Quitar marco';remove.setAttribute('aria-label','Quitar '+frame.name);remove.addEventListener('click',()=>commit(()=>{frames.splice(frames.indexOf(frame),1)}));
   for(const control of [name,locate,remove])control.disabled=getBusy()||!!drag;row.append(name,locate,remove);
   if(frame.id===selectedFrame){const controls=document.createElement('div');controls.className='frame-dimensions';for(const [key,label] of [['x','X'],['y','Y'],['width','W'],['height','H']]){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type='number';input.disabled=getBusy()||!!drag;input.step=1;input.value=Math.round(frame[key]);input.setAttribute('aria-label',label+' del marco');input.addEventListener('change',()=>{if(!Number.isFinite(input.valueAsNumber))return;commit(()=>{frame[key]=Math.max(key==='width'||key==='height'?1:-1e7,Math.min(1e7,input.valueAsNumber))})});wrap.append(input);controls.append(wrap)}row.append(controls)}
   list.append(row);
  }
 }
 drawButton.addEventListener('click',()=>{viewport.dataset.mode=viewport.dataset.mode==='frame'?'draw':'frame';for(const b of document.querySelectorAll('.cursor-modes button'))b.setAttribute('aria-pressed',String(b.dataset.mode===viewport.dataset.mode));onChange()});
 fromSelection.addEventListener('click',()=>{if(getSelection().length)create(documentBounds({...getState(),infinite:true,strokes:getSelection()}))});
 target.addEventListener('change',()=>{selectedFrame=frames.some(f=>f.id===target.value)?target.value:null;onChange()});
 art.addEventListener('pointerdown',e=>{if(viewport.dataset.mode!=='frame'||e.button!==0||drag)return;e.preventDefault();const point=toWorld(e.clientX,e.clientY);drag={id:e.pointerId,start:point,end:point};art.setPointerCapture(e.pointerId);onChange();});
 art.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;drag.end=toWorld(e.clientX,e.clientY);onPaint()});
 function region(){return {x:Math.min(drag.start.x,drag.end.x),y:Math.min(drag.start.y,drag.end.y),width:Math.abs(drag.end.x-drag.start.x),height:Math.abs(drag.end.y-drag.start.y)}}
 function finish(e){if(drag?.id!==e.pointerId)return;const box=region(),id=drag.id;drag=null;if(art.hasPointerCapture(id))art.releasePointerCapture(id);if(e.type==='pointerup'&&box.width*camera.scale>=6&&box.height*camera.scale>=6)create(box);viewport.dataset.mode='draw';for(const b of document.querySelectorAll('.cursor-modes button'))b.setAttribute('aria-pressed',String(b.dataset.mode==='draw'));onChange();}
 for(const type of ['pointerup','pointercancel','lostpointercapture'])art.addEventListener(type,finish);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){const id=drag.id;drag=null;if(art.hasPointerCapture(id))art.releasePointerCapture(id);viewport.dataset.mode='draw';onChange()}});
 function draw(ctx){ctx.save();ctx.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);ctx.lineWidth=1/camera.scale;ctx.font=12/camera.scale+'px Arial';ctx.setLineDash([6/camera.scale,4/camera.scale]);for(const frame of [...frames,...(drag?[{...region(),id:'draft',name:'Area'}]:[])]){ctx.strokeStyle=frame.id===selectedFrame||frame.id==='draft'?'#0055ff':'#737373';ctx.fillStyle=ctx.strokeStyle;ctx.strokeRect(frame.x,frame.y,frame.width,frame.height);ctx.fillText(frame.name,frame.x,frame.y-6/camera.scale)}ctx.restore();}
 return {refresh,draw,get dragging(){return !!drag}};
}
