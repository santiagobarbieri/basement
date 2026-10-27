import {createPWA} from './pwa.js';
const hub=document.querySelector('.hub');
let locked=false;
const updates=createPWA({beforeUpdate:async()=>{
 if(!hub||!['/hub/','/hub/index.html'].includes(location.pathname))throw Error('Return to the hub to update Basement.');
 if(hub.dataset.busy==='true'||hub.dataset.pendingSave==='true'||window.basementSessionBlocked||[...document.querySelectorAll('dialog[open]')].some(dialog=>dialog.id!=='settings')||document.querySelector('#settings [data-unsaved="true"]'))throw Error('Finish the current operation before updating.');
 hub.inert=true;locked=true;return ()=>{hub.inert=false;locked=false;};
}});
window.basementUpdates=updates;
updates.subscribe(state=>{
 for(const element of document.querySelectorAll('[data-update-label]'))element.textContent=state.waiting?'New Version Available':'Up to date';
 for(const element of document.querySelectorAll('[data-build]'))element.textContent=state.build?state.build.slice(0,12):'Checking…';
 for(const element of document.querySelectorAll('[data-update-message]'))element.textContent=state.message;
 for(const element of document.querySelectorAll('[data-check]')){element.disabled=state.checking||state.updating||!state.supported;element.textContent=state.checking?'Checking…':'Check for updates';}
 for(const element of document.querySelectorAll('[data-apply]')){element.hidden=!state.waiting;element.disabled=state.updating;element.textContent=state.updating?'Updating…':'Update';}
 if(!state.updating&&locked){hub.inert=false;locked=false;}
 window.dispatchEvent(new CustomEvent('basement-update-state',{detail:state}));
});
document.addEventListener('click',event=>{if(event.target.closest('[data-check]'))updates.check();if(event.target.closest('[data-apply]'))updates.update();});
