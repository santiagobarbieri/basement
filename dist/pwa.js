// Release coordination only. Basement runs as a website and has no install flow.
export function createPWA({beforeUpdate=async()=>{},notify}={}){
 const listeners=new Set();let registration=null,approved=false,started=false,activationTimer=null;
 const state={supported:'serviceWorker' in navigator&&isSecureContext,ready:false,waiting:false,checking:false,updating:false,online:navigator.onLine,build:'',message:''};
 const emit=()=>{for(const fn of listeners)fn({...state});};
 const fail=error=>{state.message=error.message||String(error);state.updating=false;emit();notify?.(state.message);};
 function inspect(){state.waiting=!!registration?.waiting;emit();}
 function readBuild(){const worker=navigator.serviceWorker.controller||registration?.active;if(!worker)return;const channel=new MessageChannel();const timer=setTimeout(()=>channel.port1.close(),3000);channel.port1.onmessage=event=>{clearTimeout(timer);state.build=event.data?.build||'';channel.port1.close();emit();};worker.postMessage({type:'GET_BUILD'},[channel.port2]);}
 async function check({quiet=false}={}){
  if(!registration||state.checking||state.updating)return;
  if(!navigator.onLine){if(!quiet){state.message='You are offline. Your open Artboard can still be saved to its folder.';emit();}return;}
  state.checking=true;if(!quiet)state.message='Checking for updates…';emit();
  try{await registration.update();inspect();if(!quiet)state.message=registration.waiting?'A new version is available.':registration.installing?'Checking the new version…':'You have the latest version.';}
  catch{if(!quiet)state.message='Could not check for updates. Try again when connected.';}finally{state.checking=false;emit();}
 }
 async function start(){if(started||!state.supported)return;started=true;
  try{
   registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
   const observe=()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{inspect();if(worker.state==='redundant'){state.message='The new version could not be verified. Your current session is unchanged.';emit();}if(worker.state==='activated'){state.ready=true;readBuild();}});};
   registration.addEventListener('updatefound',observe);observe();inspect();
   navigator.serviceWorker.ready.then(()=>{state.ready=true;readBuild();inspect();});
  }catch{state.message='Updates need a connection. You can keep working in this open session.';emit();}
 }
 // Suppress browser installation banners from any stale previous manifest.
 window.addEventListener('beforeinstallprompt',event=>event.preventDefault());
 if(state.supported)navigator.serviceWorker.addEventListener('controllerchange',()=>{state.ready=true;readBuild();inspect();if(approved){clearTimeout(activationTimer);approved=false;location.reload();}});
 for(const name of ['online','offline'])window.addEventListener(name,()=>{state.online=navigator.onLine;emit();if(state.online)check({quiet:true});});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check({quiet:true});});
 const interval=setInterval(()=>check({quiet:true}),60*60*1000);window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
 if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
 return {get state(){return {...state};},subscribe(fn){listeners.add(fn);fn({...state});return ()=>listeners.delete(fn);},check:()=>started?check():start(),
  async update(){if(state.updating||!registration?.waiting)return;state.updating=true;state.message='Preparing to update…';emit();
   let restore;try{
    restore=await beforeUpdate();const worker=registration.waiting;
    if(!worker){restore?.();state.updating=false;state.message='No update is pending.';emit();return;}
    approved=true;
    await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(Error('The update did not respond. Please try again.'));},10000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.ok?resolve():reject(Error(event.data?.error||'Could not update.'));};worker.postMessage({type:'APPLY_UPDATE'},[channel.port2]);});
    activationTimer=setTimeout(()=>{if(!approved)return;approved=false;restore?.();fail(Error('The update could not finish. You can retry.'));},15000);
   }catch(error){approved=false;clearTimeout(activationTimer);restore?.();fail(error);}
  }
 };
}
