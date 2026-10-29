import {FILTER_DEFINITIONS} from './endo-filter-catalog.js';
// Endo's presentation shell moves the original controls without cloning IDs or
// changing document state. The editor modules bind to these same nodes afterward.
const $ = selector => document.querySelector(selector);
const root = document.documentElement, body = document.body;
const main = $('main'), viewport = $('#canvas-viewport'), oldHeader = $('.studio-header');
const rail = $('.tool-rail'), inspector = $('.right'), dock = $('#layers-dock');
const icon = name => { if(name==='eye'){const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');node.setAttribute('stroke-width','1.5');node.setAttribute('aria-hidden','true');node.classList.add('ui-icon','shell-vector-icon');node.innerHTML='<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';return node;} const node = document.createElement('i'); node.className = 'ui-icon'; node.dataset.uiIcon = name; node.setAttribute('aria-hidden', 'true'); node.style.setProperty('--icon', `url('/hub/assets/ui/${name}.svg')`); return node; };
const control = (label, action, shortcut = '') => { const node = document.createElement('button'); node.type = 'button'; node.setAttribute('role', 'menuitem'); node.className = 'shell-menu-command'; const name = document.createElement('span'); name.textContent = label; node.append(name); if (shortcut) { const key = document.createElement('kbd'); key.textContent = shortcut; node.append(key); } if (action) node.addEventListener('click', action); return node; };
const isMac = /Mac|iPhone|iPad/.test(navigator.platform), mod = isMac ? '⌘' : 'Ctrl+';
const right = document.createElement('aside'); right.className = 'shell-right'; right.setAttribute('aria-label', 'Editor panels');
const top = document.createElement('div'); top.className = 'shell-topleft';
const home = $('.main-page-link'); home.title = 'Save and return to your Projects'; home.setAttribute('aria-label', home.title); home.replaceChildren(icon('back'));
const heading = $('.document-heading'); heading.querySelector('label').textContent = 'Project name'; $('#project-title').setAttribute('aria-label', 'Project name');
top.append(home, heading);
const menus = document.createElement('nav'); menus.className = 'menu-row'; menus.setAttribute('role', 'menubar'); menus.setAttribute('aria-label', 'Editor menus');
const menuNodes = new Map(), triggers = new Map(); let opened = null;
for (const [name, glyph] of [['edit','change'],['image','projects'],['layer','copy'],['select','projects'],['filters','settings'],['view','sun'],['file','version']]) {
 const group = document.createElement('div'); group.className = 'shell-menu-group' + (name === 'file' ? ' file' : '');
 const trigger = document.createElement('button'); trigger.type = 'button'; trigger.dataset.menu = name; trigger.id = 'menu-trigger-' + name; trigger.setAttribute('role','menuitem'); trigger.setAttribute('aria-haspopup','menu'); trigger.setAttribute('aria-expanded','false'); trigger.setAttribute('aria-controls','menu-' + name); trigger.title = name === 'file' ? 'File · Save, Export and folder' : name[0].toUpperCase() + name.slice(1); trigger.append(icon(glyph), document.createTextNode(name[0].toUpperCase() + name.slice(1)));
 const menu = document.createElement('div'); menu.id = 'menu-' + name; menu.dataset.menuPanel = name; menu.className = 'shell-menu'; menu.setAttribute('role','menu'); menu.setAttribute('aria-labelledby', trigger.id); menu.hidden = true;
 group.append(trigger,menu); menus.append(group); menuNodes.set(name,menu); triggers.set(name,trigger);
 trigger.addEventListener('click', () => opened === name ? closeMenu(true) : openMenu(name));
 trigger.addEventListener('pointerenter', () => { if (opened && opened !== name) openMenu(name, false); });
 trigger.addEventListener('keydown', event => { if (['ArrowDown','ArrowUp','Enter',' '].includes(event.key)) { event.preventDefault(); openMenu(name); const items = enabledItems(menu); (event.key === 'ArrowUp' ? items.at(-1) : items[0])?.focus(); } });
}
function enabledItems(menu) { return [...menu.querySelectorAll('button,a[href],select,input')].filter(node => !node.disabled && !node.closest('[hidden]') && node.getBoundingClientRect().width); }
function closeMenu(focus = false) { const previous = opened;for(const node of document.querySelectorAll('.shell-submenu'))node.hidden=true;for(const node of document.querySelectorAll('[data-submenu]'))node.setAttribute('aria-expanded','false'); for (const [name, menu] of menuNodes) { menu.hidden = true; triggers.get(name).setAttribute('aria-expanded','false'); } opened = null; $('#export-menu').hidden = true; $('#export').setAttribute('aria-expanded','false'); if (focus && previous) triggers.get(previous).focus(); }
function openMenu(name, focus = true) { closeMenu(); const menu = menuNodes.get(name); menu.hidden = false; triggers.get(name).setAttribute('aria-expanded','true'); opened = name; if (focus) enabledItems(menu)[0]?.focus({preventScroll:true}); }
function separator(menu) { const node = document.createElement('div'); node.className = 'shell-menu-divider'; node.setAttribute('role','separator'); menu.append(node); }
function moveCommand(id, menuName, label, shortcut = '') { const node = $('#' + id); if (!node) return; const visual = node.querySelector('svg,.ui-icon'); node.replaceChildren(); if (visual) node.append(visual); const text = document.createElement('span'); text.textContent = label; node.append(text); if (shortcut) { const key = document.createElement('kbd'); key.textContent = shortcut; node.append(key); } node.className = 'shell-menu-command'; node.setAttribute('role','menuitem'); menuNodes.get(menuName).append(node); }
const proxies = [];
function proxy(label, target, shortcut = '') { const node = control(label, () => { const original = $(target); if (original && !original.disabled) original.click(); }, shortcut); node.dataset.commandTarget=target;proxies.push([node,target]); return node; }
function inspectorCommand(label,name){return control(label,()=>document.dispatchEvent(new CustomEvent('endo-inspect',{detail:{name}})));}
const edit = menuNodes.get('edit');
moveCommand('return','edit','Undo',mod+'Z'); moveCommand('restore','edit','Redo','⇧'+mod+'Z'); separator(edit);
moveCommand('copy-selection','edit','Copy',mod+'C'); const cut=control('Cut',()=>{if(!$('#copy-selection').disabled){$('#copy-selection').click();$('#delete').click();}},mod+'X');proxies.push([cut,'#copy-selection']);edit.append(cut);moveCommand('paste-selection','edit','Paste',mod+'V'); moveCommand('duplicate-selection','edit','Duplicate',mod+'J'); moveCommand('delete','edit','Delete','Del');
function submenu(label,name,menuName){
 const trigger=control(label+' ›');trigger.dataset.submenu=name;trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','submenu-'+name);
 const child=document.createElement('div');child.id='submenu-'+name;child.className='shell-menu shell-submenu';child.setAttribute('role','menu');child.setAttribute('aria-label',label);child.hidden=true;const group=document.createElement('div');group.className='shell-submenu-group';group.append(trigger,child);menuNodes.get(menuName).append(group);
 const close=()=>{child.hidden=true;trigger.setAttribute('aria-expanded','false');};
 const open=focus=>{for(const item of menuNodes.get(menuName).querySelectorAll('.shell-submenu'))item.hidden=true;for(const item of menuNodes.get(menuName).querySelectorAll('[data-submenu]'))item.setAttribute('aria-expanded','false');child.hidden=false;trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect(),w=child.offsetWidth,h=child.offsetHeight;child.style.left=Math.max(8,r.right+w+5>innerWidth?r.left-w-5:r.right+5)+'px';child.style.top=Math.max(8,Math.min(r.top,innerHeight-h-8))+'px';if(focus)enabledItems(child)[0]?.focus({preventScroll:true});};
 trigger.addEventListener('click',()=>open(true));trigger.addEventListener('pointerenter',()=>open(false));
 trigger.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();open(true);}});
 child.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();close();trigger.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const items=enabledItems(child),index=items.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}});
 return child;
}
function adjustmentItems(menu,attribute='filterType'){
 let group=null;for(const definition of FILTER_DEFINITIONS){
  if(group!==definition.group){if(group)separator(menu);group=definition.group;const heading=document.createElement('div');heading.className='filter-menu-group-label';heading.textContent=group;heading.setAttribute('role','presentation');menu.append(heading);}
  const item=control(definition.label,()=>{$('#filter-type').value=definition.type;$('#add-filter').click();});item.dataset[attribute]=definition.type;item.title=definition.description;proxies.push([item,'#add-filter']);menu.append(item);
 }
}
const image = menuNodes.get('image'); image.append(inspectorCommand('Canvas Size…','areas'));
const backgroundMenu=submenu('Background','background','image');backgroundMenu.append(control('Transparent',()=>{document.dispatchEvent(new CustomEvent('endo-inspect',{detail:{name:'areas'}}));if(!$('#frame-transparent').checked)$('#frame-transparent').click();}),control('Color…',()=>{document.dispatchEvent(new CustomEvent('endo-inspect',{detail:{name:'areas'}}));if($('#frame-transparent').checked)$('#frame-transparent').click();const input=$('#frame-background');input.scrollIntoView({block:'nearest'});input.focus({preventScroll:true});input.click();}));
image.append(proxy('New Artboard','#new-frame-tool','F'),proxy('Duplicate Artboard','#frame-duplicate'),proxy('Delete Artboard','#frame-delete'));adjustmentItems(submenu('Adjustments','image-adjustments','image'));
const layer = menuNodes.get('layer');
moveCommand('layer-add','layer','New Layer'); moveCommand('layer-duplicate','layer','Duplicate Layer'); moveCommand('layer-delete','layer','Delete Layer'); separator(layer);
moveCommand('layer-up','layer','Bring Forward'); moveCommand('layer-down','layer','Send Backward'); moveCommand('selection-to-layer','layer','Selection to Layer');separator(layer);adjustmentItems(submenu('New Adjustment Layer','layer-adjustments','layer'));layer.append(proxy('Hide / Show Layer','.layer-row.active .layer-visibility'),proxy('Lock / Unlock Layer','.layer-row.active .layer-lock'));const rename=control('Rename Layer',()=>{const target=$('.layer-row.active .layer-select');if(target&&!target.disabled)target.dispatchEvent(new KeyboardEvent('keydown',{key:'F2',bubbles:true}));},'F2');proxies.push([rename,'.layer-row.active .layer-select']);layer.append(rename);
const select = menuNodes.get('select');
select.append(control('Select All', () => { const art = $('#artboard');document.querySelector('.cursor-modes [data-mode=select]').click();art.focus({preventScroll:true}); art.dispatchEvent(new KeyboardEvent('keydown',{key:'a',code:'KeyA',ctrlKey:!isMac,metaKey:isMac,bubbles:true})); },mod+'A'),control('Clear Selection', () => { $('#artboard').focus({preventScroll:true}); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); },'Esc'));
const filters = menuNodes.get('filters');
adjustmentItems(filters);

const view = menuNodes.get('view'); view.append(proxy('Zoom In','#zoom-in',mod+'+'),proxy('Zoom Out','#zoom-out',mod+'−'),proxy('Fit Artboard','#zoom-fit',mod+'0')); separator(view);
moveCommand('endo-theme-toggle','view','Switch theme');
const file = menuNodes.get('file'); file.append($('#endo-save-tools')); separator(file);
const exportGroup = $('.header-export'); exportGroup.classList.add('shell-export-group'); $('#export').className = 'shell-menu-command'; $('#export').replaceChildren(document.createTextNode('Export…')); $('#export').setAttribute('role','menuitem'); exportGroup.querySelectorAll('label').forEach(node => { if(node.htmlFor==='export-target')node.textContent='Artboard'; }); $('#show-export-areas').textContent='Manage artboards ↗'; file.append(exportGroup); separator(file);
file.append(control('Home / Close Project', () => home.click()));
for (const menu of menuNodes.values()) {
 menu.addEventListener('click', event => { const item = event.target.closest('button,[role=menuitem]'); if (!item || item.id === 'export' || item.id === 'endo-theme-toggle') return;if(item.id==='export-png'||item.id==='export-ment'){closeMenu(true);return;}if(item.id==='show-export-areas'){closeMenu();return;}if(item.closest('.export-options'))return; if (item.getAttribute('aria-haspopup') !== 'menu') closeMenu(); });
 menu.addEventListener('keydown', event => { if (event.defaultPrevented || event.target.closest('#export-menu')) return; const items = enabledItems(menu).filter(item=>item.closest('[role=menu]')===menu), index = items.indexOf(document.activeElement); if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); } else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (index + (event.key==='ArrowDown'?1:-1) + items.length) % items.length; items[next]?.focus(); } else if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); const names = [...menuNodes.keys()], next = (names.indexOf(opened) + (event.key==='ArrowRight'?1:-1) + names.length) % names.length; openMenu(names[next]); } });
}
document.addEventListener('pointerdown', event => { if (opened && !event.target.closest('.shell-menu-group')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopImmediatePropagation(); closeMenu(true); } },true);
const panelNodes=new Map();
function panel(name,label,glyph){
 const region=document.createElement('section');region.id='panel-'+name;region.className='shell-panel';region.setAttribute('role','region');region.setAttribute('aria-label',label);
 const heading=document.createElement('h2');heading.className='shell-panel-title';heading.append(icon(glyph),document.createTextNode(label));
 const content=document.createElement('div');content.id='panel-body-'+name;content.className='shell-panel-body';region.append(heading,content);panelNodes.set(name,{region,content});return region;
}
const previewPanel = panel('preview','Preview','eye'); const brushPreview = $('#brush-preview'); panelNodes.get('preview').content.append(brushPreview); brushPreview.querySelector('h2').textContent = 'Brush';

// Keep each original control only once; its editor moves it into a dedicated window.
const bank=document.createElement('div');bank.id='endo-controls-bank';bank.hidden=true;
bank.append($('.selection-scope'),$('#inspector-brush'),$('#inspector-color'),$('#inspector-symmetry'),$('#inspector-areas'),$('#inspector-filters'));body.append(bank);
const filterType=$('#filter-type');filterType.replaceChildren();for(const definition of FILTER_DEFINITIONS){const option=document.createElement('option');option.value=definition.type;option.textContent=definition.label;filterType.append(option);}
const layerPanel = panel('layers','Layers','copy'); panelNodes.get('layers').content.append(dock); dock.querySelector('.layers-heading h2').textContent='Artboard';

const layerActions = document.createElement('div');layerActions.className='shell-layer-actions';
const adjustmentButton=document.createElement('button');adjustmentButton.type='button';adjustmentButton.id='add-adjustment';adjustmentButton.title='New adjustment layer';adjustmentButton.setAttribute('aria-label',adjustmentButton.title);adjustmentButton.setAttribute('aria-haspopup','menu');adjustmentButton.setAttribute('aria-expanded','false');adjustmentButton.setAttribute('aria-controls','adjustment-menu');adjustmentButton.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/></svg>';proxies.push([adjustmentButton,'#add-filter']);
const adjustmentMenu=document.createElement('div');adjustmentMenu.id='adjustment-menu';adjustmentMenu.className='shell-menu adjustment-menu';adjustmentMenu.setAttribute('role','menu');adjustmentMenu.setAttribute('aria-label','New adjustment layer');adjustmentMenu.hidden=true;
adjustmentItems(adjustmentMenu,'adjustment');
for(const item of adjustmentMenu.querySelectorAll('[data-adjustment]'))item.addEventListener('click',()=>closeAdjustmentMenu());

function closeAdjustmentMenu(focus=false){adjustmentMenu.hidden=true;adjustmentButton.setAttribute('aria-expanded','false');if(focus)adjustmentButton.focus({preventScroll:true});}
adjustmentButton.addEventListener('click',()=>{if(!adjustmentMenu.hidden){closeAdjustmentMenu(true);return;}closeMenu();adjustmentMenu.hidden=false;adjustmentButton.setAttribute('aria-expanded','true');const r=adjustmentButton.getBoundingClientRect();adjustmentMenu.style.left=Math.max(8,Math.min(innerWidth-adjustmentMenu.offsetWidth-8,r.left))+'px';adjustmentMenu.style.top=Math.max(8,r.top-adjustmentMenu.offsetHeight-7)+'px';enabledItems(adjustmentMenu)[0]?.focus({preventScroll:true});});
adjustmentMenu.addEventListener('keydown',event=>{const items=enabledItems(adjustmentMenu),index=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
document.addEventListener('pointerdown',event=>{if(!adjustmentMenu.hidden&&!adjustmentMenu.contains(event.target)&&!adjustmentButton.contains(event.target))closeAdjustmentMenu();},true);
document.addEventListener('keydown',event=>{if(!adjustmentMenu.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeAdjustmentMenu(true);}},true);
window.addEventListener('resize',()=>closeAdjustmentMenu());
function actionIcon(title,target,glyph){const button=proxy(title,target);button.title=title;button.setAttribute('aria-label',title);button.replaceChildren(icon(glyph));return button;}
layerActions.append(adjustmentButton,actionIcon('New layer','#layer-add','plus'),actionIcon('Duplicate layer','#layer-duplicate','copy'),actionIcon('Delete layer','#layer-delete','trash'),adjustmentMenu);dock.append(layerActions);dock.querySelector('.layer-header-actions').remove();dock.querySelector('.layers-footer').remove();

right.append(previewPanel,layerPanel);
const headerControls=document.createElement('div');headerControls.className='shell-header-controls';const brushBar=document.createElement('div');brushBar.id='brush-options-bar';headerControls.append(brushBar,menus);
// Keep the inspector hook used by endo-ui.js; presentation is now three panels.
right.classList.add('right');
const modes = $('.cursor-modes'), hand = modes.querySelector('[data-mode=pan]');
for(const mode of ['select','draw','erase','marquee'])modes.append(modes.querySelector('[data-mode='+mode+']'));
const handGroup = document.createElement('div'); handGroup.className='cursor-modes rail-group'; handGroup.append(hand); rail.append(handGroup);
const chip = $('#toolbar-colors'); chip.classList.add('color-chip'); rail.querySelector('.rail-bottom').remove();
const status = document.createElement('div'); status.className='status-chip'; status.append($('.scale'));
const frameStatus=document.createElement('span');frameStatus.id='shell-artboard-status';status.append(frameStatus);
const quality = $('#render-quality-status'); quality.title=quality.textContent;quality.setAttribute('aria-label',quality.textContent); status.append(quality);
const session=$('.session');session.classList.add('sr-only');status.append(session);
document.addEventListener('endo-artboard-rendered',event=>{const frame=event.detail?.frames?.find(item=>item.id===event.detail.activeFrameId);if(frame)frameStatus.textContent=frame.name+' · '+frame.width+' × '+frame.height;});
const toolContext = $('.tool-context'); toolContext.classList.add('sr-only'); status.append(toolContext);
const feedback = $('#export-feedback'); feedback.classList.add('shell-toast');
status.querySelector('.scale').after(chip);chip.classList.remove('color-chip');chip.classList.add('material-colors-button');chip.title='Material colors';chip.setAttribute('aria-label','Material colors');chip.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4l-.4-.4a1.5 1.5 0 0 1 1-2.6h2a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="10" cy="6.8" r=".8"/><circle cx="14" cy="7" r=".8"/><circle cx="17" cy="10" r=".8"/></svg>';
main.replaceChildren(viewport,rail,headerControls,right,status,feedback); main.className='shell-floating'; body.append(top);top.inert=!!window.basementSessionBlocked;window.addEventListener('basement-session-blocked',()=>{top.inert=true;});oldHeader.remove(); inspector.remove();
const popovers = document.createElement('div'); popovers.className='shell-popovers'; body.append(popovers);

// Save errors remain next to the Project, even while its other panels are hidden.
new MutationObserver(()=>{ const state=$('#endo-save-status'); state.title=$('#local-status')?.textContent||''; top.classList.toggle('has-save-error',state.dataset.saveState==='error'); }).observe($('#endo-save-status'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-save-state']});
let folderFromFile=false;file.addEventListener('click',event=>{if(event.target.closest('[data-studio-folder]'))folderFromFile=true;});document.addEventListener('close',event=>{if(event.target.id==='folder-settings'&&folderFromFile){folderFromFile=false;triggers.get('file').focus({preventScroll:true});}},true);
const saveHost = $('#endo-save-tools'); new MutationObserver(()=>{for(const item of saveHost.querySelectorAll('button')){item.setAttribute('role','menuitem');item.classList.add('shell-menu-command');} }).observe(saveHost,{childList:true,subtree:true});
let feedbackTimer; new MutationObserver(()=>{clearTimeout(feedbackTimer);feedback.classList.toggle('is-visible',!!feedback.textContent);if(feedback.textContent)feedbackTimer=setTimeout(()=>feedback.classList.remove('is-visible'),5500);}).observe(feedback,{childList:true,subtree:true,characterData:true});
function syncProxies(){ for(const [proxy,target] of proxies){const original=$(target);const disabled=!original||original.disabled;if(proxy.disabled!==disabled)proxy.disabled=disabled;}}
new MutationObserver(syncProxies).observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']}); syncProxies();
for(const container of [right,rail,top,status,chip,headerControls]){ container.addEventListener('wheel',event=>{event.stopPropagation();if(event.ctrlKey||event.metaKey)event.preventDefault();},{passive:false}); container.addEventListener('gesturestart',event=>{event.stopPropagation();event.preventDefault();},{passive:false});container.addEventListener('gesturechange',event=>{event.stopPropagation();event.preventDefault();},{passive:false}); }
window.basementCanvasInsets = () => {const leftPanel=rail.getBoundingClientRect().right;return {left:Math.ceil(leftPanel)+22,right:Math.ceil(innerWidth-right.getBoundingClientRect().left)+22,top:58,bottom:42};};

window.addEventListener('resize',()=>document.dispatchEvent(new Event('endo-shell-layout')));
export function getCanvasInsets(){return window.basementCanvasInsets();}
