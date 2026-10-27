import {initialState,copy,growingDrop,stroke,sprinkle,example,validate,History,ment} from './engine.js';
import {drawMarble,warp} from './runtime.js';
import {animatedHTML,embedCode,safeName,svg,png,webm,webmType} from './export.js';
import {getProject,putProject,projectSavedLabel,projectSavingLabel,registerStudioSession} from '/project-store.js';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),history=new History(),art=$('art'),overlay=$('overlay'),ctx=art.getContext('2d'),guide=overlay.getContext('2d');
let state=initialState(),camera={x:0,y:0,scale:1},fitScale=1,gesture=null,editBefore=null,hover=null,hoverWorld=null,space=false,ready=false,elapsed=0,lastTick=0,lastRender=0,dirty=false,saving=false,revision=0,saveTimer,videoBusy=false,previewPaused=false;
const id=query.get('project')||crypto.randomUUID();let createdAt=Date.now();$('name').value=(query.get('name')||'Untitled').slice(0,80);
const title=()=>$('name').value.trim()||'Untitled',ratio=()=>overlay.width/overlay.clientWidth,message=text=>$('message').textContent=text;
function render(){if(!art.width)return;const d=ratio();drawMarble(ctx,state,art.width,art.height,elapsed,'contain',{x:camera.x*d,y:camera.y*d,scale:camera.scale*d});drawGuide();$('empty').hidden=state.shapes.length>0;$('canvas-info').textContent=state.shapes.length+' gotas · '+state.shapes.reduce((n,s)=>n+s.points.length,0).toLocaleString('es-AR')+' puntos';}
function drawGuide(){guide.clearRect(0,0,overlay.width,overlay.height);if(!hover||state.tool.mode==='pan'||space)return;const d=ratio();guide.save();guide.setTransform(camera.scale*d,0,0,camera.scale*d,camera.x*d,camera.y*d);guide.lineWidth=1/camera.scale;guide.strokeStyle='#ffffffcc';guide.setLineDash([4/camera.scale,4/camera.scale]);guide.beginPath();const anchor=gesture?.kind==='drop'?gesture.center:hoverWorld?warp(hoverWorld,state.bath,state.motion,elapsed,true):hover,center=warp(anchor,state.bath,state.motion,elapsed);if(state.tool.mode==='drop'){for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,p=warp({x:anchor.x+Math.cos(a)*(gesture?.kind==='drop'?gesture.radius:8),y:anchor.y+Math.sin(a)*(gesture?.kind==='drop'?gesture.radius:8)},state.bath,state.motion,elapsed);i?guide.lineTo(p.x,p.y):guide.moveTo(p.x,p.y);}}else if(state.tool.mode==='comb'){for(let i=0;i<state.tool.tines;i++){const x=center.x+(i-(state.tool.tines-1)/2)*state.tool.spacing;guide.moveTo(x,center.y-14/camera.scale);guide.lineTo(x,center.y+14/camera.scale);}}else guide.arc(center.x,center.y,state.tool.reach,0,Math.PI*2);guide.stroke();guide.restore();}
function fit(){const w=overlay.clientWidth,h=overlay.clientHeight;if(!w||!h)return;camera.scale=Math.max(.01,Math.min((w-48)/state.bath.width,(h-48)/state.bath.height));fitScale=camera.scale;camera.x=(w-state.bath.width*camera.scale)/2;camera.y=(h-state.bath.height*camera.scale)/2;render();}
function resize(){const r=$('workspace').getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);art.width=overlay.width=Math.max(1,Math.round(r.width*d));art.height=overlay.height=Math.max(1,Math.round(r.height*d));fit();}
function zoom(factor,x=overlay.clientWidth/2,y=overlay.clientHeight/2){const next=Math.max(fitScale*.4,Math.min(fitScale*10,camera.scale*factor));camera.x=x-(x-camera.x)*next/camera.scale;camera.y=y-(y-camera.y)*next/camera.scale;camera.scale=next;$('fit').textContent=Math.round(camera.scale/fitScale*100)+' %';render();}
function point(event){const r=overlay.getBoundingClientRect(),screen={x:event.clientX-r.left,y:event.clientY-r.top},world={x:(screen.x-camera.x)/camera.scale,y:(screen.y-camera.y)/camera.scale};return {screen,world,base:warp(world,state.bath,state.motion,elapsed,true)};}
function schedule(){if(!ready)return;dirty=true;revision++;clearTimeout(saveTimer);$('save-status').textContent='Unsaved changes';saveTimer=setTimeout(save,5000);}
function preview(){const c=document.createElement('canvas');c.width=240;c.height=Math.round(240*state.bath.height/state.bath.width);drawMarble(c.getContext('2d'),state,c.width,c.height,elapsed);return c.toDataURL();}
async function save(){if(!ready||saving||gesture||editBefore||!dirty)return;saving=true;$('save-status').textContent=projectSavingLabel();const version=revision;try{await putProject({id,name:title(),studio:'marble',state:copy(state),preview:preview(),createdAt,updatedAt:Date.now()});if(version===revision){dirty=false;$('save-status').textContent=projectSavedLabel();}const url=new URL(location.href);url.searchParams.set('project',id);window.history.replaceState(null,'',url);}catch(error){message(error.message);$('save-status').textContent='Save failed: '+error.message;}finally{saving=false;if(dirty&&revision!==version)setTimeout(save,100);}}
function commit(before){history.commit(before,state);schedule();refresh();}
function finishEdit(){if(!editBefore)return;const before=editBefore;editBefore=null;try{validate(state);commit(before);}catch(error){state=before;message(error.message);refresh();}}
function action(change){finishEdit();const before=copy(state);try{change();validate(state);commit(before);}catch(error){state=before;message(error.message);refresh();}}
function growHeld(now){
 if(gesture?.kind!=='drop')return;
 gesture.radius=growingDrop(state,gesture.before,gesture.center,(now-gesture.started)/1000,gesture.color);
 $('drop-radius').textContent='Radio '+Math.round(gesture.radius)+' px · soltá para depositar';
 render();
}
function endGesture(cancel=false){
 if(!gesture)return;const g=gesture;
 if(g.kind==='drop'&&!cancel)try{growHeld(performance.now());}catch(error){cancel=true;message(error.message);}
 gesture=null;
 if(cancel&&g.kind!=='pan'){state=g.before;refresh();return;}
 if(g.kind!=='pan')try{validate(state);commit(g.before);}catch(error){state=g.before;message(error.message);refresh();}else render();
}
function setMode(mode){endGesture();finishEdit();state.tool.mode=mode;schedule();refresh();}
for(const mode of ['drop','stroke','comb','pan'])$(mode).onclick=()=>setMode(mode);
overlay.onpointerdown=event=>{
 if(!ready||gesture||event.button>1)return;finishEdit();overlay.focus();const p=point(event);overlay.setPointerCapture(event.pointerId);
 if(state.tool.mode==='pan'||space||event.button===1){gesture={kind:'pan',screen:p.screen,camera:{...camera}};return;}
 if(p.world.x<0||p.world.y<0||p.world.x>state.bath.width||p.world.y>state.bath.height)return;
 gesture={kind:state.tool.mode,before:copy(state),last:p.base,center:p.base,started:performance.now(),color:state.activeColor,radius:8};hover=p.base;hoverWorld=p.world;
 try{if(gesture.kind==='drop')growHeld(gesture.started);else render();}catch(error){message(error.message);endGesture(true);}
};
overlay.onpointermove=event=>{
 const p=point(event);hover=p.base;hoverWorld=p.world;if(!gesture){drawGuide();return;}const g=gesture;
 if(g.kind==='pan'){camera.x=g.camera.x+p.screen.x-g.screen.x;camera.y=g.camera.y+p.screen.y-g.screen.y;render();return;}
 const q={x:Math.max(-state.bath.width,Math.min(state.bath.width*2,p.base.x)),y:Math.max(-state.bath.height,Math.min(state.bath.height*2,p.base.y))},length=Math.hypot(q.x-g.last.x,q.y-g.last.y);
 try{
  if(g.kind==='drop'){drawGuide();return;}else if(length>1){const a={...g.last},count=Math.min(12,Math.ceil(length/18));for(let i=1;i<=count;i++){const next={x:a.x+(q.x-a.x)*i/count,y:a.y+(q.y-a.y)*i/count};stroke(state,g.last,next);g.last=next;}}
  render();
 }catch(error){message(error.message);endGesture(true);}
};
overlay.onpointerup=()=>endGesture();overlay.onpointercancel=()=>endGesture(true);overlay.onlostpointercapture=()=>endGesture();overlay.onpointerleave=()=>{if(!gesture){hover=null;hoverWorld=null;drawGuide();}};
overlay.addEventListener('wheel',event=>{event.preventDefault();if(gesture)return;const p=point(event);if(event.ctrlKey||event.metaKey)zoom(Math.exp(-event.deltaY*.01),p.screen.x,p.screen.y);else{camera.x-=event.deltaX;camera.y-=event.deltaY;render();}},{passive:false});
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);$('fit').onclick=()=>{fit();$('fit').textContent='100 %';};
function undo(redo=false){finishEdit();endGesture();state=history.step(state,redo);schedule();refresh();fit();}
$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);
$('clear').onclick=()=>action(()=>{state.shapes=[];elapsed=0;});
$('sprinkle').onclick=()=>action(()=>sprinkle(state));
function makeExample(randomize=false){action(()=>{if(randomize)state.seed=crypto.getRandomValues(new Uint32Array(1))[0];example(state);});}
$('example').onclick=()=>makeExample();$('start-example').onclick=()=>makeExample();$('shuffle').onclick=()=>makeExample(true);
for(const key of ['radius','strength','reach','spacing','tines']){
 const input=$(key);input.oninput=()=>{if(!input.validity.valid||input.value==='')return;editBefore ||=copy(state);state.tool[key]=+input.value;if($(key+'-value'))$(key+'-value').textContent=input.value+(key==='strength'?'×':key==='radius'?' px/s':'');drawGuide();};input.onchange=finishEdit;input.onblur=finishEdit;
}
for(const key of ['amount','duration','wavelength']){
 const input=$(key);input.oninput=()=>{editBefore ||=copy(state);state.motion[key]=+input.value;$(key+'-value').textContent=input.value+(key==='duration'?' s':'');render();};input.onchange=finishEdit;input.onblur=finishEdit;
}
function playback(){if(!state.motion.enabled){previewPaused=false;action(()=>state.motion.enabled=true);}else{previewPaused=!previewPaused;refresh();}}
$('motion-enabled').onchange=()=>action(()=>{state.motion.enabled=$('motion-enabled').checked;previewPaused=false;});$('play').onclick=playback;
$('paper').oninput=()=>{editBefore ||=copy(state);state.bath.paper=$('paper').value;render();};$('paper').onchange=finishEdit;$('paper').onblur=finishEdit;
$('seed').oninput=()=>{if(!$('seed').validity.valid||$('seed').value==='')return;editBefore ||=copy(state);state.seed=+$('seed').value;};$('seed').onchange=finishEdit;$('seed').onblur=finishEdit;
$('format').onchange=()=>action(()=>{const [width,height]=$('format').value.split(',').map(Number),sx=width/state.bath.width,sy=height/state.bath.height;for(const shape of state.shapes)for(const p of shape.points){p.x*=sx;p.y*=sy;}state.bath.width=width;state.bath.height=height;fit();});
const palettes={earth:['#253e39','#9bb07a','#d26c44','#e8d6ad'],cobalt:['#153bb0','#f47a56','#a2bdc0','#eee5ce'],mono:['#1c252a','#ddd4bc','#777d70','#f3eddc'],candy:['#d35084','#ead454','#6350ad','#f5ccae']};
$('palette-preset').onchange=()=>{const colors=palettes[$('palette-preset').value];if(colors)action(()=>{state.palette=[...colors];state.activeColor%=colors.length;for(const shape of state.shapes)shape.color%=colors.length;});};
let paletteKey='';
function paletteUI(){const key=JSON.stringify([state.palette,state.activeColor]);if(key===paletteKey)return;paletteKey=key;$('palette').replaceChildren();state.palette.forEach((color,index)=>{
 const row=document.createElement('div');row.className='ink'+(state.activeColor===index?' active':'');const button=document.createElement('button');button.style.background=color;button.setAttribute('aria-label','Usar tinta '+(index+1));button.setAttribute('aria-pressed',String(state.activeColor===index));button.onclick=()=>{finishEdit();state.activeColor=index;schedule();refresh();};
 const input=document.createElement('input');input.type='color';input.value=color;input.setAttribute('aria-label','Editar tinta '+(index+1));input.oninput=()=>{editBefore ||=copy(state);state.palette[index]=input.value;button.style.background=input.value;$('palette-preset').value='custom';render();};input.onchange=finishEdit;input.onblur=finishEdit;row.append(button,input);$('palette').append(row);
 });}
function refresh(){
 document.title=title()+' · Marble';for(const mode of ['drop','stroke','comb','pan'])$(mode).setAttribute('aria-pressed',String(state.tool.mode===mode));overlay.style.cursor=state.tool.mode==='pan'?'grab':'crosshair';
 $('drop-radius').textContent='Mantené presionado para hacer crecer la gota.';
 $('drop-options').hidden=state.tool.mode!=='drop';$('stroke-options').hidden=!['stroke','comb'].includes(state.tool.mode);$('comb-options').hidden=state.tool.mode!=='comb';$('tool-hint').textContent=({drop:'Una pulsación, una gota del color elegido. Mantené presionado para hacerla crecer.',stroke:'Arrastrá para estirar las vetas de color.',comb:'Arrastrá el peine para formar bandas y pliegues.',pan:'Arrastrá para desplazar la vista.'})[state.tool.mode];
 for(const key of ['radius','strength','reach','spacing','tines']){$(key).value=state.tool[key];if($(key+'-value'))$(key+'-value').textContent=state.tool[key]+(key==='strength'?'×':key==='radius'?' px/s':'');}
 for(const key of ['amount','duration','wavelength']){$(key).value=state.motion[key];$(key+'-value').textContent=state.motion[key]+(key==='duration'?' s':'');}
 $('motion-enabled').checked=state.motion.enabled;$('play').textContent=state.motion.enabled&&!previewPaused?'Ⅱ':'▶';$('play').setAttribute('aria-pressed',String(state.motion.enabled&&!previewPaused));$('play').setAttribute('aria-label',state.motion.enabled&&!previewPaused?'Pausar vista previa':'Reproducir vista previa');
 $('paper').value=state.bath.paper;$('seed').value=state.seed;$('format').value=state.bath.width+','+state.bath.height;$('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length;$('clear').disabled=!state.shapes.length;
 $('palette-preset').value=Object.keys(palettes).find(k=>JSON.stringify(palettes[k])===JSON.stringify(state.palette))||'custom';paletteUI();$('embed-code').value=embedCode(title(),$('embed-type').value);$('save-webm').disabled=videoBusy||!webmType();render();
}
function download(blob,extension){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safeName(title())+'.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('name').oninput=()=>{document.title=title()+' · Marble';$('embed-code').value=embedCode(title(),$('embed-type').value);schedule();};$('export-toggle').onclick=()=>$('export-menu').hidden=!$('export-menu').hidden;
$('embed-toggle').onclick=()=>{$('embed-box').hidden=!$('embed-box').hidden;$('embed-code').value=embedCode(title(),$('embed-type').value);};$('embed-type').onchange=()=>{$('embed-code').value=embedCode(title(),$('embed-type').value);};$('copy-embed').onclick=async()=>{try{await navigator.clipboard.writeText($('embed-code').value);message('Código copiado.');}catch{$('embed-code').select();message('Seleccioná y copiá el código de inserción.');}};
$('save-html').onclick=()=>{finishEdit();try{download(new Blob([animatedHTML(state,title(),$('web-fit').value)],{type:'text/html'}),'html');message(state.motion.enabled?'HTML animado descargado · listo para tu web.':'HTML descargado. Activá Animación para exportar con movimiento.');}catch(e){message(e.message);}};
$('save-svg').onclick=()=>{finishEdit();try{download(new Blob([svg(state,elapsed)],{type:'image/svg+xml'}),'svg');message('SVG del cuadro actual descargado.');}catch(e){message(e.message);}};
$('save-png').onclick=async()=>{finishEdit();$('save-png').disabled=true;try{download(await png(copy(state),4096,elapsed),'png');message('PNG HD descargado.');}catch(e){message(e.message);}finally{$('save-png').disabled=false;}};
$('save-ment').onclick=()=>{finishEdit();download(new Blob([ment(state,{id,name:title(),preview:preview()})],{type:'application/json'}),'ment');message('Copia editable .ment descargada.');};
$('save-webm').onclick=async()=>{finishEdit();videoBusy=true;$('save-webm').disabled=true;try{const blob=await webm(copy(state),n=>message('Grabando WebM · '+n+' %'));download(blob,'webm');message('WebM descargado · usalo con autoplay muted loop playsinline.');}catch(e){message(e.message);}finally{videoBusy=false;$('save-webm').disabled=!webmType();}};
$('home').onclick=async event=>{event.preventDefault();finishEdit();endGesture();while(saving)await new Promise(r=>setTimeout(r,30));await save();if(!dirty)location.href='/hub/';};
document.onkeydown=e=>{if(e.target.matches('input,select,textarea'))return;if(e.code==='Space'){e.preventDefault();space=true;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();finishEdit();endGesture();save();}else if(e.key==='Escape')endGesture(true);else if(!e.ctrlKey&&!e.metaKey&&['d','s','c'].includes(e.key.toLowerCase()))setMode(({d:'drop',s:'stroke',c:'comb'})[e.key.toLowerCase()]);};document.onkeyup=e=>{if(e.code==='Space')space=false;};window.addEventListener('blur',()=>{space=false;endGesture(true);});document.addEventListener('visibilitychange',()=>{lastTick=0;if(document.hidden)endGesture(true);});
function tick(now){
 requestAnimationFrame(tick);if(document.hidden||!ready){lastTick=0;return;}
 if(lastTick&&state.motion.enabled&&!previewPaused&&!gesture)elapsed+=(now-lastTick)/1000;lastTick=now;
 if(now-lastRender<1000/30)return;
 if(gesture?.kind==='drop'){lastRender=now;try{growHeld(now);}catch(error){message(error.message);endGesture(true);}return;}
 if(state.motion.enabled&&!previewPaused&&state.shapes.length&&!gesture){lastRender=now;render();}
}
requestAnimationFrame(tick);new ResizeObserver(resize).observe($('workspace'));
(async()=>{try{if(query.has('project')){const p=await getProject(id);if(!p||p.studio!=='marble')throw Error('Proyecto Marble no disponible');state=validate(p.state);$('name').value=p.name;createdAt=p.createdAt;}ready=true;refresh();fit();if(!query.has('project'))schedule();else $('save-status').textContent=projectSavedLabel();}catch(e){message(e.message);document.querySelector('main').inert=true;}})();

window.addEventListener('basement-library-changed',()=>{if(!ready){location.reload();return;}dirty=true;save();});

registerStudioSession({save:async()=>{if(!ready)throw Error('Artboard is not ready.');finishEdit();endGesture();while(saving)await new Promise(r=>setTimeout(r,20));await save();if(dirty)throw Error($('save-status').textContent||'Save failed.');},capture:()=>({id,name:title(),studio:'marble',state:copy(state),preview:preview(),createdAt,updatedAt:Date.now()}),dirty:()=>dirty});
