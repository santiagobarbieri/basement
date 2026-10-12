const $ = id => document.getElementById(id);
const api = (command, args = {}) => window.__TAURI__.core.invoke(command, args);
const studios = [
  ['quill','Quill','Vectors & Illustrations','#1a61f8',false],
  ['endo','Endo','Brushes','#78ad00',true],
  ['reel','Reel','Video Editing','#ff4213',false],
  ['folio','Folio','Page Layout','#f32783',false],
  ['lux','Lux','Photo Development','#ffaf0c',false],
  ['mirage','Mirage','Motion & Effects','#6a31fd',false],
  ['prism','Prism','Image Editing','#00f3ff',true]
].map(([id,name,subtitle,color,available]) => ({id,name,subtitle,color,available}));
let artboards = [], preferences = {}, filter = 'all', selectedStudio = 'endo', current = null, zoom = 1, blobURL;
let toastTimer, busy = false;
const studioFor = id => studios.find(s => s.id === id);
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,5000); }
function formatDay(time) {
  const day = value => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(value));
  if (day(time)===day(Date.now())) return 'Today';
  if (day(time)===day(Date.now()-86400000)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(time)).replace(/([A-Za-z]{3}) /,'$1. ');
}
function clock() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'short',year:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  $('clock').replaceChildren();const date=document.createElement('span');date.className='date';date.textContent=`${parts.day} ${parts.month} / ${parts.year}`;$('clock').append(date,document.createTextNode(` | ${parts.weekday}. ${parts.hour}:${parts.minute}`));
}
function buildStudios() {
  for(const s of studios) {
    const button=document.createElement('button');button.className='studio-pill';button.style.setProperty('--accent',s.color);button.disabled=!s.available;button.title=s.available?`Crear artboard de ${s.name}`:`${s.name} · Soon`;
    const image=document.createElement('img');image.src=`icons/${s.id}.svg`;image.alt='';const name=document.createElement('span');name.textContent=s.name;const subtitle=document.createElement('span');subtitle.className='subtitle';subtitle.textContent=s.subtitle;const action=document.createElement('span');action.className=s.available?'plus':'soon';action.textContent=s.available?'+':'Soon';
    button.append(image,name,subtitle,action);button.onclick=()=>newDialog(s.id);$('studio-list').append(button);
  }
  for(const id of ['all',...studios.map(s=>s.id)]) {
    const button=document.createElement('button');button.className='filter-dot';button.dataset.studio=id;button.style.setProperty('--accent',studioFor(id)?.color||'transparent');button.title=id==='all'?'Todos':studioFor(id).name;button.setAttribute('aria-label',button.title);button.onclick=()=>{filter=id;renderList()};$('filters').append(button);
  }
}
function renderList() {
  const focusedFolder=document.activeElement?.dataset?.folder;
  $('artboard-count').textContent=artboards.length;
  for(const button of $('filters').children)button.setAttribute('aria-pressed',String(button.dataset.studio===filter));
  $('artboards').replaceChildren();const visible=artboards.filter(b=>filter==='all'||b.project.studio===filter);
  $('empty').hidden=visible.length>0;
  $('empty').querySelector('p').textContent=artboards.length?'Todavía no hay artboards de este Studio.':'Tu primer artboard empieza acá.';
  for(const board of visible) {
    const s=studioFor(board.project.studio);const row=document.createElement('button');row.className='artboard-row';row.dataset.folder=board.folder;row.style.setProperty('--accent',s.color);row.disabled=!s.available;row.setAttribute('aria-label',`Abrir ${board.project.name} · ${s.name}`);
    const color=document.createElement('span');color.className='color';const icon=document.createElement('img');icon.className='icon';icon.src=`icons/${s.id}.svg`;icon.alt=s.name;
    const name=document.createElement('span');name.className='name';name.textContent=board.project.name;const date=document.createElement('span');date.textContent=formatDay(board.project.updatedAt);const arrow=document.createElement('span');arrow.className='arrow';arrow.textContent='↗';row.append(color,icon,name,date,arrow);row.onclick=()=>openBoard(board.folder).catch(error=>toast(String(error)));$('artboards').append(row);
  }
  if(focusedFolder)$('artboards').querySelector(`[data-folder="${CSS.escape(focusedFolder)}"]`)?.focus();
}
async function refresh() {
  const result=await api('home');artboards=result.index.artboards;preferences=result.preferences;document.body.classList.toggle('theme-light',preferences.theme==='light');renderList();
  $('disk-warning').hidden=!result.index.warnings.length;$('disk-warning').textContent=result.index.warnings.length?`${result.index.warnings.length} carpeta(s) no se pudieron leer. Revisá sus project.json.`:'';
  $('root-path').textContent=preferences.root;$('theme').value=preferences.theme;
  return result;
}
function newDialog(id) {
  selectedStudio=id;const s=studioFor(id);$('new-dialog').style.setProperty('--studio-accent',s.color);$('new-title').textContent=`Nuevo artboard · ${s.name}`;$('create-error').textContent='';$('new-dialog').showModal();$('new-form').elements.name.focus();$('new-form').elements.name.select();
}
const newForm=$('new-form');
newForm.elements.preset.onchange=event=>{if(event.target.value==='custom')return;const [width,height,resolution]=event.target.value.split(',');Object.assign(newForm.elements.width,{value:width});newForm.elements.height.value=height;newForm.elements.resolution.value=resolution};
for(const key of ['width','height'])newForm.elements[key].oninput=()=>{newForm.elements.preset.value='custom'};
newForm.elements.background.onchange=event=>{$('background-color').hidden=event.target.value!=='color'};
$('cancel-new').onclick=()=>$('new-dialog').close();
newForm.onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;$('create').disabled=true;$('create-error').textContent='';
  try {const f=newForm.elements;const board=await api('create_artboard',{input:{studio:selectedStudio,name:f.name.value,width:Number(f.width.value),height:Number(f.height.value),resolution:Number(f.resolution.value),background:f.background.value==='color'?$('background-color').value:f.background.value}});$('new-dialog').close();await refresh();await openBoard(board.folder);}catch(error){$('create-error').textContent=String(error)}finally{busy=false;$('create').disabled=false}
};
function fitCanvas() {
  if(!current)return;const area=document.querySelector('.workspace').getBoundingClientRect();const fit=Math.min((area.width-60)/current.project.width,(area.height-60)/current.project.height);const scale=Math.max(.05,fit*zoom);$('canvas').style.width=`${current.project.width*scale}px`;$('canvas').style.height=`${current.project.height*scale}px`;$('zoom-fit').textContent=`${Math.round(scale*100)}%`;
}
async function openBoard(folder) {
  const board=await api('read_artboard',{folder});if(!studioFor(board.project.studio)?.available)throw Error('Este Studio todavía no está disponible.');
  current=board;zoom=1;const s=studioFor(board.project.studio);$('home').hidden=true;$('studio').hidden=false;$('studio').style.setProperty('--studio-accent',s.color);$('studio-icon').src=`icons/${s.id}.svg`;$('artboard-name').value=board.project.name;$('mode').textContent=s.id==='endo'?'Paint':'Edit';$('units').textContent=`${board.project.width} × ${board.project.height} px · ${board.project.resolution} ppi`;$('saved-location').textContent=`${preferences.root}/${board.folder}`;
  $('library-title').textContent=s.id==='endo'?'Brushes':'Properties';$('library').replaceChildren();
  for(const label of s.id==='endo'?['Metal','Chrome','Sand','Neon']:['Imagen','RGB · 8 bits','Fondo']){const row=document.createElement('div');row.className='library-row';row.textContent=label;$('library').append(row)}
  $('tool-rail').replaceChildren();for(const [icon,label] of [['pointer','Seleccionar'],['brush','Pincel'],['eraser','Borrador'],['restore','Restaurar'],['flip-horizontal','Simetría'],['atom','Mandala'],['layout-grid','Mosaico'],['grid-3x3','Grilla'],['photo','Imágenes'],['history','Historial']]){const button=document.createElement('button');button.disabled=true;button.title=`${label} · editor pendiente`;const image=document.createElement('img');image.src=`icons/tools/panels/${icon}.svg`;image.alt=label;button.append(image);$('tool-rail').append(button)}
  $('board-details').replaceChildren();for(const [label,value] of [['Ancho',`${board.project.width} px`],['Alto',`${board.project.height} px`],['Resolución',`${board.project.resolution} ppi`],['Fondo',board.project.background==='transparent'?'Transparente':board.project.background]]){const row=document.createElement('div');row.className='detail-row';const a=document.createElement('span'),b=document.createElement('span');a.textContent=label;b.textContent=value;row.append(a,b);$('board-details').append(row)}
  const bytes=await api('artboard_image',{folder});if(blobURL)URL.revokeObjectURL(blobURL);blobURL=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const image=new Image();image.src=blobURL;await image.decode();const canvas=$('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);fitCanvas();
}
$('back').onclick=async()=>{current=null;$('studio').hidden=true;$('home').hidden=false;await refresh()};
$('artboard-name').onchange=async()=>{if(!current)return;try{current=await api('rename_artboard',{folder:current.folder,name:$('artboard-name').value});$('artboard-name').value=current.project.name;$('saved-location').textContent=`${preferences.root}/${current.folder}`;await refresh();toast('Artboard guardado.')}catch(error){$('artboard-name').value=current.project.name;toast(String(error))}};
$('export').onclick=async()=>{if(!current)return;try{const path=await api('export_png',{folder:current.folder});if(path)toast(`PNG exportado: ${path}`)}catch(error){toast(String(error))}};
$('zoom-in').onclick=()=>{zoom=Math.min(4,zoom*1.25);fitCanvas()};$('zoom-out').onclick=()=>{zoom=Math.max(.25,zoom/1.25);fitCanvas()};$('zoom-fit').onclick=()=>{zoom=1;fitCanvas()};addEventListener('resize',fitCanvas);
function showPreferences(){if(!$('preferences').open)$('preferences').showModal()}
$('close-preferences').onclick=()=>$('preferences').close();$('theme').onchange=async event=>{await api('set_theme',{theme:event.target.value});await refresh()};
$('choose-root').onclick=async()=>{try{if(await api('choose_root')){current=null;$('studio').hidden=true;$('home').hidden=false;await refresh()}}catch(error){toast(String(error))}};
addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key===','){event.preventDefault();showPreferences()}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();$('artboard-name').blur();if(current)toast('El artboard está guardado en disco.')}});
addEventListener('focus',()=>refresh().catch(error=>toast(String(error))));
buildStudios();clock();setInterval(clock,15000);
setInterval(()=>{if(!$('home').hidden&&!$('new-dialog').open&&!$('preferences').open)refresh().catch(()=>{});},3000);
if(window.__TAURI__){window.__TAURI__.event.listen('preferences',showPreferences);window.__TAURI__.event.listen('open-artboard',event=>{refresh().then(()=>openBoard(event.payload)).then(async()=>{if(await api('qa_mode'))await api('qa_report',{data:{finderOpened:event.payload}})}).catch(error=>toast(String(error)))});window.__TAURI__.event.listen('open-error',event=>toast(event.payload));}
refresh().then(async()=>{const folder=await api('pending_open');if(folder)await openBoard(folder)}).catch(error=>toast(`No se pudo abrir la carpeta de artboards: ${error}`));
window.__basement={refresh,openBoard,newDialog,get current(){return current}};
if(window.__TAURI__)api('qa_mode').then(async enabled=>{
  if(!enabled)return;
  try {
    let data=await refresh();
    if(!data.index.artboards.length){
      for(const [studio,name] of [['endo','New Endo Project'],['prism','Prism testing']])await api('create_artboard',{input:{studio,name,width:512,height:512,resolution:72,background:studio==='endo'?'transparent':'#ffffff'}});
    }
    data=await refresh();const endo=data.index.artboards.find(b=>b.project.studio==='endo'),prism=data.index.artboards.find(b=>b.project.studio==='prism');
    await openBoard(endo.folder);const endoLoaded=$('canvas').width===endo.project.width&&$('mode').textContent==='Paint';
    await openBoard(prism.folder);const prismLoaded=$('canvas').width===prism.project.width&&$('mode').textContent==='Edit';
    let formCreated=true;
    if(!data.index.artboards.some(b=>b.project.name==='Brush testing')){
      newDialog('endo');newForm.elements.name.value='Brush testing';newForm.elements.width.value='320';newForm.elements.height.value='240';newForm.requestSubmit();
      for(let i=0;i<100&&busy;i++)await new Promise(resolve=>setTimeout(resolve,50));
      formCreated=!$('new-dialog').open&&current?.project.name==='Brush testing';
    }
    current=null;$('studio').hidden=true;$('home').hidden=false;data=await refresh();
    await api('qa_report',{data:{endoLoaded,prismLoaded,formCreated,home:data,rows:$('artboards').children.length,errors:[]}});
  }catch(error){await api('qa_report',{data:{error:String(error)}})}
});
