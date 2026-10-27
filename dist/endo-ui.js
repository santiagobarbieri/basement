// Endo's presentation follows the hub. Theme changes never mutate the Artboard.
const root=document.documentElement;
const themeButton=document.querySelector('#endo-theme-toggle');
for(const icon of document.querySelectorAll('[data-ui-icon]'))icon.style.setProperty('--icon',`url('/hub/assets/ui/${icon.dataset.uiIcon}.svg')`);
function setTheme(theme){
 root.dataset.theme=theme==='light'?'light':'dark';
 const light=root.dataset.theme==='light',label='Switch to '+(light?'dark':'light')+' mode';
 themeButton.setAttribute('aria-label',label);themeButton.setAttribute('title',label);themeButton.setAttribute('aria-pressed',String(light));
 document.querySelector('meta[name=theme-color]').content=light?'#dfdfdf':'#111111';
}
setTheme(root.dataset.theme);
themeButton.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';setTheme(next);try{localStorage.setItem('basement-theme',next);}catch{}});
window.addEventListener('storage',event=>{if(event.key==='basement-theme')setTheme(event.newValue);});
window.addEventListener('pageshow',()=>{try{setTheme(localStorage.getItem('basement-theme'));}catch{}});
document.querySelector('#show-export-areas').addEventListener('click',()=>{
 const menu=document.querySelector('#export-menu'),areas=document.querySelector('#export-areas');menu.hidden=true;document.querySelector('#export').setAttribute('aria-expanded','false');areas.open=true;areas.scrollIntoView({block:'nearest',behavior:'auto'});document.querySelector('#draw-frame').focus({preventScroll:true});
});
// Reuse existing commands, including their busy/disabled safeguards.
document.addEventListener('keydown',event=>{
 if(window.basementSessionBlocked||document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!event.altKey){event.preventDefault();const command=document.querySelector(event.shiftKey?'#restore':'#return');if(!command.disabled)command.click();}
 else if(event.key==='Delete'||event.key==='Backspace'){const command=document.querySelector('#delete');if(!command.disabled){event.preventDefault();command.click();}}
});
