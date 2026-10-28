import {normalizeEndoState,validateEndoState} from './endo-model.js';
import {FolderWorkspace} from './folder-workspace.js';
import {scanStorageUsage} from './storage-usage.js';
import {validate as validateMarble} from './marble/engine.js';
import {validate as validateDistortion} from './distortion/model.js';
import {validate as validateFoundry} from './foundry/model.js';
let opening;
function db(){return opening ||= new Promise((resolve,reject)=>{const request=indexedDB.open('basement-projects',1);request.onupgradeneeded=()=>request.result.createObjectStore('projects',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>{opening=null;reject(request.error)}})}
async function transaction(mode,work){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('projects',mode);const request=work(tx.objectStore('projects'));let value;request.onsuccess=()=>value=request.result;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Could not access browser storage.'))})}
// The old database remains intact as a recovery cache and migration source.
const legacyList=()=>transaction('readonly',s=>s.getAll());
const legacyGet=id=>transaction('readonly',s=>s.get(id));
const supported=()=>typeof globalThis.showDirectoryPicker==='function';
let settingsOpening;
function settingsDB(){return settingsOpening ||= new Promise((resolve,reject)=>{const r=indexedDB.open('basement-storage',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>{settingsOpening=null;reject(r.error);};});}
async function setting(value){const database=await settingsDB();return new Promise((resolve,reject)=>{const tx=database.transaction('settings',value===undefined?'readonly':'readwrite');const store=tx.objectStore('settings'),r=value===undefined?store.get('workspace'):store.put(value,'workspace');let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Could not remember the folder.'));});}
let queue=Promise.resolve();
function exclusive(work){const run=()=>globalThis.navigator?.locks?navigator.locks.request('basement-library',work):work();const job=queue.then(run);queue=job.catch(()=>{});return job;}
let workspace=null,token,initialized=false,pendingSnapshot=null;
const listeners=new Set();
const state={supported:supported(),configured:false,ready:false,name:'',busy:false,failures:[],error:''};
function emit(){for(const fn of listeners)fn({...state});if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('basement-storage-change'));}
export function subscribeStorage(fn){listeners.add(fn);fn({...state});return ()=>listeners.delete(fn);}
export async function storageStatus(){
 const config=await setting();state.supported=supported();state.configured=!!config;state.name=config?.handle.name||'';
 state.ready=!!config&&!pendingSnapshot&&await config.handle.queryPermission({mode:'readwrite'})==='granted';
 if(!initialized){token=config?.token;initialized=true;}
 else if(token!==config?.token){state.ready=false;state.error='The folder changed in another window. Download a .ment recovery copy and return to the hub.';}
 emit();return {...state};
}
async function activeWorkspace(){
 const config=await setting();
 if(!initialized){token=config?.token;initialized=true;}
 if(config?.token!==token)throw Error('The folder changed in another window. Download a .ment recovery copy and return to the hub.');
 if(!config)throw Error('Choose a folder before saving Artboards.');
 if(await config.handle.queryPermission({mode:'readwrite'})!=='granted'){
  state.ready=false;state.error='Reconnect your folder to continue saving.';emit();throw Error(state.error);
 }
 state.ready=!pendingSnapshot;state.configured=true;state.name=config.handle.name;
 if(!workspace)workspace=new FolderWorkspace(config.handle,{encode:encodeProject,decode:decodeProject});
 return workspace;
}
export async function chooseProjectFolder({mode='open'}={}){
 if(!supported())throw Error('Open Basement in Google Chrome to choose a folder.');
 // Keep the picker directly attached to the user's click (before any awaits).
 const handle=await showDirectoryPicker({id:'basement-projects',mode:'readwrite',startIn:'documents'});
 return connectProjectFolder(handle,{mode});
}
export function connectProjectFolder(handle,{mode='open'}={}){return exclusive(async()=>{
 state.busy=true;state.error='';emit();
 try{
  if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Allow write access to this folder.');
  await writableSession();const previous=await setting();
  if(previous&&await previous.handle.isSameEntry(handle)){token=previous.token;initialized=true;state.error='';await storageStatus();if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('basement-library-changed'));return;}
  const next=new FolderWorkspace(handle,{encode:encodeProject,decode:decodeProject});
  const loaded=await next.list();
  if(loaded.failures.length)throw Error('The folder contains unreadable Artboards. Check them before connecting it.');
  let migrated=0;
  if(previous&&mode!=='open'){if(!['copy','move'].includes(mode))throw Error('Unknown folder operation.');const source=await activeWorkspace();await source.copyTo(next,null,{move:mode==='move'});}
  // Only the first connection migrates browser projects. Changing folders opens
  // the selected library without importing the previous folder's cache into it.
  if(!previous){
   const existing=new Map(loaded.projects.map(p=>[p.id,p]));
   for(const project of await legacyList()){
    const disk=existing.get(project.id);
    if(disk){
     if(await encodeProject(disk)===await encodeProject(project))continue;
     const copy={...project,id:crypto.randomUUID(),name:project.name+' (browser copy)'};
     await next.write(copy);migrated++;continue;
    }
    await next.write(project);migrated++;
   }
  }
  const config={handle,token:crypto.randomUUID()};await setting(config);
  workspace=next;token=config.token;initialized=true;state.failures=[];await storageStatus();
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('basement-library-changed',{detail:{migrated}}));
 }catch(error){state.error=error.message;emit();throw error;}
 finally{state.busy=false;emit();}
});}
export async function reconnectProjectFolder(){
 const config=await setting();if(!config)throw Error('Choose a folder first.');
 if(await config.handle.requestPermission({mode:'readwrite'})!=='granted')throw Error('Folder access was not granted.');
 return exclusive(async()=>{if(token&&token!==config.token)throw Error('The folder changed. Reopen Basement.');token=config.token;initialized=true;state.error='';await storageStatus();if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('basement-library-changed'));});
}
export const listProjects=()=>exclusive(async()=>{
 const config=await setting();if(!config)return legacyList();
 const disk=await activeWorkspace(),loaded=await disk.list();state.failures=loaded.failures;emit();return loaded.projects;
});
export const getProject=id=>exclusive(async()=>{const config=await setting();return config?(await activeWorkspace()).read(id):legacyGet(id);});
async function writableSession(){if(typeof window==='undefined')return;if(window.basementSessionBlocked||window.basementSessionReady&&await window.basementSessionReady!==true||window.basementSessionBlocked)throw Error('Basement is already open in another tab.');}
async function validateName(disk,name,excludeId){
 if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('Enter an Artboard name of 1–80 characters.');
 if((await disk.list()).projects.some(p=>p.id!==excludeId&&p.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase())){const error=Error('An Artboard with this name already exists.');error.code='NAME_CONFLICT';throw error;}
}
export const assertUniqueName=(name,excludeId)=>exclusive(async()=>validateName(await activeWorkspace(),name,excludeId));
async function writeSnapshot(snapshot,options={}){
 await writableSession();
 // Reject document/name errors before the disk-write barrier. They must not
 // disconnect a healthy library or leave an unsaveable recovery snapshot.
 if(typeof snapshot.name!=='string'||!snapshot.name.trim()||snapshot.name.trim().length>80)throw Error('Enter an Artboard name of 1–80 characters.');
 const disk=await activeWorkspace();await validateName(disk,snapshot.name,snapshot.id);
 const previous=await disk.read(snapshot.id,{acceptExternal:false});
 const record={...snapshot,name:snapshot.name.trim(),lastOpenedAt:snapshot.lastOpenedAt??previous?.lastOpenedAt??snapshot.createdAt};
 decodeProject(await encodeProject(record));
 try{
  await disk.write(record,options);pendingSnapshot=null;state.error='';state.ready=true;emit();
  try{await transaction('readwrite',s=>s.put(record));}catch(error){console.warn('Basement recovery cache unavailable',error);}
 }catch(error){
  pendingSnapshot=record;state.error=error.message;state.ready=false;emit();
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('basement-write-error',{detail:{message:error.message,code:error.code}}));throw error;
 }
}
export function putProject(project,options={}){const snapshot=structuredClone(project);return exclusive(()=>writeSnapshot(snapshot,options));}
export const retryPendingSave=(options={})=>exclusive(async()=>{if(pendingSnapshot)await writeSnapshot(pendingSnapshot,options);});
export const pendingProject=()=>pendingSnapshot?structuredClone(pendingSnapshot):null;
export function registerStudioSession(session){window.basementStudioSession=session;window.addEventListener('beforeunload',event=>{if(session.dirty()){event.preventDefault();event.returnValue='';}});}
export const deleteProject=id=>exclusive(async()=>{
 await writableSession();await(await activeWorkspace()).trash(id);
 try{await transaction('readwrite',s=>s.delete(id));}catch(error){console.warn('Basement recovery cache unavailable',error);}
});
export const markProjectOpened=id=>exclusive(async()=>{const disk=await activeWorkspace(),p=await disk.read(id);if(!p)throw Error('Artboard unavailable.');await writeSnapshot({...p,lastOpenedAt:Date.now()});});
export const renameProject=(id,name)=>exclusive(async()=>{const disk=await activeWorkspace(),p=await disk.read(id);if(!p)throw Error('Artboard unavailable.');await writeSnapshot({...p,name,updatedAt:Date.now()});});
export const duplicateProject=id=>exclusive(async()=>{
 const disk=await activeWorkspace(),p=await disk.read(id);if(!p)throw Error('Artboard unavailable.');
 const names=new Set((await disk.list()).projects.map(p=>p.name.trim().toLocaleLowerCase()));let i=1,name;
 do{name=p.name.slice(0,65)+' Copy'+(i===1?'':' '+i);i++;}while(names.has(name.toLocaleLowerCase()));
 const copy={...p,id:crypto.randomUUID(),name,createdAt:Date.now(),updatedAt:Date.now(),lastOpenedAt:Date.now()};await writeSnapshot(copy);return copy;
});
export async function moveProjects(ids,handle){
 if(!handle)handle=await showDirectoryPicker({id:'basement-move',mode:'readwrite',startIn:'documents'});
 return exclusive(async()=>{await writableSession();const source=await activeWorkspace();if(await source.handle.isSameEntry(handle))throw Error('Choose a different folder.');if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Allow access to the destination folder.');return source.copyTo(new FolderWorkspace(handle,{encode:encodeProject,decode:decodeProject}),ids,{move:true});});
}
export const listTrash=()=>exclusive(async()=>(await activeWorkspace()).listTrash());
export const restoreProject=(id,name)=>exclusive(async()=>{await writableSession();const disk=await activeWorkspace(),p=(await disk.listTrash()).find(p=>p.id===id);if(!p)throw Error('Artboard unavailable.');await validateName(disk,name||p.name,id);return disk.restore(id,name);});
export const permanentlyDeleteProjects=ids=>exclusive(async()=>{await writableSession();const disk=await activeWorkspace();for(const id of ids)await disk.deleteForever(id);});
export const checkProjectChanged=id=>exclusive(async()=>(await activeWorkspace()).changed(id));
export const acceptExternalVersion=id=>exclusive(async()=>{await(await activeWorkspace()).read(id);state.error='';state.ready=true;emit();});
export const getLibrarySize=()=>exclusive(async()=>{const disk=await activeWorkspace();let bytes=0;for await(const [name,file]of disk.handle.entries())if(file.kind==='file'&&name.toLowerCase().endsWith('.ment'))bytes+=(await file.getFile()).size;return bytes;});
export const getStorageUsage=()=>exclusive(async()=>scanStorageUsage((await activeWorkspace()).handle,{decode:decodeProject}));
export const projectSavedLabel=()=>state.ready?'Saved in '+state.name:'Folder disconnected';
export const projectSavingLabel=()=>state.ready?'Saving…':'Reconnect your folder';
const validTimestamp=value=>Number.isFinite(value)&&value>=0&&value<=8.64e15-31*86400000;
const timestamp=(value,fallback)=>validTimestamp(value)?value:fallback;
export async function encodeProject(project){
 for(const key of ['createdAt','updatedAt','lastOpenedAt','deletedAt'])if(project[key]!==undefined&&!validTimestamp(project[key]))throw Error('Invalid Artboard date.');
 const paths={endo:['./ment-format.js','serializeMent'],tremor:['./tremor/ment-format.js','serializeMent'],kiln:['./kiln/model.js','ment'],contour:['./contour/model.js','ment'],foundry:['./foundry/model.js','ment'],distortion:['./distortion/model.js','ment'],marble:['./marble/engine.js','ment']};
 const spec=paths[project.studio];if(!spec)throw Error('Unsupported Studio.');
 const module=await import(spec[0]);
 const content=project.studio==='tremor'?structuredClone(project.state):project.state;
 if(project.studio==='tremor'){content.scene.frameTime=0;for(const stroke of content.strokes)stroke.createdAt=-Math.max(0,stroke.age||0);}
 const document=JSON.parse(module[spec[1]](content,{id:project.id,name:project.name,preview:project.preview,savedAt:new Date(project.updatedAt).toISOString()}));
 document.savedAt=new Date(project.updatedAt).toISOString();
 document.library={createdAt:project.createdAt,updatedAt:project.updatedAt,lastOpenedAt:project.lastOpenedAt??project.createdAt,...(project.deletedAt?{deletedAt:project.deletedAt}:{})};
 return JSON.stringify(document);
}
export function decodeProject(text){
 const doc=JSON.parse(text),project=importMent(text),fallback=timestamp(Date.parse(doc.savedAt),Date.now());
 const id=doc.artboard.id;if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid Artboard identifier.');
 return {...project,id,lastOpenedAt:timestamp(doc.library?.lastOpenedAt,fallback),...(validTimestamp(doc.library?.deletedAt)?{deletedAt:doc.library.deletedAt}:{}),createdAt:timestamp(doc.library?.createdAt,fallback),updatedAt:timestamp(doc.library?.updatedAt,fallback)};
}
export function projectUrl(project){return ({endo:'/',kiln:'/kiln/',tremor:'/tremor/',contour:'/contour/',foundry:'/foundry/',distortion:'/distortion/',marble:'/marble/'}[project.studio])+'?project='+encodeURIComponent(project.id)}
export function freezeState(studio,state){const copy=studio==='endo'?normalizeEndoState(state):structuredClone(state);delete copy.selected;delete copy.selection;if(studio==='tremor'){for(const stroke of copy.strokes)stroke.age=Math.max(0,(state.scene.frameTime||performance.now())-(stroke.createdAt??performance.now()));delete copy.scene.frameTime;}return copy}
export function resumeState(project){const copy=structuredClone(project.state);copy.selected=null;copy.selection=[];if(project.studio==='tremor'){const now=performance.now();copy.scene.frameTime=now;for(const stroke of copy.strokes){stroke.createdAt=now-(stroke.age||0);delete stroke.age}}return copy}
export function importMent(text){
 const doc=JSON.parse(text),a=doc?.artboard;
 if(typeof a?.name!=='string'||!a.name.trim()||a.name.trim().length>80)throw Error('Invalid Artboard name.');
 if(doc.format!=='basement.ment'||doc.version!==1||!a||!['endo','kiln','tremor','contour','foundry','distortion','marble'].includes(a.studio)||!Array.isArray(a.layers))throw Error('This is not a compatible .ment file.');
 let state;
 if(a.studio==='marble'){state=validateMarble(a.settings);
 }else if(a.studio==='distortion'){state=validateDistortion(a.settings);
 }else if(a.studio==='foundry'){state=validateFoundry(a.settings);
 }else if(a.studio==='contour'){
  const source=a.layers.find(l=>l.type==='image')?.image,config=a.settings;
  if(!source||!/^data:image\/(png|jpeg|webp);base64,/.test(source.data||'')||!Number.isFinite(source.width)||!Number.isFinite(source.height)||source.width<=0||source.height<=0||source.width*source.height>16000000||!config?.contour||!config.shared||!config.colors)throw Error('Invalid Contour Artboard.');
  for(const [key,min,max]of [['threshold',1,99],['roughness',0,12],['jitter',0,20],['fps',1,24],['stroke',0,20],['labelSize',8,80],['seed',0,4294967295]])if(!Number.isFinite(config.contour[key])||config.contour[key]<min||config.contour[key]>max)throw Error('Invalid Contour settings.');
  for(const value of Object.values(config.colors))if(!/^#[0-9a-f]{6}$/i.test(value))throw Error('Invalid Contour colors.');
  if(source.foreground&&!/^data:image\/png;base64,/.test(source.foreground))throw Error('Invalid Contour mask.');
  state={...config,source};
 }else if(a.studio==='kiln'){
  const source=a.layers.find(l=>l.type==='image')?.image,units=a.layers.find(l=>l.type?.startsWith('kiln.'));
  if(!source||!/^data:image\/(png|jpeg|webp);base64,/.test(source.data||'')||!(source.width>0&&source.height>0)||source.width*source.height>16000000)throw Error('The Artboard image is not supported.');
  const options=units?.options||{},settings=a.settings||{};
  state={...settings,...options,source,uploads:a.assets?.tiles||[],tool:units?.type.split('.')[1]||settings.tool||'characters',output:!!units,selectedLayer:'output'};
  if(!['characters','tiles','cells'].includes(state.tool)||!state.shared||!state.characters||!state.tiles||!state.cells||!state.colors)throw Error('Missing Kiln settings.');
 }else if(a.studio==='endo'){
  if(!a.layers.length||a.layers.length>64)throw Error('The Artboard layers are invalid.');
  const layers=[],strokes=[];
  for(const layer of a.layers){
   if(!layer||typeof layer!=='object'||!Array.isArray(layer.strokes)||!['endo.cromo','endo.surface'].includes(layer.type))throw Error('The Artboard contains an invalid Endo layer.');
   const {strokes:source,type,...metadata}=layer;layers.push(metadata);
   for(const stroke of source){
    if(stroke.layerId!==undefined&&stroke.layerId!==layer.id)throw Error('A stroke references an invalid layer.');
    strokes.push({...stroke,layerId:layer.id});
   }
  }
  const {strokeOrder,...config}=a.settings||{};
  if(strokeOrder!==undefined){
   const byNumber=new Map(strokes.map(stroke=>[stroke.number,stroke]));
   if(!Array.isArray(strokeOrder)||strokeOrder.length!==strokes.length||new Set(strokeOrder).size!==strokes.length||strokeOrder.some(number=>!byNumber.has(number)))throw Error('The stroke order is invalid.');
   strokes.splice(0,strokes.length,...strokeOrder.map(number=>byNumber.get(number)));
  }
  state=validateEndoState({...config,layers,strokes,selected:null,selection:[]});
 }else{
  const config=a.settings||{},strokes=a.layers.flatMap(l=>l.strokes||[]);
  if(strokes.length>10000||!config.scene||!config.defaults)throw Error('Missing Artboard settings.');
  let total=0;
  for(const stroke of strokes){if(!Array.isArray(stroke.points)||!stroke.settings||!(stroke.settings.width>0&&stroke.settings.width<=100))throw Error('The Artboard contains invalid strokes.');total+=stroke.points.length;for(const p of stroke.points)if(![p.x,p.y,p.time,p.pressure].every(Number.isFinite)||Math.abs(p.x)>1e7||Math.abs(p.y)>1e7)throw Error('The Artboard contains invalid coordinates.');for(const key of ['primary','shadow','contrast'])if(!/^#[0-9a-f]{6}$/i.test(stroke.settings[key]||''))throw Error('The Artboard contains invalid colors.');}
  if(total>1000000)throw Error('The Artboard contains too many points.');
  state={...config,strokes,tool:config.tool||{mode:'none'},nextNumber:Math.max(config.nextNumber||1,...strokes.map(s=>(s.number||0)+1))};
  if(['endo','tremor'].includes(a.studio)){
   const frames=config.frames||[];
   if(!Array.isArray(frames)||frames.length>50)throw Error('The Artboard export areas are invalid.');
   const ids=new Set();for(const frame of frames){if(typeof frame.id!=='string'||ids.has(frame.id)||typeof frame.name!=='string'||frame.name.length>80||![frame.x,frame.y,frame.width,frame.height].every(Number.isFinite)||frame.width<=0||frame.height<=0||[frame.x,frame.y,frame.width,frame.height].some(v=>Math.abs(v)>1e7))throw Error('The Artboard contains an invalid export area.');ids.add(frame.id)}
   state.frames=frames.map(f=>({...f}));
  }

  if(a.studio==='tremor'){state.scene={background:a.background?'color':'transparent',backgroundColor:a.background||'#102d40',...state.scene};for(const stroke of strokes)stroke.age=stroke.age||0;}
 }
 return {id:crypto.randomUUID(),name:typeof a.name==='string'?a.name.slice(0,80):'Untitled',studio:a.studio,state,preview:typeof a.preview==='string'&&a.preview.startsWith('data:image/png;')?a.preview:null,createdAt:Date.now(),updatedAt:Date.now()};
}
