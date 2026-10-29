import {normalizeBlending as defaultBlending} from './endo-brushes.js';
import {renderMaterialSample} from './endo-samples.js';

const icon=content=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+content+'</svg>';
const materials=[['none','Normal'],['cromo','Chrome'],['relief','Relief'],['sand','Magnetic sand'],['crayon','Crayon'],['cement','Cement'],['dust','Powder']];
const materialPalette=(primary='#8795a8')=>{const channels=[1,3,5].map(index=>parseInt(primary.slice(index,index+2),16));const hex=values=>'#'+values.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');return{primary,shadow:hex(channels.map(value=>value*.12)),contrast:hex(channels.map(value=>value+(255-value)*.88))};};
const settings=[['strength','Mix',0,100,1,'%'],['relief','Depth',.1,2,.05,''],['shine','Shine',0,100,1,'%'],['roughness','Roughness',0,100,1,'%'],['grain','Grain',0,100,1,'%'],['density','Density',0,100,1,'%'],['particleSize','Scale',.4,6,.1,'px'],['ridge','Ridge',0,100,1,'%'],['light','Light angle',0,360,1,'°']];


// Creation and material editing temporarily take the inspector's entire column.
// Neither a canvas click nor a tool change dismisses the layer editor.
export function createLayerPanels({getState,onAction,getBusy,onOpen=()=>{},onClose=()=>{}}){
 const sidebar=document.querySelector('.shell-right');
 const panel=document.createElement('section');panel.id='layer-properties-panel';panel.className='layer-properties-panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-labelledby','layer-properties-title');
 panel.innerHTML='<header><strong id="layer-properties-title">New Layer</strong><button type="button" id="layer-properties-close" aria-label="Close layer properties" title="Close">'+icon('<path d="m6 6 12 12M18 6 6 18"/>')+'</button></header><div class="layer-properties-scroll"></div><footer></footer>';
 sidebar.append(panel);const title=panel.querySelector('strong'),body=panel.querySelector('.layer-properties-scroll'),footer=panel.querySelector('footer');
 let mode=null,layerId=null,opener=null,fields=new Map(),materialButtons=[],colorFields=[],emptyInfo=null,sampleFrame=null,sampleSignature=null;
 const makeButton=(label,action,id)=>{const button=document.createElement('button');button.type='button';button.textContent=label;if(id)button.id=id;button.addEventListener('click',action);return button;};
 const current=()=>getState().layers.find(layer=>layer.id===layerId);
 const effective=layer=>({...defaultBlending(),...(layer?.blending||{})});
 function announce(value){document.dispatchEvent(new CustomEvent('endo-sidebar-mode',{detail:{mode:value}}));document.dispatchEvent(new Event('endo-shell-layout'));}
 function close(restoreFocus=true){if(!mode)return;onAction('finish-edit');panel.hidden=true;const previous=mode;mode=null;layerId=null;window.basementEndoLayerPanelOpen=false;if(sidebar.dataset.sidebarMode===previous){delete sidebar.dataset.sidebarMode;announce(null);}onClose();if(restoreFocus)(opener?.isConnected?opener:document.querySelector('#artboard'))?.focus({preventScroll:true});}
 function open(next,id){document.dispatchEvent(new Event('endo-layer-panel-open'));if(getBusy())return;onAction('finish-edit');onOpen();opener=document.activeElement;mode=next;layerId=id||null;sidebar.dataset.sidebarMode=mode;panel.dataset.mode=mode;panel.hidden=false;window.basementEndoLayerPanelOpen=true;body.replaceChildren();footer.replaceChildren();fields.clear();materialButtons=[];colorFields=[];sampleSignature=null;announce(mode);}
 function openNewLayer(){
  open('new-layer');if(mode!=='new-layer')return;title.textContent='New Layer';
  const state=getState(),count=state.layers.filter(layer=>layer.frameId===state.activeFrameId&&layer.kind==='paint').length;
  const form=document.createElement('form');form.id='new-layer-form';
  const label=document.createElement('label');label.className='layer-property-name';label.textContent='Name';const input=document.createElement('input');input.type='text';input.id='new-layer-name';input.maxLength=80;input.required=true;input.autocomplete='off';input.value='Layer '+(count+1);label.append(input);form.append(label);
  const hint=document.createElement('p');hint.className='layer-properties-note';hint.textContent='Paint on this layer. Add textures later from Blending Options.';form.append(hint);
  const frameName=document.createElement('p');frameName.className='layer-properties-frame';frameName.textContent=state.frames.find(frame=>frame.id===state.activeFrameId)?.name||'Active artboard';form.append(frameName);body.append(form);
  const cancel=makeButton('Cancel',()=>close(), 'new-layer-cancel');
  const create=document.createElement('button');create.type='submit';create.id='new-layer-create';create.className='primary';create.textContent='Create Layer';create.setAttribute('form',form.id);footer.append(cancel,create);
  form.addEventListener('submit',event=>{event.preventDefault();if(getBusy())return;const name=input.value.trim();if(!name){input.focus();return;}const previous=getState().activeLayerId;onAction('create-layer',{name});if(getState().activeLayerId!==previous)close(false);});
  input.focus({preventScroll:true});input.select();sync(getState(),getBusy());
 }
 function updateBlending(patch,element){const layer=current();if(!layer||layer.locked||getBusy())return;onAction('layer-blending',{id:layerId,value:{...effective(layer),...patch},element});sync(getState(),getBusy());}
 function openBlending(id){
  const layer=getState().layers.find(item=>item.id===id);if(!layer||layer.kind!=='paint')return;open('blending',id);if(mode!=='blending')return;title.textContent='Blending Options';
  const target=document.createElement('p');target.className='layer-properties-target';target.textContent=layer.name;body.append(target);
  const heading=document.createElement('h3');heading.textContent='Material';body.append(heading);
  const gallery=document.createElement('div');gallery.className='layer-material-gallery';gallery.setAttribute('role','group');gallery.setAttribute('aria-label','Layer material');
  for(const[value,label]of materials){const button=makeButton('',()=>{updateBlending({material:value},button);onAction('finish-edit');});button.dataset.layerMaterial=value;const sample=document.createElement('canvas');sample.width=240;sample.height=96;sample.dataset.materialSample=value;sample.setAttribute('aria-hidden','true');button.append(sample);const name=document.createElement('span');name.textContent=label;button.append(name);button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed','false');gallery.append(button);materialButtons.push(button);}body.append(gallery);
  emptyInfo=document.createElement('p');emptyInfo.className='layer-properties-note';emptyInfo.textContent='Normal keeps the original paint. Choose a material to texture this layer.';body.append(emptyInfo);
  const controls=document.createElement('div');controls.className='layer-material-controls';
  for(const[key,label,min,max,step,unit]of settings){const row=document.createElement('label');row.className='layer-material-control';row.dataset.blendingRow=key;const caption=document.createElement('span');caption.textContent=label;
   const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.step=step;range.dataset.blendingParameter=key;range.setAttribute('aria-label','Material '+label.toLowerCase());
   const number=document.createElement('input');number.type='number';number.min=min;number.max=max;number.step=step;number.dataset.blendingValue=key;number.setAttribute('aria-label',range.getAttribute('aria-label')+' value');number.title=unit;
   for(const input of[range,number]){input.addEventListener('input',()=>{const value=input.valueAsNumber;if(!Number.isFinite(value))return;const next=Math.max(min,Math.min(max,value));range.value=next;number.value=next;updateBlending({[key]:next},input);});input.addEventListener('change',()=>onAction('finish-edit'));input.addEventListener('blur',()=>{onAction('finish-edit');sync(getState(),getBusy());});input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}});}
   row.append(caption,range,number);controls.append(row);fields.set(key,{range,number,min,max,row});
  }body.append(controls);
  const colors=document.createElement('div');colors.className='layer-material-colors';const colorTitle=document.createElement('h3');colorTitle.textContent='Material colors';colors.append(colorTitle);
  for(const[key,label]of[['primary','Base'],['contrast','Contrast'],['shadow','Shadow']]){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type='color';input.dataset.blendingColor=key;input.setAttribute('aria-label','Material '+label.toLowerCase()+' color');input.addEventListener('input',()=>updateBlending({[key]:input.value},input));input.addEventListener('change',()=>onAction('finish-edit'));input.addEventListener('blur',()=>onAction('finish-edit'));row.append(input);colors.append(row);colorFields.push({key,input});}body.append(colors);
  const reset=makeButton('Reset',()=>{if(getBusy()||current()?.locked)return;onAction('layer-blending',{id:layerId,value:defaultBlending(),element:reset});onAction('finish-edit');sync(getState(),getBusy());});reset.id='layer-blending-reset';const done=makeButton('Done',()=>close());done.id='layer-blending-done';done.className='primary';footer.append(reset,done);sync(getState(),getBusy());panel.querySelector('[data-layer-material="'+effective(layer).material+'"]')?.focus({preventScroll:true});
 }
 function queueMaterialSamples(){
  if(sampleFrame!==null)return;
  sampleFrame=requestAnimationFrame(()=>{
   sampleFrame=null;if(mode!=='blending'||panel.hidden||getBusy())return;
   const state=getState(),layer=state.layers.find(item=>item.id===layerId);if(!layer)return;
   const source=state.strokes.find(stroke=>stroke.layerId===layerId&&stroke.operation!=='erase')?.settings||state.defaults;
   const values=effective(layer),parameters={...values,primary:values.primary||source.primary||state.defaults.primary||'#8795a8'};delete parameters.material;
   const signature=JSON.stringify(parameters);if(sampleSignature===signature)return;
   for(const button of materialButtons)renderMaterialSample(button.querySelector('canvas'),button.dataset.layerMaterial,parameters);
   sampleSignature=signature;
  });
 }
 function sync(state=getState(),busy=getBusy()){
  if(!mode||panel.hidden)return;
  if(mode==='new-layer'){const disabled=busy||state.layers.length>=512;panel.querySelector('#new-layer-create').disabled=disabled;panel.querySelector('#new-layer-name').disabled=disabled;return;}
  const layer=state.layers.find(item=>item.id===layerId&&item.frameId===state.activeFrameId&&item.kind==='paint');if(!layer){close(false);return;}const values=effective(layer),disabled=busy||layer.locked,normal=values.material==='none';
  panel.dataset.layerId=layerId;body.querySelector('.layer-properties-target').textContent=layer.name+(layer.locked?' · Locked':'');
  for(const button of materialButtons){button.disabled=disabled;button.setAttribute('aria-pressed',String(button.dataset.layerMaterial===values.material));}
  emptyInfo.hidden=!normal;body.querySelector('.layer-material-controls').hidden=normal;body.querySelector('.layer-material-colors').hidden=normal;
  for(const[key,{range,number,min,max}]of fields){const value=values[key];if(document.activeElement!==range)range.value=value;if(document.activeElement!==number)number.value=value;range.style.setProperty('--fill',((value-min)/(max-min)*100)+'%');range.disabled=number.disabled=disabled;}
  const sourcePaint=state.strokes.find(stroke=>stroke.layerId===layerId&&stroke.operation!=='erase')?.settings,palette=materialPalette(values.primary||sourcePaint?.primary||state.defaults.primary||'#8795a8');for(const{key,input}of colorFields){const value=values[key]||palette[key];if(document.activeElement!==input)input.value=value;input.title=values[key]?'Material color override':key==='primary'?'Inherited from layer paint':'Derived from the base color';input.disabled=disabled;}
  panel.querySelector('#layer-blending-reset').disabled=disabled;if(!busy)queueMaterialSamples();
 }
 panel.querySelector('#layer-properties-close').addEventListener('click',()=>close());
 panel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape'||!mode||window.basementEndoPopoverOpen||document.querySelector('dialog[open]'))return;event.preventDefault();event.stopImmediatePropagation();close();},true);
 document.addEventListener('endo-sidebar-mode',event=>{if(mode&&event.detail?.mode!==mode){onAction('finish-edit');mode=null;layerId=null;panel.hidden=true;window.basementEndoLayerPanelOpen=false;}});
 window.addEventListener('basement-session-blocked',()=>close(false));window.addEventListener('basement-write-error',()=>close(false));
 window.basementCloseLayerPanel=()=>close(false);
 return{openNewLayer,openBlending,close,sync};
}
