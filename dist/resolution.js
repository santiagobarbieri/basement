import {QUALITY_PRESETS,readQuality} from './endo-quality.js';
const $=selector=>document.querySelector(selector),old=$('#render-quality-status'),overlay=$('#resolution-view');
if(overlay){overlay.style.opacity='0';overlay.dataset.resolution='frame-preview';}
const button=document.createElement('button');button.id='render-quality-button';button.type='button';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','quality-menu');button.title='Preview resolution · export always uses full quality';
const menu=document.createElement('div');menu.id='quality-menu';menu.className='shell-menu quality-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Preview resolution');menu.hidden=true;
for(const[mode,definition]of Object.entries(QUALITY_PRESETS)){const item=document.createElement('button');item.type='button';item.dataset.quality=mode;item.setAttribute('role','menuitemradio');item.textContent=definition.label;item.addEventListener('click',()=>{if(window.basementEndoBusy?.())return;document.dispatchEvent(new CustomEvent('endo-quality-change',{detail:{mode}}));close();sync();});menu.append(item);}
old.replaceWith(button);document.querySelector('main').append(menu);
function close(focus=false){menu.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus({preventScroll:true});}
function sync(){const mode=window.basementRenderQuality||readQuality();button.dataset.quality=mode;button.textContent=QUALITY_PRESETS[mode].label;button.setAttribute('aria-label','Preview resolution: '+QUALITY_PRESETS[mode].label);button.disabled=!!window.basementEndoBusy?.();for(const item of menu.children)item.setAttribute('aria-checked',String(item.dataset.quality===mode));}
button.addEventListener('click',()=>{if(!menu.hidden){close(true);return;}menu.hidden=false;button.setAttribute('aria-expanded','true');const r=button.getBoundingClientRect();menu.style.left=Math.max(8,r.left)+'px';menu.style.top=Math.max(8,r.top-menu.offsetHeight-6)+'px';menu.querySelector('[aria-checked=true]')?.focus();});
menu.addEventListener('keydown',event=>{const items=[...menu.children],i=items.indexOf(document.activeElement);if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!button.contains(event.target))close();},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();event.stopImmediatePropagation();close(true);}},true);
document.addEventListener('endo-artboard-rendered',()=>{if(overlay)overlay.style.opacity='0';$('#artboard').dataset.renderMode='frame-preview';sync();});
document.addEventListener('endo-quality-change',()=>queueMicrotask(sync));sync();
