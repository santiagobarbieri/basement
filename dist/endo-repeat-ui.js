import {toolRegion} from './symmetry.js';

export function createRepeatArea({tool,art,viewport,camera,toWorld,commit,onPaint,getBusy,getSelectionBounds}) {
 const button=document.querySelector('#repeat-region-draw');
 const keys=['x','y','width','height'];
 const fields=Object.fromEntries(keys.map(key=>[key,document.querySelector('#repeat-'+key)]));
 let drag=null;
 const visible=()=>{
  const inset=Math.min(50,viewport.clientWidth/8,viewport.clientHeight/8);
  const p=toWorld(viewport.getBoundingClientRect().left+inset,viewport.getBoundingClientRect().top+inset);
  return {x:Math.round(p.x),y:Math.round(p.y),width:Math.round((viewport.clientWidth-inset*2)/camera.scale),height:Math.round((viewport.clientHeight-inset*2)/camera.scale)};
 };
 function refresh(){
  const box=toolRegion(tool),busy=getBusy()||!!drag;
  button.disabled=busy;button.setAttribute('aria-pressed',String(viewport.dataset.mode==='repeat-region'));
  for(const key of keys){const input=fields[key];input.disabled=busy;input.value=Math.round(box[key]);}
  document.querySelector('#repeat-region-selection').disabled=busy||!getSelectionBounds();
  for(const id of ['visible','reset'])document.querySelector('#repeat-region-'+id).disabled=busy;
  document.querySelector('#repeat-region-help').textContent=viewport.dataset.mode==='repeat-region'
   ?'Drag a new area, drag inside to move it, or drag a corner to resize. Esc cancels.'
   :'Repetition stays inside this area. Changes affect new strokes; existing strokes keep their own area.';
 }
 function set(region){commit(()=>{tool.region={...region,width:Math.max(1,region.width),height:Math.max(1,region.height)};});refresh();onPaint();}
 button.addEventListener('click',()=>{
  if(getBusy())return;
  viewport.dataset.mode=viewport.dataset.mode==='repeat-region'?'draw':'repeat-region';
  for(const item of document.querySelectorAll('.cursor-modes button'))item.setAttribute('aria-pressed',String(item.dataset.mode===viewport.dataset.mode));
  refresh();onPaint();art.focus({preventScroll:true});
 });
 document.querySelector('#repeat-region-visible').addEventListener('click',()=>set(visible()));
 document.querySelector('#repeat-region-selection').addEventListener('click',()=>{const bounds=getSelectionBounds();if(bounds)set(bounds);});
 document.querySelector('#repeat-region-reset').addEventListener('click',()=>set({x:0,y:0,width:960,height:850}));
 for(const key of keys)fields[key].addEventListener('change',()=>{
  const value=fields[key].valueAsNumber;if(!Number.isFinite(value)){refresh();return;}
  const box=toolRegion(tool);box[key]=Math.max(key==='width'||key==='height'?1:-1e7,Math.min(1e7,value));set(box);
 });
 art.addEventListener('pointerdown',event=>{
  if(event.button!==0||viewport.dataset.mode!=='repeat-region'||drag||getBusy())return;
  event.preventDefault();const start=toWorld(event.clientX,event.clientY),box=toolRegion(tool),tolerance=9/camera.scale;
  const corners=[['nw',box.x,box.y],['ne',box.x+box.width,box.y],['se',box.x+box.width,box.y+box.height],['sw',box.x,box.y+box.height]];
  const corner=tool.region&&corners.find(([,x,y])=>Math.hypot(start.x-x,start.y-y)<tolerance);
  const inside=tool.region&&start.x>=box.x&&start.y>=box.y&&start.x<=box.x+box.width&&start.y<=box.y+box.height;
  drag={id:event.pointerId,start,box,kind:corner?corner[0]:inside?'move':'new',region:{...box}};
  art.setPointerCapture(event.pointerId);onPaint();
 });
 art.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  const point=toWorld(event.clientX,event.clientY),dx=point.x-drag.start.x,dy=point.y-drag.start.y,b=drag.box;
  if(drag.kind==='move')drag.region={...b,x:b.x+dx,y:b.y+dy};
  else if(drag.kind==='new')drag.region={x:Math.min(drag.start.x,point.x),y:Math.min(drag.start.y,point.y),width:Math.abs(dx),height:Math.abs(dy)};
  else{
   const left=drag.kind.includes('w')?b.x+dx:b.x,right=drag.kind.includes('e')?b.x+b.width+dx:b.x+b.width;
   const top=drag.kind.includes('n')?b.y+dy:b.y,bottom=drag.kind.includes('s')?b.y+b.height+dy:b.y+b.height;
   drag.region={x:Math.min(left,right),y:Math.min(top,bottom),width:Math.abs(right-left),height:Math.abs(bottom-top)};
  }
  onPaint();
 });
 function end(event){
  if(drag?.id!==event.pointerId)return;
  const current=drag;drag=null;
  if(art.hasPointerCapture(current.id))art.releasePointerCapture(current.id);
  if(event.type==='pointerup'&&current.region.width*camera.scale>=8&&current.region.height*camera.scale>=8)set(current.region);
  viewport.dataset.mode='draw';for(const item of document.querySelectorAll('.cursor-modes button'))item.setAttribute('aria-pressed',String(item.dataset.mode==='draw'));
  refresh();onPaint();
 }
 for(const type of ['pointerup','pointercancel','lostpointercapture'])art.addEventListener(type,end);
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||event.target.closest('input,select,textarea'))return;
  if(drag){const id=drag.id;drag=null;if(art.hasPointerCapture(id))art.releasePointerCapture(id);}
  if(viewport.dataset.mode==='repeat-region'){viewport.dataset.mode='draw';for(const b of document.querySelectorAll('.cursor-modes button'))b.setAttribute('aria-pressed',String(b.dataset.mode==='draw'));refresh();onPaint();}
 });
 function draw(ctx){
  if(tool.mode==='none'&&viewport.dataset.mode!=='repeat-region'&&!drag)return;
  const box=drag?.region||toolRegion(tool),q=camera.scale;
  ctx.save();ctx.setTransform(q,0,0,q,camera.x,camera.y);ctx.strokeStyle='#4e7aff';ctx.lineWidth=1/q;ctx.setLineDash([6/q,4/q]);ctx.strokeRect(box.x,box.y,box.width,box.height);
  ctx.fillStyle='#4e7aff';ctx.font=11/q+'px Arial';ctx.fillText('Repeat area',box.x,box.y-7/q);
  if(viewport.dataset.mode==='repeat-region')for(const [x,y]of [[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]]){ctx.fillRect(x-3/q,y-3/q,6/q,6/q);}
  ctx.restore();
 }
 return {refresh,draw,visible,get dragging(){return !!drag;}};
}
