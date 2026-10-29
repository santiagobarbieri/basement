import {BRUSH_PRESETS,brushPreset} from './endo-brushes.js';
import {renderBrushSample} from './endo-samples.js';

// Native select menus cannot display a canvas. Keep its value/change interface
// for the editor and expose the same presets through a rendered listbox.
export function createBrushPicker({select,host,getSettings,onChoose,beforeOpen=()=>{},isBlocked=()=>false}){
 select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 const button=document.createElement('button');button.type='button';button.id='brush-picker';button.title='Brush shape';button.setAttribute('aria-label','Brush shape');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','brush-picker-list');
 button.innerHTML='<canvas width="120" height="48" class="brush-picker-current rendered-brush-sample" aria-hidden="true"></canvas><span class="brush-picker-label"></span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
 select.after(button);
 const list=document.createElement('div');list.id='brush-picker-list';list.className='brush-picker-list';list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-label','Brush shape');host.append(list);
 let current='round',opener=null,typeahead='',typeaheadTimer;
 for(const preset of BRUSH_PRESETS){
  const item=document.createElement('button');item.type='button';item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.dataset.brushPreset=preset.id;item.id='brush-option-'+preset.id;
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=80;canvas.className='rendered-brush-sample';canvas.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=preset.label;
  item.append(canvas,label);item.addEventListener('click',()=>{if(isBlocked())return;onChoose(preset);close(true);});list.append(item);
 }
 function sync(settings=getSettings()){
  const preset=BRUSH_PRESETS.find(p=>p.id===(settings.brushPreset||settings.tip))||BRUSH_PRESETS.find(p=>p.tip===settings.tip)||brushPreset('round');current=preset.id;select.value=current;
  const color=settings.primary||'#222222';button.querySelector('.brush-picker-label').textContent=preset.label;button.title=preset.label+' brush';
  renderBrushSample(button.querySelector('canvas'),{...preset,...settings,brush:'basic'},{primary:color});
  for(const item of list.children){item.setAttribute('aria-selected',String(item.dataset.brushPreset===current));renderBrushSample(item.querySelector('canvas'),brushPreset(item.dataset.brushPreset),{primary:color});}
  button.disabled=isBlocked();
 }
 function place(){const r=button.getBoundingClientRect();list.style.left=Math.max(8,Math.min(innerWidth-list.offsetWidth-8,r.left))+'px';list.style.top=Math.max(8,Math.min(innerHeight-list.offsetHeight-8,r.bottom+6))+'px';}
 function close(focus=false){if(list.hidden)return;list.hidden=true;button.setAttribute('aria-expanded','false');clearTimeout(typeaheadTimer);typeahead='';if(focus)(opener?.isConnected?opener:button).focus({preventScroll:true});}
 function open(){if(isBlocked())return;beforeOpen();opener=button;sync();list.hidden=false;button.setAttribute('aria-expanded','true');place();list.querySelector('[aria-selected=true]')?.focus({preventScroll:true});}
 button.addEventListener('click',()=>list.hidden?open():close(true));
 button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();if(list.hidden)open();else list.querySelector('[aria-selected=true]')?.focus({preventScroll:true});}});
 list.addEventListener('keydown',event=>{
  const items=[...list.children],index=items.indexOf(document.activeElement),key=event.key;
  if(['ArrowDown','ArrowUp','Home','End'].includes(key)){
   event.preventDefault();event.stopPropagation();const next=key==='Home'?0:key==='End'?items.length-1:(index+(key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus({preventScroll:true});items[next]?.scrollIntoView({block:'nearest'});
  }else if(key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);}
  else if(key==='Tab'){close(true);}
  else if(key.length===1&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&key!==' '){
   event.preventDefault();event.stopPropagation();clearTimeout(typeaheadTimer);typeahead+=key.toLowerCase();const match=BRUSH_PRESETS.find(p=>p.label.toLowerCase().startsWith(typeahead));if(match)list.querySelector('[data-brush-preset="'+match.id+'"]')?.focus({preventScroll:true});typeaheadTimer=setTimeout(()=>{typeahead='';},600);
  }else event.stopPropagation();
 });
 // Close without changing the selected brush when focus/pointer leaves.
 document.addEventListener('pointerdown',event=>{if(!list.hidden&&!list.contains(event.target)&&!button.contains(event.target))close();},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopImmediatePropagation();close(true);}},true);
 list.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
 window.addEventListener('resize',()=>{if(!list.hidden)place();});
 for(const name of ['basement-session-blocked','basement-write-error'])window.addEventListener(name,()=>close());
 document.addEventListener('endo-layer-panel-open',()=>close());
 return{button,list,sync,close};
}
