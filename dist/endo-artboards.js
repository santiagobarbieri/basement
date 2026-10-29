const $=selector=>document.querySelector(selector);
const presets=[
 ['Screen','Desktop HD',1920,1080],['Screen','Phone portrait',1080,1920],['Screen','Tablet',1536,2048],
 ['Square','Square 1080',1080,1080],['Square','Square 2048',2048,2048],
 ['Print · 150 dpi','A4 portrait',1240,1754],['Print · 150 dpi','A4 landscape',1754,1240],['Print · 120 dpi','A3 portrait',1404,1984]
];
export function setupArtboardPanel(){
 const panel=document.createElement('aside');panel.id='artboard-panel';panel.className='artboard-panel';panel.hidden=true;panel.setAttribute('aria-label','Artboards');
 panel.innerHTML='<header><strong>Artboards</strong><button id="artboard-panel-close" type="button" aria-label="Close artboard presets" title="Close">×</button></header><div class="artboard-panel-scroll"><section id="artboard-presets" aria-label="Artboard size presets"></section></div>';
 const list=panel.querySelector('#artboard-presets');let group='';
 for(const[category,name,width,height]of presets){if(category!==group){group=category;const title=document.createElement('h3');title.textContent=category;list.append(title);}const button=document.createElement('button');button.type='button';button.dataset.artboardPreset=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');button.innerHTML='<span>'+name+'</span><small>'+width+' × '+height+'</small>';button.addEventListener('click',()=>{document.dispatchEvent(new CustomEvent('endo-create-artboard',{detail:{width,height,name}}));close();});list.append(button);}
 const properties=$('.frames-panel');panel.querySelector('.artboard-panel-scroll').append(properties);$('#inspector-areas').remove();$('.shell-right').append(panel);
 const viewport=$('#canvas-viewport');let dismissed=false;
 function show(){window.basementCloseLayerPanel?.();dismissed=false;panel.hidden=false;$('.shell-right').dataset.sidebarMode='artboards';document.dispatchEvent(new CustomEvent('endo-sidebar-mode',{detail:{mode:'artboards'}}));document.dispatchEvent(new Event('endo-shell-layout'));}
 function close(){dismissed=true;panel.hidden=true;if($('.shell-right').dataset.sidebarMode==='artboards'){delete $('.shell-right').dataset.sidebarMode;document.dispatchEvent(new CustomEvent('endo-sidebar-mode',{detail:{mode:null}}));}$('#artboard-panel-close').blur();$('#artboard').focus({preventScroll:true});document.dispatchEvent(new Event('endo-shell-layout'));}
 function sync(){list.hidden=viewport.dataset.mode!=='frame'&&!!viewport.dataset.frameSelection;document.dispatchEvent(new Event('endo-shell-layout'));}
 $('#draw-frame').addEventListener('click',()=>{show();sync();});
 document.addEventListener('endo-frame-selected',()=>{show();sync();});
 document.addEventListener('endo-inspect',event=>{if(event.detail?.name==='areas')show();});
 panel.querySelector('#artboard-panel-close').addEventListener('click',close);
 panel.addEventListener('wheel',event=>event.stopPropagation());panel.addEventListener('gesturechange',event=>{event.preventDefault();event.stopPropagation();},{passive:false});
 document.addEventListener('endo-sidebar-mode',event=>{if(event.detail?.mode!=='artboards'){dismissed=true;panel.hidden=true;}});
 new MutationObserver(sync).observe(viewport,{attributes:true,attributeFilter:['data-mode','data-frame-selection']});
 window.basementOpenArtboards=show;window.basementCloseArtboards=close;
}
