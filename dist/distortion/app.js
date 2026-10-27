import {styleDefaults,paletteDefaults,upgradeStyle,resolveTreatment,setAdjustment} from './style-model.js';
import {initialState,subdivide,extractPalette,composeCollage,collageDefaults,GRID_PRESETS,restoreComposition,defaults,base,buildGrid,regrid,bounds,center,polygon,pick,rectSelect,selectionBox,TYPES,reset,History,capture,validate,ment,exportSize} from './model.js';
import {getProject,putProject,projectSavedLabel,projectSavingLabel,registerStudioSession} from '/project-store.js';
import {hasMotion,motionSettings} from './motion.js';
import {treat} from './treatments.js';
const $=id=>document.getElementById(id),url=new URLSearchParams(location.search),history=new History();let state=initialState(),selected=new Set(),mode='select',camera={x:0,y:0,scale:1},fitScale=1,gesture=null,editBefore=null,ready=false,saveTimer,saving=false,dirty=false,revision=0;
const id=url.get('project')||crypto.randomUUID();let createdAt=Date.now();$('name').value=(url.get('name')||'Untitled').slice(0,80);
const art=$('art'),overlay=$('overlay'),ctx=overlay.getContext('2d');let worker=null,renderer=null,requestId=0,inflight=false,pending=false,viewVersion=0,thumbImage=null,thumbSource=null,thumbKey='',space=false;
const exports=new Map();try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'})}catch{}
if(worker){worker.onmessage=({data})=>{if(exports.has(data.id)){if(data.progress!==undefined){message('Preparando GIF · '+data.progress+' %');return;}const promise=exports.get(data.id);exports.delete(data.id);data.error?promise.reject(Error(data.error)):promise.resolve(data.blob);return}inflight=false;if(data.error)message(data.error);else if(data.id===viewVersion){art.getContext('2d').clearRect(0,0,art.width,art.height);art.getContext('2d').drawImage(data.bitmap,0,0)}data.bitmap?.close();if(pending){pending=false;render()}};worker.onerror=()=>{message('El motor no respondió. Recargá la página para reintentar.');for(const job of exports.values())job.reject(Error('Error de render'));exports.clear();inflight=false}}
function message(text){$('message').textContent=text}
const title=()=>$('name').value.trim()||'Untitled',filename=()=>title().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-');
function schedule(){if(!ready)return;dirty=true;revision++;$('save-status').textContent='Unsaved changes';clearTimeout(saveTimer);saveTimer=setTimeout(save,5000)}
async function save(){if(!ready||saving||gesture||editBefore||!dirty)return;const version=revision;saving=true;$('save-status').textContent=projectSavingLabel();try{await putProject({id,name:title(),studio:'distortion',state:capture(state),preview:preview(),createdAt,updatedAt:Date.now()});if(version===revision){dirty=false;$('save-status').textContent=projectSavedLabel()}const u=new URL(location.href);u.searchParams.set('project',id);window.history.replaceState(null,'',u)}catch(e){$('save-status').textContent='Save failed: '+e.message;message(e.message)}finally{saving=false;if(dirty&&revision!==version)setTimeout(save,100)}}
function preview(){const c=document.createElement('canvas');c.width=240;c.height=160;c.getContext('2d').drawImage(art,0,0,240,160);return c.toDataURL()}
function commit(before){history.commit(before,capture(state));selected=new Set([...selected].filter(id=>state.fragments.some(f=>f.id===id&&!f.deleted)));schedule();refresh()}
function action(change){finishEdit();const before=capture(state);try{change();validate(state);commit(before)}catch(error){state=before;message(error.message);refresh()}}
function finishEdit(){if(editBefore){const before=editBefore;editBefore=null;commit(before)}}
const selectedPieces=()=>state.fragments.filter(f=>!f.deleted&&selected.has(f.id));
const targets=()=>selectedPieces().filter(f=>!f.locked&&!f.protected);
function setMode(value){finishEdit();mode=value;for(const key of ['select','brush','erase','transform','pan','protect'])$(key).setAttribute('aria-pressed',String(key===mode));overlay.style.cursor=mode==='pan'?'grab':mode==='brush'||mode==='erase'||mode==='protect'?'crosshair':'default';drawOverlay()}
function resize(){const r=$('workspace').getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1);art.width=overlay.width=Math.max(1,Math.round(r.width*ratio));art.height=overlay.height=Math.max(1,Math.round(r.height*ratio));drawOverlay();render()}
const dpr=()=>overlay.width/overlay.clientWidth;
function render(){drawOverlay();if(inflight){pending=true;viewVersion=++requestId;return;}const cam={x:camera.x*dpr(),y:camera.y*dpr(),scale:camera.scale*dpr()},data={id:++requestId,kind:'preview',state:{...capture(state),motionTime:performance.now()},width:art.width,height:art.height,camera:cam,quality:Math.min(1,Math.max(.2,cam.scale))};viewVersion=data.id;inflight=true;if(worker)worker.postMessage(data);else import('./renderer.js').then(async({Renderer})=>{renderer ||=new Renderer();await renderer.load(state.source);renderer.draw(art.getContext('2d'),data.state,cam,art.width,art.height,data.quality);inflight=false;if(pending){pending=false;render()}}).catch(e=>{inflight=false;message(e.message)})}
function fit(){const b=selectionBox(state)||{x:0,y:0,right:state.source?.width||800,bottom:state.source?.height||600},w=Math.max(1,b.right-b.x),h=Math.max(1,b.bottom-b.y);camera.scale=Math.min((overlay.clientWidth-48)/w,(overlay.clientHeight-48)/h);camera.scale=Math.max(.005,camera.scale);fitScale=camera.scale;camera.x=(overlay.clientWidth-w*camera.scale)/2-b.x*camera.scale;camera.y=(overlay.clientHeight-h*camera.scale)/2-b.y*camera.scale;render()}
function zoom(factor,x=overlay.clientWidth/2,y=overlay.clientHeight/2){const next=Math.max(.005,Math.min(20,camera.scale*factor));camera.x=x-(x-camera.x)*next/camera.scale;camera.y=y-(y-camera.y)*next/camera.scale;camera.scale=next;render()}
function local(event){const r=overlay.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top}}
const world=p=>({x:(p.x-camera.x)/camera.scale,y:(p.y-camera.y)/camera.scale});
const path=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath()};
function handles(){const b=selectionBox(state,selected);if(!b)return [];return [{x:b.x,y:b.y,kind:'scale'},{x:b.right,y:b.y,kind:'scale'},{x:b.right,y:b.bottom,kind:'scale'},{x:b.x,y:b.bottom,kind:'scale'},{x:(b.x+b.right)/2,y:b.y-28/camera.scale,kind:'rotate'}]}
function drawOverlay(){ctx.clearRect(0,0,overlay.width,overlay.height);ctx.save();ctx.setTransform(camera.scale*dpr(),0,0,camera.scale*dpr(),camera.x*dpr(),camera.y*dpr());ctx.lineWidth=1/camera.scale;for(const f of state.fragments){if(f.deleted||(!state.grid.visible&&!selected.has(f.id)&&!(mode==='protect'&&f.protected)))continue;path(polygon(f));ctx.strokeStyle=f.protected?'#75bfff':f.locked?'#e9c777':selected.has(f.id)?'#72e38c':'#ffffff44';ctx.lineWidth=(selected.has(f.id)?2:1)/camera.scale;ctx.stroke()}if(mode==='transform'&&selected.size){const b=selectionBox(state,selected);if(b){ctx.strokeStyle='#72e38c';ctx.lineWidth=1/camera.scale;ctx.strokeRect(b.x,b.y,b.right-b.x,b.bottom-b.y);for(const h of handles()){const size=7/camera.scale;ctx.fillStyle='#72e38c';ctx.fillRect(h.x-size/2,h.y-size/2,size,size)}}}if(gesture?.kind==='rect'){const a=gesture.start,b=gesture.last;ctx.fillStyle='#72e38c22';ctx.strokeStyle='#72e38c';ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y)}ctx.restore();$('fit').textContent=Math.round(camera.scale/fitScale*100)+' %';$('empty').hidden=!!state.source;$('canvas-info').textContent=state.source?state.fragments.filter(f=>!f.deleted).length+' fragmentos · '+selected.size+' seleccionados':''}
function transformGroup(original,ids,dx,dy,angle,factor,origin){const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);for(const f of state.fragments){if(!ids.has(f.id)||f.deleted||f.locked)continue;const old=original.fragments.find(o=>o.id===f.id),c=center(old),x=c.x+old.transform.x-origin.x,y=c.y+old.transform.y-origin.y;f.transform={...old.transform,x:origin.x+(x*cos-y*sin)*factor-c.x+dx,y:origin.y+(x*sin+y*cos)*factor-c.y+dy,angle:old.transform.angle+angle,sx:Math.max(.05,Math.min(20,old.transform.sx*factor)),sy:Math.max(.05,Math.min(20,old.transform.sy*factor))}}}
function brushAt(p){const f=pick(state,p);if(!f||gesture.visited.has(f.id)||f.locked)return;gesture.visited.add(f.id);if(mode==='protect'){f.protected=!gesture.unprotect;if(f.protected)reset(f,'treatment');return;}if(f.protected)return;f.type=mode==='erase'?'original':state.active;f.params=structuredClone(state.brush)}
overlay.onpointerdown=e=>{if(!ready||e.button>1)return;finishEdit();overlay.focus();const screen=local(e),p=world(screen);overlay.setPointerCapture(e.pointerId);const before=capture(state);if(mode==='pan'||space||e.button===1){gesture={kind:'pan',screen,camera:{...camera},before};return}if(!state.source)return;if(mode==='brush'||mode==='erase'||mode==='protect'){gesture={kind:'brush',before,visited:new Set(),last:p,unprotect:e.altKey};brushAt(p);render();return}const handle=mode==='transform'&&handles().find(h=>Math.hypot(h.x-p.x,h.y-p.y)<10/camera.scale);if(handle){const b=selectionBox(state,selected);gesture={kind:handle.kind,before,start:p,origin:{x:(b.x+b.right)/2,y:(b.y+b.bottom)/2},ids:new Set(selected)};return}const hit=pick(state,p);if(hit){if(e.shiftKey){selected.has(hit.id)?selected.delete(hit.id):selected.add(hit.id);refresh();return}if(!selected.has(hit.id))selected=new Set([hit.id]);gesture={kind:mode==='transform'?'move':'click',before,start:p,ids:new Set(selected)};refresh()}else{gesture={kind:'rect',before,start:p,last:p,initial:e.shiftKey?new Set(selected):new Set()};if(!e.shiftKey)selected.clear();refresh()}};
overlay.onpointermove=e=>{if(!gesture)return;const screen=local(e),p=world(screen),g=gesture;if(g.kind==='pan'){camera.x=g.camera.x+screen.x-g.screen.x;camera.y=g.camera.y+screen.y-g.screen.y}else if(g.kind==='brush'){const step=Math.max(1,Math.min(state.source.width/state.grid.columns,state.source.height/state.grid.rows)*(state.splits?.length ? .02 : .15)),n=Math.min(4000,Math.ceil(Math.hypot(p.x-g.last.x,p.y-g.last.y)/step));for(let i=1;i<=n;i++)brushAt({x:g.last.x+(p.x-g.last.x)*i/n,y:g.last.y+(p.y-g.last.y)*i/n});g.last=p}else if(g.kind==='rect'){g.last=p;selected=new Set([...g.initial,...rectSelect(state,{x:Math.min(g.start.x,p.x),y:Math.min(g.start.y,p.y),right:Math.max(g.start.x,p.x),bottom:Math.max(g.start.y,p.y)})])}else if(g.kind==='move'){let dx=p.x-g.start.x,dy=p.y-g.start.y;if(e.shiftKey)Math.abs(dx)>Math.abs(dy)?dy=0:dx=0;transformGroup(g.before,g.ids,dx,dy,0,1,{x:0,y:0})}else if(g.kind==='rotate'||g.kind==='scale'){let angle=(Math.atan2(p.y-g.origin.y,p.x-g.origin.x)-Math.atan2(g.start.y-g.origin.y,g.start.x-g.origin.x))*180/Math.PI;if(e.shiftKey)angle=Math.round(angle/15)*15;const factor=Math.max(.05,Math.min(20,Math.hypot(p.x-g.origin.x,p.y-g.origin.y)/Math.max(1,Math.hypot(g.start.x-g.origin.x,g.start.y-g.origin.y))));transformGroup(g.before,g.ids,0,0,g.kind==='rotate'?angle:0,g.kind==='scale'?factor:1,g.origin)}render()};
function endGesture(cancel=false){if(!gesture)return;const g=gesture;gesture=null;if(cancel&&g.kind!=='pan')state=g.before;if(['brush','move','rotate','scale'].includes(g.kind)&&!cancel)commit(g.before);else refresh()}
overlay.onpointerup=()=>endGesture();overlay.onpointercancel=()=>endGesture(true);overlay.onlostpointercapture=()=>endGesture();
overlay.addEventListener('wheel',e=>{e.preventDefault();if(gesture)return;const p=local(e);if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.01),p.x,p.y);else{camera.x-=e.deltaX;camera.y-=e.deltaY;render()}},{passive:false});
for(const key of ['select','brush','erase','transform','pan','protect'])$(key).onclick=()=>setMode(key);
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);$('fit').onclick=fit;
function undo(redo=false){finishEdit();state=history.step(capture(state),redo);selected.clear();schedule();refresh()}
$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);$('delete').onclick=()=>action(()=>targets().forEach(f=>f.deleted=true));$('select-all').onclick=()=>{selected=new Set(state.fragments.filter(f=>!f.deleted).map(f=>f.id));refresh()};$('deselect').onclick=()=>{selected.clear();refresh()};
for(const [id,kind]of [['reset-transform','transform'],['reset-treatment','treatment'],['reset-all','all']])$(id).onclick=()=>action(()=>targets().forEach(f=>reset(f,kind)));
$('apply-grid').onclick=()=>{const g={...state.grid};for(const key of ['columns','rows','skewX','skewY','originX','originY'])g[key]=+$(key).value;try{validate({...capture(state),source:null,fragments:[],splits:[],grid:g})}catch(e){message(e.message);return}const structural=g.rows!==state.grid.rows||g.columns!==state.grid.columns,edited=state.fragments.some(f=>f.deleted||f.locked||f.protected||f.id.includes('/')||f.type!=='original'||JSON.stringify(f.transform)!==JSON.stringify(base())||f.jitter.x||f.jitter.y||f.jitter.angle||f.jitter.scale!==1);if(structural&&edited&&!confirm('Cambiar filas o columnas reconstruye las piezas y reinicia sus ediciones. Podés deshacerlo. ¿Continuar?'))return;action(()=>regrid(state,g));selected.clear();fit()};
const gridKeys=['columns','rows','skewX','skewY','originX','originY'];
function gridDrawing(g){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 120 76');svg.setAttribute('aria-hidden','true');for(const f of buildGrid({id:'preview',width:120,height:76},g)){const p=document.createElementNS(ns,'polygon');p.setAttribute('points',f.source.polygon.map(p=>p.x+','+p.y).join(' '));svg.append(p)}return svg;}
function gridDraft(){const g={...state.grid};for(const key of gridKeys)g[key]=+$(key).value;if(!gridKeys.every(k=>$(k).validity.valid&&$(k).value!=='')){$('apply-grid').disabled=true;return}$('apply-grid').disabled=false;const preset=GRID_PRESETS.find(p=>gridKeys.every(k=>p[k]===g[k]));for(const b of $('grid-presets').children)b.setAttribute('aria-pressed',String(b.dataset.preset===preset?.id));const changed=gridKeys.some(k=>g[k]!==state.grid[k]);$('grid-description').textContent=(preset?preset.name:'Personalizada · '+g.columns+' × '+g.rows)+(changed?' · sin aplicar':'');$('grid-draft').replaceChildren(gridDrawing(g));}
for(const preset of GRID_PRESETS){const button=document.createElement('button');button.type='button';button.dataset.preset=preset.id;button.title=preset.name;const label=document.createElement('span');label.textContent=preset.name;button.append(gridDrawing(preset),label);$('grid-presets').append(button);button.onclick=()=>{for(const key of gridKeys)$(key).value=preset[key];$('apply-grid').click();refresh()};}
for(const key of gridKeys)$(key).addEventListener('input',gridDraft);
for(const button of document.querySelectorAll('[data-step]'))button.onclick=()=>{const [key,step]=button.dataset.step.split(':');$(key).value=Math.max(1,Math.min(32,(+$(key).value||1)+Number(step)));gridDraft()};
$('restore-composition').onclick=()=>{if(!state.source)return;action(()=>{state=restoreComposition(state);selected.clear()});fit();message('Composición restaurada · Grilla conservada. Podés deshacerlo.');};
$('grid-visible').onchange=()=>action(()=>state.grid.visible=$('grid-visible').checked);
const EFFECTS=TYPES.filter(t=>t!=='original');
const labels={original:'Original',ascii:'ASCII',pixel:'Pixel',dither:'Dither',halftone:'Semitono',lines:'Líneas',duotone:'Duotono',invert:'Negativo',solid:'Color plano',contour:'Contorno'};
for(const type of EFFECTS){const b=document.createElement('button');b.type='button';b.dataset.type=type;const c=document.createElement('canvas');c.width=150;c.height=90;const label=document.createElement('span');label.textContent=labels[type];b.append(c,label);if(type!=='original')$('treatments').append(b);b.onclick=()=>{if(!selected.size)return;action(()=>{state.active=type;targets().forEach(f=>{f.type=type;f.params=structuredClone(state.brush)})});};const row=document.createElement('label');row.textContent=labels[type];const check=document.createElement('input');check.type='checkbox';check.checked=true;check.id='enable-'+type;const input=document.createElement('input');input.type='number';input.min=0;input.max=100;input.value=state.weights[type];input.id='weight-'+type;row.append(check,input);$('weights').append(row);}
const adjustments={brightness:'brightness',contrast:'contrast',threshold:'threshold',size:'size',scale:'scale','ascii-charset':'charset','ascii-density':'density'};
for(const [id,key]of Object.entries(adjustments)){
 const input=$(id);input.oninput=()=>{
  if(!input.validity.valid||input.value==='')return;editBefore ||=capture(state);
  setAdjustment(state,selected.size?targets():null,key,key==='charset'?input.value:+input.value);
  $('brightness-value').textContent=Math.round(+$('brightness').value*100)+' %';$('ascii-density-value').textContent=$('ascii-density').value+'×';render();thumbnails();
 };
 input.onchange=()=>{if(!editBefore)input.oninput();finishEdit()};input.onblur=finishEdit;
}
$('reset-overrides').onclick=()=>action(()=>targets().forEach(f=>delete f.overrides));
function readDistribution(){state.seed=+$('seed').value;for(const t of EFFECTS)state.weights[t]=$('enable-'+t).checked?Math.max(0,Math.min(100,+$('weight-'+t).value)):0;}
function composeCurrent(){if(state.source)composeCollage(state,state.seed,selected.size?selected:null);}
function liveComposition(){
 editBefore ||=capture(state);state.collage={...collageDefaults(),...state.collage,amount:+$('collage-amount').value,clustering:+$('collage-clustering').value};readDistribution();
 $('collage-amount-value').textContent=$('collage-amount').value+' %';$('collage-clustering-value').textContent=$('collage-clustering').value+' %';
 try{composeCurrent();render()}catch(error){state=editBefore;editBefore=null;message(error.message);refresh();}
}
for(const key of ['collage-amount','collage-clustering',...EFFECTS.map(t=>'weight-'+t)]){
 const input=$(key);input.oninput=()=>{if(input.validity.valid&&input.value!=='')liveComposition()};input.onchange=()=>{if(!input.validity.valid||input.value==='')return;if(!editBefore)liveComposition();finishEdit()};input.onblur=finishEdit;
}
for(const t of EFFECTS)$('enable-'+t).onchange=()=>{if($('enable-'+t).checked&&+$('weight-'+t).value===0)$('weight-'+t).value=25;liveComposition();finishEdit();};
$('random-all').onclick=()=>{
 if(!state.source)return;
 action(()=>{state.seed=crypto.getRandomValues(new Uint32Array(1))[0];composeCurrent();});
 message('Nueva distribución · La paleta y los ajustes se conservan.');
};
$('seed').oninput=()=>{if(!$('seed').validity.valid||$('seed').value==='')return;editBefore ||=capture(state);state.seed=+$('seed').value;try{composeCurrent();render()}catch(error){state=editBefore;editBefore=null;message(error.message);refresh()}};
$('seed').onchange=finishEdit;$('seed').onblur=finishEdit;
async function thumbnails(){if(!state.source)return;const f=selectedPieces()[0]||state.fragments.find(f=>!f.deleted);if(!f)return;const key=JSON.stringify([state.source.id,f.id,state.grid,resolveTreatment(state,f),state.palette]);if(key===thumbKey)return;thumbKey=key;try{if(thumbSource!==state.source.id){const image=await createImageBitmap(await(await fetch(state.source.data)).blob());thumbImage?.close();thumbImage=image;thumbSource=state.source.id;}if(key!==thumbKey)return;const box=bounds(f.source.polygon),q=Math.min(1,150/(box.right-box.x),90/(box.bottom-box.y));for(const button of $('treatments').children){const c=button.querySelector('canvas'),cx=c.getContext('2d'),result=treat(thumbImage,box,button.dataset.type,resolveTreatment(state,{...f,type:button.dataset.type}),q);cx.clearRect(0,0,c.width,c.height);const scale=Math.min(c.width/result.width,c.height/result.height);cx.drawImage(result,(c.width-result.width*scale)/2,(c.height-result.height*scale)/2,result.width*scale,result.height*scale)}}catch(e){message(e.message)}}
function showMixed(input,values,fallback){
 const mixed=new Set(values.map(v=>JSON.stringify(v))).size>1;
 input.dataset.mixed=String(mixed);input.title=mixed?'Valores diferentes · editar aplica a toda la selección':'';
 if(input.tagName==='SELECT'){
  let option=input.querySelector('[data-mixed-option]');if(!option){option=document.createElement('option');option.value='';option.textContent='Mixto';option.disabled=true;option.dataset.mixedOption='true';input.prepend(option);}option.hidden=!mixed;
 }
 input.value=mixed&&!['color','checkbox','range'].includes(input.type)?'':fallback;
 if(input.type==='number')input.placeholder=mixed?'Mixto':'';
 return mixed;
}
function refresh(){
 const fs=selectedPieces(),local=fs.length>0,types=new Set(fs.map(f=>f.type)),type=types.size===1?fs[0].type:local?'mixed':state.active;
 $('global-controls').hidden=local;$('source-controls').hidden=local;$('piece-controls').hidden=!local;$('piece-inspector').hidden=!local;
 $('scope-title').textContent=local?(fs.length===1?'Editar bloque':`Editar ${fs.length} bloques`):'Toda la composición';
 $('scope-hint').textContent=local?'Misma paleta global. Ajustá solamente los detalles de esta selección.':'Una configuración compartida por toda la grilla.';
 $('piece-selection-title').textContent=fs.length+' seleccionados'+(types.size>1?' · efectos mixtos':'');
 $('color-scope').textContent='Global · los cuatro efectos usan estos mismos colores';
 $('adjustment-title').textContent=local?'Ajustes de la selección':'Ajustes globales';
 $('adjustment-scope').textContent=local?'Hereda los ajustes globales salvo los valores que cambies acá.':'Base común de Contorno, ASCII, Pixel y Semitono.';
 $('reset-overrides').hidden=!local;$('reset-overrides').disabled=!targets().some(f=>Object.keys(f.overrides||{}).length);
 $('motion-controls').hidden=local&&!fs.some(f=>['ascii','contour','halftone'].includes(f.type));$('motion-controls').querySelector('h2').textContent=local?'Jitter de la selección':'Jitter global';
 $('random-all').disabled=!state.source;const collage={...collageDefaults(),...state.collage};
 for(const key of ['amount','clustering']){$('collage-'+key).value=collage[key];$('collage-'+key+'-value').textContent=collage[key]+' %';}
 $('restore-composition').disabled=!state.source;document.title=title()+' · Distortion';
 for(const key of ['columns','rows','skewX','skewY','originX','originY'])$(key).value=state.grid[key];gridDraft();$('grid-visible').checked=state.grid.visible;$('seed').value=state.seed;
 for(const t of EFFECTS){$('weight-'+t).value=state.weights[t];$('enable-'+t).checked=state.weights[t]>0;}
 const values=fs.map(f=>resolveTreatment(state,f)),base=local?values[0]:state.style;
 for(const [id,key]of Object.entries(adjustments)){
  const value=base[key];const mixed=showMixed($(id),values.map(p=>p[key]),typeof value==='number'?Math.round(value*100)/100:value);
  $(id).disabled=local&&!targets().length;$(id).dataset.overridden=String(local&&fs.some(f=>f.overrides?.[key]!==undefined));
  if(id==='brightness')$('brightness-value').textContent=mixed?'Mixto':Math.round(value*100)+' %';
  if(id==='ascii-density')$('ascii-density-value').textContent=mixed?'Mixto':value+'×';
 }
 for(const button of $('treatments').children)button.setAttribute('aria-pressed',String(types.size===1&&button.dataset.type===type));
 $('selection-info').textContent=fs.length+' seleccionados'+(types.size>1?' · valores mixtos':fs.length?' · '+labels[type]:'');
 $('parameters').hidden=false;const ascii=!local||types.has('ascii');$('ascii-properties').hidden=!ascii;$('scale').closest('label').hidden=!ascii;
 $('threshold').closest('label').hidden=local&&type==='original';$('size').closest('label').firstChild.textContent=type==='contour'?'Grosor de contorno':'Tamaño de unidad';
 refreshExtras();$('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length;
 for(const key of ['delete','reset-transform','reset-treatment','reset-all'])$(key).disabled=!targets().length;
 $('source-info').textContent=state.source?state.source.name+' · '+state.source.width+' × '+state.source.height:'Una imagen, muchas posibilidades.';
 render();if(local)thumbnails();
}
$('subdivide').onclick=()=>action(()=>{selected=new Set(subdivide(state,selected))});
for(const [button,key,value]of [['lock-pieces','locked',true],['unlock-pieces','locked',false],['protect-pieces','protected',true],['unprotect-pieces','protected',false]]){
 $(button).onclick=()=>action(()=>selectedPieces().forEach(f=>{if(key==='protected'&&f.locked)return;f[key]=value;if(key==='protected'&&value)reset(f,'treatment')}));
}

function changePalette(change){
 const before=capture(state);try{state.palette||=paletteDefaults();change(state.palette);validate(state);render();thumbnails();}catch(error){state=before;message(error.message);refresh();}
}
let paletteKey='';
function paletteUI(){
 const colors=state.palette.colors,key=JSON.stringify(colors);if(key===paletteKey)return;paletteKey=key;$('palette-colors').replaceChildren();
 colors.forEach((entry,index)=>{
  const row=document.createElement('div');row.className='palette-entry';
  const enable=document.createElement('input');enable.type='checkbox';enable.checked=entry.enabled;enable.setAttribute('aria-label','Usar color '+(index+1));
  const color=document.createElement('input');color.type='color';color.value=entry.color;color.setAttribute('aria-label','Color '+(index+1));
  const weight=document.createElement('input');weight.type='number';weight.min=0;weight.max=100;weight.step=1;weight.value=entry.weight;weight.title='Peso del color';weight.setAttribute('aria-label','Peso del color '+(index+1));
  const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Quitar color '+(index+1));
  const update=()=>{if(!weight.validity.valid||weight.value==='')return;editBefore ||=capture(state);changePalette(p=>p.colors[index]={color:color.value,weight:+weight.value,enabled:enable.checked});};
  color.oninput=weight.oninput=update;color.onchange=weight.onchange=()=>{if(!editBefore)update();finishEdit()};color.onblur=weight.onblur=finishEdit;enable.onchange=()=>{update();finishEdit()};
  remove.onclick=()=>action(()=>changePalette(p=>p.colors.splice(index,1)));row.append(enable,color,weight,remove);$('palette-colors').append(row);
 });
}
$('extract-palette').onclick=async()=>{
 if(!state.source)return;const source=state.source;
 try{const image=await createImageBitmap(await(await fetch(source.data)).blob()),c=document.createElement('canvas');c.width=128;c.height=128;c.getContext('2d').drawImage(image,0,0,128,128);image.close();const colors=extractPalette(c.getContext('2d').getImageData(0,0,128,128).data);if(state.source!==source)return;action(()=>{state.palette={colors};state.style.colorMode='palette';});}catch(e){message(e.message)}
};
$('add-palette-color').onclick=()=>action(()=>changePalette(p=>{if(p.colors.length<8)p.colors.push({color:'#ed4435',weight:25,enabled:true});}));
for(const [id,key]of [['color-mode','colorMode'],['background','background'],['pattern-backdrop','backdrop']]){
 $(id).oninput=()=>{editBefore ||=capture(state);const before=capture(state);state.style[key]=$(id).value;try{validate(state);render();thumbnails()}catch(error){state=before;message(error.message);refresh();}};
 $(id).onchange=()=>{if(!editBefore)$(id).oninput();finishEdit()};$(id).onblur=finishEdit;
}
function readMotion(key){
 const value=key==='enabled'?$('motion-enabled').checked:+$('motion-'+key).value;
 setAdjustment(state,selected.size?targets():null,{enabled:'motionEnabled',amount:'jitterAmount',speed:'motionSpeed'}[key],value);
 $('motion-amount-value').textContent=$('motion-amount').value+' px';$('motion-speed-value').textContent=$('motion-speed').value+'×';
}
for(const key of ['amount','speed']){$('motion-'+key).oninput=()=>{if(!$('motion-'+key).validity.valid||$('motion-'+key).value==='')return;editBefore ||=capture(state);readMotion(key);render()};$('motion-'+key).onchange=finishEdit;$('motion-'+key).onblur=finishEdit;}
$('motion-enabled').onchange=()=>action(()=>readMotion('enabled'));
function refreshExtras(){
 const fs=selectedPieces();for(const key of ['lock-pieces','unlock-pieces','protect-pieces','unprotect-pieces'])$(key).disabled=!fs.length;
 $('subdivide').disabled=!targets().length;$('extract-palette').disabled=!state.source;$('piece-status').textContent=fs.filter(f=>f.protected).length+' protegidas · '+fs.filter(f=>f.locked).length+' bloqueadas';
 const motions=fs.map(f=>motionSettings(state,f)),motion=motions[0]||{enabled:false,amount:3,fps:12,speed:1,...state.motion};
 for(const key of ['amount','speed']){const mixed=showMixed($('motion-'+key),motions.map(m=>m[key]),motion[key]);$('motion-'+key+'-value').textContent=mixed?'Mixto':motion[key]+(key==='speed'?'×':' px');}
 $('motion-enabled').checked=motion.enabled;$('motion-enabled').indeterminate=new Set(motions.map(m=>m.enabled)).size>1;
 $('color-mode').value=state.style.colorMode;$('background').value=state.style.background;$('pattern-backdrop').value=state.style.backdrop;
 paletteUI();$('palette-colors').hidden=state.style.colorMode!=='palette';$('add-palette-color').disabled=state.palette.colors.length>=8;$('save-gif').disabled=!state.source;
}
let animationAt=0;
function animate(now){requestAnimationFrame(animate);if(document.hidden||!ready||!state.source||gesture||inflight||pending||!hasMotion(state))return;const fps=Math.max(1,...state.fragments.filter(f=>!f.deleted&&motionSettings(state,f).enabled).map(f=>motionSettings(state,f).fps));if(now-animationAt<1000/fps)return;animationAt=now;render();}
requestAnimationFrame(animate);
$('save-gif').onclick=async()=>{
 finishEdit();$('save-gif').disabled=true;try{
 const snapshot=capture(state),size=exportSize(snapshot,1024),data={kind:'gif',id:++requestId,state:snapshot,width:size.width,height:size.height,camera:{x:-size.x*size.scale,y:-size.y*size.scale,scale:size.scale},quality:size.scale};let blob;message('Preparando GIF…');
 if(worker)blob=await new Promise((resolve,reject)=>{exports.set(data.id,{resolve,reject});worker.postMessage(data)});
 else{const {Renderer}=await import('./renderer.js'),{createGifEncoder}=await import('../contour/gif-encode.js'),r=new Renderer();await r.load(snapshot.source);let encoder;const fps=Math.max(1,...snapshot.fragments.filter(f=>!f.deleted&&motionSettings(snapshot,f).enabled).map(f=>motionSettings(snapshot,f).fps)),count=hasMotion(snapshot)?fps*4:1;for(let i=0;i<count;i++){const c=r.render({...snapshot,motionTime:(i+.01)*1000/fps},data.width,data.height,data.camera,data.quality),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;encoder??=createGifEncoder(c.width,c.height,pixels,Math.round(100/fps));encoder.add(pixels);message('Preparando GIF · '+Math.round((i+1)/count*100)+' %');await new Promise(res=>setTimeout(res,0));}blob=encoder.finish();}
 download(blob,'gif');message('GIF '+data.width+' × '+data.height+' descargado.');
 }catch(e){message(e.message)}finally{$('save-gif').disabled=false;}
};

$('load').onclick=()=>$('image-file').click();$('image-file').onchange=async()=>{const file=$('image-file').files[0];if(!file)return;$('image-file').value='';if(state.source&&!confirm('Reemplazar la imagen inicia una grilla nueva. Podés deshacerlo. ¿Continuar?'))return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>40*1024*1024)throw Error('Usá PNG, JPG o WebP de hasta 40 MB.');message('Cargando imagen…');const image=await createImageBitmap(file),factor=Math.min(1,4096/Math.max(image.width,image.height),Math.sqrt(16000000/(image.width*image.height))),c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*factor));c.height=Math.max(1,Math.round(image.height*factor));c.getContext('2d').drawImage(image,0,0,c.width,c.height);image.close();const source={id:crypto.randomUUID(),name:file.name,width:c.width,height:c.height,data:c.toDataURL('image/png')};action(()=>{state.source=source;delete state.splits;state.fragments=buildGrid(source,state.grid)});selected.clear();fit();message('Imagen lista. Elegí piezas o pintá tratamientos.')}catch(e){message(e.message)}};
$('name').oninput=()=>{document.title=title()+' · Distortion';schedule()};$('export').onclick=()=>$('export-menu').hidden=!$('export-menu').hidden;
function download(blob,extension){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename()+'.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(u),60000)}
$('save-ment').onclick=()=>{finishEdit();download(new Blob([ment(state,{id,name:title(),preview:preview()})],{type:'application/json'}),'ment');message('Copia .ment descargada.')};
$('save-png').onclick=async()=>{finishEdit();$('save-png').disabled=true;try{const snapshot=capture(state),size=exportSize(snapshot,+$('png-size').value),data={kind:'export',id:++requestId,state:snapshot,width:size.width,height:size.height,camera:{x:-size.x*size.scale,y:-size.y*size.scale,scale:size.scale},quality:Math.min(4,size.scale)};message('Preparando PNG '+size.width+' × '+size.height+'…');let blob;if(worker){blob=await new Promise((resolve,reject)=>{exports.set(data.id,{resolve,reject});worker.postMessage(data)})}else{const {Renderer}=await import('./renderer.js'),r=new Renderer();await r.load(snapshot.source);const c=r.render(snapshot,data.width,data.height,data.camera,data.quality);blob=c.convertToBlob?await c.convertToBlob({type:'image/png'}):await new Promise(res=>c.toBlob(res))}download(blob,'png');message('PNG '+size.width+' × '+size.height+' descargado.')}catch(e){message(e.message)}finally{$('save-png').disabled=false}};
document.onkeydown=e=>{if(e.target.matches('input,textarea,select'))return;if(e.code==='Space'){e.preventDefault();space=true}if(e.key==='Escape'){endGesture(true);selected.clear();refresh()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey)}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();$('select-all').click()}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('delete').click()}if(e.key.startsWith('Arrow')&&selected.size&&mode==='transform'){e.preventDefault();const step=e.shiftKey?10:1;action(()=>targets().forEach(f=>{if(e.key==='ArrowLeft')f.transform.x-=step;if(e.key==='ArrowRight')f.transform.x+=step;if(e.key==='ArrowUp')f.transform.y-=step;if(e.key==='ArrowDown')f.transform.y+=step}))}};document.onkeyup=e=>{if(e.code==='Space')space=false};window.onblur=()=>{space=false;endGesture(true)};
$('main-page').onclick=async e=>{e.preventDefault();finishEdit();endGesture();while(saving)await new Promise(r=>setTimeout(r,30));await save();if(!dirty)location.href='/hub/'};
new ResizeObserver(resize).observe($('workspace'));
(async()=>{try{if(url.has('project')){const p=await getProject(id);if(!p||p.studio!=='distortion')throw Error('Proyecto no disponible');state=upgradeStyle(validate(p.state));$('name').value=p.name;createdAt=p.createdAt;}ready=true;setMode('select');refresh();fit();if(!url.has('project'))schedule();else $('save-status').textContent=projectSavedLabel()}catch(e){message(e.message);document.querySelector('main').inert=true}})();

window.addEventListener('basement-library-changed',()=>{if(!ready){location.reload();return;}dirty=true;save();});

registerStudioSession({save:async()=>{if(!ready)throw Error('Artboard is not ready.');finishEdit();endGesture();while(saving)await new Promise(r=>setTimeout(r,20));await save();if(dirty)throw Error($('save-status').textContent||'Save failed.');},capture:()=>({id,name:title(),studio:'distortion',state:capture(state),preview:preview(),createdAt,updatedAt:Date.now()}),dirty:()=>dirty});
