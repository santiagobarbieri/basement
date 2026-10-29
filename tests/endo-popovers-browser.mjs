// Real Chrome, a temporary profile and an OPFS library. Never opens user files.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,extname} from 'node:path';

const root=resolve('dist'),temp=await mkdtemp('/private/tmp/basement-endo-');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';
 const target=resolve(root,'.'+path);if(!target.startsWith(root+'/')){res.writeHead(404).end();return;}
 const data=await readFile(target),mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.ready=new Promise(r=>this.ws.onopen=r);this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else this.onEvent?.(m);};}
 async send(method,params={}){await this.ready;return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 close(){this.ws.close();}
}
let browser,page;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(temp+'/DevToolsActivePort','utf8')).split('\n')[0];break;}catch{await delay(100);}}
 assert.ok(port,'Chrome started');const debug='http://127.0.0.1:'+port;
 browser=new CDP((await(await fetch(debug+'/json/version')).json()).webSocketDebuggerUrl);
 const target=(await browser.send('Target.createTarget',{url:origin+'/hub/'})).targetId;
 page=new CDP((await(await fetch(debug+'/json')).json()).find(t=>t.id===target).webSocketDebuggerUrl);
 await page.send('Page.enable');await page.send('Page.bringToFront');
 const nativeDialogs=[];
 page.onEvent=message=>{if(message.method==='Page.javascriptDialogOpening'){nativeDialogs.push(message.params.type);page.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});}};
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
 const run=async expression=>{const r=await page.send('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<300;i++){try{if(await run(expression))return;}catch{}await delay(100);}throw Error('Timed out: '+expression+'; '+await run("JSON.stringify({url:location.href,status:document.querySelector('#local-status')?.textContent,feedback:document.querySelector('#export-feedback')?.textContent,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.textContent.slice(0,150))})"));};
 const click=async selector=>{
  const hiddenMenus=await run(`(()=>{let node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing control: '+${JSON.stringify(selector)});const ids=[];while(node){if(node.matches('[role=menu][hidden]'))ids.unshift(node.id);node=node.parentElement;}return ids;})()`);
  for(const id of hiddenMenus)await click(`[aria-controls="${id}"]`);
  const p=await run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'nearest'});const r=element.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden control: '+${JSON.stringify(selector)});return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await pointer('mousePressed',p,1);await pointer('mouseReleased',p,0);
 };
 const openMenu=async name=>{if(await run(`document.querySelector('[data-menu="${name}"]').getAttribute('aria-expanded')!=='true'`))await click(`[data-menu="${name}"]`);await wait(`!document.querySelector('[data-menu-panel="${name}"]').hidden`);};
 const pointer=(type,point,buttons)=>page.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons,clickCount:1});
 const key=async(key,modifiers=0)=>{const codes={Escape:27,Enter:13,Tab:9,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Home:36,End:35};const code=key===' '?'Space':key;await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:codes[key]||0,modifiers});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:codes[key]||0,modifiers});};
 const closePopovers=async()=>{for(const[popup,close]of [['#color-popover','#color-popover-cancel'],['#brush-popover','#brush-popover-close'],['#filter-properties','#filter-properties-close'],['#repeat-popover','#repeat-popover-close']])if(await run(`!!document.querySelector('${popup}')&&!document.querySelector('${popup}').hidden`))await click(close);};
 const openBrush=async()=>{await closePopovers();await click('#open-brush-popover');await wait("!document.querySelector('#brush-popover').hidden");};
 const addAdjustment=async type=>{await closePopovers();await click('#add-adjustment');await wait("!document.querySelector('#adjustment-menu').hidden");await click(`#adjustment-menu [data-adjustment=${type}]`);await wait("!document.querySelector('#filter-properties').hidden");};
 const capture=async name=>{await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await delay(500);const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/private/tmp/basement-endo-'+name+'.png',Buffer.from(data,'base64'));};
 await wait('window.basementSessionReady');
 await run(`(async()=>{localStorage.setItem('basement-theme','dark');const store=await import('/project-store.js');const root=await(await navigator.storage.getDirectory()).getDirectoryHandle('Endo UI Test',{create:true});await store.connectProjectFolder(root);await store.putProject({id:'endo-ui-test',name:'Material studies',studio:'endo',state:await(await import('/hub/studios.js')).createInitial('endo'),createdAt:Date.now(),updatedAt:Date.now()});})()`);
 await page.send('Page.navigate',{url:origin+'/?project=endo-ui-test'});
 await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')&&!!window.basementStudioSession");
 await click('#zoom-fit');

 const state=()=>run('window.basementStudioSession.capture().state');
 const signature=()=>run("(await import('/ment-format.js')).documentSignature(window.basementStudioSession.capture().state)");
 const field=async(selector,value)=>run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.blur();})()`);
 const screen=await run("(()=>{const s=window.basementStudioSession.capture().state,f=s.frames.find(f=>f.id===s.activeFrameId);return{x:s.view.x+(f.x+f.width*.23)*s.view.scale,y:s.view.y+(f.y+f.height*.5)*s.view.scale};})()");
 assert.equal(await run("document.querySelector('#panel-settings')===null&&document.querySelector('[data-inspector-tab]')===null"),true,'Settings and its tabs are removed entirely');
 assert.equal(await run("document.querySelector('#filter-type').closest('[hidden]')!==null"),true);
 await click('.cursor-modes button[data-mode=draw]');
 const original=await signature();
 await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...screen,button:'right',buttons:2,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...screen,button:'right',buttons:0,clickCount:1});
 await wait("!document.querySelector('#brush-popover').hidden");
 assert.equal((await state()).strokes.length,0,'A secondary click never paints');
 assert.equal(await run("document.activeElement.closest('[data-control]').dataset.control"),'width','Size receives initial focus');
 await field('#controls [data-control=width] input[type=number]',46);assert.equal((await state()).defaults.width,46);await capture('brush-popup');await key('Escape');await click('#return');assert.equal(await signature(),original,'Brush values retain normal Undo after closing');
 const doubleClick=async selector=>{const point=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const clickCount of [1,2]){await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount});}};
 await doubleClick('.cursor-modes button[data-mode=erase]');await wait("!document.querySelector('#brush-popover').hidden");assert.equal(await run("document.querySelector('.brush-switch').hidden"),true,'Eraser exposes size without a material grid');await key('Escape');
 await doubleClick('.cursor-modes button[data-mode=draw]');await wait("!document.querySelector('#brush-popover').hidden");assert.equal(await run("document.querySelector('.brush-switch').hidden"),false);await click('#brush-popover-close');
 await run("document.querySelector('#artboard').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:innerWidth-4,clientY:innerHeight-4}))");await click('[data-brush-tip=chisel]');
 assert.equal(await run("(()=>{const r=document.querySelector('#brush-popover').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()"),true,'Brush shape changes keep the popup inside the viewport');await click('#brush-popover-close');await click('#return');
 console.log('PASS Brush popup opens with secondary click and double click, follows Eraser, clamps to the window and preserves Undo');
 const defaults=structuredClone((await state()).defaults);
 await click('#brush-options-bar [data-open-color=primary]');await wait("!document.querySelector('#color-popover').hidden");assert.equal(await run("document.querySelector('.color-role[aria-pressed=true]').dataset.color"),'primary');assert.match(await run("document.querySelector('#color-editing-role').textContent"),/paint color/i);
 await field('#color-hex','#112233');await field('#color-hex','#20a060');await field('#color-h',48);await field('#color-s',65);
 await delay(5200);assert.deepEqual(await run("(await(await import('/project-store.js')).getProject('endo-ui-test')).state.defaults"),defaults,'An unconfirmed live preview is never written to the library');
 await capture('color-popup');await click('#color-popover-ok');const changed=(await state()).defaults;assert.notDeepEqual(changed,defaults);await click('#return');assert.deepEqual((await state()).defaults,defaults,'One Undo reverts the confirmed paint color');await click('#restore');assert.deepEqual((await state()).defaults,changed);await click('#return');
 await click('#brush-options-bar [data-open-color=primary]');await field('#color-hex','#ff0000');await key('Escape');assert.deepEqual((await state()).defaults,defaults,'Escape cancels the entire color preview');
 await click('#brush-options-bar [data-open-color=primary]');await field('#color-hex','#00ff00');await pointer('mousePressed',screen,1);await pointer('mouseReleased',screen,0);assert.equal((await state()).strokes.length,0);assert.deepEqual((await state()).defaults,defaults,'A click on the canvas cancels Color without drawing');
 assert.equal(await run("document.querySelector('#toolbar-colors').closest('.status-chip')!==null"),true);await click('#toolbar-colors');await wait("!document.querySelector('#color-popover').hidden");await click('#color-popover-cancel');console.log('PASS top and bottom paint color open transactional previews, with OK/Undo/Redo, Escape and canvas safety');
 await click('#add-adjustment');await wait("!document.querySelector('#adjustment-menu').hidden");await capture('adjustment-list');
 const filterTypes=await run("[...document.querySelectorAll('#adjustment-menu [data-adjustment]')].map(e=>e.dataset.adjustment)");for(const type of ['brightness','contrast','exposure','saturation','grayscale','invert','posterize','threshold','dither','colored-dither','pigment-grain','paper-texture','crosshatch','ink-wash'])assert.ok(filterTypes.includes(type),'The gallery includes '+type);assert.ok(await run("document.querySelectorAll('#adjustment-menu .filter-menu-group-label').length>=4"),'Effects are grouped by purpose');await key('End');assert.equal(await run('document.activeElement.dataset.adjustment'),'ink-wash');await key('Escape');assert.equal(await run("document.activeElement.id"),'add-adjustment');
 await addAdjustment('threshold');assert.equal((await state()).layers.at(-1).kind,'adjustment');assert.equal(await run("document.querySelector('#filter-properties').getAttribute('role')"),'dialog');assert.match(await run("document.querySelector('#filter-properties-title').textContent"),/Threshold/);await capture('adjustment-window');await click('#filter-properties-close');
 assert.ok(await run("document.querySelector('.layer-row.active .layer-select').getBoundingClientRect().width>=120"),'Layers retain enough width for their names');
 const ids=await run("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)})()");assert.deepEqual(ids,[],'Moving controls never duplicates IDs');
 for(const theme of ['dark','light']){if(await run('document.documentElement.dataset.theme')!==theme){await click('#endo-theme-toggle');await key('Escape');}await click('#brush-options-bar [data-open-color=primary]');await capture(theme+'-color-popup');await click('#color-popover-cancel');await openBrush();await capture(theme+'-brush-popup');await click('#brush-popover-close');}
 await page.send('Emulation.setDeviceMetricsOverride',{width:1024,height:640,deviceScaleFactor:1,mobile:false});await click('#brush-options-bar [data-open-color=primary]');assert.equal(await run("(()=>{const r=document.querySelector('#color-popover').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()"),true);await click('#color-popover-cancel');
 console.log('PASS grouped image/paint adjustments, per-layer filter windows, icon controls, unique IDs and both themes at the minimum viewport');
}finally{
 page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
