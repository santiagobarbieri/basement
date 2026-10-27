// One active Basement session per origin, including hubs and Studios. Web Locks
// release on navigation/tab close; a second tab never takes over automatically.
const lockedElements=new Map();
let releaseLock,holding=false,overlay;
window.basementSessionBlocked=false;
let resolveReady;
window.basementSessionReady=new Promise(resolve=>{resolveReady=resolve;});
function block(){
 window.basementSessionBlocked=true;
 document.documentElement.inert=false;
 for(const element of document.body.children){lockedElements.set(element,element.inert);element.inert=true;}
 overlay=document.createElement('div');overlay.id='basement-session-blocked';overlay.setAttribute('role','alertdialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','session-heading');
 overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#111;color:#d9d9d9;display:grid;place-content:center;padding:32px;font:14px Arial,sans-serif';
 overlay.innerHTML='<div style="max-width:440px"><h1 id="session-heading" style="font-size:28px;font-weight:400">Basement is already open</h1><p style="line-height:1.6;color:#aaa">Use the existing tab to keep working. Close it before continuing here.</p><button type="button" style="margin-top:16px;background:#d9d9d9;color:#111;border:0;border-radius:4px;padding:8px 18px;cursor:pointer">Try again</button></div>';
 overlay.querySelector('button').onclick=()=>location.reload();document.body.append(overlay);overlay.querySelector('button').focus();
 window.dispatchEvent(new CustomEvent('basement-session-blocked'));
}
function acquire(){
 if(holding)return;
 document.documentElement.inert=true;
 if(!navigator.locks){resolveReady(false);block();return;}
 navigator.locks.request('basement-active-tab',{mode:'exclusive',ifAvailable:true},async lock=>{
  if(!lock){resolveReady(false);block();return;}
  holding=true;window.basementSessionBlocked=false;document.documentElement.inert=false;
  if(overlay){overlay.remove();overlay=null;for(const [element,inert] of lockedElements)element.inert=inert;lockedElements.clear();}
  resolveReady(true);window.dispatchEvent(new CustomEvent('basement-session-ready'));
  await new Promise(resolve=>{releaseLock=resolve;});holding=false;
 }).catch(()=>{resolveReady(false);block();});
}
acquire();
window.addEventListener('pagehide',()=>{releaseLock?.();holding=false;});
window.addEventListener('pageshow',event=>{if(event.persisted)acquire();});
// Inert suppresses pointer input. Stop Studio hotkeys in a blocked second tab.
window.addEventListener('keydown',event=>{if(window.basementSessionBlocked&&event.key!=='Tab'){event.stopImmediatePropagation();if(event.key!=='Enter'&&event.key!==' ')event.preventDefault();}},true);
const connection=document.createElement('div');connection.id='basement-connection';connection.setAttribute('role','status');connection.style.cssText='position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483646;padding:8px 16px;background:#111;color:#ddd;border:1px solid #777;border-radius:4px;font:12px Arial,sans-serif;pointer-events:none';
connection.textContent='Offline — your open Artboard can still save to its folder.';document.body.append(connection);
function showConnection(){connection.hidden=navigator.onLine;window.dispatchEvent(new CustomEvent('basement-connection-change',{detail:{online:navigator.onLine}}));}
window.addEventListener('online',showConnection);window.addEventListener('offline',showConnection);showConnection();
