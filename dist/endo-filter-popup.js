const labels = {threshold:'Threshold',dither:'Dither',grayscale:'Grayscale',invert:'Invert'};
const explanations = {
 threshold:'Turn the content below this adjustment into black and white.',
 dither:'Rebuild tones with a black and white pattern fixed to the frame.',
 grayscale:'Remove color from the content below this adjustment.',
 invert:'Invert the colors of the content below this adjustment.'
};

// Properties float beside the canvas. The editor stays available behind them.
export function createFilterPopup({getState,onAction,getBusy}) {
 const popup=document.createElement('section');
 popup.className='filter-properties';popup.dataset.filterPopup='';popup.hidden=true;
 popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','false');popup.setAttribute('aria-labelledby','filter-popup-title');
 popup.innerHTML='<div class="filter-properties-header" tabindex="0" title="Drag to move filter properties"><h3 id="filter-popup-title">Adjustment</h3><span aria-hidden="true">⠿</span></div><div class="filter-properties-body"><p class="filter-properties-description"></p><label class="filter-popup-preview"><input type="checkbox" data-filter-preview>Preview effect</label><div class="filter-properties-controls"></div><p class="filter-properties-scope"></p><button type="button" class="filter-properties-remove">Delete adjustment layer</button></div><p class="filter-properties-hint">Esc or click outside to close</p>';
 document.body.append(popup);
 const header=popup.querySelector('.filter-properties-header'),title=popup.querySelector('h3');
 const description=popup.querySelector('.filter-properties-description'),scope=popup.querySelector('.filter-properties-scope');
 const controls=popup.querySelector('.filter-properties-controls'),preview=popup.querySelector('[data-filter-preview]');
 const remove=popup.querySelector('.filter-properties-remove');
 let layerId=null,type=null,opener=null,drag=null;
 const fields=new Map();
 const layer=()=>getState().layers.find(item=>item.id===layerId&&item.kind==='adjustment');
 function clampPosition(left,top){
  const rect=popup.getBoundingClientRect();
  popup.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,left))+'px';
  popup.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,top))+'px';
 }
 function position(){
  if(popup.hidden)return;
  const sidebar=document.querySelector('.right')?.getBoundingClientRect();
  clampPosition((sidebar?.left??innerWidth)-popup.offsetWidth-12,Math.min(150,innerHeight-popup.offsetHeight-12));
 }
 function close({restoreFocus=false}={}){
  if(popup.hidden)return;
  if(drag&&header.hasPointerCapture(drag.id))header.releasePointerCapture(drag.id);
  popup.hidden=true;popup.removeAttribute('data-layer-id');layerId=null;type=null;drag=null;onAction('finish-edit');
  if(restoreFocus&&opener?.isConnected)opener.focus({preventScroll:true});
 }
 function build(filter){
  controls.replaceChildren();fields.clear();type=filter.type;
  const parameters=type==='threshold'?[['amount','Threshold',0,255]]:type==='dither'?[['amount','Threshold',0,255],['scale','Pattern size',1,64]]:[];
  for(const [key,label,min,max] of parameters){
   const row=document.createElement('label');row.className='filter-popup-control';
   const name=document.createElement('span');name.textContent=label;
   const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.step=1;range.setAttribute('aria-label',labels[type]+' '+label.toLowerCase());range.dataset.filterParameter=key;
   const number=document.createElement('input');number.type='number';number.min=min;number.max=max;number.step=1;number.setAttribute('aria-label',labels[type]+' '+label.toLowerCase()+' value');number.dataset.filterValue=key;
   const apply=element=>{
    if(!layer()||getBusy()||layer().locked)return;
    const value=element===range?Number(range.value):number.valueAsNumber;
    if(!Number.isFinite(value))return;
    const bounded=Math.max(min,Math.min(max,Math.round(value)));range.value=bounded;number.value=bounded;
    range.style.setProperty('--fill',((bounded-min)/(max-min)*100)+'%');
    onAction('filter-input',{id:layerId,key,value:bounded,element});
   };
   range.addEventListener('input',()=>apply(range));number.addEventListener('input',()=>apply(number));
   for(const field of [range,number]){
    field.addEventListener('change',()=>onAction('finish-edit'));
    field.addEventListener('blur',()=>{onAction('finish-edit');sync();});
   }
   number.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();number.blur();}});
   row.append(name,range,number);controls.append(row);fields.set(key,{range,number,min,max});
  }
  if(!parameters.length){const note=document.createElement('p');note.className='panel-note';note.textContent='This adjustment has no additional parameters. Use Preview to compare it with the original.';controls.append(note);}
 }
 function sync(){
  if(popup.hidden)return;
  const state=getState(),item=state.layers.find(entry=>entry.id===layerId&&entry.kind==='adjustment');
  if(!item||item.frameId!==state.activeFrameId){close();return;}
  const filter=item.filter,disabled=getBusy()||item.locked;
  if(!filter){close();return;}
  if(type!==filter.type)build(filter);
  title.textContent=labels[filter.type]||'Adjustment';
  description.textContent=explanations[filter.type]||'';
  const frame=state.frames?.find(frame=>frame.id===item.frameId);
  scope.textContent=item.clipToLayerId?'Clipped adjustment · '+(frame?.name||'current frame'):(frame?.name||'Current frame')+' · affects content below this layer';
  if(!item.visible)scope.textContent+=' · layer hidden';
  preview.checked=filter.enabled!==false;preview.disabled=disabled;remove.disabled=disabled;
  for(const [key,field]of fields){
   const value=filter[key]??(key==='amount'?128:2);
   if(document.activeElement!==field.range)field.range.value=value;
   if(document.activeElement!==field.number)field.number.value=value;
   field.range.style.setProperty('--fill',((value-field.min)/(field.max-field.min)*100)+'%');
   field.range.disabled=field.number.disabled=disabled;
  }
 }
 function open(id){
  const item=getState().layers.find(entry=>entry.id===id&&entry.kind==='adjustment');
  if(!item)return;
  const changed=layerId!==id||popup.hidden;
  if(changed){onAction('finish-edit');opener=document.activeElement;}
  layerId=id;popup.dataset.layerId=id;popup.hidden=false;sync();
  if(changed){position();(controls.querySelector('input')||preview).focus({preventScroll:true});}
 }
 preview.addEventListener('change',()=>{if(layerId)onAction('filter-toggle',{id:layerId});sync();});
 remove.addEventListener('click',()=>{const id=layerId;close();if(id)onAction('filter-remove',{id});});
 document.addEventListener('pointerdown',event=>{
  if(!popup.hidden&&!popup.contains(event.target)&&!event.target.closest('[data-filter-open]'))close();
 },true);
 document.addEventListener('keydown',event=>{
  if(!popup.hidden&&event.key==='Escape'){
   event.preventDefault();event.stopImmediatePropagation();close({restoreFocus:true});
  }
 },true);
 header.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;event.preventDefault();const rect=popup.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};header.setPointerCapture(event.pointerId);header.focus({preventScroll:true});
 });
 header.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)clampPosition(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);});
 const endDrag=event=>{if(drag?.id!==event.pointerId)return;drag=null;if(header.hasPointerCapture(event.pointerId))header.releasePointerCapture(event.pointerId);};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(event,endDrag);
 header.addEventListener('keydown',event=>{
  const movement={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[event.key];
  if(!movement)return;event.preventDefault();event.stopPropagation();const rect=popup.getBoundingClientRect();clampPosition(rect.left+movement[0],rect.top+movement[1]);
 });
 window.addEventListener('resize',()=>{if(!popup.hidden){const rect=popup.getBoundingClientRect();clampPosition(rect.left,rect.top);}});
 return {open,close,sync,get element(){return popup;}};
}
