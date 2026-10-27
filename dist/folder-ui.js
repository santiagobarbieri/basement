import {storageStatus,subscribeStorage,chooseProjectFolder,reconnectProjectFolder,retryPendingSave,pendingProject,encodeProject,checkProjectChanged,acceptExternalVersion,putProject} from './project-store.js';
// The hub owns its Settings view. A Studio may provide a header slot for these controls.
const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='/folder-ui.css';document.head.append(stylesheet);
const tools=document.createElement('div');tools.className='folder-studio-tools';
const save=document.createElement('button');save.type='button';save.textContent='Save';save.title='Save Artboard (⌘/Ctrl S)';
const opener=document.createElement('button');opener.type='button';opener.textContent='Folder';
save.dataset.studioSave='';opener.dataset.studioFolder='';
const feedback=document.createElement('span');feedback.className='folder-save-feedback';feedback.setAttribute('role','status');tools.append(save,opener,feedback);
const toolsHost=document.querySelector('[data-studio-save-slot]');if(toolsHost)tools.classList.add('is-mounted');(toolsHost||document.body).append(tools);
const dialog=document.createElement('dialog');dialog.id='folder-settings';dialog.className='folder-settings';dialog.setAttribute('aria-labelledby','folder-title');
dialog.innerHTML=`<h2 id="folder-title">Your Artboards folder</h2><p data-description>Choose a folder on your computer. Artboards are saved there as portable .ment files.</p><dl><dt>Folder</dt><dd data-location>Not connected</dd></dl><label data-name-label hidden>Artboard name<input data-recovery-name maxlength="80" autocomplete="off"></label><div class="folder-actions"><button type="button" data-choose>Choose folder</button><button type="button" data-reconnect hidden>Reconnect and retry</button><button type="button" data-retry hidden>Retry save</button><button type="button" data-emergency hidden>Download emergency .ment</button></div><p data-result role="status"></p><p data-error role="alert"></p>`;
let dismissHint;if(toolsHost){dialog.tabIndex=-1;dismissHint=document.createElement('p');dismissHint.className='folder-dismiss-hint';dismissHint.textContent='Press Esc or click outside to close.';dialog.append(dismissHint);}
document.body.append(dialog);
const $=s=>dialog.querySelector(s);let state={configured:false,ready:false,busy:false},acting=false,writeFailed=false;
function open(){if(dismissHint)dismissHint.hidden=!state.ready||writeFailed||acting||state.busy;if(!dialog.open){dialog.showModal();if(toolsHost&&state.ready&&!writeFailed&&!acting)dialog.focus();}}
function render(next){
 state=next;opener.textContent=state.ready?'Folder: '+state.name:'Reconnect folder';
 opener.title=state.ready?'Manage your Artboards folder: '+state.name:'Reconnect your Artboards folder';
 $('[data-location]').textContent=state.name||'Not connected';
 $('[data-choose]').hidden=state.configured;$('[data-choose]').disabled=acting||state.busy||!state.supported;
 $('[data-reconnect]').hidden=!state.configured||state.ready&&!writeFailed;$('[data-reconnect]').disabled=acting||state.busy;
 $('[data-retry]').hidden=!writeFailed;$('[data-retry]').disabled=acting||state.busy;
 $('[data-emergency]').hidden=!writeFailed&&!(state.configured&&!state.ready&&window.basementStudioSession?.capture);
 if(dismissHint)dismissHint.hidden=!state.ready||writeFailed||acting||state.busy;
 if(!state.supported)$('[data-error]').textContent='Open Basement in Google Chrome to save Artboards in a folder.';
 else if(state.error)$('[data-error]').textContent=state.error;
 if(!state.ready&&!state.busy&&state.configured)open();
}
subscribeStorage(render);
opener.onclick=()=>{storageStatus().catch(showError);open();};
save.onclick=async()=>{save.disabled=true;try{if(!window.basementStudioSession)throw Error('Artboard is loading.');await window.basementStudioSession.save();feedback.textContent='Saved';}catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}};
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();if(!dialog.open&&!conflict.open)save.click();}},true);
dialog.addEventListener('cancel',event=>{if(acting||state.busy||!state.ready||writeFailed)event.preventDefault();});
dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if((event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)&&state.ready&&!writeFailed&&!acting)dialog.close();});
function showError(error){$('[data-error]').textContent=error.message||String(error);}
async function operate(action){
 if(acting)return;acting=true;$('[data-error]').textContent='';$('[data-result]').textContent='Connecting…';render(state);
 try{await action();const status=await storageStatus();if(!status.ready||pendingProject())throw Error(status.error||'The folder is not ready. Retry before continuing.');writeFailed=false;$('[data-result]').textContent='Saved to your folder.';dialog.close();}
 catch(error){$('[data-result]').textContent='';if(error.name!=='AbortError')showError(error);}
 finally{acting=false;render(state);}
}
$('[data-choose]').onclick=()=>operate(chooseProjectFolder);
$('[data-reconnect]').onclick=()=>operate(async()=>{await reconnectProjectFolder();await retryPendingSave();await window.basementStudioSession?.save();});
$('[data-retry]').onclick=()=>operate(async()=>{if(!$('[data-name-label]').hidden){const name=$('[data-recovery-name]').value.trim(),p=pendingProject();if(!p)throw Error('Artboard unavailable.');await putProject({...p,name});const input=document.querySelector('#project-title,#name');if(input)input.value=name;$('[data-name-label]').hidden=true;}else await retryPendingSave();await window.basementStudioSession?.save();});
$('[data-emergency]').onclick=async()=>{
 try{const p=window.basementStudioSession?.capture()||pendingProject();if(!p)throw Error('No Artboard is open.');const raw=await encodeProject(p),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=p.name.replace(/[\\/:*?"<>|]/g,'_')+'.ment';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('[data-result]').textContent='Emergency .ment downloaded. Reconnect the folder to continue editing.';}catch(error){showError(error);}
};
const conflict=document.createElement('dialog');conflict.className='folder-settings';conflict.innerHTML=`<h2>Artboard changed outside Basement</h2><p>Choose the version to keep. Loading the disk version discards the changes currently open in this tab.</p><div class="folder-actions"><button data-disk>Load disk version</button><button data-current>Keep my current version</button></div><p role="alert"></p>`;document.body.append(conflict);
conflict.addEventListener('cancel',event=>event.preventDefault());
function showConflict(){if(dialog.open)dialog.close();if(!conflict.open)conflict.showModal();}
const projectId=()=>new URLSearchParams(location.search).get('project');
conflict.querySelector('[data-disk]').onclick=async()=>{const session=window.basementStudioSession;if(session)session.dirty=()=>false;await acceptExternalVersion(projectId());location.reload();};
conflict.querySelector('[data-current]').onclick=async()=>{
 try{const p=window.basementStudioSession?.capture()||pendingProject();if(!p)throw Error('Artboard unavailable.');await putProject(p,{overwriteExternal:true});await window.basementStudioSession?.save();writeFailed=false;conflict.close();await storageStatus();}
 catch(error){conflict.querySelector('[role=alert]').textContent=error.message;}
};
window.addEventListener('basement-write-error',event=>{writeFailed=true;$('[data-name-label]').hidden=event.detail.code!=='NAME_CONFLICT';if(event.detail.code==='NAME_CONFLICT')$('[data-recovery-name]').value=pendingProject()?.name||'';if(event.detail.code==='EXTERNAL_CHANGE')showConflict();else{showError(Error(event.detail.message));open();}});
window.addEventListener('basement-storage-change',()=>{});
let checking=false;
async function inspect(){if(checking||document.hidden||dialog.open||conflict.open||!projectId()||!window.basementStudioSession)return;checking=true;try{const status=await storageStatus();if(!status.ready)open();else if(await checkProjectChanged(projectId()))showConflict();}catch(error){showError(error);open();}finally{checking=false;}}
window.addEventListener('focus',inspect);document.addEventListener('visibilitychange',inspect);setInterval(inspect,5000);
(async()=>{try{await storageStatus();if(!state.ready)open();}catch(error){showError(error);open();}})();
