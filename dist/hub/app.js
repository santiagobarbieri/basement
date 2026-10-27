import * as store from '/project-store.js';
import {studios,studioById,createInitial} from './studios.js';
import {zipFiles,readArchive} from './archive.js';

const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const hub=$('.hub'),settings=$('#settings'),creation=$('#new-artboard'),trashDialog=$('#trash-dialog'),actionDialog=$('#action-dialog');
let projects=[],view='projects',filter='all',layout='grid',selected=new Set(),selecting=false,currentStudio=null,imageFile=null,imageURL=null,busy=0,refreshing=false;
let profilePhotoToken=0,profilePhotoLoading=false,approvedArtboardNavigation=false,renderedLibrary=null;
let folderState={configured:false,ready:false,name:'',failures:[]},profile={name:'Local profile',photo:null},draftProfile=null,expiredChecked=false;
function icon(name){const el=document.createElement('i');el.className='icon';el.style.setProperty('--icon',`url("assets/ui/${name}.svg")`);el.setAttribute('aria-hidden','true');return el;}
$$('[data-icon]').forEach(el=>{el.style.setProperty('--icon',`url("assets/ui/${el.dataset.icon}.svg")`);el.setAttribute('aria-hidden','true');});
function theme(){return document.documentElement.dataset.theme;}
function paintStudio(element,studio){element.style.setProperty('--studio-color',studio[theme()]);element.style.setProperty('--studio-logo',`url("${studio.logo}")`);}
function symbol(studio){const el=document.createElement('span');el.className='studio-symbol';if(studio){paintStudio(el,studio);el.setAttribute('aria-label',studio.name);el.setAttribute('role','img');}return el;}
function feedback(message=''){ $('#library-feedback').textContent=message; }
function errorText(error){return error instanceof SyntaxError?'This .ment file could not be read.':error?.message||String(error);}
function bytes(value){if(!Number.isFinite(value))return 'Unavailable';if(value<1024)return value+' B';const unit=value<1024**2?'KB':value<1024**3?'MB':'GB',div={KB:1024,MB:1024**2,GB:1024**3}[unit];return new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(value/div)+' '+unit;}
function relativeDate(timestamp){if(!timestamp)return 'Not opened yet';const elapsed=Math.max(0,Date.now()-timestamp),days=Math.floor(elapsed/86400000);if(elapsed<60000)return 'Opened just now';if(elapsed<3600000)return 'Opened '+Math.floor(elapsed/60000)+' min ago';if(days<1)return 'Opened '+Math.floor(elapsed/3600000)+' hr ago';if(days===1)return 'Opened yesterday';if(days<30)return 'Opened '+days+' days ago';return 'Opened '+new Intl.DateTimeFormat('en',{day:'numeric',month:'short',year:'numeric'}).format(timestamp);}
function filename(project){return project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,80)+'--'+project.id+'.ment';}
function download(data,name){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function setBusyUI(value){hub.dataset.busy=String(value);for(const node of [$('#project-list'),$('#footer-actions'),$('#new-file'),$('#selection-bar')])node.inert=value;}
async function operate(work,{message='Working…',refresh=true}={}){if(busy)return;busy++;setBusyUI(true);feedback(message);try{const result=await work();return result;}catch(error){if(error.name!=='AbortError')feedback(errorText(error));}finally{if(refresh)await refreshProjects();busy--;setBusyUI(busy>0);}}

// One confirmation surface handles names, import conflicts and destructive actions.
let resolveAction=null;
function ask({title,description='',value,choices=[{value:'confirm',label:'Confirm',primary:true},{value:null,label:'Cancel'}],apply=false,validate}={}){
 if(actionDialog.open)throw Error('Finish the current dialog first.');
 $('#action-title').textContent=title;$('#action-description').textContent=description;
 const input=$('#action-input');input.hidden=value===undefined;input.value=value??'';input.required=value!==undefined;
 $('#action-input-label').hidden=value===undefined;$('#action-apply-label').hidden=!apply;$('#action-apply').checked=false;$('#action-error').textContent='';
 const buttons=$('#action-buttons');buttons.replaceChildren();let settling=false;
 return new Promise(resolve=>{
  resolveAction=result=>{resolveAction=null;actionDialog.close();resolve(result);};
  for(const choice of choices){const button=document.createElement('button');button.type='button';button.className=choice.primary?'primary':'outline';if(choice.danger)button.classList.add('danger-button');button.textContent=choice.label;
   button.onclick=async()=>{if(settling)return;if(choice.value===null){resolveAction(null);return;}if(value!==undefined&&!input.reportValidity())return;settling=true;button.disabled=true;try{if(validate)await validate(input.value.trim(),choice.value);resolveAction({choice:choice.value,value:input.value.trim(),apply:$('#action-apply').checked});}catch(error){$('#action-error').textContent=errorText(error);}finally{settling=false;button.disabled=false;}};
   buttons.append(button);
  }
  $('#action-form').onsubmit=event=>{event.preventDefault();buttons.querySelector('button')?.click();};
  actionDialog.showModal();if(value!==undefined){input.focus();input.select();}
 });
}
function dismissAction(){resolveAction?.(null);}
actionDialog.addEventListener('cancel',event=>{event.preventDefault();dismissAction();});
function outside(dialog,event){if(event.target!==dialog)return false;const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;}
actionDialog.addEventListener('click',event=>{if(outside(actionDialog,event))dismissAction();});
async function confirmDelete(title,description){return !!await ask({title,description,choices:[{value:'delete',label:'Delete permanently',danger:true},{value:null,label:'Cancel'}]});}

function renderFilter(){
 const menu=$('#filter-menu');menu.replaceChildren();
 for(const studio of [null,...studios]){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(filter===(studio?.id||'all')));if(studio){paintStudio(button,studio);button.append(symbol(studio));}button.append(document.createTextNode(studio?.name||'All Studios'));button.onclick=()=>{filter=studio?.id||'all';closeFilter();renderFilter();renderProjects();$('#filter-toggle').focus();};menu.append(button);}
 const current=studioById(filter),toggle=$('#filter-toggle');toggle.classList.toggle('filtered',!!current);toggle.style.setProperty('--filter-color',current?.[theme()]||'var(--bg)');toggle.replaceChildren();if(current)toggle.append(symbol(current));const label=document.createElement('span');label.id='filter-label';label.textContent=current?.name||'All Studios';toggle.append(label,icon('chevron'));
}
function closeFilter(){ $('#filter-menu').hidden=true;$('#filter-toggle').setAttribute('aria-expanded','false'); }
$('#filter-toggle').onclick=()=>{const menu=$('#filter-menu');menu.hidden=!menu.hidden;$('#filter-toggle').setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('[aria-checked=true]')?.focus({preventScroll:true});};
$('#filter-menu').addEventListener('keydown',event=>{const options=[...event.currentTarget.querySelectorAll('button')],i=options.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();options[event.key==='Home'?0:event.key==='End'?options.length-1:(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.filter-wrap'))closeFilter();if(!event.target.closest('#project-menu,.more-button'))closeProjectMenu();if(hub.classList.contains('menu-open')&&!event.target.closest('.sidebar,#sidebar-toggle'))toggleSidebar(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeFilter();closeProjectMenu();toggleSidebar(false);}});
function visibleProjects(){const query=$('#project-search').value.trim().toLocaleLowerCase();return projects.filter(p=>(filter==='all'||p.studio===filter)&&p.name.toLocaleLowerCase().includes(query)).sort((a,b)=>(b.lastOpenedAt||0)-(a.lastOpenedAt||0)||b.createdAt-a.createdAt);}
function renderProjects(){
 const list=$('#project-list');
 for(const id of selected)if(!projects.some(p=>p.id===id))selected.delete(id);
 const visible=visibleProjects(),query=$('#project-search').value.trim().toLocaleLowerCase();
 const snapshot={view,filter,layout,selecting,selected:[...selected].join(','),query,ready:folderState.ready,theme:theme(),visible};
 const fields=['id','name','studio','lastOpenedAt','updatedAt','preview'];
 if(renderedLibrary&&Object.keys(snapshot).filter(key=>key!=='visible').every(key=>snapshot[key]===renderedLibrary[key])&&visible.length===renderedLibrary.visible.length&&visible.every((project,i)=>fields.every(key=>project[key]===renderedLibrary.visible[i][key]))){for(let i=0;i<visible.length;i++){const date=list.children[i]?.querySelector('time');if(date)date.textContent=relativeDate(visible[i].lastOpenedAt);}return;}
 const keepPosition=renderedLibrary&&['view','filter','layout','query'].every(key=>snapshot[key]===renderedLibrary[key]);
 const scrollTop=keepPosition?list.scrollTop:0,focused=document.activeElement,focusedId=focused?.closest('.project-card')?.dataset.id,focusedClass=['more-button','project-name','project-preview','select-checkbox'].find(name=>focused?.classList.contains(name));
 const fragment=document.createDocumentFragment();
 list.className=layout==='grid'?'project-grid':'project-list';list.classList.toggle('selecting',selecting);

 for(const project of visible){
  const studio=studioById(project.studio),card=document.createElement('article');card.className='project-card';card.dataset.id=project.id;card.classList.toggle('selected',selected.has(project.id));
  if(selecting){const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='select-checkbox';checkbox.checked=selected.has(project.id);checkbox.setAttribute('aria-label','Select '+project.name);checkbox.onclick=event=>event.stopPropagation();checkbox.onchange=()=>{checkbox.checked?selected.add(project.id):selected.delete(project.id);renderProjects();};card.append(checkbox);}
  const preview=document.createElement('button');preview.type='button';preview.className='project-preview';preview.setAttribute('aria-label','Open '+project.name);
  if(project.preview&&/^data:image\/(png|jpeg|webp);base64,/.test(project.preview)){const img=document.createElement('img');img.src=project.preview;img.alt='';img.loading='lazy';preview.append(img);}
  preview.onclick=()=>selecting?toggleSelected(project.id):openProject(project);
  const details=document.createElement('div');details.className='project-description';details.append(symbol(studio));
  const text=document.createElement('div');text.className='project-text';const name=document.createElement('button');name.className='project-name';name.type='button';name.textContent=project.name;name.title=project.name;name.onclick=()=>selecting?toggleSelected(project.id):openProject(project);
  const date=document.createElement('time');date.className='project-date';date.textContent=relativeDate(project.lastOpenedAt);if(project.lastOpenedAt){date.dateTime=new Date(project.lastOpenedAt).toISOString();date.title=new Date(project.lastOpenedAt).toLocaleString('en');}text.append(name,date);details.append(text);
  const more=document.createElement('button');more.type='button';more.className='more-button';more.setAttribute('aria-label','Actions for '+project.name);more.setAttribute('aria-haspopup','menu');more.append(icon('more'));more.onclick=event=>{event.stopPropagation();openProjectMenu(project,more);};card.append(preview,details,more);fragment.append(card);
 }
 list.replaceChildren(fragment);list.hidden=!visible.length;list.scrollTop=scrollTop;renderedLibrary=snapshot;
 if(focusedId&&focusedClass)[...list.children].find(row=>row.dataset.id===focusedId)?.querySelector('.'+focusedClass)?.focus({preventScroll:true});
 const current=studioById(filter);$('#page-title').textContent=view==='projects'?'All '+(current?current.name+' ':'')+'Artboards':({studios:'Studios / Apps',about:'About',contact:'Contact'}[view]);
 $('#library-empty').hidden=visible.length>0;$('#library-empty p').textContent=projects.length?'No results.':'No Artboards yet.';$('#empty-folder').hidden=folderState.ready;
 $('#list-heading').hidden=layout!=='list'||!visible.length;$('#list-heading').classList.toggle('selecting',selecting);
 $('#selection-bar').hidden=!selecting;$('#selection-count').textContent=selected.size+' selected';
 for(const selector of ['#download-selection','#move-selection','#trash-selection'])$(selector).disabled=!selected.size;
}
function toggleSelected(id){selected.has(id)?selected.delete(id):selected.add(id);renderProjects();}
$$('[data-layout]').forEach(button=>button.onclick=()=>{layout=button.dataset.layout;$$('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderProjects();});
$('#project-search').oninput=renderProjects;
$$('[data-view]').forEach(button=>button.onclick=()=>{
 view=button.dataset.view;filter='all';$('#project-search').value='';selected.clear();selecting=false;layout='grid';$$('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===layout)));
 $$('[data-view]').forEach(b=>{if(b===button)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('#projects-view').hidden=view!=='projects';$('#placeholder-view').hidden=view==='projects';$('#library-controls').hidden=view!=='projects';$('#footer-actions').hidden=view!=='projects';renderFilter();renderProjects();toggleSidebar(false);
});
function toggleSidebar(open=!hub.classList.contains('menu-open')){hub.classList.toggle('menu-open',open);$('#sidebar-toggle').setAttribute('aria-expanded',String(open));}
$('#sidebar-toggle').onclick=()=>toggleSidebar();

async function refreshProjects(){
 if(refreshing||window.basementSessionBlocked)return;refreshing=true;
 try{const status=await store.storageStatus();if(status.ready){projects=(await store.listProjects()).map(({state,...metadata})=>metadata);const size=await store.getLibrarySize();$('#library-size').textContent=bytes(size);$('#storage-library-size').textContent=bytes(size);}else projects=[];$('#storage-count').textContent=projects.length;renderProjects();}
 catch(error){feedback(errorText(error));}
 finally{refreshing=false;}
}
async function requireFolder(){await store.storageStatus();if(folderState.ready)return true;openSettings('folder');$('#folder-status').textContent=folderState.configured?'Reconnect your folder before continuing.':'Choose a folder before creating or importing Artboards.';return false;}
async function openProject(project){if(busy||!await requireFolder())return;await operate(async()=>{await store.markProjectOpened(project.id);approvedArtboardNavigation=true;location.assign(store.projectUrl(project));},{message:'Opening '+project.name+'…',refresh:false});}
function closeProjectMenu(){ $('#project-menu').hidden=true; }
$('#project-list').addEventListener('scroll',closeProjectMenu,{passive:true});
window.addEventListener('resize',()=>{closeProjectMenu();closeFilter();});
function openProjectMenu(project,opener){
 const menu=$('#project-menu');menu.replaceChildren();
 const items=[['Open','folder',()=>openProject(project)],['Rename','version',()=>rename(project)],['Duplicate','copy',()=>operate(async()=>{await store.duplicateProject(project.id);feedback('Artboard duplicated.');})],['Export .ment','export',()=>operate(()=>exportOne(project),{message:'Preparing .ment…',refresh:false})],['Move','move',()=>move([project.id])],['Select','check',()=>{selecting=true;selected.add(project.id);renderProjects();}],['Move to trash','trash',()=>trashProjects([project.id])]];
 for(const [label,ico,action]of items){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');if(ico==='trash')button.className='danger';button.append(icon(ico),document.createTextNode(label));button.onclick=()=>{closeProjectMenu();action();};menu.append(button);}
 menu.hidden=false;const r=opener.getBoundingClientRect();menu.style.left=Math.min(innerWidth-menu.offsetWidth-10,Math.max(10,r.right-menu.offsetWidth))+'px';menu.style.top=Math.min(innerHeight-menu.offsetHeight-10,r.bottom+4)+'px';menu.querySelector('button').focus();
}
$('#project-menu').addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}});
async function rename(project){const result=await ask({title:'Rename Artboard',value:project.name,choices:[{value:'rename',label:'Rename',primary:true},{value:null,label:'Cancel'}],validate:name=>store.assertUniqueName(name,project.id)});if(result)await operate(async()=>{await store.renameProject(project.id,result.value);feedback('Artboard renamed.');});}
async function exportOne(project){download(await store.encodeProject(await store.getProject(project.id)),filename(project));feedback('Artboard exported.');}
async function exportMany(ids,name){if(ids.length>2000)throw Error('Select at most 2,000 Artboards per ZIP.');const files=[];let totalBytes=0;for(const project of projects.filter(p=>ids.includes(p.id))){const fresh=await store.getProject(project.id);if(!fresh)throw Error('An Artboard was removed from the folder. Refresh and try again.');const data=await store.encodeProject(fresh);totalBytes+=new TextEncoder().encode(data).byteLength;if(totalBytes>512*1024*1024)throw Error('This ZIP exceeds 512 MB. Export smaller selections.');files.push({name:filename(fresh),data});}if(!files.length){feedback('No Artboards to export.');return;}download(zipFiles(files),name);feedback(files.length+' Artboard'+(files.length===1?'':'s')+' exported.');}
$('#export-library').onclick=()=>operate(()=>exportMany(projects.map(p=>p.id),'Basement Artboards.zip'),{message:'Preparing library ZIP…',refresh:false});
$('#download-selection').onclick=()=>operate(()=>exportMany([...selected],'Basement Selection.zip'),{message:'Preparing selection ZIP…',refresh:false});
$('#select-all').onclick=()=>{visibleProjects().forEach(p=>selected.add(p.id));renderProjects();};
$('#cancel-selection').onclick=()=>{selected.clear();selecting=false;renderProjects();};
async function move(ids){if(busy)return; // The picker is invoked synchronously from this user action.
 await operate(async()=>{const result=await store.moveProjects(ids);selected.clear();selecting=false;feedback((result?.length||ids.length)+' Artboard(s) moved to the selected folder.');},{message:'Choose a destination folder…'});
}
$('#move-selection').onclick=()=>move([...selected]);
async function trashProjects(ids){const result=await ask({title:ids.length===1?'Move Artboard to trash?':'Move '+ids.length+' Artboards to trash?',description:'You can restore them from Trash. They expire after 30 days, with confirmation before permanent deletion.',choices:[{value:'trash',label:'Move to trash',primary:true},{value:null,label:'Cancel'}]});if(!result)return;await operate(async()=>{for(const id of ids)await store.deleteProject(id);selected.clear();selecting=false;feedback('Artboards moved to trash.');});}
$('#trash-selection').onclick=()=>trashProjects([...selected]);

// New Artboard: choose an available Studio, then name it and embed its source.
function renderStudios(){const grid=$('#studio-grid');grid.replaceChildren();for(const studio of studios){const card=document.createElement('button');card.type='button';card.className='studio-card';card.dataset.studio=studio.id;paintStudio(card,studio);const title=document.createElement('h3');title.textContent=studio.name;const descriptor=document.createElement('p');descriptor.textContent=studio.descriptor;const action=document.createElement('span');action.className='studio-card-action';action.textContent='New Artboard +';card.append(title,descriptor,action);card.onclick=()=>chooseStudio(studio);grid.append(card);}}
function resetImage(){imageFile=null;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;$('#initial-image').value='';$('#image-file-label').textContent='Choose PNG, JPG or WebP';$('#image-preview').hidden=true;$('#image-preview').removeAttribute('src');}
function openCreation(){currentStudio=null;resetImage();$('#new-project-name').value='';$('#new-error').textContent='';$('#studio-picker').hidden=false;$('#new-form').hidden=true;creation.setAttribute('aria-labelledby','new-title');renderStudios();creation.showModal();}
$('#new-file').onclick=async()=>{if(!busy&&await requireFolder())openCreation();};
function chooseStudio(studio){if(busy)return;currentStudio=studio;resetImage();$('#studio-picker').hidden=true;$('#new-form').hidden=false;paintStudio($('#new-form'),studio);$('#about-studio').textContent='About '+studio.name;$('#studio-description').textContent=studio.description;$('#new-studio-title').textContent='New '+studio.name+' Artboard';creation.setAttribute('aria-labelledby','new-studio-title');$('#initial-image-field').hidden=!studio.requiredImage;$('#initial-image').required=studio.requiredImage;$('#new-error').textContent='';$('#new-project-name').focus();}
$('#back-to-studios').onclick=()=>{if(busy)return;currentStudio=null;resetImage();$('#new-form').hidden=true;$('#studio-picker').hidden=false;creation.setAttribute('aria-labelledby','new-title');$('#studio-grid button').focus();};
$('#initial-image').onchange=()=>{resetImagePreview();imageFile=$('#initial-image').files[0]||null;$('#image-file-label').textContent=imageFile?.name||'Choose PNG, JPG or WebP';if(imageFile){imageURL=URL.createObjectURL(imageFile);$('#image-preview').src=imageURL;$('#image-preview').hidden=false;}};
function resetImagePreview(){if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;$('#image-preview').hidden=true;}
$('#new-form').onsubmit=async event=>{event.preventDefault();if(busy||!currentStudio)return;const studio=currentStudio,source=imageFile;const name=$('#new-project-name').value.trim();if(!name){$('#new-error').textContent='Enter an Artboard name.';return;}if(studio.requiredImage&&!source){$('#new-error').textContent='Choose an initial image.';return;}busy++;setBusyUI(true);$('#create-artboard').disabled=true;$('#back-to-studios').disabled=true;$('#new-project-name').disabled=true;$('#initial-image').disabled=true;$('#new-error').textContent='';try{await store.assertUniqueName(name);const state=await createInitial(studio.id,source),now=Date.now(),project={id:crypto.randomUUID(),name,studio:studio.id,state,preview:null,createdAt:now,updatedAt:now,lastOpenedAt:now};await store.putProject(project);approvedArtboardNavigation=true;location.assign(store.projectUrl(project));}catch(error){$('#new-error').textContent=errorText(error);}finally{busy--;setBusyUI(busy>0);$('#create-artboard').disabled=false;$('#back-to-studios').disabled=false;$('#new-project-name').disabled=false;$('#initial-image').disabled=false;}};
creation.addEventListener('cancel',event=>{if(busy)event.preventDefault();});creation.addEventListener('click',event=>{if(!busy&&outside(creation,event))creation.close();});creation.addEventListener('close',resetImage);

// Profile and preferences stay in this browser, separate from the folder.
try{const saved=JSON.parse(localStorage.getItem('basement-profile')||'null');if(saved&&typeof saved.name==='string')profile={name:saved.name.slice(0,80)||'Local profile',photo:typeof saved.photo==='string'&&saved.photo.startsWith('data:image/png;base64,')?saved.photo:null};}catch{}
function renderAvatar(target,photo){target.replaceChildren();if(photo){const image=document.createElement('img');image.src=photo;image.alt='';target.append(image);}else target.append(icon('user'));}
$$('label[role=button]').forEach(label=>label.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('#'+label.htmlFor).click();}}));
function renderProfile(){ $('#profile-name').textContent=profile.name;renderAvatar($('#profile-avatar'),profile.photo); }
function draftDirty(){return profilePhotoLoading||!!draftProfile&&(draftProfile.name!==profile.name||draftProfile.photo!==profile.photo);}
function updateDraft(){draftProfile.name=$('#account-name').value;$('#account-panel').dataset.unsaved=String(draftDirty());}
function openSettings(tab='account'){if(busy)return;if(settings.open){showSettingsTab(tab);return;}profilePhotoToken++;profilePhotoLoading=false;draftProfile={...profile};$('#account-name').value=profile.name;renderAvatar($('#account-avatar'),profile.photo);$('#account-panel').dataset.unsaved='false';$('#account-error').textContent='';$('#folder-error').textContent='';showSettingsTab(tab);if(!settings.open)settings.showModal();toggleSidebar(false);}
function showSettingsTab(tab){$$('[data-settings-tab]').forEach(b=>{if(b.dataset.settingsTab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$$('[data-settings-page]').forEach(p=>p.hidden=p.dataset.settingsPage!==tab);if(tab==='storage')refreshStorageEstimate();}
$$('[data-settings-tab]').forEach(button=>button.onclick=()=>showSettingsTab(button.dataset.settingsTab));$$('[data-settings]').forEach(button=>button.onclick=()=>openSettings(button.dataset.settings));$('#profile-open').onclick=()=>openSettings();$('#empty-folder').onclick=()=>openSettings('folder');
function clearProfileDraft(){draftProfile=null;profilePhotoToken++;profilePhotoLoading=false;$('#account-panel').dataset.unsaved='false';$('#account-panel button[type=submit]').disabled=false;}
async function closeSettings(){if(busy||profilePhotoLoading)return;if(draftDirty()){const answer=await ask({title:'Discard changes?',description:'Your profile has changes that have not been saved.',choices:[{value:'discard',label:'Discard changes',primary:true},{value:null,label:'Keep editing'}]});if(!answer)return;}clearProfileDraft();settings.close();}
settings.addEventListener('close',()=>{if(!settings.open)clearProfileDraft();});
settings.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});settings.addEventListener('click',event=>{if(outside(settings,event))closeSettings();});
$('#account-name').oninput=updateDraft;
$('#account-photo').onchange=async()=>{const file=$('#account-photo').files[0];$('#account-photo').value='';if(!file||!draftProfile)return;const photoToken=++profilePhotoToken,capturedDraft=draftProfile;profilePhotoLoading=true;$('#account-panel').dataset.unsaved='true';$('#account-panel button[type=submit]').disabled=true;$('#account-error').textContent='';try{if(file.size>20*1024*1024)throw Error('Choose a picture smaller than 20 MB.');const bitmap=await createImageBitmap(file);try{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d'),side=Math.min(bitmap.width,bitmap.height);context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);if(photoToken!==profilePhotoToken||draftProfile!==capturedDraft||!settings.open)return;draftProfile.photo=canvas.toDataURL('image/png');}finally{bitmap.close();}renderAvatar($('#account-avatar'),draftProfile.photo);updateDraft();}catch(error){if(photoToken===profilePhotoToken)$('#account-error').textContent=errorText(error);}finally{if(photoToken===profilePhotoToken){profilePhotoLoading=false;$('#account-panel button[type=submit]').disabled=false;if(draftProfile===capturedDraft)updateDraft();}}};
$('#remove-photo').onclick=()=>{profilePhotoToken++;profilePhotoLoading=false;$('#account-panel button[type=submit]').disabled=false;draftProfile.photo=null;renderAvatar($('#account-avatar'),null);updateDraft();};
$('#account-panel').onsubmit=event=>{event.preventDefault();if(profilePhotoLoading)return;const next={...draftProfile,name:draftProfile.name.trim()||'Local profile'};try{localStorage.setItem('basement-profile',JSON.stringify(next));profile=next;draftProfile={...next};$('#account-panel').dataset.unsaved='false';renderProfile();settings.close();feedback('Profile saved.');}catch{$('#account-error').textContent='The browser could not save your profile. Free some browser storage and try again.';}};
$$('[data-theme-choice]').forEach(button=>button.onclick=()=>applyTheme(button.dataset.themeChoice));
function applyTheme(value){document.documentElement.dataset.theme=value;try{localStorage.setItem('basement-theme',value);}catch{}$('#mode-label').textContent=value==='light'?'Light':'Dark';$$('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===value)));$('meta[name="theme-color"]').content=value==='light'?'#dfdfdf':'#111111';renderFilter();renderProjects();renderStudios();if(currentStudio)paintStudio($('#new-form'),currentStudio);}
store.subscribeStorage(state=>{folderState=state;const hasPending=!state.ready&&!!store.pendingProject();hub.dataset.pendingSave=String(hasPending);$('#hub-recovery-actions').hidden=!hasPending;$$('[data-folder-name]').forEach(e=>e.textContent=state.name||(state.ready?'Connected folder':'Not connected'));$('#security-status').textContent=state.error?'Save error':state.ready?'On your computer':state.configured?'Reconnect folder':'Choose a folder';$('#security-status').title=state.error||'';$('#folder-status').textContent=state.error||(state.ready?'Connected. Your Artboards save directly to this folder.':state.configured?'Folder permission is needed to continue.':'No folder selected.');$('#choose-folder').textContent=state.configured?'Choose another folder':'Choose folder';$('#choose-folder').disabled=state.busy||!state.supported;$('#reconnect-folder').hidden=!state.configured||state.ready;$('#folder-options').hidden=!state.configured;if(!state.supported)$('#folder-error').textContent='Use Google Chrome to connect an Artboard folder.';else if(state.failures?.length)feedback(state.failures.length+' file(s) could not be read. The original files are unchanged.');});
$('#choose-folder').onclick=()=>{if(busy)return;const mode=$('input[name="folder-mode"]:checked').value;operate(async()=>{try{await store.chooseProjectFolder({mode});feedback('Folder connected.');$('#folder-error').textContent='';}catch(error){if(error.name!=='AbortError')$('#folder-error').textContent=errorText(error);throw error;}},{message:'Connecting folder…'});};
$('#reconnect-folder').onclick=()=>operate(async()=>{try{await store.reconnectProjectFolder();feedback('Folder reconnected.');}catch(error){$('#folder-error').textContent=errorText(error);throw error;}},{message:'Reconnecting folder…'});
$('#retry-hub-save').onclick=()=>operate(async()=>{await store.reconnectProjectFolder();await store.retryPendingSave();feedback('Artboard saved to your folder.');},{message:'Retrying save…'});
$('#emergency-hub-save').onclick=async()=>{try{const project=store.pendingProject();if(!project)throw Error('No pending Artboard to recover.');download(await store.encodeProject(project),filename(project));feedback('Emergency .ment downloaded. Retry saving to reconnect the library.');}catch(error){$('#folder-error').textContent=errorText(error);}};
function storageLegendEntry(label,size,color){
 const item=document.createElement('div');item.className='storage-legend-item';const dot=document.createElement('i');dot.className='storage-dot';dot.style.background=color;
 const name=document.createElement('span');name.textContent=label;const amount=document.createElement('span');amount.className='muted';amount.textContent=bytes(size);item.append(dot,name,amount);return item;
}
async function refreshStorageEstimate(){
 const [library,browser]=await Promise.allSettled([folderState.ready?store.getStorageUsage():Promise.resolve(null),navigator.storage.estimate()]);
 const bar=$('#storage-library-bar'),legend=$('#storage-library-legend');bar.replaceChildren();legend.replaceChildren();
 if(library.status==='fulfilled'&&library.value){
  const usage=library.value,segments=usage.studios.map(item=>({...item,label:studioById(item.id)?.name||item.id,color:studioById(item.id)?.[theme()]||'#929292'}));
  if(usage.otherBytes)segments.push({id:'other',label:'Other files',bytes:usage.otherBytes,color:'#929292'});
  if(usage.trashBytes)segments.push({id:'trash',label:'Trash',bytes:usage.trashBytes,color:'#9a7cba'});
  for(const item of segments.filter(item=>item.bytes>0)){
   const segment=document.createElement('span');segment.className='storage-segment';segment.dataset.storageSegment='';segment.dataset.category=item.id;segment.dataset.bytes=item.bytes;segment.style.flexBasis=(item.bytes/usage.totalBytes*100)+'%';segment.style.background=item.color;segment.title=item.label+' · '+bytes(item.bytes);bar.append(segment);legend.append(storageLegendEntry(item.label,item.bytes,item.color));
  }
  $('#storage-library-total').textContent=bytes(usage.totalBytes);$('#storage-library-size').textContent=bytes(usage.libraryBytes);$('#storage-count').textContent=usage.count;
  $('#storage-trash-summary').textContent=usage.trashCount?' · '+bytes(usage.trashBytes)+' in Trash':'';
  bar.setAttribute('aria-label',usage.totalBytes?'Library storage: '+segments.filter(item=>item.bytes).map(item=>item.label+' '+bytes(item.bytes)).join(', '):'Library storage: empty');
  if(!usage.totalBytes){const empty=document.createElement('span');empty.className='muted';empty.textContent='No Artboard files yet.';legend.append(empty);}
 }else{
  $('#storage-library-total').textContent=library.status==='rejected'?'Unavailable':'No folder connected';bar.setAttribute('aria-label','Library storage unavailable');
  const message=document.createElement('span');message.className='muted';message.textContent='Connect your folder to see its storage breakdown.';legend.append(message);
 }
 const meter=$('#storage-browser-bar');
 if(browser.status==='fulfilled'&&Number.isFinite(browser.value.usage)&&browser.value.quota>0){
  const used=browser.value.usage,quota=browser.value.quota;$('#storage-browser-used').textContent=bytes(used);$('#storage-browser-quota').textContent=bytes(quota);$('#storage-browser-fill').style.width=Math.min(100,used/quota*100)+'%';$('#storage-browser-fill').dataset.used=String(used>0);meter.setAttribute('aria-valuemax',quota);meter.setAttribute('aria-valuenow',used);meter.setAttribute('aria-valuetext',bytes(used)+' used of '+bytes(quota));$('#storage-browser-remaining').textContent=bytes(Math.max(0,quota-used))+' available to this site';
 }else{$('#storage-browser-used').textContent=$('#storage-browser-quota').textContent='Unavailable';meter.removeAttribute('aria-valuenow');meter.setAttribute('aria-valuetext','Browser storage estimate unavailable');$('#storage-browser-fill').style.width='0';$('#storage-browser-remaining').textContent='The browser could not estimate its storage allowance.';}
}


// Import preserves original IDs so an existing Artboard is recognized.
$('#import-library').onclick=async()=>{if(!busy&&await requireFolder())$('#ment-file').click();};
$('#ment-file').onchange=()=>{const files=[...$('#ment-file').files];$('#ment-file').value='';if(files.length)importFiles(files);};
async function importFiles(files){if(!await requireFolder())return;if(files.length>2000||files.reduce((sum,file)=>sum+file.size,0)>512*1024*1024){feedback('Import at most 2,000 files and 512 MB at a time.');return;}await operate(async()=>{
 const entries=[],failures=[];let totalBytes=0;function addEntries(incoming){const size=incoming.reduce((sum,entry)=>sum+new TextEncoder().encode(entry.text).byteLength,0);if(entries.length+incoming.length>2000||totalBytes+size>512*1024*1024)throw Error('The combined import exceeds 2,000 Artboards or 512 MB. Import smaller groups.');totalBytes+=size;entries.push(...incoming);}let imported=0,skipped=0,conflictPolicy=null;
 for(const file of files){try{if(/\.zip$/i.test(file.name))addEntries(await readArchive(file));else if(/\.ment$/i.test(file.name)){if(file.size>128*1024*1024)throw Error('File exceeds 128 MB.');addEntries([{name:file.name,text:await file.text()}]);}else throw Error('Only .ment files and ZIP archives are supported.');}catch(error){failures.push(file.name+': '+errorText(error));}}
 for(const [entryIndex,entry] of entries.entries()){try{
  let project=store.decodeProject(entry.text);if(!project.name.trim()||project.name.trim().length>80)throw Error('The Artboard must have a name of 1–80 characters.');project.name=project.name.trim();delete project.deletedAt;const existing=await store.listProjects(),sameId=existing.find(p=>p.id===project.id),sameName=existing.find(p=>p.name.trim().toLocaleLowerCase()===project.name.trim().toLocaleLowerCase()),conflict=sameId||sameName;
  if(conflict){let choice=conflictPolicy;if(!choice){const result=await ask({title:'Artboard already exists',description:'“'+project.name+'” matches an Artboard in this library. Replace the existing Artboard or import a separate copy.',choices:[{value:'replace',label:'Replace',primary:true},{value:'copy',label:'Import as copy'},{value:'skip',label:'Skip'},{value:null,label:'Cancel import'}],apply:true});if(!result){skipped+=entries.length-entryIndex;break;}choice=result.choice;if(result.apply)conflictPolicy=choice;}
   if(choice==='skip'){skipped++;continue;}
   if(choice==='replace'){if(sameId&&sameName&&sameId.id!==sameName.id){throw Error('The ID and name match two different Artboards. Import as a copy instead.');}project={...project,id:conflict.id,name:conflict.name,createdAt:conflict.createdAt,lastOpenedAt:conflict.lastOpenedAt};}
   else{const names=new Set(existing.map(p=>p.name.trim().toLocaleLowerCase()));let i=1,name;do{name=project.name.slice(0,65)+' Copy'+(i===1?'':' '+i);i++;}while(names.has(name.toLocaleLowerCase()));project={...project,id:crypto.randomUUID(),name,createdAt:Date.now(),lastOpenedAt:0};}
  }
  await store.putProject(project);imported++;
 }catch(error){failures.push(entry.name+': '+errorText(error));}}
 feedback(imported+' Artboard(s) imported.'+(skipped?' '+Math.max(0,skipped)+' skipped.':'')+(failures.length?' '+failures.length+' could not be imported.':''));
 if(failures.length)await ask({title:'Import completed with issues',description:failures.join('\n'),choices:[{value:'close',label:'Done',primary:true}]});
 },{message:'Importing Artboards…'});}
$('#library-panel').addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});$('#library-panel').addEventListener('drop',event=>{event.preventDefault();if(!busy&&event.dataTransfer.files.length)importFiles([...event.dataTransfer.files]);});

async function refreshTrash(){const records=await store.listTrash(),list=$('#trash-list');list.replaceChildren();for(const project of records){const row=document.createElement('div');row.className='trash-row';row.append(symbol(studioById(project.studio)));const copy=document.createElement('div'),name=document.createElement('strong');name.textContent=project.name;const remaining=document.createElement('small');remaining.textContent=project.expired?'Expired · awaiting your confirmation':Math.max(1,Math.ceil((project.expiresAt-Date.now())/86400000))+' days remaining';remaining.classList.toggle('expired',project.expired);if(project.invalid)remaining.textContent='File could not be read · original retained';copy.append(name,remaining);row.append(copy);const restore=document.createElement('button');restore.className='outline';restore.textContent='Restore';restore.disabled=!!project.invalid;restore.onclick=()=>restoreTrashed(project);const remove=document.createElement('button');remove.className='outline';remove.textContent='Delete permanently';remove.onclick=()=>deleteForever([project.id]);row.append(restore,remove);list.append(row);}$('#trash-empty').hidden=records.length>0;$('#empty-trash').disabled=!records.length;return records;}
async function openTrash(){if(busy||profilePhotoLoading||!await requireFolder())return;if(settings.open){if(draftDirty()){const answer=await ask({title:'Discard changes?',description:'Your profile changes have not been saved.',choices:[{value:'discard',label:'Discard changes',primary:true},{value:null,label:'Keep editing'}]});if(!answer)return;}clearProfileDraft();settings.close();}try{await refreshTrash();$('#trash-feedback').textContent='';trashDialog.showModal();}catch(error){feedback(errorText(error));}}
$$('[data-trash-open]').forEach(button=>button.onclick=openTrash);
async function restoreTrashed(project){await operate(async()=>{let name=project.name;try{await store.assertUniqueName(name,project.id);}catch(error){if(error.code!=='NAME_CONFLICT')throw error;const answer=await ask({title:'Choose a new name',description:'Another Artboard already uses this name.',value:name,choices:[{value:'restore',label:'Restore',primary:true},{value:null,label:'Cancel'}],validate:value=>store.assertUniqueName(value,project.id)});if(!answer)return;name=answer.value;}await store.restoreProject(project.id,name);await refreshTrash();$('#trash-feedback').textContent='Artboard restored.';feedback('Artboard restored.');},{message:'Restoring Artboard…'});}
async function deleteForever(ids){if(!await confirmDelete(ids.length===1?'Delete Artboard permanently?':'Delete '+ids.length+' Artboards permanently?','This removes the .ment files from the folder. This action cannot be undone.'))return;await operate(async()=>{await store.permanentlyDeleteProjects(ids);if(trashDialog.open)await refreshTrash();$('#trash-feedback').textContent='Artboards permanently deleted.';feedback('Artboards permanently deleted.');});}
$('#empty-trash').onclick=async()=>{try{const trash=await store.listTrash();if(trash.length)await deleteForever(trash.map(p=>p.id));}catch(error){$('#trash-feedback').textContent=errorText(error);}};
trashDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});trashDialog.addEventListener('click',event=>{if(!busy&&outside(trashDialog,event))trashDialog.close();});
async function checkExpired(){if(expiredChecked||!folderState.ready||$$('dialog[open]').length||busy)return;expiredChecked=true;try{const expired=(await store.listTrash()).filter(p=>p.expired&&!p.invalid);if(!expired.length)return;const choice=await ask({title:'Expired Artboards in Trash',description:expired.length+' Artboard(s) have been in Trash for at least 30 days. Review them before deciding whether to delete them permanently.',choices:[{value:'review',label:'Review trash',primary:true},{value:'delete',label:'Delete permanently',danger:true},{value:null,label:'Keep for now'}]});if(choice?.choice==='review')await openTrash();if(choice?.choice==='delete')await deleteForever(expired.map(p=>p.id));}catch(error){feedback(errorText(error));}}
window.addEventListener('basement-library-changed',()=>{expiredChecked=false;refreshProjects().then(checkExpired);});window.addEventListener('focus',()=>{refreshProjects().then(checkExpired);});window.addEventListener('pageshow',()=>{$('[data-view=projects]').click();refreshProjects().then(checkExpired);});
setInterval(()=>{if(!document.hidden&&!busy&&!$$('dialog[open]').length)refreshProjects().then(checkExpired);},5000);
window.addEventListener('beforeunload',event=>{if(approvedArtboardNavigation){approvedArtboardNavigation=false;return;}if(busy||draftDirty()||hub.dataset.pendingSave==='true'){event.preventDefault();event.returnValue='';}});
renderProfile();applyTheme(theme());
await(window.basementSessionReady||Promise.resolve(true));if(!window.basementSessionBlocked){await refreshProjects();await checkExpired();}
