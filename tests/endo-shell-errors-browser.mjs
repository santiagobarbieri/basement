// Chrome, OPFS and all write failures are confined to a temporary profile.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),temp=await mkdtemp('/private/tmp/basement-endo-shell-errors-');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';const target=resolve(root,'.'+path);if(!target.startsWith(root+'/')){res.writeHead(404).end();return;}const data=await readFile(target),mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
class CDP{constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.ready=new Promise(r=>this.ws.onopen=r);this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else this.onEvent?.(m);};}async send(method,params={}){await this.ready;return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}close(){this.ws.close();}}
let browser,page;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(temp+'/DevToolsActivePort','utf8')).split('\n')[0];break;}catch{await delay(100);}}assert.ok(port,'Chrome started');const debug='http://127.0.0.1:'+port;
 browser=new CDP((await(await fetch(debug+'/json/version')).json()).webSocketDebuggerUrl);const target=(await browser.send('Target.createTarget',{url:origin+'/hub/'})).targetId;page=new CDP((await(await fetch(debug+'/json')).json()).find(t=>t.id===target).webSocketDebuggerUrl);
 await page.send('Page.enable');await page.send('Page.bringToFront');await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
 const runtimeErrors=[];await page.send('Runtime.enable');const nativeDialogs=[];page.onEvent=message=>{if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded')runtimeErrors.push(message.params.entry);if(message.method==='Page.javascriptDialogOpening'){nativeDialogs.push(message.params.type);page.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});}};
 const run=async expression=>{const r=await page.send('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<300;i++){try{if(await run(expression))return;}catch{}await delay(100);}throw Error('Timed out: '+expression+'; runtime: '+JSON.stringify(runtimeErrors)+'; '+await run("JSON.stringify({url:location.href,status:document.querySelector('#local-status')?.textContent,error:document.querySelector('#folder-settings [data-error]')?.textContent,blocked:window.basementSessionBlocked,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.textContent.slice(0,200))})"));};
 const pointer=(type,point,buttons)=>page.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons,clickCount:1});
 const click=async selector=>{const point=await run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'nearest'});const r=element.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await pointer('mousePressed',point,1);await pointer('mouseReleased',point,0);};
 const key=async key=>{const codes={Escape:27,Tab:9};await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code:key,windowsVirtualKeyCode:codes[key]||0});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:codes[key]||0});};
 const capture=async name=>{await delay(200);const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/private/tmp/basement-endo-shell-'+name+'.png',Buffer.from(data,'base64'));};
 const isVisible=selector=>run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)}),style=getComputedStyle(element),r=element.getBoundingClientRect();return !element.closest('[hidden]')&&style.visibility!=='hidden'&&style.display!=='none'&&r.width>0&&r.height>0;})()`);
 await wait('window.basementSessionReady');
 await run(`(async()=>{const store=await import('/project-store.js');window.testFolder=await(await navigator.storage.getDirectory()).getDirectoryHandle('Endo Error Test',{create:true});await store.connectProjectFolder(window.testFolder);await store.putProject({id:'endo-shell-errors',name:'Saved original',studio:'endo',state:await(await import('/hub/studios.js')).createInitial('endo'),createdAt:Date.now(),updatedAt:Date.now()});})()`);
 await page.send('Page.navigate',{url:origin+'/?project=missing-shell-project'});
 await wait("document.querySelector('#endo-save-status')?.dataset.saveState==='error'&&document.querySelector('main')?.inert");
 assert.match(await run("document.querySelector('#local-status').textContent"),/not available/i);
 assert.ok(await isVisible('#local-status'),'A load failure remains visible in the floating Project pill');
 assert.equal(await run("document.querySelector('.main-page-link').closest('main,[inert]')===null"),true,'Home remains outside the failed editor inert boundary');
 assert.equal(await run("document.querySelector('#project-title').disabled"),true);
 await capture('load-error');await click('.main-page-link');await wait("location.pathname==='/hub/'");
 console.log('PASS an unavailable project disables the editor, keeps its error visible and leaves Home usable');

 await page.send('Page.navigate',{url:origin+'/?project=endo-shell-errors'});
 await wait("document.querySelector('#local-status')?.dataset.saveState==='saved'&&!!window.basementStudioSession");
 await run(`(async()=>{window.testFolder=await(await navigator.storage.getDirectory()).getDirectoryHandle('Endo Error Test');window.originalFiles={};for await(const [name,handle]of window.testFolder.entries())if(handle.kind==='file')window.originalFiles[name]=await(await handle.getFile()).text();window.testDownloads=[];const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.testDownloads.push({name:this.download,url:this.href});return;}return click.call(this);};window.restoreWritable=FileSystemFileHandle.prototype.createWritable;FileSystemFileHandle.prototype.createWritable=async function(){throw new DOMException('Simulated disk write failure','NotAllowedError');};document.querySelector('#artboard').focus();})()`);
 await key('Tab');assert.equal(await run("document.body.classList.contains('shell-panels-hidden')"),false);
 await run(`(async()=>{const title=document.querySelector('#project-title');title.value='Unsaved recovery';title.dispatchEvent(new Event('input',{bubbles:true}));try{await window.basementStudioSession.save();}catch(error){window.testSaveFailure=error.message;}})()`);
 await wait("document.querySelector('#folder-settings').open&&document.querySelector('#endo-save-status').dataset.saveState==='error'&&document.querySelector('.shell-topleft').classList.contains('has-save-error')");
 assert.match(await run('window.testSaveFailure'),/Simulated disk write failure/);
 assert.ok(await isVisible('#local-status'),'Write failures remain visible beside the fixed editor panels');
 assert.match(await run("document.querySelector('#local-status').textContent"),/Save failed:.*Simulated disk write failure/);
 assert.ok(await isVisible('#folder-settings [data-emergency]'),'Emergency portable download remains reachable');
 assert.ok(await isVisible('#folder-settings [data-reconnect]'),'Reconnect and retry remains reachable');
 assert.equal(await run('window.basementStudioSession.dirty()'),true,'A failed write never marks the in-memory state saved');
 assert.equal(await run("(await import('/project-store.js')).pendingProject().name"),'Unsaved recovery');
 assert.equal(await run("(await import('/project-store.js')).storageStatus().then(status=>status.ready)"),false,'There is no silent browser-storage fallback');
 assert.equal(await run(`(async()=>{for(const [name,text]of Object.entries(window.originalFiles)){const handle=await window.testFolder.getFileHandle(name);if(await(await handle.getFile()).text()!==text)return false;}return true;})()`),true,'A failed write leaves the original portable file unchanged');
 await key('Escape');assert.equal(await run("document.querySelector('#folder-settings').open"),true,'Escape cannot dismiss a blocking disk-write error');
 const priorCount=await run('window.basementStudioSession.capture().state.strokes.length');
 const p=await run("(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect();return{x:r.x+r.width*.4,y:r.y+r.height*.4};})()");await pointer('mousePressed',p,1);await pointer('mouseMoved',{x:p.x+70,y:p.y+40},1);await pointer('mouseReleased',{x:p.x+70,y:p.y+40},0);
 assert.equal(await run('window.basementStudioSession.capture().state.strokes.length'),priorCount,'The modal write barrier prevents editing the canvas');
 await capture('write-error');await click('#folder-settings [data-emergency]');await wait('window.testDownloads.length===1');
 const emergency=await run('fetch(window.testDownloads[0].url).then(response=>response.json())');
 assert.equal(emergency.version,2);assert.equal(emergency.artboard.id,'endo-shell-errors');assert.equal(emergency.artboard.name,'Unsaved recovery');
 assert.equal(await run('window.basementStudioSession.dirty()'),true,'Downloading recovery does not claim the disk write succeeded');
 console.log('PASS real write failures block editing, survive fixed panels/Escape, preserve disk and expose a complete emergency .ment');

 await run('FileSystemFileHandle.prototype.createWritable=window.restoreWritable');await click('#folder-settings [data-reconnect]');
 await wait("!document.querySelector('#folder-settings').open&&document.querySelector('#local-status').dataset.saveState==='saved'&&!window.basementStudioSession.dirty()");
 assert.equal(await run("(await import('/project-store.js')).getProject('endo-shell-errors').then(project=>project.name)"),'Unsaved recovery');
 await run("document.querySelector('#artboard').focus()");await key('Tab');assert.equal(await run("document.body.classList.contains('shell-panels-hidden')"),false);
 assert.ok(await isVisible('.main-page-link'));assert.equal(await run("document.querySelector('main').inert"),false);assert.deepEqual(nativeDialogs,[]);
 console.log('PASS reconnect retries the pending version, clears the write barrier and restores the editor without reloading or losing work');
 console.log('PASS Endo floating-shell error visibility and recovery in isolated Chrome/OPFS');
}finally{
 page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
