// Isolated Chrome profile, OPFS library and server: never accesses user projects.
// Exercises real Studio save, failure recovery and external-edit choices.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),temp=await mkdtemp('/private/tmp/basement-studio-');
const server=createServer(async(req,res)=>{try{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';
 const target=resolve(root,'.'+path);if(!target.startsWith(root+'/')){res.writeHead(404).end();return;}
 const data=await readFile(target);
 const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.ready=new Promise(r=>this.ws.onopen=r);this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};}
 async send(method,params={}){await this.ready;return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 close(){this.ws.close();}
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,page;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(temp+'/DevToolsActivePort','utf8')).split('\n')[0];break;}catch{await delay(100);}}
 assert.ok(port,'Chrome started');const debug='http://127.0.0.1:'+port;
 browser=new CDP((await(await fetch(debug+'/json/version')).json()).webSocketDebuggerUrl);
 const target=(await browser.send('Target.createTarget',{url:origin+'/hub/'})).targetId;
 page=new CDP((await(await fetch(debug+'/json')).json()).find(t=>t.id===target).webSocketDebuggerUrl);await page.send('Page.enable');
 const run=async expression=>{const r=await page.send('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<250;i++){if(await run(expression))return;await delay(100);}throw Error('Timed out: '+expression+'\n'+await run("JSON.stringify({url:location.href,status:document.querySelector('#save-status')?.textContent,modal:document.querySelector('#folder-settings')?.open,error:document.querySelector('[data-error]')?.textContent})"));};
 await wait('window.basementSessionReady');
 await run(`(async()=>{window.showDirectoryPicker=async()=>navigator.storage.getDirectory();const s=await import('/project-store.js');await s.connectProjectFolder(await navigator.storage.getDirectory());await s.putProject({id:'studio-test',name:'Studio test',studio:'marble',state:(await import('/marble/engine.js')).initialState(),preview:null,createdAt:Date.now(),updatedAt:Date.now()});})()`);
 const validation=await run(`(async()=>{const s=await import('/project-store.js'),p=await s.getProject('studio-test');let failures=0;for(const invalid of [{...p,name:''},{...p,id:'other',name:p.name},{...p,updatedAt:1e100}]){try{await s.putProject(invalid);}catch{failures++;}}return {failures,ready:(await s.storageStatus()).ready,pending:s.pendingProject()};})()`);
 assert.deepEqual(validation,{failures:3,ready:true,pending:null});
 console.log('PASS invalid metadata and duplicate names never disconnect a healthy library');
 await page.send('Page.navigate',{url:origin+'/marble/?project=studio-test'});
 await wait("window.basementStudioSession&&!window.basementStudioSession.dirty()&&document.querySelector('#name').value==='Studio test'");
 await run("document.querySelector('#name').value='Autosaved',document.querySelector('#name').dispatchEvent(new Event('input',{bubbles:true}))");
 await delay(1000);
 assert.equal(await run("(await import('/project-store.js')).getProject('studio-test').then(p=>p.name)"),'Studio test');
 await wait("!window.basementStudioSession.dirty()&&document.querySelector('#save-status').textContent.startsWith('Saved')");
 assert.equal(await run("(await import('/project-store.js')).getProject('studio-test').then(p=>p.name)"),'Autosaved');
 console.log('PASS Studio autosave waits for idle delay and saves the portable Artboard');
 await run("document.querySelector('#name').value='Manual save',document.querySelector('#name').dispatchEvent(new Event('input',{bubbles:true})),document.querySelector('.folder-studio-tools button').click()");
 await wait("!window.basementStudioSession.dirty()");
 assert.equal(await run("(await import('/project-store.js')).getProject('studio-test').then(p=>p.name)"),'Manual save');
 console.log('PASS manual Save persists immediately to the chosen folder');
 await run(`(async()=>{window.originalPermission=FileSystemDirectoryHandle.prototype.queryPermission;window.permissionLost=true;FileSystemDirectoryHandle.prototype.queryPermission=function(...args){return window.permissionLost?Promise.resolve('denied'):window.originalPermission.apply(this,args);};document.querySelector('#name').value='Permission recovery';document.querySelector('#name').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.folder-studio-tools button').click();})()`);
 await wait("document.querySelector('#folder-settings').open&&!document.querySelector('[data-emergency]').hidden");
 assert.equal(await run("(await import('/project-store.js')).pendingProject()"),null);
 assert.equal(await run("(await import('/project-store.js')).storageStatus().then(s=>s.ready)"),false);
 assert.equal(await run("window.basementStudioSession.capture().name"),'Permission recovery');
 await run("window.permissionLost=false,document.querySelector('[data-reconnect]').click()");
 await wait("!document.querySelector('#folder-settings').open&&!window.basementStudioSession.dirty()");
 assert.equal(await run("(await import('/project-store.js')).getProject('studio-test').then(p=>p.name)"),'Permission recovery');
 await run("FileSystemDirectoryHandle.prototype.queryPermission=window.originalPermission");
 console.log('PASS permission loss before writing blocks editing and exposes the in-memory emergency copy');
 await run(`(async()=>{window.originalWriter=FileSystemFileHandle.prototype.createWritable;window.failDisk=true;FileSystemFileHandle.prototype.createWritable=function(...args){if(window.failDisk)return Promise.reject(Error('Simulated disk full'));return window.originalWriter.apply(this,args);};document.querySelector('#name').value='Recovered';document.querySelector('#name').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.folder-studio-tools button').click();})()`);
 await wait("document.querySelector('#folder-settings').open&&document.querySelector('[data-error]').textContent.includes('Simulated disk full')");
 assert.equal(await run("(await import('/project-store.js')).storageStatus().then(s=>s.ready)"),false);
 assert.equal(await run("(await import('/project-store.js')).pendingProject().name"),'Recovered');
 assert.equal(await run("document.querySelector('[data-emergency]').hidden"),false);
 await run("window.failDisk=false,document.querySelector('[data-retry]').click()");
 await wait("!document.querySelector('#folder-settings').open&&!window.basementStudioSession.dirty()");
 assert.equal(await run("(await import('/project-store.js')).getProject('studio-test').then(p=>p.name)"),'Recovered');
 console.log('PASS disk failures block editing, retain recovery, and retry restores the clean state');
 const external=paper=>`(async()=>{const root=await navigator.storage.getDirectory();for await(const [name,h]of root.entries()){if(h.kind!=='file'||!name.endsWith('.ment'))continue;const doc=JSON.parse(await(await h.getFile()).text());if(doc.artboard.id!=='studio-test')continue;doc.artboard.settings.bath.paper=${JSON.stringify(paper)};const writer=await h.createWritable();await writer.write(JSON.stringify(doc));await writer.close();}window.dispatchEvent(new Event('focus'));})()`;
 const originalPaper=await run("window.basementStudioSession.capture().state.bath.paper");
 await run(external('#123456'));
 await wait("document.querySelector('[data-current]').closest('dialog').open");
 await run("document.querySelector('[data-current]').click()");
 await wait("!document.querySelector('[data-current]').closest('dialog').open&&!window.basementStudioSession.dirty()");
 assert.equal(await run("(await import('/project-store.js')).getProject('studio-test').then(p=>p.state.bath.paper)"),originalPaper);
 await run(external('#345678'));
 await wait("document.querySelector('[data-current]').closest('dialog').open");
 await run("document.querySelector('[data-disk]').click()");
 await wait("window.basementStudioSession&&!window.basementStudioSession.dirty()&&document.querySelector('#paper').value==='#345678'");
 console.log('PASS external changes offer both keeping the current state and loading the disk version');
 await run("document.querySelector('#name').value='Saved on Home',document.querySelector('#name').dispatchEvent(new Event('input',{bubbles:true})),document.querySelector('#home').click()");
 await wait("location.pathname==='/hub/'&&!!document.querySelector('#project-list')");
 assert.equal(await run("(await import('/project-store.js')).getProject('studio-test').then(p=>p.name)"),'Saved on Home');
 await page.send('Page.navigate',{url:origin+'/marble/?project=missing-id'});
 await wait("document.querySelector('main')?.inert===true");
 assert.equal(await run("window.basementStudioSession.dirty()"),false);
 console.log('PASS Home saves pending edits; missing Artboards never open an editable blank document');
}finally{
 page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
