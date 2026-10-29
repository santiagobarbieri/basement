import {setupArtboardPanel} from './endo-artboards.js';
import {BRUSH_PRESETS,brushPreset} from './endo-brushes.js';
import {renderBrushSample} from './endo-samples.js';
import {createBrushPicker} from './endo-brush-picker.js';
// Pincel y color conservan una sola instancia de sus controles y su estado.
const $=selector=>document.querySelector(selector);
const glyph=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
const brushIcon=glyph('<path d="m15 4 5 5-9 9-7 2 2-7 9-9ZM13 6l5 5"/>');
const closeIcon=glyph('<path d="m6 6 12 12M18 6 6 18"/>');
export function setupEndoPopovers(){
 if($('#brush-popover'))return;
 const host=$('.shell-popovers'),art=$('#artboard'),viewport=$('#canvas-viewport');
 const blocked=()=>window.basementSessionBlocked||!!document.querySelector('dialog[open]');
 let colorToken=null,oldColors=null,oldLink=true,colorRole='primary',popupDrag=null,opener=null,currentBrush={brush:'basic',tip:'round',brushPreset:'round'};
 function popup(id,label){
  const node=document.createElement('section');node.id=id;node.className='endo-popover';node.hidden=true;node.setAttribute('role','dialog');node.setAttribute('aria-modal','false');node.setAttribute('aria-labelledby',id+'-title');
  node.innerHTML='<header class="popover-header" tabindex="0"><strong id="'+id+'-title">'+label+'</strong><span class="popover-scope"></span><button type="button" id="'+id+'-close" class="popover-close" aria-label="Close '+label+'" title="Close · Esc">'+closeIcon+'</button></header><div class="popover-body"></div>';
  host.append(node);return node;
 }
 const brush=popup('brush-popover','Brush'),color=popup('color-popover','Color'),repeat=popup('repeat-popover','Repeat');
 const brushBody=brush.querySelector('.popover-body'),colorBody=color.querySelector('.popover-body');
 const brushPanel=$('.brush-panel');brushBody.append(brushPanel);$('#endo-controls-bank').append($('.scene-card'));
 const gallery=brushPanel.querySelector('.brush-switch');gallery.replaceChildren();gallery.setAttribute('aria-label','Brush shapes');
 const brushHeading=brushPanel.querySelector('.section-heading');brushHeading.querySelector('h2').textContent='Brushes';brushHeading.querySelector('.section-caption').textContent=BRUSH_PRESETS.length+' brushes';
 for(const preset of BRUSH_PRESETS){
  const item=document.createElement('button');item.type='button';item.dataset.brushTip=preset.id;item.dataset.tip=preset.tip;item.title=preset.label;item.setAttribute('aria-label',preset.label+' brush');item.setAttribute('aria-pressed',String(preset.id==='round'));
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=96;canvas.className='rendered-brush-sample';canvas.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=preset.label;item.append(canvas,label);item.addEventListener('click',()=>chooseBrush(preset));gallery.append(item);
 }
 const sizes=document.createElement('div');sizes.className='brush-quick-sizes';sizes.setAttribute('role','group');sizes.setAttribute('aria-label','Quick brush sizes');
 for(const width of [2,5,10,20,40,80]){const item=document.createElement('button');item.type='button';item.dataset.brushSize=width;item.title=width+' px';item.setAttribute('aria-label',width+' pixel brush');item.innerHTML='<span class="brush-size-dot" style="--diameter:'+Math.min(18,Math.max(2,width*.3))+'px"></span><small>'+width+'</small>';item.addEventListener('click',()=>{const field=$('#controls [data-control=width] input[type=range]');if(!field||field.disabled)return;field.value=width;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});sizes.append(item);}gallery.after(sizes);
 function chooseBrush(preset){if(blocked()||window.basementEndoBusy?.())return;document.dispatchEvent(new CustomEvent('endo-brush-tip',{detail:{...preset,brush:'basic',brushPreset:preset.id}}));}
 function drawBrushSamples(){
  const primary=$('#primary').value;
  for(const item of gallery.children)renderBrushSample(item.querySelector('canvas'),brushPreset(item.dataset.brushTip),{primary});
 }
 repeat.querySelector('.popover-body').append($('.symmetry-panel'));$('#inspector-symmetry').remove();
 setupArtboardPanel();
 const preview=document.createElement('canvas');preview.id='brush-popup-preview';preview.width=640;preview.height=210;preview.setAttribute('aria-label','Brush preview');brushBody.prepend(preview);
 const launcher=document.createElement('button');launcher.id='open-brush-popover';launcher.type='button';launcher.className='brush-popover-launcher';launcher.title='Brush settings · Double click Brush or right click canvas';launcher.setAttribute('aria-label','Brush settings');launcher.innerHTML=brushIcon+'<canvas width="160" height="50" aria-hidden="true"></canvas><span class="brush-launcher-size"></span><span aria-hidden="true">⌄</span>';$('#brush-options-bar').append(launcher);
 const material=document.createElement('select');material.id='brush-type';material.setAttribute('aria-label','Brush shape');material.title='Brush shape';for(const preset of BRUSH_PRESETS){const option=document.createElement('option');option.value=preset.id;option.textContent=preset.label;material.append(option);}launcher.before(material);material.addEventListener('change',()=>chooseBrush(brushPreset(material.value)));
 const brushPicker=createBrushPicker({select:material,host,getSettings:()=>({...currentBrush,primary:$('#primary').value}),onChoose:chooseBrush,beforeOpen:()=>{closeBrush();closeRepeat();},isBlocked:()=>blocked()||!!window.basementEndoBusy?.()});
 launcher.addEventListener('click',()=>openBrush(launcher));
 const samples=document.createElement('div');samples.className='settings-color-samples';samples.setAttribute('role','group');samples.setAttribute('aria-label','Paint color');
 for(const[role,name]of [['primary','Paint color']]){
  const button=document.createElement('button');button.type='button';button.dataset.openColor=role;button.title=name;button.setAttribute('aria-label',name);button.innerHTML='<span class="settings-color-swatch"></span>'+glyph(role==='primary'?'<circle cx="12" cy="12" r="7"/>':role==='contrast'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>':'<path d="M19 14A8 8 0 0 1 10 5a8 8 0 1 0 9 9Z"/>');button.addEventListener('click',()=>openColor(role,button));samples.append(button);
 }
 launcher.after(samples);for(const button of samples.children)button.querySelector('svg').remove();$('#inspector-brush').remove();
 const colors=$('.colors-panel');colorBody.append(colors);
 $('#tab-color')?.remove();$('#inspector-color').remove();
 const contrastLabel=colors.querySelector('[data-color=contrast]');contrastLabel.firstChild.nodeValue='Highlight';
 const roles=colors.querySelector('.color-roles'),square=$('#color-square'),hue=$('#color-hue'),picker=$('#color-picker'),hex=colors.querySelector('.hex-field'),rgb=colors.querySelector('.rgb-fields');
 const spectrum=document.createElement('div');spectrum.className='popover-color-spectrum';spectrum.append(square,hue);
 const channels=document.createElement('div');channels.className='popover-color-channels';
 const comparison=document.createElement('div');comparison.className='color-comparison';comparison.innerHTML='<div><span id="color-active-swatch"></span><small>New</small></div><div><span id="color-original-swatch"></span><small>Current</small></div>';
 // The active swatch already exists: move it, without creating a duplicate ID.
 const oldSwatch=colors.querySelector('.colors-heading #color-active-swatch');comparison.querySelector('#color-active-swatch').replaceWith(oldSwatch);
 const hsb=document.createElement('div');hsb.className='hsb-fields';
 for(const[key,label,max]of [['h','H',360],['s','S',100],['v','B',100]]){const field=document.createElement('label');field.textContent=label;const input=document.createElement('input');input.id='color-'+key;input.type='number';input.min=0;input.max=max;input.step=1;input.setAttribute('aria-label',{h:'Hue value',s:'Saturation value',v:'Brightness value'}[key]);field.append(input);hsb.append(field);}
 channels.append(comparison,hsb,rgb,hex);picker.replaceChildren(spectrum,channels);colors.prepend(roles);
 const editingRole=document.createElement('p');editingRole.id='color-editing-role';editingRole.setAttribute('role','status');colorBody.prepend(editingRole);
 const footer=document.createElement('footer');footer.className='popover-footer';footer.innerHTML='<button type="button" id="color-popover-cancel">Cancel</button><button type="button" id="color-popover-ok" class="popover-confirm">OK</button>';color.append(footer);
 function flags(){window.basementEndoColorOpen=!color.hidden;window.basementEndoPopoverOpen=!color.hidden||!brush.hidden||!repeat.hidden;}
 function clamp(node,x,y){const r=node.getBoundingClientRect();node.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x))+'px';node.style.top=Math.max(8,Math.min(innerHeight-r.height-8,y))+'px';}
 function sync(){
  const scope=$('#stroke-scope').textContent==='Adjustment layer'?'New stroke':$('#stroke-scope').textContent,help=$('#stroke-scope-help').textContent;
  for(const node of [brush,color,repeat]){node.querySelector('.popover-scope').textContent=scope;node.querySelector('.popover-scope').title=help;}
  for(const button of samples.children){const value=$('#'+button.dataset.openColor).value;button.querySelector('.settings-color-swatch').style.background=value;button.style.backgroundColor=value;button.title={primary:'Paint color',contrast:'Material highlight',shadow:'Material shadow'}[button.dataset.openColor]+' · '+value.toUpperCase();}
  const chosen=BRUSH_PRESETS.find(preset=>preset.id===(currentBrush.brushPreset||currentBrush.tip))||BRUSH_PRESETS.find(preset=>preset.tip===currentBrush.tip)||brushPreset('round');material.value=chosen.id;brushPicker.sync({...currentBrush,primary:$('#primary').value});for(const item of gallery.children)item.setAttribute('aria-pressed',String(item.dataset.brushTip===chosen.id));
  const basic=currentBrush.brush==='basic';color.dataset.paintMode=String(basic);colors.querySelector('[data-color=primary]').firstChild.nodeValue=basic?'Paint color':'Base color';if(basic&&colorRole!=='primary'){colorRole='primary';colors.querySelector('[data-color=primary]').click();}
  for(const item of sizes.children)item.setAttribute('aria-pressed',String(Number(item.dataset.brushSize)===Number($('#controls [data-control=width] input')?.value)));drawBrushSamples();
  const source=$('#preview'),context=preview.getContext('2d');context.clearRect(0,0,preview.width,preview.height);context.drawImage(source,0,0,preview.width,preview.height);
  const mini=launcher.querySelector('canvas');mini.getContext('2d').clearRect(0,0,mini.width,mini.height);mini.getContext('2d').drawImage(source,0,0,mini.width,mini.height);
  launcher.querySelector('.brush-launcher-size').textContent=($('#controls [data-control=width] input')?.value??28)+' px';
  for(const node of [brush,color,repeat])if(!node.hidden&&node.style.left){const r=node.getBoundingClientRect();clamp(node,r.left,r.top);}
  if(oldColors){colorRole=colors.querySelector('[data-color][aria-pressed=true]')?.dataset.color||colorRole;$('#color-original-swatch').style.background=oldColors[colorRole];}
  editingRole.textContent=currentBrush.brush==='basic'?'Editing paint color':'Editing '+({primary:'base color',contrast:'material highlight',shadow:'material shadow'}[colorRole]);
 }
 function closeRepeat(){if(repeat.hidden)return;repeat.hidden=true;document.dispatchEvent(new Event('endo-finish-edit'));flags();}
 function openRepeat(anchor){if(blocked()||window.basementEndoBusy?.())return;closeBrush();closeRepeat();repeat.hidden=false;flags();const r=anchor?.getBoundingClientRect?.();clamp(repeat,r?.right+8||54,r?.top||100);}
 function closeBrush(focus=false){if(brush.hidden)return;brush.hidden=true;document.dispatchEvent(new Event('endo-finish-edit'));flags();if(focus)art.focus({preventScroll:true});}
 function closeColor(confirm=false,focus=true){
  if(color.hidden)return;
  // Blur while the preview transaction is still active, then commit once.
  if(color.contains(document.activeElement))document.activeElement.blur();
  color.hidden=true;
  if(confirm)window.basementEndoEditSession.commit(colorToken);
  else{window.basementEndoEditSession.cancel(colorToken);$('#color-link').checked=oldLink;try{localStorage.setItem('endo-linked-colors',String(oldLink));}catch{}}
  colorToken=null;oldColors=null;flags();sync();document.dispatchEvent(new Event('endo-settings'));if(focus)art.focus({preventScroll:true});
 }
 function openBrush(anchor){
  if(blocked()||window.basementEndoBusy?.())return;
  brushPicker.close();
  closeColor(false,false);closeBrush();closeRepeat();opener=anchor;brush.hidden=false;flags();sync();
  const r=anchor?.getBoundingClientRect?.(),left=r?(r.left>innerWidth/2?r.left-brush.offsetWidth-12:r.right+8):50;clamp(brush,anchor?.clientX??left,anchor?.clientY??(r?.top??80));
  const size=brush.querySelector('[data-control=width] input[type=number]');size?.focus({preventScroll:true});
 }
 function openColor(role='primary',anchor=null){
  if(blocked())return;
  brushPicker.close();
  if(currentBrush.brush==='basic')role='primary';
  if(!color.hidden){colors.querySelector('[data-color="'+role+'"]')?.click();sync();return;}
  if(window.basementEndoBusy?.())return;closeBrush();closeRepeat();opener=anchor;
  colorToken=window.basementEndoEditSession.begin('color');if(!colorToken)return;
  oldColors=Object.fromEntries(['primary','contrast','shadow'].map(key=>[key,$('#'+key).value]));oldLink=$('#color-link').checked;colorRole=role;
  color.hidden=false;flags();colors.querySelector('[data-color="'+role+'"]')?.click();sync();
  const inset=window.basementCanvasInsets?.()||{left:0,right:0,top:0,bottom:0};const rect=color.getBoundingClientRect();clamp(color,(inset.left+innerWidth-inset.right-rect.width)/2,(innerHeight-rect.height)/2);
  $('#color-hex').focus({preventScroll:true});$('#color-hex').select();
 }
 launcher.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();openBrush(launcher);}});
 $('#toolbar-colors').addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openColor(event.target.closest('[data-toolbar-color]')?.dataset.toolbarColor||'primary',$('#toolbar-colors'));},true);
 for(const button of document.querySelectorAll('.cursor-modes button[data-mode=draw],.cursor-modes button[data-mode=erase]'))button.addEventListener('dblclick',event=>{event.preventDefault();openBrush(button);});
 art.addEventListener('contextmenu',event=>{if(['draw','erase'].includes(viewport.dataset.mode)){event.preventDefault();openBrush({clientX:event.clientX,clientY:event.clientY});}});
 $('#repeat-popover-close').addEventListener('click',closeRepeat);
 $('#brush-popover-close').addEventListener('click',()=>closeBrush(true));$('#color-popover-close').addEventListener('click',()=>closeColor(false));$('#color-popover-cancel').addEventListener('click',()=>closeColor(false));$('#color-popover-ok').addEventListener('click',()=>closeColor(true));
 for(const event of ['endo-settings','endo-colors-changed','endo-preview'])document.addEventListener(event,sync);
 for(const event of ['input','click'])colors.addEventListener(event,()=>queueMicrotask(sync));
 document.addEventListener('pointerdown',event=>{
  if(!color.hidden&&!color.contains(event.target)&&!event.target.closest('#toolbar-colors,[data-open-color]')){
   const canvasTarget=viewport.contains(event.target);closeColor(false,false);
   if(canvasTarget){event.preventDefault();event.stopImmediatePropagation();art.focus({preventScroll:true});return;}
  }
  if(!repeat.hidden&&!repeat.contains(event.target)&&!event.target.closest('[data-open-inspector=symmetry]'))closeRepeat();
  if(!brush.hidden&&!brush.contains(event.target)&&!event.target.closest('#open-brush-popover'))closeBrush();
 },true);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&(!brush.hidden||!color.hidden||!repeat.hidden)){event.preventDefault();event.stopImmediatePropagation();if(!color.hidden)closeColor(false);else if(!brush.hidden)closeBrush(true);else closeRepeat();}
  else if((!brush.hidden||!color.hidden||!repeat.hidden)&&(event.metaKey||event.ctrlKey)&&['s','t'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();}
  else if(!color.hidden&&event.key==='Enter'&&!event.target.closest('button')){event.preventDefault();event.stopImmediatePropagation();closeColor(true);}
  else if(!brush.hidden||!color.hidden||!repeat.hidden){if(!event.target.closest('input,select,textarea,button,[contenteditable=true]')){event.stopImmediatePropagation();}}
 },true);
 for(const node of [brush,color,repeat]){
  const header=node.querySelector('.popover-header');
  header.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;event.preventDefault();const r=node.getBoundingClientRect();popupDrag={id:event.pointerId,node,x:event.clientX,y:event.clientY,left:r.left,top:r.top};header.setPointerCapture(event.pointerId);});
  header.addEventListener('pointermove',event=>{if(popupDrag?.id===event.pointerId)clamp(node,popupDrag.left+event.clientX-popupDrag.x,popupDrag.top+event.clientY-popupDrag.y);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(name,event=>{if(popupDrag?.id!==event.pointerId)return;popupDrag=null;if(header.hasPointerCapture(event.pointerId))header.releasePointerCapture(event.pointerId);});
  node.addEventListener('wheel',event=>event.stopPropagation());node.addEventListener('gesturechange',event=>{event.preventDefault();event.stopPropagation();},{passive:false});
 }
 window.addEventListener('resize',()=>{for(const node of [brush,color,repeat])if(!node.hidden){const r=node.getBoundingClientRect();clamp(node,r.left,r.top);}});
 window.basementOpenBrush=openBrush;window.basementOpenColor=openColor;window.basementOpenRepeat=openRepeat;window.basementSyncBrushTips=settings=>{currentBrush={...settings};sync();};$('#toolbar-colors').title='Paint color';$('#toolbar-colors').setAttribute('aria-label','Paint color');
 document.addEventListener('endo-layer-panel-open',()=>{closeBrush();closeRepeat();closeColor(false,false);});
 window.addEventListener('basement-session-blocked',()=>{closeBrush();closeRepeat();closeColor(false,false);});
 window.addEventListener('basement-write-error',()=>{closeBrush();closeRepeat();closeColor(false,false);});
 new MutationObserver(()=>{if(document.querySelector('dialog[open]')){closeBrush();closeRepeat();closeColor(false,false);}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('endo-inspect',()=>{closeBrush();});
 flags();sync();
}
