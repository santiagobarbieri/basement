import {addFrame,removeFrame,duplicateFrame,moveFrame,resizeFrame,MIN_FRAME_SIZE,MAX_FRAME_SIZE,MAX_FRAMES} from './endo-model.js';
export function createFrameEditor({art,viewport,camera,toWorld,getState,apply,onActivate,onPaint,getBusy}){
 const list=document.querySelector('#frame-list'),button=document.querySelector('#draw-frame'),papers=document.querySelector('#frame-backgrounds');
 const keys=['x','y','width','height'],fields=Object.fromEntries(keys.map(key=>[key,document.querySelector('#frame-'+key)]));
 let drag=null,lastList='',lastOptions='';
 const current=()=>{const state=getState();return state.frames.find(f=>f.id===state.activeFrameId)||state.frames[0];};
 const clampSize=value=>Math.round(Math.max(MIN_FRAME_SIZE,Math.min(MAX_FRAME_SIZE,value)));
 const focus=frame=>{const scale=Math.max(.1,Math.min(1,(viewport.clientWidth-100)/frame.width,(viewport.clientHeight-100)/frame.height));onActivate(frame.id,{focus:true,view:{scale,x:(viewport.clientWidth-frame.width*scale)/2-frame.x*scale,y:(viewport.clientHeight-frame.height*scale)/2-frame.y*scale}});};
 function refresh(){
  const state=getState(),frame=current(),busy=getBusy()||!!drag;if(!frame)return;
  button.disabled=busy;button.setAttribute('aria-pressed',String(viewport.dataset.mode==='frame'));
  document.querySelector('#new-frame-tool').disabled=busy;
  for(const key of keys){fields[key].disabled=busy;if(document.activeElement!==fields[key])fields[key].value=Math.round(frame[key]);}
  const name=document.querySelector('#frame-name');name.disabled=busy;if(document.activeElement!==name)name.value=frame.name;
  const transparent=document.querySelector('#frame-transparent');transparent.disabled=busy;transparent.checked=frame.background===null;
  const background=document.querySelector('#frame-background');background.disabled=busy||transparent.checked;background.value=frame.background||'#ffffff';
  document.querySelector('#frame-add').disabled=busy||state.frames.length>=MAX_FRAMES;document.querySelector('#frame-duplicate').disabled=busy||state.frames.length>=MAX_FRAMES;document.querySelector('#frame-delete').disabled=busy||state.frames.length<=1;
  document.querySelector('#frame-size-hint').textContent=MIN_FRAME_SIZE+'–'+MAX_FRAME_SIZE+' px per side · Export 2× · '+frame.width*2+' × '+frame.height*2+' px';
  document.querySelector('#repeat-frame-name').textContent='Repeats inside '+frame.name+'. The frame defines the center and boundaries.';
  const optionsSignature=JSON.stringify(state.frames.map(f=>[f.id,f.name]));
  for(const id of ['active-frame-select','export-target']){
   const select=document.querySelector('#'+id),value=id==='active-frame-select'?state.activeFrameId:select.value;
   if(select.dataset.options!==optionsSignature){select.replaceChildren();for(const f of state.frames){const option=document.createElement('option');option.value=f.id;option.textContent=f.name;select.append(option);}select.dataset.options=optionsSignature;}
   select.value=state.frames.some(f=>f.id===value)?value:state.activeFrameId;select.disabled=busy;
  }
  const signature=JSON.stringify([state.activeFrameId,state.frames,busy]);
  if(signature!==lastList){lastList=signature;list.replaceChildren();for(const f of state.frames){const row=document.createElement('div');row.className='frame-entry';row.classList.toggle('active',f.id===state.activeFrameId);row.dataset.frameId=f.id;const select=document.createElement('button');select.type='button';select.textContent=f.name+' · '+f.width+' × '+f.height;select.setAttribute('aria-pressed',String(f.id===state.activeFrameId));select.disabled=busy;select.addEventListener('click',()=>onActivate(f.id));const fit=document.createElement('button');fit.type='button';fit.textContent='↗';fit.title='Focus '+f.name;fit.setAttribute('aria-label',fit.title);fit.disabled=busy;fit.addEventListener('click',()=>focus(f));row.append(select,fit);list.append(row);}}
 }
 function toggle(){if(getBusy())return;viewport.dataset.mode=viewport.dataset.mode==='frame'?'draw':'frame';for(const b of document.querySelectorAll('.cursor-modes button'))b.setAttribute('aria-pressed',String(b.dataset.mode===viewport.dataset.mode));refresh();onPaint();art.focus({preventScroll:true});}
 button.addEventListener('click',toggle);document.querySelector('#new-frame-tool').addEventListener('click',()=>button.click());
 document.querySelector('#frame-add').addEventListener('click',()=>{const frame=current();apply(addFrame(getState(),{x:frame.x+frame.width+80,y:frame.y,width:960,height:850,background:null}));focus(current());});
 document.querySelector('#frame-duplicate').addEventListener('click',()=>{apply(duplicateFrame(getState(),current().id));focus(current());});
 document.querySelector('#frame-delete').addEventListener('click',()=>{apply(removeFrame(getState(),current().id));focus(current());});
 document.querySelector('#active-frame-select').addEventListener('change',event=>{const frame=getState().frames.find(f=>f.id===event.target.value);if(frame)focus(frame);});
 document.querySelector('#export-target').addEventListener('change',()=>document.querySelector('#export-target').dispatchEvent(new Event('endo-export-frame')));
 document.querySelector('#frame-name').addEventListener('change',event=>{const state=getState();state.frames.find(f=>f.id===state.activeFrameId).name=event.target.value.trim()||'Frame';apply(state);});
 for(const key of keys)fields[key].addEventListener('change',()=>{const value=fields[key].valueAsNumber;if(!Number.isFinite(value)){refresh();return;}const frame=current();if(key==='x'||key==='y')apply(moveFrame(getState(),frame.id,{x:key==='x'?Math.max(-1e7,Math.min(1e7,value)):frame.x,y:key==='y'?Math.max(-1e7,Math.min(1e7,value)):frame.y}));else apply(resizeFrame(getState(),frame.id,{[key]:clampSize(value)}));});
 document.querySelector('#frame-transparent').addEventListener('change',event=>{const state=getState();state.frames.find(f=>f.id===state.activeFrameId).background=event.target.checked?null:document.querySelector('#frame-background').value;apply(state);});
 document.querySelector('#frame-background').addEventListener('change',event=>{const state=getState();state.frames.find(f=>f.id===state.activeFrameId).background=event.target.value;apply(state);});
 art.addEventListener('pointerdown',event=>{
  if(event.button!==0||viewport.dataset.mode!=='frame'||drag||getBusy())return;event.preventDefault();const start=toWorld(event.clientX,event.clientY),state=getState(),frame=current(),tolerance=9/camera.scale;
  const corner=[['nw',frame.x,frame.y],['ne',frame.x+frame.width,frame.y],['se',frame.x+frame.width,frame.y+frame.height],['sw',frame.x,frame.y+frame.height]].find(([,x,y])=>Math.hypot(start.x-x,start.y-y)<tolerance);
  const inside=start.x>=frame.x&&start.x<=frame.x+frame.width&&start.y>=frame.y&&start.y<=frame.y+frame.height;
  drag={id:event.pointerId,start,before:state,frame:{...frame},kind:corner?corner[0]:inside?'move':'new',region:{x:start.x,y:start.y,width:64,height:64}};if(drag.kind!=='new')drag.region={...frame};art.setPointerCapture(event.pointerId);onPaint();
 });
 art.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;const p=toWorld(event.clientX,event.clientY),dx=p.x-drag.start.x,dy=p.y-drag.start.y,f=drag.frame;
  if(drag.kind==='move')drag.region={...f,x:f.x+dx,y:f.y+dy};
  else if(drag.kind==='new')drag.region={x:Math.min(drag.start.x,p.x),y:Math.min(drag.start.y,p.y),width:clampSize(Math.abs(dx)),height:clampSize(Math.abs(dy))};
  else{const left=drag.kind.includes('w')?Math.max(f.x+f.width-MAX_FRAME_SIZE,Math.min(f.x+dx,f.x+f.width-MIN_FRAME_SIZE)):f.x,top=drag.kind.includes('n')?Math.max(f.y+f.height-MAX_FRAME_SIZE,Math.min(f.y+dy,f.y+f.height-MIN_FRAME_SIZE)):f.y,right=drag.kind.includes('e')?Math.max(left+MIN_FRAME_SIZE,Math.min(left+MAX_FRAME_SIZE,f.x+f.width+dx)):f.x+f.width,bottom=drag.kind.includes('s')?Math.max(top+MIN_FRAME_SIZE,Math.min(top+MAX_FRAME_SIZE,f.y+f.height+dy)):f.y+f.height;drag.region={x:left,y:top,width:clampSize(right-left),height:clampSize(bottom-top)};}
  onPaint();
 });
 function finish(event){if(drag?.id!==event.pointerId)return;const gesture=drag;drag=null;if(art.hasPointerCapture(gesture.id))art.releasePointerCapture(gesture.id);if(event.type==='pointerup'){if(gesture.kind==='new')apply(addFrame(gesture.before,{...gesture.region,background:null}));else if(gesture.kind==='move')apply(moveFrame(gesture.before,gesture.frame.id,gesture.region));else apply(resizeFrame(gesture.before,gesture.frame.id,gesture.region));}viewport.dataset.mode='draw';for(const b of document.querySelectorAll('.cursor-modes button'))b.setAttribute('aria-pressed',String(b.dataset.mode==='draw'));refresh();onPaint();}
 for(const type of ['pointerup','pointercancel','lostpointercapture'])art.addEventListener(type,finish);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){const id=drag.id;drag=null;if(art.hasPointerCapture(id))art.releasePointerCapture(id);viewport.dataset.mode='draw';refresh();onPaint();}});
 function draw(ctx){
  const state=getState(),q=camera.scale;ctx.save();ctx.setTransform(q,0,0,q,camera.x,camera.y);ctx.lineWidth=1/q;ctx.font=11/q+'px Arial';
  for(const frame of state.frames){const active=frame.id===state.activeFrameId;ctx.strokeStyle=active?'#5f87ff':'#707070';ctx.fillStyle=ctx.strokeStyle;ctx.setLineDash([]);ctx.strokeRect(frame.x,frame.y,frame.width,frame.height);ctx.fillText(frame.name+' · '+frame.width+' × '+frame.height,frame.x,frame.y-9/q);if(active&&viewport.dataset.mode==='frame'){for(const[x,y]of[[frame.x,frame.y],[frame.x+frame.width,frame.y],[frame.x,frame.y+frame.height],[frame.x+frame.width,frame.y+frame.height]])ctx.fillRect(x-3/q,y-3/q,6/q,6/q);}}
  if(drag){ctx.setLineDash([5/q,4/q]);ctx.strokeStyle='#5f87ff';ctx.strokeRect(drag.region.x,drag.region.y,drag.region.width,drag.region.height);}ctx.restore();
  const existing=new Map([...papers.children].map(node=>[node.dataset.frameId,node]));for(const frame of state.frames){let node=existing.get(frame.id);if(!node){node=document.createElement('div');node.className='frame-paper';node.dataset.frameId=frame.id;papers.append(node);}existing.delete(frame.id);node.style.left=frame.x*q+camera.x+'px';node.style.top=frame.y*q+camera.y+'px';node.style.width=frame.width*q+'px';node.style.height=frame.height*q+'px';node.style.backgroundColor=frame.background||'';node.classList.toggle('transparent',frame.background===null);}for(const node of existing.values())node.remove();
 }
 return{refresh,draw,focus,get dragging(){return !!drag;}};
}
