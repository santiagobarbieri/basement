import {gifGeometry} from './gif-geometry.js';
import {getProject,putProject,freezeState,resumeState,projectSavedLabel,projectSavingLabel,registerStudioSession} from '/project-store.js';
import { exportGif } from './gif-export.js';
import { documentSignature, serializeMent } from './ment-format.js';

export function createSaver({ getState: getRawState, prepare, isBusy, getPreview, loadState }) {
  const button = document.querySelector('#export'), status = document.querySelector('#save-status');
  const menu = document.querySelector('#export-menu');
  const mentButton = document.querySelector('#export-ment'), pngButton = document.querySelector('#export-gif');
  const feedback = document.querySelector('#export-feedback');
  const titleInput=document.querySelector('#project-title');
  titleInput.value=(new URLSearchParams(location.search).get('name')||'Untitled').slice(0,80);
  const title=()=>titleInput.value.trim()||'Untitled';
  const safeFilename=()=>title().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'')||'Untitled';
  const getState=()=>({...getRawState(),projectName:title()});
  const signatureOf=state=>JSON.stringify([state.projectName,documentSignature(state)]);
  const studio='tremor';
  let id=new URLSearchParams(location.search).get('project')||crypto.randomUUID();
  let baseline = null, downloaded = null, handle = null, saving = false, exporting = false;
  let filename = safeFilename()+'.ment';
  function update() {
    button.disabled = saving || exporting || isBusy();
    mentButton.disabled=pngButton.disabled=button.disabled;
    try{const area=gifGeometry(getState());document.querySelector('#export-size').textContent=area.width+' × '+area.height+' px · 2 s';}
    catch(error){pngButton.disabled=true;document.querySelector('#export-size').textContent=error.message;}
    if (button.disabled) closeMenu(false);
    if (saving) { status.textContent = 'Guardando…'; return; }
    if (isBusy()) { status.textContent = baseline || downloaded ? 'Copia .ment desactualizada' : 'Copia .ment sin exportar'; return; }
    const signature = signatureOf(getState());
    status.textContent = baseline === signature ? 'Guardado en tu Mac'
      : downloaded === signature ? 'Descarga .ment iniciada'
      : baseline || downloaded ? 'Copia .ment desactualizada' : 'Copia .ment sin exportar';
    if(ready&&!localWriting){clearTimeout(localTimer);localTimer=setTimeout(persistLocal,5000);}
  }
  function markChanged() {
    if (!saving) status.textContent = baseline || downloaded ? 'Copia .ment desactualizada' : 'Copia .ment sin exportar';
  }
  async function save() {
    if (saving || exporting || isBusy()) return;
    feedback.textContent = "";
    prepare();
    // Freeze the clicked version: changes made during a save remain unsaved.
    const state = structuredClone(getState()), signature = signatureOf(state), preview = getPreview();
    saving = true; update();
    let writable;
    try {
      if (typeof window.showSaveFilePicker === 'function') {
        const target = handle || await window.showSaveFilePicker({
          suggestedName: filename, excludeAcceptAllOption: true,
          types: [{ description: 'Artboard BASEMENT (.ment)', accept: { 'application/json': ['.ment'] } }],
        });
        const text = serializeMent(state, { id, name: state.projectName, preview });
        writable = await target.createWritable();
        await writable.write(text); await writable.close(); writable = null;
        handle = target; filename = target.name; baseline = signature;
        status.title = filename;
      } else {
        const text = serializeMent(state, { id, name: state.projectName, preview });
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        downloaded = signature;
        status.title = 'El navegador inició la descarga. Comprobá el archivo en tus descargas.';
      }
      saving = false; update();
    } catch (error) {
      if (writable) { try { await writable.abort(); } catch {} }
      saving = false; update();
      if (error.name !== 'AbortError') { status.textContent = 'No se pudo guardar'; status.title = 'Probá Export nuevamente.'; }
    }
  }
  function closeMenu(focus = true) {
    menu.hidden = true; button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  }
  button.addEventListener('click', () => {
    menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) mentButton.focus();
  });
  mentButton.addEventListener('click', () => { closeMenu(); save(); });
  pngButton.addEventListener('click', async () => {
    if(saving||exporting||isBusy()||pngButton.disabled)return;
    closeMenu();prepare(); const state = structuredClone(getState());
    exporting = true; feedback.textContent = 'Generando GIF…'; update();
    try {
      const blob = await exportGif(state), url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url;
      const area=gifGeometry(state),suffix=area.name?' — '+area.name.replace(/[<>:"/\\|?*]/g,'-'):state.exportTarget==='selection'?' — selección':'';
      anchor.download=filename.replace(/\.ment$/i,'')+suffix+'.gif';
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      feedback.textContent = 'Descarga GIF iniciada';
    }catch(error){feedback.textContent=error.message||'No se pudo exportar GIF';}
    exporting = false; update();
  });
  document.addEventListener('click', e => { if (!e.target.closest('.file')) closeMenu(false); });
  menu.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); (document.activeElement === mentButton ? pngButton : mentButton).focus();
    }
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); prepare(); persistLocal(); }
  });
  titleInput.addEventListener('input',()=>{handle=null;filename=safeFilename()+'.ment';document.title=title()+' · Tremor';update();});
  titleInput.addEventListener('blur',()=>{if(!titleInput.value.trim())titleInput.value='Untitled';});
  document.title=title()+' · Tremor';
  const localStatus=document.createElement('small');localStatus.id='local-status';status.before(localStatus);
  let ready=false,localWriting=false,localSignature=null,createdAt=Date.now(),localTimer;
  async function persistLocal(){
    if(!ready||localWriting||isBusy())return;
    const state=structuredClone(getState()),signature=signatureOf(state);
    if(signature===localSignature)return;
    localWriting=true;localStatus.textContent=projectSavingLabel();
    try{
      prepare();const frozen=structuredClone(getState());
      await putProject({id,name:frozen.projectName,studio,state:freezeState(studio,frozen),preview:getPreview(),createdAt,updatedAt:Date.now()});
      localSignature=signatureOf(frozen);localStatus.textContent=projectSavedLabel();
      const url=new URL(location.href);url.searchParams.set('project',id);history.replaceState(null,'',url);
    }catch(error){localStatus.textContent='Save failed: '+error.message;console.error(error)}
    finally{localWriting=false;}
  }
  (async()=>{
    try{
      if(new URLSearchParams(location.search).has('project')){
        localStatus.textContent='Abriendo proyecto…';const project=await getProject(id);
        if(!project||project.studio!==studio)throw Error('Proyecto no disponible en la carpeta');
        titleInput.value=project.name;filename=safeFilename()+'.ment';createdAt=project.createdAt;await loadState(resumeState(project));document.title=title()+' · '+studio;
        localSignature=signatureOf(getState());localStatus.textContent=projectSavedLabel();
      }
      ready=true;persistLocal();
    }catch(error){localStatus.textContent=error.message;button.disabled=true;titleInput.disabled=true;const editor=document.querySelector('main');if(editor)editor.inert=true;}
  })();
  registerStudioSession({save:async()=>{if(!ready)throw Error(localStatus.textContent||'Artboard is not ready.');prepare();while(localWriting)await new Promise(r=>setTimeout(r,20));await persistLocal();if(signatureOf(getState())!==localSignature)throw Error(localStatus.textContent||'Finish the current action before saving.');},capture:()=>({id,name:title(),studio,state:freezeState(studio,getState()),preview:getPreview(),createdAt,updatedAt:Date.now()}),dirty:()=>ready&&signatureOf(getState())!==localSignature});
  // Save before leaving via Main Page; if storage fails, keep the work open.
  document.querySelector('.main-page-link')?.addEventListener('click',async event=>{
    event.preventDefault();if(!ready){location.href='/hub/';return;}if(isBusy()&&signatureOf(getState())===localSignature){location.href='/hub/';return;}const started=performance.now();while(isBusy()&&performance.now()-started<15000)await new Promise(r=>setTimeout(r,30));if(isBusy())return;while(localWriting)await new Promise(r=>setTimeout(r,20));
    await persistLocal();if(signatureOf(getState())!==localSignature)return;location.href=event.currentTarget?.href||'/hub/';
  });
  window.addEventListener('basement-library-changed',()=>{if(!ready){location.reload();return;}localSignature=null;persistLocal();});
  update();
  return { update, markChanged };
}
