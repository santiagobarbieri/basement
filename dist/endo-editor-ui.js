const labels={threshold:'Threshold',dither:'Dither',grayscale:'Grayscale',invert:'Invert'};
export function createEditorUI({getState,onAction,getBusy}){
 const list=document.querySelector('#layer-list'),filters=document.querySelector('#filter-list');
 const button=(text,title,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.addEventListener('click',action);return b;};
 for(const [id,action]of [['layer-add','add-layer'],['layer-duplicate','duplicate-layer'],['layer-delete','delete-layer'],['layer-up','layer-up'],['layer-down','layer-down'],['selection-to-layer','selection-to-layer'],['add-filter','add-filter']])document.querySelector('#'+id).addEventListener('click',()=>onAction(action,{type:document.querySelector('#filter-type').value}));
 const opacity=document.querySelector('#layer-opacity');
 opacity.addEventListener('input',()=>{document.querySelector('#layer-opacity-value').textContent=opacity.value+'%';onAction('layer-opacity',{value:Number(opacity.value)/100,element:opacity});});
 opacity.addEventListener('change',()=>onAction('finish-edit'));
 function render(){
  const state=getState(),busy=getBusy(),active=state.layers.find(layer=>layer.id===state.activeLayerId),index=state.layers.indexOf(active);
  list.replaceChildren();
  for(const layer of [...state.layers].reverse()){
   const row=document.createElement('div');row.className='layer-row';row.dataset.layerId=layer.id;row.setAttribute('role','listitem');row.classList.toggle('active',layer.id===state.activeLayerId);
   const visibility=button(layer.visible?'◉':'○',layer.visible?'Hide '+layer.name:'Show '+layer.name,()=>onAction('layer-visible',{id:layer.id}));visibility.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(layer.visible?'':'<path d="m3 3 18 18"/>')+'</svg>';visibility.className='layer-visibility';visibility.setAttribute('aria-pressed',String(layer.visible));
   const lock=button(layer.locked?'▣':'◇',layer.locked?'Unlock '+layer.name:'Lock '+layer.name,()=>onAction('layer-lock',{id:layer.id}));lock.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="'+(layer.locked?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 7-2')+'"/></svg>';lock.className='layer-lock';lock.setAttribute('aria-pressed',String(layer.locked));
   const select=button('','Select '+layer.name,()=>onAction('activate-layer',{id:layer.id}));select.className='layer-select';select.setAttribute('aria-pressed',String(layer.id===state.activeLayerId));
   const name=document.createElement('span');name.className='layer-name';name.textContent=layer.name;select.append(name);
   const info=document.createElement('small');info.className='layer-info';const count=state.strokes.filter(s=>s.layerId===layer.id&&s.operation!=='erase').length;info.textContent=count+' stroke'+(count===1?'':'s')+(layer.filters.length?' · '+layer.filters.length+' filter'+(layer.filters.length===1?'':'s'):'');select.append(info);
   name.addEventListener('dblclick',event=>{
    event.preventDefault();event.stopPropagation();
    const input=document.createElement('input');input.className='layer-name-input';input.value=layer.name;input.maxLength=80;input.setAttribute('aria-label','Layer name');name.replaceWith(input);input.focus();input.select();
    let done=false;const finish=()=>{if(done)return;done=true;onAction('rename-layer',{id:layer.id,name:input.value.trim()||layer.name});};
    input.addEventListener('click',e=>e.stopPropagation());input.addEventListener('blur',finish);input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish();}if(e.key==='Escape'){input.value=layer.name;finish();}});
   });
   for(const b of [visibility,lock,select])b.disabled=busy;
   row.append(visibility,lock,select);list.append(row);
  }
  opacity.value=Math.round((active?.opacity??1)*100);opacity.disabled=busy||!active;document.querySelector('#layer-opacity-value').textContent=opacity.value+'%';
  for(const id of ['layer-add','layer-duplicate'])document.querySelector('#'+id).disabled=busy||state.layers.length>=64;
  document.querySelector('#layer-delete').disabled=busy||state.layers.length<=1;
  document.querySelector('#layer-up').disabled=busy||index===state.layers.length-1;
  document.querySelector('#layer-down').disabled=busy||index<=0;
  document.querySelector('#selection-to-layer').disabled=busy||!state.selection.length||state.layers.length>=64;
  document.querySelector('#filter-layer-label').textContent='Filters on '+(active?.name||'the active layer')+'. Original strokes stay editable.';
  document.querySelector('#add-filter').disabled=busy||!active||active.locked||active.filters.length>=8;
  filters.replaceChildren();
  if(!active?.filters.length){const p=document.createElement('p');p.className='panel-note';p.textContent='Add a filter to this layer. You can adjust, disable or remove it later.';filters.append(p);}
  for(const filter of active?.filters||[]){
   const row=document.createElement('section');row.className='filter-row';row.dataset.filterId=filter.id;
   const header=document.createElement('div');header.className='filter-heading';const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=filter.enabled!==false;toggle.setAttribute('aria-label','Enable '+labels[filter.type]);toggle.disabled=busy||active.locked;toggle.addEventListener('change',()=>onAction('filter-toggle',{id:filter.id}));
   const name=document.createElement('strong');name.textContent=labels[filter.type];const remove=button('×','Remove '+labels[filter.type],()=>onAction('filter-remove',{id:filter.id}));remove.disabled=busy||active.locked;header.append(toggle,name,remove);row.append(header);
   for(const [key,title,min,max]of filter.type==='threshold'?[['amount','Threshold',0,255]]:filter.type==='dither'?[['amount','Threshold',0,255],['scale','Pattern size',1,16]]:[]){
    const label=document.createElement('label');label.className='filter-control';const text=document.createElement('span');text.textContent=title;const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=1;input.value=filter[key]??(key==='amount'?128:2);input.setAttribute('aria-label',labels[filter.type]+' '+title.toLowerCase());input.disabled=busy||active.locked;const value=document.createElement('output');value.textContent=input.value;
    input.addEventListener('input',()=>{value.textContent=input.value;onAction('filter-input',{id:filter.id,key,value:Number(input.value),element:input});});input.addEventListener('change',()=>onAction('finish-edit'));label.append(text,input,value);row.append(label);
   }
   filters.append(row);
  }
 }
 return {render};
}
