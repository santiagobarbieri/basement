import {addFrame,removeFrame,duplicateFrame,moveFrame,resizeFrame,MIN_FRAME_SIZE,MAX_FRAME_SIZE,MAX_FRAMES} from './endo-model.js';
import {moveFrameBounds,resizeFrameBounds} from './endo-transform.js';

const handles={nw:[0,0],n:[.5,0],ne:[1,0],e:[1,.5],se:[1,1],s:[.5,1],sw:[0,1],w:[0,.5]};
export function createFrameEditor({art,viewport,camera,toWorld,getState,apply,onActivate,onPaint,getBusy,hitStroke,preview,commit}){
 const list=document.querySelector('#frame-list'),button=document.querySelector('#draw-frame'),papers=document.querySelector('#frame-backgrounds');
 const keys=['x','y','width','height'],fields=Object.fromEntries(keys.map(key=>[key,document.querySelector('#frame-'+key)]));
 const ui=document.createElement('div');ui.id='frame-transform-ui';viewport.append(ui);
 const labels=document.createElement('div');labels.className='frame-labels';ui.append(labels);
 const box=document.createElement('div');box.className='frame-transform-box';box.hidden=true;ui.append(box);
 for(const [handle,[x,y]]of Object.entries(handles)){
  const node=document.createElement('button');node.type='button';node.dataset.frameHandle=handle;
  node.title='Resize artboard · Shift: proportions · Alt: center';node.setAttribute('aria-label','Resize artboard '+handle);
  node.style.left=x*100+'%';node.style.top=y*100+'%';box.append(node);
 }
 let drag=null,selectedId=null,lastList='',previewRequest=0;
 const current=()=>{const state=getState();return state.frames.find(f=>f.id===state.activeFrameId)||state.frames[0];};
 const clampSize=value=>Math.round(Math.max(MIN_FRAME_SIZE,Math.min(MAX_FRAME_SIZE,value)));
 function setMode(mode){
  viewport.dataset.mode=mode;
  for(const b of document.querySelectorAll('.cursor-modes button'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  button.setAttribute('aria-pressed',String(mode==='frame'));
 }
 function deselect(){selectedId=null;delete viewport.dataset.frameSelection;box.hidden=true;onPaint();}
 function select(id){
  selectedId=id;viewport.dataset.frameSelection=id;setMode('select');onActivate(id);
  document.dispatchEvent(new CustomEvent('endo-frame-selected',{detail:{id}}));onPaint();
 }
 function focus(frame){
  const inset=window.basementCanvasInsets?.()||{left:0,right:0,top:0,bottom:0};
  const w=viewport.clientWidth-inset.left-inset.right,h=viewport.clientHeight-inset.top-inset.bottom;
  const scale=Math.max(.1,Math.min(1,(w-100)/frame.width,(h-100)/frame.height));
  onActivate(frame.id,{focus:true,view:{scale,x:inset.left+(w-frame.width*scale)/2-frame.x*scale,y:inset.top+(h-frame.height*scale)/2-frame.y*scale}});
 }
 function refresh(){
  const state=getState(),frame=current(),busy=getBusy()||!!drag;if(!frame)return;
  if(selectedId&&((state.selection||[]).length||!state.frames.some(f=>f.id===selectedId&&f.id===state.activeFrameId)||!['frame','select'].includes(viewport.dataset.mode))){
   selectedId=null;delete viewport.dataset.frameSelection;
  }
  button.disabled=busy;button.setAttribute('aria-pressed',String(viewport.dataset.mode==='frame'));
  document.querySelector('#new-frame-tool').disabled=busy;
  for(const key of keys){fields[key].disabled=busy;if(document.activeElement!==fields[key])fields[key].value=Math.round(frame[key]);}
  const name=document.querySelector('#frame-name');name.disabled=busy;if(document.activeElement!==name)name.value=frame.name;
  const transparent=document.querySelector('#frame-transparent');transparent.disabled=busy;transparent.checked=frame.background===null;
  const background=document.querySelector('#frame-background');background.disabled=busy||transparent.checked;background.value=frame.background||'#ffffff';
  document.querySelector('#frame-add').disabled=busy||state.frames.length>=MAX_FRAMES;
  document.querySelector('#frame-duplicate').disabled=busy||state.frames.length>=MAX_FRAMES;
  document.querySelector('#frame-delete').disabled=busy||state.frames.length<=1;
  document.querySelector('#frame-size-hint').textContent=MIN_FRAME_SIZE+'–'+MAX_FRAME_SIZE+' px per side · Canvas size crops; strokes keep their size · Shift: proportions · Alt: center';
  document.querySelector('#repeat-frame-name').textContent='Repeats inside '+frame.name+'. The artboard defines the center and boundaries.';
  const optionsSignature=JSON.stringify(state.frames.map(f=>[f.id,f.name]));
  for(const id of ['active-frame-select','export-target']){
   const select=document.querySelector('#'+id),value=id==='active-frame-select'?state.activeFrameId:select.value;
   if(select.dataset.options!==optionsSignature){
    select.replaceChildren();for(const f of state.frames){const option=document.createElement('option');option.value=f.id;option.textContent=f.name;select.append(option);}
    select.dataset.options=optionsSignature;
   }
   select.value=state.frames.some(f=>f.id===value)?value:state.activeFrameId;select.disabled=busy;
  }
  const signature=JSON.stringify([state.activeFrameId,state.frames,busy]);
  if(signature!==lastList){
   lastList=signature;list.replaceChildren();
   for(const f of state.frames){
    const row=document.createElement('div');row.className='frame-entry';row.classList.toggle('active',f.id===state.activeFrameId);row.dataset.frameId=f.id;
    const entry=document.createElement('button');entry.type='button';entry.textContent=f.name+' · '+f.width+' × '+f.height;
    entry.setAttribute('aria-pressed',String(f.id===state.activeFrameId));entry.disabled=busy;entry.addEventListener('click',()=>select(f.id));
    const fit=document.createElement('button');fit.type='button';fit.textContent='↗';fit.title='Focus '+f.name;fit.setAttribute('aria-label',fit.title);fit.disabled=busy;
    fit.addEventListener('click',()=>{select(f.id);focus(f);});row.append(entry,fit);list.append(row);
   }
  }
 }
 function toggle(){
  if(getBusy()||drag)return;
  setMode(viewport.dataset.mode==='frame'?'select':'frame');selectedId=current().id;viewport.dataset.frameSelection=selectedId;
  refresh();onPaint();art.focus({preventScroll:true});
 }
 document.addEventListener('endo-create-artboard',event=>{
  if(getBusy()||drag||window.basementSessionBlocked)return;
  const size=event.detail||{};if(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<64||size.height<64||size.width>2048||size.height>2048)return;
  const frame=current();apply(addFrame(getState(),{name:'Artboard '+(getState().frames.length+1),x:frame.x+frame.width+80,y:frame.y,width:size.width,height:size.height,background:null}));select(current().id);focus(current());
 });
 button.addEventListener('click',toggle);document.querySelector('#new-frame-tool').addEventListener('click',()=>button.click());
 document.querySelector('#frame-add').addEventListener('click',()=>{
  const frame=current();apply(addFrame(getState(),{name:'Artboard '+(getState().frames.length+1),x:frame.x+frame.width+80,y:frame.y,width:960,height:850,background:null}));
  select(current().id);focus(current());
 });
 document.querySelector('#frame-duplicate').addEventListener('click',()=>{apply(duplicateFrame(getState(),current().id));select(current().id);focus(current());});
 document.querySelector('#frame-delete').addEventListener('click',()=>{apply(removeFrame(getState(),current().id));select(current().id);focus(current());});
 document.querySelector('#active-frame-select').addEventListener('change',event=>{
  const frame=getState().frames.find(f=>f.id===event.target.value);if(frame){select(frame.id);focus(frame);}
 });
 document.querySelector('#export-target').addEventListener('change',()=>document.querySelector('#export-target').dispatchEvent(new Event('endo-export-frame')));
 document.querySelector('#frame-name').addEventListener('change',event=>{
  const state=getState();state.frames.find(f=>f.id===state.activeFrameId).name=event.target.value.trim()||'Artboard';apply(state);
 });
 for(const key of keys)fields[key].addEventListener('change',()=>{
  const value=fields[key].valueAsNumber;if(!Number.isFinite(value)){refresh();return;}const frame=current();
  if(key==='x'||key==='y')apply(moveFrame(getState(),frame.id,{x:key==='x'?Math.max(-1e7,Math.min(1e7,value)):frame.x,y:key==='y'?Math.max(-1e7,Math.min(1e7,value)):frame.y}));
  else apply(resizeFrame(getState(),frame.id,{[key]:clampSize(value)}));
 });
 document.querySelector('#frame-transparent').addEventListener('change',event=>{
  const state=getState();state.frames.find(f=>f.id===state.activeFrameId).background=event.target.checked?null:document.querySelector('#frame-background').value;apply(state);
 });
 document.querySelector('#frame-background').addEventListener('change',event=>{
  const state=getState();state.frames.find(f=>f.id===state.activeFrameId).background=event.target.value;apply(state);
 });
 function nextState(gesture){
  return (gesture.kind==='move'?moveFrame:resizeFrame)(gesture.before,gesture.frame.id,gesture.region);
 }
 function paintPreview(){
  previewRequest=0;if(!drag)return;
  if(drag.moved&&drag.kind!=='new')preview(nextState(drag));else onPaint();
 }
 function update(event){
  const p=toWorld(event.clientX,event.clientY),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
  drag.moved||=Math.hypot(dx,dy)*camera.scale>2;
  if(drag.kind==='move')drag.region=moveFrameBounds(drag.frame,dx,dy,event);
  else if(drag.kind==='new')drag.region={x:Math.round(Math.min(drag.start.x,p.x)),y:Math.round(Math.min(drag.start.y,p.y)),width:clampSize(Math.abs(dx)),height:clampSize(Math.abs(dy))};
  else drag.region=resizeFrameBounds(drag.frame,drag.kind,dx,dy,event);
  if(!previewRequest)previewRequest=requestAnimationFrame(paintPreview);
 }
 function start(event,frame,kind){
  event.preventDefault();event.stopImmediatePropagation();select(frame.id);if(kind==='new')setMode('frame');
  const before=getState();
  drag={id:event.pointerId,start:toWorld(event.clientX,event.clientY),before,frame:{...frame},kind,moved:false,region:{...frame}};
  if(kind==='new')drag.region={x:Math.round(drag.start.x),y:Math.round(drag.start.y),width:64,height:64};
  art.focus({preventScroll:true});art.setPointerCapture(event.pointerId);refresh();onPaint();
 }
 // Pan captures first in zoom.js. Claim only artboard gestures, before paint/selection.
 viewport.addEventListener('pointerdown',event=>{
  if(event.button!==0||drag||getBusy()||window.basementSessionBlocked||document.querySelector('dialog[open]'))return;
  const title=event.target.closest('[data-frame-title]'),handle=event.target.closest('[data-frame-handle]'),state=getState();
  if(title){const frame=state.frames.find(f=>f.id===title.dataset.frameTitle);if(frame)start(event,frame,'move');return;}
  if(handle){start(event,current(),handle.dataset.frameHandle);return;}
  if(event.target!==art||!['select','frame'].includes(viewport.dataset.mode))return;
  const p=toWorld(event.clientX,event.clientY),frame=[...state.frames].reverse().find(f=>p.x>=f.x&&p.y>=f.y&&p.x<=f.x+f.width&&p.y<=f.y+f.height);
  if(!frame){if(viewport.dataset.mode==='frame')start(event,current(),'new');else deselect();return;}
  const tolerance=6/camera.scale,border=Math.min(p.x-frame.x,frame.x+frame.width-p.x,p.y-frame.y,frame.y+frame.height-p.y)<tolerance;
  if(viewport.dataset.mode==='frame'||border){start(event,frame,'move');return;}
  if(frame.id!==state.activeFrameId)onActivate(frame.id);
  if(!event.shiftKey&&hitStroke(event)===null)start(event,frame,'move');else deselect();
 },true);
 art.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();update(event);
 },true);
 function finish(event){
  if(drag?.id!==event.pointerId)return;
  event.preventDefault();event.stopImmediatePropagation();if(event.type==='pointerup')update(event);
  const gesture=drag;drag=null;cancelAnimationFrame(previewRequest);previewRequest=0;
  if(art.hasPointerCapture(gesture.id))art.releasePointerCapture(gesture.id);
  if(event.type==='pointerup'&&gesture.moved){
   const next=gesture.kind==='new'?addFrame(gesture.before,{...gesture.region,name:'Artboard '+(gesture.before.frames.length+1),background:null}):nextState(gesture);
   commit(gesture.before,next);selectedId=current().id;viewport.dataset.frameSelection=selectedId;
  }else preview(gesture.before);
  setMode('select');refresh();onPaint();
 }
 for(const type of ['pointerup','pointercancel','lostpointercapture'])art.addEventListener(type,finish,true);
 document.addEventListener('keydown',event=>{
  if(window.basementEndoPopoverOpen||event.target.closest('input,select,textarea,[contenteditable=true]')||document.querySelector('dialog[open]')||window.basementSessionBlocked)return;
  if(event.key==='Escape'&&drag){
   finish({pointerId:drag.id,type:'pointercancel',preventDefault(){},stopImmediatePropagation(){}});
   event.preventDefault();event.stopImmediatePropagation();art.focus({preventScroll:true});return;
  }
  if(drag||getBusy()||!selectedId||viewport.dataset.mode!=='select'||event.target.closest('[role=menu],[role=tablist]'))return;
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(delta&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
   event.preventDefault();event.stopImmediatePropagation();const step=event.shiftKey?10:1;
   apply(moveFrame(getState(),selectedId,moveFrameBounds(current(),delta[0]*step,delta[1]*step)));onPaint();
  }else if(event.key==='Delete'||event.key==='Backspace'){
   event.preventDefault();event.stopImmediatePropagation();document.querySelector('#frame-delete').click();
  }else if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='j'){
   event.preventDefault();event.stopImmediatePropagation();document.querySelector('#frame-duplicate').click();
  }else if(event.key==='Escape'){deselect();event.preventDefault();event.stopImmediatePropagation();}
 },true);
 function draw(ctx){
  const state=getState(),q=camera.scale;ctx.save();ctx.setTransform(q,0,0,q,camera.x,camera.y);ctx.lineWidth=1/q;
  for(const frame of state.frames){ctx.strokeStyle=frame.id===selectedId?'#678cfa':'#707070';ctx.strokeRect(frame.x,frame.y,frame.width,frame.height);}
  if(drag?.kind==='new'){ctx.setLineDash([5/q,4/q]);ctx.strokeStyle='#678cfa';ctx.strokeRect(drag.region.x,drag.region.y,drag.region.width,drag.region.height);}ctx.restore();
  const existing=new Map([...papers.children].map(node=>[node.dataset.frameId,node])),titles=new Map([...labels.children].map(node=>[node.dataset.frameTitle,node]));
  for(const frame of state.frames){
   let node=existing.get(frame.id);
   if(!node){node=document.createElement('div');node.className='frame-paper';node.dataset.frameId=frame.id;papers.append(node);}
   existing.delete(frame.id);
   Object.assign(node.style,{left:frame.x*q+camera.x+'px',top:frame.y*q+camera.y+'px',width:frame.width*q+'px',height:frame.height*q+'px',backgroundColor:frame.background||''});
   node.classList.toggle('transparent',frame.background===null);
   let title=titles.get(frame.id);
   if(!title){
    title=document.createElement('button');title.type='button';title.dataset.frameTitle=frame.id;
    title.addEventListener('dblclick',()=>focus(getState().frames.find(f=>f.id===frame.id)));
    title.addEventListener('keydown',e=>{if(e.key==='Enter'){select(frame.id);art.focus({preventScroll:true});}});
    labels.append(title);
   }
   titles.delete(frame.id);title.textContent=frame.name+' · '+frame.width+' × '+frame.height;
   title.title='Drag to move '+frame.name+' · Double click to fit';title.setAttribute('aria-label','Select and move '+frame.name);
   Object.assign(title.style,{left:frame.x*q+camera.x+'px',top:frame.y*q+camera.y-24+'px',maxWidth:Math.max(130,frame.width*q)+'px'});
   title.classList.toggle('selected',frame.id===selectedId);
  }
  for(const node of [...existing.values(),...titles.values()])node.remove();
  const frame=state.frames.find(f=>f.id===selectedId);
  box.hidden=!frame||!['select','frame'].includes(viewport.dataset.mode);
  if(!box.hidden)Object.assign(box.style,{left:frame.x*q+camera.x+'px',top:frame.y*q+camera.y+'px',width:frame.width*q+'px',height:frame.height*q+'px'});
 }
 return{refresh,draw,focus,select,deselect,get selection(){return selectedId;},get dragging(){return !!drag;}};
}
