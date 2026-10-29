// Endo keeps persistent controls in the tool and document bars; editors float.
const $=selector=>document.querySelector(selector),root=document.documentElement;
for(const icon of document.querySelectorAll('[data-ui-icon]'))icon.style.setProperty('--icon',"url('/hub/assets/ui/"+icon.dataset.uiIcon+".svg')");
const themeButton=$('#endo-theme-toggle');
function setTheme(value){root.dataset.theme=value==='light'?'light':'dark';const light=root.dataset.theme==='light',name='Switch to '+(light?'dark':'light')+' mode';themeButton.title=name;themeButton.setAttribute('aria-label',name);themeButton.setAttribute('aria-pressed',String(light));$('meta[name=theme-color]').content=light?'#dfdfdf':'#111111';}
setTheme(root.dataset.theme);themeButton.addEventListener('click',()=>{setTheme(root.dataset.theme==='dark'?'light':'dark');try{localStorage.setItem('basement-theme',root.dataset.theme);}catch{}});
window.addEventListener('storage',event=>{if(event.key==='basement-theme')setTheme(event.newValue);});
window.addEventListener('pageshow',()=>{try{setTheme(localStorage.getItem('basement-theme'));}catch{}});
const art=$('#artboard'),viewport=$('#canvas-viewport');
document.addEventListener('endo-inspect',event=>{if(event.detail?.name==='areas')window.basementOpenArtboards?.();if(event.detail?.name==='symmetry')window.basementOpenRepeat?.($('[data-open-inspector=symmetry]'));});
for(const button of document.querySelectorAll('[data-open-inspector]'))button.addEventListener('click',event=>{if(event.defaultPrevented)return;const name=button.dataset.openInspector;if(name==='symmetry')window.basementOpenRepeat?.(button);else if(name==='color')window.basementOpenColor?.('primary');});
$('#show-export-areas').addEventListener('click',()=>{$('#export-menu').hidden=true;$('#export').setAttribute('aria-expanded','false');window.basementOpenArtboards?.();});
for(const button of document.querySelectorAll('.cursor-modes button,#draw-frame'))button.addEventListener('click',()=>art.focus({preventScroll:true}));
art.addEventListener('pointerdown',event=>{if(!window.basementSessionBlocked&&!document.querySelector('dialog[open]')&&event.button===0)art.focus({preventScroll:true});},true);
function updateTools(){
 const mode=viewport.dataset.mode||'draw',repeat=viewport.dataset.repetition||'none';
 const labels={draw:'Brush',erase:'Eraser',select:'Select / move',marquee:'Marquee',pan:'Hand',frame:'Artboard'};
 $('#active-tool-label').textContent=labels[mode]||'Brush';$('#active-tool-hint').textContent=mode==='frame'?'Drag to create an artboard or choose a preset':'';
 $('[data-open-inspector=symmetry]').setAttribute('aria-pressed',String(repeat!=='none'));
 $('#brush-options-bar').classList.toggle('erasing',mode==='erase');
}
new MutationObserver(updateTools).observe(viewport,{attributes:true,attributeFilter:['data-mode','data-repetition']});updateTools();
const colorLink=$('#color-link');try{colorLink.checked=localStorage.getItem('endo-linked-colors')!=='false';}catch{}colorLink.addEventListener('change',()=>{try{localStorage.setItem('endo-linked-colors',String(colorLink.checked));}catch{}});
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||window.basementEndoPopoverOpen||window.basementEndoBusy?.()||window.basementSessionBlocked||document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!event.altKey){event.preventDefault();const button=$(event.shiftKey?'#restore':'#return');if(!button.disabled)button.click();return;}
 if(event.key==='Delete'||event.key==='Backspace'){const button=$('#delete');if(!button.disabled){event.preventDefault();button.click();}return;}
 if(event.repeat||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||document.querySelector('[role=menu]:not([hidden])'))return;
 const selector={b:'.cursor-modes [data-mode=draw]',e:'.cursor-modes [data-mode=erase]',v:'.cursor-modes [data-mode=select]',m:'.cursor-modes [data-mode=marquee]',h:'.cursor-modes [data-mode=pan]',f:'#draw-frame',r:'[data-open-inspector=symmetry]'}[event.key.toLowerCase()];
 const button=selector&&$(selector);if(button&&!button.disabled){event.preventDefault();button.click();if(event.key.toLowerCase()!=='r')art.focus({preventScroll:true});}
});
const repeatMarks={mandala:'<circle cx="12" cy="12" r="7"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6"/>',mirror:'<path d="M12 3v18M8 6 3 12l5 6ZM16 6l5 6-5 6Z"/>',grid:'<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16"/>',mosaic:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="5" width="7" height="7"/><rect x="5" y="14" width="7" height="7"/><rect x="16" y="16" width="5" height="5"/>'};
for(const button of document.querySelectorAll('[data-tool]')){button.title=button.textContent;button.setAttribute('aria-label',button.title);button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'+repeatMarks[button.dataset.tool]+'</svg>';}
for(const[id,label,glyph]of [['frame-add','New artboard','plus'],['frame-duplicate','Duplicate artboard','copy'],['frame-delete','Delete artboard','trash']]){const button=$('#'+id);button.title=label;button.setAttribute('aria-label',label);button.innerHTML='<i class="ui-icon" style="--icon:url(/hub/assets/ui/'+glyph+'.svg)" aria-hidden="true"></i>';}
