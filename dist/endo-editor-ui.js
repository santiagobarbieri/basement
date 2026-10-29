import {filterDefinition,filterDisplayValue,filterStoredValue} from './endo-filter-catalog.js';
import {createLayerPanels} from './endo-layer-panels.js';
import {renderLayerThumbnail} from './endo-renderer.js';

const icon=content=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+content+'</svg>';
const filterIcon=icon('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>');
const labelFor=type=>filterDefinition(type)?.label||'Adjustment';

export function createEditorUI({getState,onAction,getBusy}){
 const list=document.querySelector('#layer-list'),filters=document.querySelector('#filter-list');
 const filterLabel=document.querySelector('#filter-layer-label');
 list.setAttribute('role','listbox');list.setAttribute('aria-multiselectable','true');list.setAttribute('aria-label','Layers');
 let draggedId=null,adjustmentId=null,adjustmentType=null,adjustmentPreview=null,opener=null,popupDrag=null;
 const fields=new Map();
 const frameLayers=state=>state.layers.filter(layer=>!state.activeFrameId||layer.frameId===state.activeFrameId);
 const selectedIds=state=>new Set((state.selectedLayerIds?.length?state.selectedLayerIds:[state.activeLayerId]).filter(Boolean));
 const button=(text,title,action)=>{const node=document.createElement('button');node.type='button';node.textContent=text;node.title=title;node.setAttribute('aria-label',title);node.addEventListener('click',action);return node;};
 const popup=document.createElement('section');popup.id='filter-properties';popup.className='endo-popover adjustment-window';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','false');popup.setAttribute('aria-labelledby','filter-properties-title');
 popup.innerHTML='<header class="popover-header" tabindex="0" title="Drag to move filter properties"><strong id="filter-properties-title">Adjustment</strong><span class="popover-scope"></span><button type="button" id="filter-properties-close" class="popover-close" aria-label="Close adjustment" title="Close · Esc">'+icon('<path d="m6 6 12 12M18 6 6 18"/>')+'</button></header><div class="popover-body"></div><footer class="popover-footer"></footer>';
 const header=popup.querySelector('header'),body=popup.querySelector('.popover-body'),footer=popup.querySelector('footer'),title=popup.querySelector('strong'),scope=popup.querySelector('.popover-scope');
 filterLabel.hidden=true;body.append(filterLabel,filters);document.body.append(popup);
 const reset=button('','Reset adjustment',()=>{const item=getState().layers.find(layer=>layer.id===adjustmentId),definition=filterDefinition(item?.filter?.type);if(!definition||item.locked||getBusy())return;for(const control of definition.controls)onAction('filter-input',{id:adjustmentId,key:control.key,value:control.key==='amount'?definition.defaultAmount:definition.defaultScale,element:reset});onAction('finish-edit');syncAdjustment(getState(),getBusy());});reset.innerHTML=icon('<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>');
 const remove=button('','Delete adjustment layer',()=>{const id=adjustmentId;closeFilter();if(id)onAction('filter-remove',{id});});remove.innerHTML=icon('<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>');footer.append(reset,remove);
 function clampPopup(left,top){const rect=popup.getBoundingClientRect();popup.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,left))+'px';popup.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,top))+'px';}
 function closeFilter(restoreFocus=false){if(popup.hidden)return;popup.hidden=true;window.basementEndoAdjustmentOpen=false;popupDrag=null;onAction('finish-edit');if(restoreFocus)(opener?.isConnected?opener:document.querySelector('#artboard'))?.focus({preventScroll:true});}
 function buildAdjustment(item){
  adjustmentId=item.id;adjustmentType=item.filter.type;fields.clear();filters.replaceChildren();
  const definition=filterDefinition(adjustmentType);
  const section=document.createElement('section');section.className='adjustment-properties';section.dataset.filterId=item.id;section.setAttribute('aria-label',labelFor(adjustmentType)+' properties');
  const previewLabel=document.createElement('label');previewLabel.className='adjustment-preview';adjustmentPreview=document.createElement('input');adjustmentPreview.type='checkbox';adjustmentPreview.dataset.filterPreview='';adjustmentPreview.setAttribute('aria-label','Preview '+labelFor(adjustmentType));previewLabel.append(adjustmentPreview,document.createTextNode('Preview'));section.append(previewLabel);
  adjustmentPreview.addEventListener('change',()=>{if(!getBusy())onAction('filter-toggle',{id:adjustmentId});});
  const controls=document.createElement('div');controls.className='adjustment-controls';section.append(controls);
  for(const control of definition?.controls||[]){
   const {key,label,min,max,step}=control,row=document.createElement('label');row.className='adjustment-control';row.title=definition.description;
   const caption=document.createElement('span');caption.textContent=label;
   const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.step=step||1;range.dataset.filterParameter=key;range.setAttribute('aria-label',labelFor(adjustmentType)+' '+label.toLowerCase());
   const number=document.createElement('input');number.type='number';number.min=control.displayMin??min;number.max=control.displayMax??max;number.step=1;number.dataset.filterValue=key;number.setAttribute('aria-label',range.getAttribute('aria-label')+' value');
   const update=element=>{
    const active=getState().layers.find(layer=>layer.id===adjustmentId);if(!active||active.locked||getBusy())return;
    const raw=element===range?Number(range.value):filterStoredValue(definition,key,number.valueAsNumber);if(!Number.isFinite(raw))return;
    const value=Math.max(min,Math.min(max,Math.round(raw)));range.value=value;number.value=filterDisplayValue(definition,key,value);range.style.setProperty('--fill',((value-min)/(max-min)*100)+'%');onAction('filter-input',{id:adjustmentId,key,value,element});
   };
   for(const input of [range,number]){input.addEventListener('input',()=>update(input));input.addEventListener('change',()=>onAction('finish-edit'));input.addEventListener('blur',()=>{onAction('finish-edit');syncAdjustment(getState(),getBusy());});}
   number.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();number.blur();}});
   row.append(caption,range,number);controls.append(row);fields.set(key,{range,number,min,max,definition});
  }
  filters.append(section);
 }
 function syncAdjustment(state,busy){
  if(popup.hidden)return;
  const item=state.layers.find(layer=>layer.id===adjustmentId&&layer.kind==='adjustment'&&layer.frameId===state.activeFrameId);
  if(!item?.filter){closeFilter();return;}
  if(adjustmentType!==item.filter.type)buildAdjustment(item);
  const definition=filterDefinition(item.filter.type),disabled=busy||item.locked;
  title.textContent=labelFor(item.filter.type);title.title=definition?.description||'';scope.textContent=item.name===labelFor(item.filter.type)?'':item.name;scope.title=(item.clipToLayerId?'Clipped to a layer':'Affects layers below')+(item.locked?' · Locked':'')+(!item.visible?' · Hidden':'');
  filterLabel.textContent=item.name;popup.dataset.layerId=item.id;adjustmentPreview.checked=item.filter.enabled!==false;adjustmentPreview.disabled=disabled;remove.disabled=disabled;reset.disabled=disabled||!fields.size;
  for(const[key,field]of fields){const value=item.filter[key]??(key==='amount'?definition.defaultAmount:definition.defaultScale);if(document.activeElement!==field.range)field.range.value=value;if(document.activeElement!==field.number)field.number.value=filterDisplayValue(field.definition,key,value);field.range.style.setProperty('--fill',((value-field.min)/(field.max-field.min)*100)+'%');field.range.disabled=field.number.disabled=disabled;}
 }
 function openFilter(id){
  const state=getState(),item=state.layers.find(layer=>layer.id===id&&layer.kind==='adjustment'&&layer.frameId===state.activeFrameId);if(!item)return;
  onAction('finish-edit');opener=document.activeElement;const wasHidden=popup.hidden,changed=adjustmentId!==id;popup.hidden=false;window.basementEndoAdjustmentOpen=true;
  if(changed||!adjustmentPreview)buildAdjustment(item);syncAdjustment(state,getBusy());
  if(wasHidden){const sidebar=document.querySelector('.shell-right')?.getBoundingClientRect();clampPopup((sidebar?.left??innerWidth)-popup.offsetWidth-12,Math.min(150,innerHeight-popup.offsetHeight-8));}
  else{const rect=popup.getBoundingClientRect();clampPopup(rect.left,rect.top);}
  if(changed||wasHidden)(filters.querySelector('input[type=number]')||adjustmentPreview).focus({preventScroll:true});
 }
 popup.querySelector('#filter-properties-close').addEventListener('click',()=>closeFilter(true));
 document.addEventListener('pointerdown',event=>{if(!popup.hidden&&!popup.contains(event.target)&&!event.target.closest('[data-filter-open]'))closeFilter();},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popup.hidden&&!window.basementEndoPopoverOpen){event.preventDefault();event.stopImmediatePropagation();closeFilter(true);}},true);
 header.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;event.preventDefault();const rect=popup.getBoundingClientRect();popupDrag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};header.setPointerCapture(event.pointerId);});
 header.addEventListener('pointermove',event=>{if(popupDrag?.id===event.pointerId)clampPopup(popupDrag.left+event.clientX-popupDrag.x,popupDrag.top+event.clientY-popupDrag.y);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(type,event=>{if(popupDrag?.id!==event.pointerId)return;popupDrag=null;if(header.hasPointerCapture(event.pointerId))header.releasePointerCapture(event.pointerId);});
 window.addEventListener('resize',()=>{if(!popup.hidden){const rect=popup.getBoundingClientRect();clampPopup(rect.left,rect.top);}});
 window.addEventListener('basement-session-blocked',()=>closeFilter());window.addEventListener('basement-write-error',()=>closeFilter());
 const layerMenu=document.createElement('div');layerMenu.id='layer-context-menu';layerMenu.className='shell-menu layer-context-menu';layerMenu.hidden=true;layerMenu.setAttribute('role','menu');layerMenu.setAttribute('aria-label','Layer actions');document.body.append(layerMenu);let menuOpener=null;
 const layerPanels=createLayerPanels({getState,onAction,getBusy,onOpen:()=>{closeFilter();closeLayerMenu();},onClose:()=>render()});
 const thumbnailCache=new Map();let thumbnailFrame=null;
 function closeLayerMenu(focus=false){if(layerMenu.hidden)return;const id=layerMenu.dataset.layerId;layerMenu.hidden=true;delete layerMenu.dataset.layerId;list.querySelector('[data-layer-id="'+id+'"] .layer-more')?.setAttribute('aria-expanded','false');if(focus)(menuOpener?.isConnected?menuOpener:list.querySelector('[data-layer-id="'+id+'"] .layer-more')||document.querySelector('#artboard'))?.focus({preventScroll:true});}
 function openLayerMenu(id,rect){
  if(getBusy())return;const initial=getState();if(!selectedIds(initial).has(id))onAction('select-layers',{id});const state=getState(),layer=state.layers.find(item=>item.id===id);if(!layer)return;const local=frameLayers(state),chosen=selectedIds(state),selected=local.filter(item=>chosen.has(item.id));
  const positions=selected.map(item=>local.indexOf(item)),contiguous=positions.length>1&&Math.max(...positions)-Math.min(...positions)+1===positions.length,paintOnly=selected.every(item=>item.kind==='paint'),unlocked=selected.every(item=>!item.locked);
  closeLayerMenu();menuOpener=list.querySelector('[data-layer-id="'+id+'"] .layer-more');layerMenu.replaceChildren();layerMenu.dataset.layerId=id;
  const add=(label,command,action,disabled=false)=>{const item=button(label,label,()=>{closeLayerMenu();action();});item.dataset.layerCommand=command;item.setAttribute('role','menuitem');item.disabled=disabled;layerMenu.append(item);return item;};
  const ids=selected.map(item=>item.id);
  add(layer.kind==='adjustment'?'Adjustment Properties…':'Blending Options…','blending',()=>layer.kind==='adjustment'?onAction('edit-filter',{id}):layerPanels.openBlending(id));
  add('Rename…','rename',()=>{const row=list.querySelector('[data-layer-id="'+id+'"]'),name=row?.querySelector('.layer-name');if(name)rename(name,layer);},layer.locked);
  const divider=document.createElement('div');divider.className='shell-menu-divider';divider.setAttribute('role','separator');layerMenu.append(divider);
  add('Rasterize Layer'+(ids.length>1?'s':''),'rasterize',()=>onAction('rasterize-layer',{ids}),!paintOnly||!unlocked);
  const merge=add('Merge Selected','merge',()=>onAction('merge-layers',{ids}),!contiguous||!paintOnly||!unlocked);if(merge.disabled)merge.title='Select adjacent, unlocked drawing layers to merge';
  add('Duplicate','duplicate',()=>onAction('duplicate-layer',{ids}),state.layers.length+ids.length>512);
  add('Delete','delete',()=>onAction('delete-layer',{ids}),!selected.some(item=>!item.locked));
  layerMenu.hidden=false;const width=layerMenu.offsetWidth,height=layerMenu.offsetHeight;layerMenu.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.right-width))+'px';layerMenu.style.top=Math.max(8,Math.min(innerHeight-height-8,rect.bottom+4))+'px';menuOpener?.setAttribute('aria-expanded','true');layerMenu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
 }
 layerMenu.addEventListener('keydown',event=>{const items=[...layerMenu.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeLayerMenu(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}});
 document.addEventListener('pointerdown',event=>{if(!layerMenu.hidden&&!layerMenu.contains(event.target)&&!event.target.closest('.layer-more'))closeLayerMenu();},true);
 window.addEventListener('resize',()=>closeLayerMenu());window.addEventListener('basement-session-blocked',()=>closeLayerMenu());window.addEventListener('basement-write-error',()=>closeLayerMenu());
 document.addEventListener('endo-layer-panel-open',()=>{closeFilter();closeLayerMenu();});
 function updateThumbnails(){
  thumbnailFrame=null;if(getBusy())return;const state=getState(),frame=state.frames.find(item=>item.id===state.activeFrameId),local=frameLayers(state),live=new Set(state.layers.map(item=>item.id));for(const id of thumbnailCache.keys())if(!live.has(id))thumbnailCache.delete(id);
  for(const canvas of list.querySelectorAll('[data-layer-thumbnail]')){
   const layer=local.find(item=>item.id===canvas.dataset.layerThumbnail);if(!layer)continue;const bounds=canvas.getBoundingClientRect(),scroll=list.getBoundingClientRect();if(bounds.bottom<scroll.top||bounds.top>scroll.bottom)continue;
   const relevant=layer.kind==='adjustment'?local.slice(0,local.indexOf(layer)+1):[layer,...local.filter(item=>item.clipToLayerId===layer.id)],ids=new Set(relevant.map(item=>item.id));
   const signature=JSON.stringify([frame,state.scene,relevant,state.strokes.filter(stroke=>ids.has(stroke.layerId)).map(stroke=>[stroke.number,stroke.operation,stroke.settings,stroke.tool,stroke.points])]);let cached=thumbnailCache.get(layer.id);
   if(!cached||cached.signature!==signature){const preview=document.createElement('canvas');preview.width=40;preview.height=40;renderLayerThumbnail(state,layer,preview);cached={signature,canvas:preview};thumbnailCache.set(layer.id,cached);}
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,40,40);ctx.drawImage(cached.canvas,0,0);
  }
 }
 function queueThumbnails(){if(thumbnailFrame===null)thumbnailFrame=requestAnimationFrame(updateThumbnails);}
 list.addEventListener('scroll',queueThumbnails,{passive:true});document.addEventListener('endo-artboard-rendered',event=>{if(!event.detail?.busy)queueThumbnails();});

 for(const[id,action]of [['layer-duplicate','duplicate-layer'],['layer-delete','delete-layer'],['layer-up','layer-up'],['layer-down','layer-down'],['selection-to-layer','selection-to-layer'],['add-filter','add-filter']])document.querySelector('#'+id)?.addEventListener('click',()=>onAction(action,{type:document.querySelector('#filter-type')?.value||'threshold'}));
 document.querySelector('#layer-add')?.addEventListener('click',()=>layerPanels.openNewLayer());
 const opacity=document.querySelector('#layer-opacity');
 opacity.addEventListener('input',()=>{document.querySelector('#layer-opacity-value').textContent=opacity.value+'%';onAction('layer-opacity',{value:Number(opacity.value)/100,element:opacity});});opacity.addEventListener('change',()=>onAction('finish-edit'));
 function clearDropTargets(){for(const row of list.querySelectorAll('.drop-target')){row.classList.remove('drop-target');delete row.dataset.dropPosition;}}
 function selectLayer(layer,event){onAction('select-layers',{id:layer.id,additive:!!(event.metaKey||event.ctrlKey),toggle:!!(event.metaKey||event.ctrlKey),range:!!event.shiftKey});}
 function rename(name,layer){
  if(getBusy())return;const input=document.createElement('input');input.className='layer-name-input';input.value=layer.name;input.maxLength=80;input.setAttribute('aria-label','Layer name');name.replaceWith(input);input.focus();input.select();
  let done=false;const finish=()=>{if(done)return;done=true;onAction('rename-layer',{id:layer.id,name:input.value.trim()||layer.name});};input.addEventListener('click',event=>event.stopPropagation());input.addEventListener('dblclick',event=>event.stopPropagation());input.addEventListener('blur',finish);input.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();finish();}if(event.key==='Escape'){event.preventDefault();input.value=layer.name;finish();}});
 }
 function layerRow(state,layer,busy){
  const adjustment=layer.kind==='adjustment',chosen=selectedIds(state).has(layer.id),row=document.createElement('div');row.className='layer-row';row.dataset.layerId=layer.id;row.dataset.layerKind=adjustment?'adjustment':'paint';row.setAttribute('role','option');row.setAttribute('aria-selected',String(chosen));row.classList.toggle('active',layer.id===state.activeLayerId);row.classList.toggle('selected',chosen);row.draggable=!busy&&!layer.locked;
  const visibility=button('',layer.visible?'Hide '+layer.name:'Show '+layer.name,()=>onAction('layer-visible',{id:layer.id}));visibility.innerHTML=icon('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(layer.visible?'':'<path d="m3 3 18 18"/>'));visibility.className='layer-visibility';visibility.setAttribute('aria-pressed',String(layer.visible));
  const lock=button('',layer.locked?'Unlock '+layer.name:'Lock '+layer.name,()=>onAction('layer-lock',{id:layer.id}));lock.innerHTML=icon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="'+(layer.locked?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 7-2')+'"/>');lock.className='layer-lock';lock.setAttribute('aria-pressed',String(layer.locked));
  const visual=button('',adjustment?'Edit '+labelFor(layer.filter?.type):'Select '+layer.name+' · Double click for Blending Options',event=>{event.stopPropagation();if(adjustment)onAction('edit-filter',{id:layer.id});else selectLayer(layer,event);});visual.className='layer-visual layer-thumbnail'+(adjustment?' layer-effect':'');if(adjustment)visual.dataset.filterOpen=layer.id;
  const thumbnail=document.createElement('canvas');thumbnail.width=40;thumbnail.height=40;thumbnail.dataset.layerThumbnail=layer.id;thumbnail.setAttribute('aria-hidden','true');visual.append(thumbnail);if(adjustment){const badge=document.createElement('span');badge.className='layer-thumbnail-badge';badge.innerHTML=filterIcon;visual.append(badge);}else visual.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();layerPanels.openBlending(layer.id);});
  const cached=thumbnailCache.get(layer.id);if(cached)thumbnail.getContext('2d').drawImage(cached.canvas,0,0,40,40);
  const select=button('','Select '+layer.name,event=>selectLayer(layer,event));select.className='layer-select';select.setAttribute('aria-pressed',String(chosen));select.title=adjustment?'Double click to edit adjustment · F2 to rename':'Double click to rename';
  const name=document.createElement('span');name.className='layer-name';name.textContent=layer.name;const info=document.createElement('small');info.className='layer-info';const count=state.strokes.filter(stroke=>stroke.layerId===layer.id&&stroke.operation!=='erase').length;info.textContent=adjustment?labelFor(layer.filter?.type)+(layer.clipToLayerId?' · clipped':' · below')+(layer.filter?.enabled===false?' · disabled':''):(layer.raster?'Raster':count+' stroke'+(count===1?'':'s'))+(layer.blending?.material&&layer.blending.material!=='none'?' · '+({cromo:'Chrome',relief:'Relief',sand:'Sand',crayon:'Crayon',cement:'Cement',dust:'Powder'}[layer.blending.material]||'Material'):'');select.append(name,info);
  select.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();if(adjustment)onAction('edit-filter',{id:layer.id});else rename(name,layer);});select.addEventListener('keydown',event=>{if(event.key==='F2'){event.preventDefault();event.stopPropagation();rename(name,layer);}else if(adjustment&&event.key==='Enter'&&event.altKey){event.preventDefault();event.stopPropagation();onAction('edit-filter',{id:layer.id});}});
  const more=button('','Layer actions for '+layer.name,event=>{event.preventDefault();event.stopPropagation();openLayerMenu(layer.id,more.getBoundingClientRect());});more.className='layer-more';more.innerHTML=icon('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded',String(!layerMenu.hidden&&layerMenu.dataset.layerId===layer.id));more.setAttribute('aria-controls','layer-context-menu');
  row.addEventListener('contextmenu',event=>{event.preventDefault();if(!getBusy())openLayerMenu(layer.id,{left:event.clientX,right:event.clientX,top:event.clientY,bottom:event.clientY});});
  row.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();event.stopPropagation();openLayerMenu(layer.id,row.getBoundingClientRect());}});
  row.addEventListener('click',event=>{if(!event.target.closest('button,input'))selectLayer(layer,event);});
  row.addEventListener('keydown',event=>{if(!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key)||getBusy())return;const local=frameLayers(getState()),index=local.findIndex(item=>item.id===layer.id),delta=event.key==='ArrowUp'?1:-1,target=local[index+delta];if(!target)return;event.preventDefault();event.stopPropagation();onAction('reorder-layer',{id:layer.id,targetId:target.id,before:delta<0});});
  row.addEventListener('dragstart',event=>{if(getBusy()||layer.locked||event.target.closest('input')){event.preventDefault();return;}draggedId=layer.id;row.classList.add('is-dragging');if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-basement-layer',layer.id);event.dataTransfer.setData('text/plain',layer.id);}});
  row.addEventListener('dragover',event=>{if(!draggedId||draggedId===layer.id||getBusy())return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';clearDropTargets();const rect=row.getBoundingClientRect();row.classList.add('drop-target');row.dataset.dropPosition=event.clientY<rect.top+rect.height/2?'above':'below';});
  row.addEventListener('dragleave',event=>{if(!row.contains(event.relatedTarget)){row.classList.remove('drop-target');delete row.dataset.dropPosition;}});row.addEventListener('drop',event=>{const id=draggedId||event.dataTransfer?.getData('application/x-basement-layer');if(!id||id===layer.id||getBusy()||!frameLayers(getState()).some(item=>item.id===id))return;event.preventDefault();event.stopPropagation();const rect=row.getBoundingClientRect();draggedId=null;clearDropTargets();onAction('reorder-layer',{id,targetId:layer.id,before:!(event.clientY<rect.top+rect.height/2)});});row.addEventListener('dragend',()=>{draggedId=null;row.classList.remove('is-dragging');clearDropTargets();});
  for(const control of [visibility,lock,select,visual,more])control.disabled=busy;
  row.append(visibility,lock,visual,select,more);return row;
 }
 list.addEventListener('keydown',event=>{
  if(getBusy()||event.target.closest('input,textarea,[contenteditable=true]'))return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='a'){event.preventDefault();event.stopPropagation();onAction('select-all-layers');return;}
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();onAction('delete-layer');return;}
  if(event.altKey||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  const state=getState(),local=[...frameLayers(state)].reverse(),id=event.target.closest('[data-layer-id]')?.dataset.layerId||state.activeLayerId,index=local.findIndex(layer=>layer.id===id),next=event.key==='Home'?0:event.key==='End'?local.length-1:Math.max(0,Math.min(local.length-1,index+(event.key==='ArrowDown'?1:-1))),layer=local[next];
  if(!layer)return;event.preventDefault();event.stopPropagation();selectLayer(layer,event);requestAnimationFrame(()=>list.querySelector('[data-layer-id="'+layer.id+'"] .layer-select')?.focus({preventScroll:true}));
 });
 function render(){
  const state=getState(),busy=getBusy(),local=frameLayers(state),active=local.find(layer=>layer.id===state.activeLayerId),index=local.indexOf(active),chosen=selectedIds(state),selected=local.filter(layer=>chosen.has(layer.id));
  list.replaceChildren();for(const layer of [...local].reverse())list.append(layerRow(state,layer,busy));
  const frame=state.frames?.find(frame=>frame.id===state.activeFrameId),frameName=document.querySelector('#layers-frame-name');if(frameName)frameName.textContent=frame?.name||'Layers';
  opacity.value=Math.round((active?.opacity??1)*100);opacity.disabled=busy||!selected.length||selected.every(layer=>layer.locked);const mixed=selected.some(layer=>layer.opacity!==active?.opacity);document.querySelector('#layer-opacity-value').textContent=mixed?'—':opacity.value+'%';opacity.title=mixed?'Mixed layer opacities':'Selected layer opacity';
  document.querySelector('#layer-add').disabled=busy||state.layers.length>=512||!frame&&!!state.activeFrameId;document.querySelector('#layer-duplicate').disabled=busy||!selected.length||state.layers.length+selected.length>512;
  document.querySelector('#layer-delete').disabled=busy||!selected.some(layer=>!layer.locked);document.querySelector('#layer-up').disabled=busy||!active||index===local.length-1;document.querySelector('#layer-down').disabled=busy||!active||index<=0;document.querySelector('#selection-to-layer').disabled=busy||!(state.selection||[]).length||state.layers.length>=512;document.querySelector('#add-filter').disabled=busy||state.layers.length>=512||!frame&&!!state.activeFrameId;
  syncAdjustment(state,busy);layerPanels.sync(state,busy);if(!busy)queueThumbnails();
 }
 return{render,openFilter,closeFilter,openNewLayer:()=>layerPanels.openNewLayer(),openBlending:id=>layerPanels.openBlending(id),closeLayerPanel:()=>layerPanels.close()};
}
