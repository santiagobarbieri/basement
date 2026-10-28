import {createFilterPopup} from './endo-filter-popup.js';

const labels={threshold:'Threshold',dither:'Dither',grayscale:'Grayscale',invert:'Invert'};
const icon=(content)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+content+'</svg>';
const filterIcon=icon('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>');
const paintIcon=icon('<path d="m15 4 5 5-9 9-7 2 2-7 9-9ZM13 6l5 5M5 16l3 3"/>');

export function createEditorUI({getState,onAction,getBusy}){
 const list=document.querySelector('#layer-list'),filters=document.querySelector('#filter-list');
 const popup=createFilterPopup({getState,onAction,getBusy});
 let draggedId=null;
 const frameLayers=state=>state.layers.filter(layer=>!state.activeFrameId||layer.frameId===state.activeFrameId);
 const button=(text,title,action)=>{const control=document.createElement('button');control.type='button';control.textContent=text;control.title=title;control.setAttribute('aria-label',title);control.addEventListener('click',action);return control;};
 function openFilter(id){popup.open(id);}
 function editFilter(id){onAction('edit-filter',{id});openFilter(id);}
 for(const [id,action]of [['layer-add','add-layer'],['layer-duplicate','duplicate-layer'],['layer-delete','delete-layer'],['layer-up','layer-up'],['layer-down','layer-down'],['selection-to-layer','selection-to-layer'],['add-filter','add-filter']]){
  document.querySelector('#'+id)?.addEventListener('click',()=>onAction(action,{type:document.querySelector('#filter-type')?.value||'threshold'}));
 }
 const opacity=document.querySelector('#layer-opacity');
 opacity.addEventListener('input',()=>{document.querySelector('#layer-opacity-value').textContent=opacity.value+'%';onAction('layer-opacity',{value:Number(opacity.value)/100,element:opacity});});
 opacity.addEventListener('change',()=>onAction('finish-edit'));
 function clearDropTargets(){for(const row of list.querySelectorAll('.drop-target')){row.classList.remove('drop-target');delete row.dataset.dropPosition;}}
 function rename(name,layer){
  if(getBusy())return;
  const input=document.createElement('input');input.className='layer-name-input';input.value=layer.name;input.maxLength=80;input.setAttribute('aria-label','Layer name');name.replaceWith(input);input.focus();input.select();
  let done=false;const finish=()=>{if(done)return;done=true;onAction('rename-layer',{id:layer.id,name:input.value.trim()||layer.name});};
  input.addEventListener('click',event=>event.stopPropagation());input.addEventListener('dblclick',event=>event.stopPropagation());input.addEventListener('blur',finish);
  input.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();finish();}if(event.key==='Escape'){event.preventDefault();input.value=layer.name;finish();}});
 }
 function layerRow(state,layer,busy){
  const adjustment=layer.kind==='adjustment';
  const row=document.createElement('div');row.className='layer-row';row.dataset.layerId=layer.id;row.dataset.layerKind=adjustment?'adjustment':'paint';row.setAttribute('role','listitem');row.classList.toggle('active',layer.id===state.activeLayerId);row.draggable=!busy;
  const visibility=button('',layer.visible?'Hide '+layer.name:'Show '+layer.name,()=>onAction('layer-visible',{id:layer.id}));
  visibility.innerHTML=icon('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(layer.visible?'':'<path d="m3 3 18 18"/>'));
  visibility.className='layer-visibility';visibility.setAttribute('aria-pressed',String(layer.visible));
  const lock=button('',layer.locked?'Unlock '+layer.name:'Lock '+layer.name,()=>onAction('layer-lock',{id:layer.id}));
  lock.innerHTML=icon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="'+(layer.locked?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 7-2')+'"/>');
  lock.className='layer-lock';lock.setAttribute('aria-pressed',String(layer.locked));
  const visual=adjustment?button('','Edit '+(labels[layer.filter?.type]||'adjustment'),event=>{event.stopPropagation();editFilter(layer.id);}):document.createElement('span');
  visual.className='layer-visual'+(adjustment?' layer-effect':'');visual.innerHTML=adjustment?filterIcon:paintIcon;
  if(adjustment)visual.dataset.filterOpen=layer.id;else visual.setAttribute('aria-hidden','true');
  const select=button('','Select '+layer.name,()=>onAction('activate-layer',{id:layer.id}));select.className='layer-select';select.setAttribute('aria-pressed',String(layer.id===state.activeLayerId));
  select.title=adjustment?'Double click to edit adjustment · F2 to rename':'Double click to rename';
  const name=document.createElement('span');name.className='layer-name';name.textContent=layer.name;
  const info=document.createElement('small');info.className='layer-info';
  const count=state.strokes.filter(stroke=>stroke.layerId===layer.id&&stroke.operation!=='erase').length;
  info.textContent=adjustment?(labels[layer.filter?.type]||'Adjustment')+(layer.clipToLayerId?' · clipped':' · below')+(layer.filter?.enabled===false?' · disabled':''):count+' stroke'+(count===1?'':'s');
  select.append(name,info);
  select.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();if(adjustment)editFilter(layer.id);else rename(name,layer);});
  select.addEventListener('keydown',event=>{
   if(event.key==='F2'){event.preventDefault();event.stopPropagation();rename(name,layer);return;}
   if(adjustment&&event.key==='Enter'&&event.altKey){event.preventDefault();event.stopPropagation();editFilter(layer.id);}
  });
  row.addEventListener('keydown',event=>{
   if(!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key)||getBusy())return;
   const local=frameLayers(getState()),index=local.findIndex(item=>item.id===layer.id),delta=event.key==='ArrowUp'?1:-1,target=local[index+delta];
   if(!target)return;event.preventDefault();event.stopPropagation();onAction('reorder-layer',{id:layer.id,targetId:target.id,before:delta<0});
  });
  row.addEventListener('dragstart',event=>{
   if(getBusy()||event.target.closest('input')){event.preventDefault();return;}
   draggedId=layer.id;row.classList.add('is-dragging');
   if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-basement-layer',layer.id);event.dataTransfer.setData('text/plain',layer.id);}
  });
  row.addEventListener('dragover',event=>{
   if(!draggedId||draggedId===layer.id||getBusy())return;
   event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';clearDropTargets();
   const rect=row.getBoundingClientRect();row.classList.add('drop-target');row.dataset.dropPosition=event.clientY<rect.top+rect.height/2?'above':'below';
  });
  row.addEventListener('dragleave',event=>{if(!row.contains(event.relatedTarget)){row.classList.remove('drop-target');delete row.dataset.dropPosition;}});
  row.addEventListener('drop',event=>{
   const id=draggedId||event.dataTransfer?.getData('application/x-basement-layer');
   if(!id||id===layer.id||getBusy())return;
   const local=frameLayers(getState());if(!local.some(item=>item.id===id))return;
   event.preventDefault();event.stopPropagation();const rect=row.getBoundingClientRect(),above=event.clientY<rect.top+rect.height/2;
   draggedId=null;clearDropTargets();onAction('reorder-layer',{id,targetId:layer.id,before:!above});
  });
  row.addEventListener('dragend',()=>{draggedId=null;row.classList.remove('is-dragging');clearDropTargets();});
  for(const control of [visibility,lock,select,...(adjustment?[visual]:[])])control.disabled=busy;
  row.append(visibility,lock,visual,select);return row;
 }
 function render(){
  const state=getState(),busy=getBusy(),local=frameLayers(state),active=local.find(layer=>layer.id===state.activeLayerId),index=local.indexOf(active);
  list.replaceChildren();for(const layer of [...local].reverse())list.append(layerRow(state,layer,busy));
  const frame=state.frames?.find(frame=>frame.id===state.activeFrameId),frameName=document.querySelector('#layers-frame-name');if(frameName)frameName.textContent=frame?.name||'Layers';
  opacity.value=Math.round((active?.opacity??1)*100);opacity.disabled=busy||!active;document.querySelector('#layer-opacity-value').textContent=opacity.value+'%';
  for(const id of ['layer-add','layer-duplicate'])document.querySelector('#'+id).disabled=busy||state.layers.length>=512||!frame&&!!state.activeFrameId;
  document.querySelector('#layer-duplicate').disabled||=!active;
  document.querySelector('#layer-delete').disabled=busy||!active||(active.kind!=='adjustment'&&local.filter(layer=>layer.kind!=='adjustment').length<=1);
  document.querySelector('#layer-up').disabled=busy||!active||index===local.length-1;
  document.querySelector('#layer-down').disabled=busy||!active||index<=0;
  document.querySelector('#selection-to-layer').disabled=busy||!(state.selection||[]).length||state.layers.length>=512;
  document.querySelector('#filter-layer-label').textContent='Adjustment layers affect the content below them in this frame. Drag them in Layers.';
  document.querySelector('#add-filter').disabled=busy||state.layers.length>=512||(!frame&&!!state.activeFrameId);
  filters.replaceChildren();
  const adjustments=local.filter(layer=>layer.kind==='adjustment'&&layer.id===state.activeLayerId);
  if(!adjustments.length){const note=document.createElement('p');note.className='panel-note';note.textContent='Add an adjustment, then move it in Layers. Click any adjustment thumbnail there to open its properties.';filters.append(note);}
  for(const layer of [...adjustments].reverse()){
   const filter=layer.filter,row=document.createElement('section');row.className='adjustment-summary';row.dataset.filterId=layer.id;
   const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=filter?.enabled!==false;enabled.setAttribute('aria-label','Enable '+layer.name);enabled.disabled=busy||layer.locked;enabled.addEventListener('change',()=>onAction('filter-toggle',{id:layer.id}));
   const open=button('','Edit '+layer.name,()=>editFilter(layer.id));open.className='adjustment-open';open.dataset.filterOpen=layer.id;open.disabled=busy;
   const name=document.createElement('strong');name.textContent=layer.name;const description=document.createElement('small');description.textContent=(labels[filter?.type]||'Adjustment')+' · '+(layer.clipToLayerId?'clipped to a layer':'affects layers below');open.append(name,description);
   const remove=button('×','Delete '+layer.name,()=>onAction('filter-remove',{id:layer.id}));remove.className='adjustment-delete';remove.disabled=busy||layer.locked;
   row.append(enabled,open,remove);filters.append(row);
  }
  popup.sync();
 }
 return {render,openFilter,closeFilter:popup.close};
}
