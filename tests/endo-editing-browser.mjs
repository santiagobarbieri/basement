// Real Chrome, a temporary profile and an OPFS library. Never opens user files.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,extname} from 'node:path';

const root=resolve('dist'),temp=await mkdtemp('/private/tmp/basement-endo-editing-');
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
 const nativeDialogs=[],runtimeErrors=[];await page.send('Runtime.enable');
 page.onEvent=message=>{if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Page.javascriptDialogOpening'){nativeDialogs.push(message.params.type);page.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});}};
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
 const run=async expression=>{const r=await page.send('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<300;i++){try{if(await run(expression))return;}catch{}await delay(100);}throw Error('Timed out: '+expression+'; errors: '+runtimeErrors.join(' | ')+'; '+await run("JSON.stringify({url:location.href,status:document.querySelector('#local-status')?.textContent,feedback:document.querySelector('#export-feedback')?.textContent,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.textContent.slice(0,150))})"));};
 const click=async selector=>{
  const hiddenMenus=await run(`(()=>{let node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing control: '+${JSON.stringify(selector)});const ids=[];while(node){if(node.matches('[role=menu][hidden]'))ids.unshift(node.id);node=node.parentElement;}return ids;})()`);
  for(const id of hiddenMenus)await click(`[aria-controls="${id}"]`);
  const p=await run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'nearest'});const r=element.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden control: '+${JSON.stringify(selector)});return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await pointer('mousePressed',p,1);await pointer('mouseReleased',p,0);
 };
 const openMenu=async name=>{if(await run(`document.querySelector('[data-menu="${name}"]').getAttribute('aria-expanded')!=='true'`))await click(`[data-menu="${name}"]`);await wait(`!document.querySelector('[data-menu-panel="${name}"]').hidden`);};
 const pointer=(type,point,buttons)=>page.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons,clickCount:1});
 const key=async key=>{const codes={Escape:27,Enter:13,Tab:9,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Home:36,End:35};const code=key===' '?'Space':key;await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:codes[key]||0});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:codes[key]||0});};
 const closePopovers=async()=>{for(const [id,close]of [['color-popover','color-popover-cancel'],['brush-popover','brush-popover-close'],['filter-properties','filter-properties-close'],['artboard-panel','artboard-panel-close'],['layer-properties-panel','layer-properties-close']])if(await run(`!!document.querySelector('#${id}')&&!document.querySelector('#${id}').hidden`))await click('#'+close);};
 const inspect=async name=>{await closePopovers();if(name==='color'){await run("window.basementOpenColor('primary')");await wait("!document.querySelector('#color-popover').hidden");return;}if(name==='brush'){await run('window.basementOpenBrush()');await wait("!document.querySelector('#brush-popover').hidden");return;}if(name==='areas'){await run('window.basementOpenArtboards()');await wait("!document.querySelector('#artboard-panel').hidden");return;}if(name==='filters'||name==='adjustment'){await click('.layer-row.active [data-filter-open]');await wait("!document.querySelector('#filter-properties').hidden");return;}throw Error('Unknown panel '+name);};
 const openBrush=async()=>inspect('brush');
 const addAdjustment=async type=>{await closePopovers();await click('#add-adjustment');await wait("!document.querySelector('#adjustment-menu').hidden");await click(`#adjustment-menu [data-adjustment=${type}]`);await wait("!document.querySelector('#filter-properties').hidden");};
 const capture=async name=>{await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await delay(500);const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/private/tmp/basement-endo-editing-'+name+'.png',Buffer.from(data,'base64'));};
 await wait('window.basementSessionReady');
 await run(`(async()=>{localStorage.setItem('basement-theme','dark');const store=await import('/project-store.js');const root=await(await navigator.storage.getDirectory()).getDirectoryHandle('Endo Editing Test',{create:true});await store.connectProjectFolder(root);const state=await(await import('/hub/studios.js')).createInitial('endo');const legacy={format:'basement.ment',version:1,savedAt:new Date().toISOString(),artboard:{id:'endo-editing-test',name:'Editing studies',studio:'endo',width:960,height:850,layers:[{id:'cromo-1',type:'endo.cromo',strokes:[]}],settings:{infinite:true,scene:state.scene,defaults:state.defaults,tool:state.tool,nextNumber:1,frames:[]}}};const file=await root.getFileHandle('Editing studies--endo-editing-test.ment',{create:true}),writer=await file.createWritable();await writer.write(JSON.stringify(legacy));await writer.close();})()`);
 await page.send('Page.navigate',{url:origin+'/?project=endo-editing-test'});
 await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')&&!!window.basementStudioSession");
 const state=()=>run('window.basementStudioSession.capture().state');
 const signature=()=>run("(await import('/ment-format.js')).documentSignature(window.basementStudioSession.capture().state)");
 const settle=async()=>{await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await wait("!!document.querySelector('#artboard').dataset.frameQuality");};
 const field=async(selector,value,event='input')=>run(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});field.focus();field.value=${JSON.stringify(String(value))};field.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));${event==='input'?"field.dispatchEvent(new Event('change',{bubbles:true}));":''}field.blur();})()`);
 const shortcut=async(letter)=>{await run("document.querySelector('#artboard').focus()");for(const type of ['rawKeyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key:letter,code:'Key'+letter.toUpperCase(),windowsVirtualKeyCode:letter.toUpperCase().charCodeAt(0),modifiers:4});};
 const drag=async(a,b,steps=15)=>{await pointer('mousePressed',a,1);for(let i=1;i<=steps;i++){await pointer('mouseMoved',{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},1);await delay(8);}await pointer('mouseReleased',b,0);await settle();};
 await click('#zoom-fit');
 const view=await run("(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect(),s=window.basementStudioSession.capture().state;return{x:r.x,y:r.y,w:r.width,h:r.height,camera:s.view,frame:s.frames.find(f=>f.id===s.activeFrameId)};})()");
 const onFrame=(x,y)=>({x:view.x+view.camera.x+(view.frame.x+view.frame.width*x)*view.camera.scale,y:view.y+view.camera.y+(view.frame.y+view.frame.height*y)*view.camera.scale});
 const lineA=onFrame(.18,.37),lineB=onFrame(.7,.37);
 const center={x:(lineA.x+lineB.x)/2,y:lineA.y};
 const pixel=p=>run(`(()=>{const canvas=document.querySelector('#artboard'),r=canvas.getBoundingClientRect();return[...canvas.getContext('2d').getImageData(Math.round((${p.x}-r.x)*canvas.width/r.width),Math.round((${p.y}-r.y)*canvas.height/r.height),1,1).data];})()`);
 const activeId=()=>run('window.basementStudioSession.capture().state.activeLayerId');
 const selectLayer=async id=>{await click(`[data-layer-id="${id}"] .layer-select`);await wait(`window.basementStudioSession.capture().state.activeLayerId===${JSON.stringify(id)}`);};
 const palette=async hex=>{await inspect('color');await field('#color-hex',hex);await click('#color-popover-ok');await click('.cursor-modes button[data-mode=draw]');await key('Escape');};
 assert.equal((await state()).layers.length,1,'A legacy .ment starts with one editable layer');
 assert.equal((await state()).layers[0].id,'cromo-1','Legacy layer identity survives migration');
 const bottom=(await state()).layers[0].id;
 await inspect('brush');
 await field('#controls [data-control=width] input[type=number]',60);
 await field('#controls [data-control=variation] input[type=number]',0);
 await field('#controls [data-control=speed] input[type=number]',0);
 await palette('#dc1e3c');await drag(lineA,lineB);
 const bottomPixel=await pixel(center);assert.deepEqual(bottomPixel,[220,30,60,255]);
 await click('.cursor-modes button[data-mode=select]');await pointer('mousePressed',center,1);await pointer('mouseReleased',center,0);await wait("/Stroke 1 selected/.test(document.querySelector('#stroke-scope').textContent)");
 await inspect('color');await field('#color-hex','#33cc55');await settle();assert.deepEqual(await pixel(center),[51,204,85,255],'Editing a selected normal stroke recolors the actual raster');await click('#color-popover-cancel');await settle();assert.deepEqual(await pixel(center),bottomPixel,'Cancel restores the selected stroke raster');
 await inspect('color');await field('#color-hex','#33cc55');await click('#color-popover-ok');await settle();assert.deepEqual(await pixel(center),[51,204,85,255]);await click('#return');await settle();assert.deepEqual(await pixel(center),bottomPixel,'Undo restores a confirmed selected-stroke color');
 console.log('PASS selected normal paint recolors actual pixels with one Undo and full Cancel restoration');
 await click('#layer-add');await wait("!document.querySelector('#layer-properties-panel').hidden");await click('#new-layer-create');await wait('window.basementStudioSession.capture().state.layers.length===2');
 const top=await activeId();assert.notEqual(top,bottom);
 await palette('#2266dd');await drag(lineA,lineB);
 const topPixel=await pixel(center);assert.deepEqual(topPixel,[34,102,221,255],JSON.stringify({layers:(await state()).layers,strokes:(await state()).strokes.map(s=>({layerId:s.layerId,settings:s.settings,points:s.points.length})),activeLayerId:await activeId()}));
 const beforeErase=await signature();
 await key('e');assert.equal(await run("document.querySelector('#canvas-viewport').dataset.mode"),'erase');
 await drag({x:center.x,y:center.y-70},{x:center.x,y:center.y+70});
 assert.equal((await state()).strokes.at(-1).operation,'erase');assert.equal((await state()).strokes.at(-1).layerId,top);
 assert.deepEqual(await pixel(center),bottomPixel,'Partial erasure reveals the lower layer');
 assert.deepEqual(await pixel({x:lineA.x+60,y:center.y}),topPixel,'Erasure leaves the rest of the top stroke intact');
 await click('#return');await settle();assert.equal(await signature(),beforeErase);assert.deepEqual(await pixel(center),topPixel);
 console.log('PASS E erases partially on the active layer, reveals lower paint and Undo restores the original');

 // Layer controls must alter the visible composition, not just list metadata.
 await click(`[data-layer-id="${top}"] .layer-visibility`);await settle();assert.deepEqual(await pixel(center),bottomPixel);
 await click(`[data-layer-id="${top}"] .layer-visibility`);await settle();assert.deepEqual(await pixel(center),topPixel);
 await click('#layer-down');await settle();assert.deepEqual((await state()).layers.map(layer=>layer.id),[top,bottom]);assert.deepEqual(await pixel(center),bottomPixel);
 await click('#layer-up');await settle();assert.deepEqual(await pixel(center),topPixel);
 await field('#layer-opacity',50);await settle();const faded=await pixel(center);assert.equal(faded[3],255);assert.notDeepEqual(faded,topPixel);assert.notDeepEqual(faded,bottomPixel);
 await field('#layer-opacity',100);await settle();assert.deepEqual(await pixel(center),topPixel);
 await click(`[data-layer-id="${top}"] .layer-lock`);
 const lockedCount=(await state()).strokes.length;
 await click('.cursor-modes button[data-mode=draw]');await drag({x:lineA.x,y:center.y+150},{x:lineB.x,y:center.y+150});
 assert.equal((await state()).strokes.length,lockedCount,'Locked layers cannot be painted');
 await click('.cursor-modes button[data-mode=erase]');await drag({x:center.x,y:center.y-50},{x:center.x,y:center.y+50});
 assert.equal((await state()).strokes.length,lockedCount,'Locked layers cannot be erased');
 await click(`[data-layer-id="${top}"] .layer-lock`);
 const namePoint=await run(`(()=>{const r=document.querySelector('[data-layer-id="${top}"] .layer-name').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 for(const clickCount of [1,2]){await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...namePoint,button:'left',buttons:1,clickCount});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...namePoint,button:'left',buttons:0,clickCount});}
 await wait("!!document.querySelector('.layer-name-input')");
 await field('.layer-name-input','Top blue','input');await wait(`window.basementStudioSession.capture().state.layers.find(l=>l.id===${JSON.stringify(top)}).name==='Top blue'`);
 await click('#layer-duplicate');await wait('window.basementStudioSession.capture().state.layers.length===3');
 const copy=await activeId();assert.notEqual(copy,top);assert.equal((await state()).strokes.filter(stroke=>stroke.layerId===copy).length,1);
 await click('#layer-delete');await wait('window.basementStudioSession.capture().state.layers.length===2');assert.equal((await state()).strokes.some(stroke=>stroke.layerId===copy),false);
 await selectLayer(top);
 console.log('PASS Layers controls show/hide, reorder, opacity, lock, rename, duplicate and delete real editable content');

 // Marquee selects both stacked strokes while leaving a distant third untouched.
 await click('.cursor-modes button[data-mode=draw]');await key('Escape');
 const farA=onFrame(.73,.75),farB=onFrame(.87,.77);
 await drag(farA,farB);const beforeSelect=await state();assert.equal(beforeSelect.layers.length,2,'A third stroke reuses the manually selected layer');assert.equal(beforeSelect.strokes.filter(stroke=>stroke.layerId===top).length,2);
 await key('m');await drag({x:lineA.x-45,y:lineA.y-50},{x:lineB.x+45,y:lineB.y+50});
 assert.match(await run("document.querySelector('#stroke-scope').textContent"),/2 strokes selected/);
 await click('.cursor-modes button[data-mode=select]');
 await drag({x:center.x-80,y:center.y},{x:center.x-50,y:center.y+22});
 const moved=await state(),q=moved.view.scale;
 for(const index of [0,1]){assert.ok(Math.abs(moved.strokes[index].points[0].x-beforeSelect.strokes[index].points[0].x-30/q)<.1);assert.ok(Math.abs(moved.strokes[index].points[0].y-beforeSelect.strokes[index].points[0].y-22/q)<.1);}
 assert.deepEqual(moved.strokes[2].points,beforeSelect.strokes[2].points);
 await click('#return');await settle();assert.deepEqual((await state()).strokes.map(stroke=>stroke.points),beforeSelect.strokes.map(stroke=>stroke.points));
 const beforeCopy=(await state()).strokes.length;
 await shortcut('c');assert.equal(await run("document.querySelector('#paste-selection').disabled"),false);
 await shortcut('v');await settle();assert.equal((await state()).strokes.length,beforeCopy+2);
 assert.ok((await state()).strokes.slice(-2).every(stroke=>stroke.operation==='paint'));assert.equal(new Set((await state()).strokes.map(stroke=>stroke.number)).size,(await state()).strokes.length,'Copied strokes receive unique identifiers');
 await click('#return');await settle();assert.equal((await state()).strokes.length,beforeCopy);
 await shortcut('j');await settle();assert.equal((await state()).strokes.length,beforeCopy+2);
 await click('#return');await settle();assert.equal((await state()).strokes.length,beforeCopy);
 console.log('PASS marquee and drag move multiple strokes; Cmd/Ctrl C/V/J preserve selection and Undo');

 // Normal painting edits one paint color; material shades live in Blending Options.
 await click('.cursor-modes button[data-mode=draw]');await key('Escape');await inspect('color');
 assert.equal(await run("document.querySelector('#color-editing-role').textContent"),'Editing paint color','The color popup identifies the single paint color');
 const colorBefore=structuredClone((await state()).defaults),invalidBefore=await signature();
 await run("document.querySelector('#color-hex').focus(),document.querySelector('#color-hex').value='#zzzzzz',document.querySelector('#color-hex').dispatchEvent(new Event('input',{bubbles:true}))");
 assert.equal(await run("document.querySelector('#color-hex').getAttribute('aria-invalid')"),'true');assert.equal(await signature(),invalidBefore);
 await key('Escape');assert.equal(await run("document.querySelector('#color-popover').hidden"),true);assert.deepEqual((await state()).defaults,colorBefore,'Escape cancels an invalid color session');
 await inspect('color');await field('#color-hex','#20a060');const confirmed=(await state()).defaults;assert.equal(confirmed.primary,'#20a060');assert.equal(confirmed.shadow,colorBefore.shadow);assert.equal(confirmed.contrast,colorBefore.contrast);
 await click('#color-popover-ok');await click('#return');assert.deepEqual((await state()).defaults,colorBefore,'One Undo reverses a confirmed paint color');
 await inspect('color');await field('#color-hex','#c05080');const unlinked=(await state()).defaults;assert.equal(unlinked.primary,'#c05080');assert.equal(unlinked.shadow,colorBefore.shadow);assert.equal(unlinked.contrast,colorBefore.contrast);await capture('color');await click('#color-popover-ok');
 await inspect('color');await field('#color-h',45);await field('#color-s',80);await field('#color-v',70);assert.notEqual((await state()).defaults.primary,unlinked.primary);await click('#color-popover-cancel');assert.deepEqual((await state()).defaults,unlinked,'Cancel reverts live HSB edits');
 await inspect('color');await field('#color-hex','#00ff00');const count=(await state()).strokes.length;assert.equal(await run("document.elementFromPoint("+lineA.x+","+lineA.y+").id"),'artboard');await pointer('mousePressed',lineA,1);await pointer('mouseReleased',lineA,0);assert.equal((await state()).strokes.length,count,'Clicking the canvas closes Color without painting');assert.deepEqual((await state()).defaults,unlinked);
 console.log('PASS Color popup: exact HEX/HSB, invalid input, Cancel/Escape, independent paint color, one Undo per OK and canvas protection');

 // Blending edits take over the entire inspector and retain their controls/focus.
 await selectLayer(top);await click(`[data-layer-id="${top}"] .layer-more`);await click('#layer-context-menu [data-layer-command=blending]');
 await wait("document.querySelector('.shell-right').dataset.sidebarMode==='blending'");
 assert.equal(await run("getComputedStyle(document.querySelector('#panel-preview')).display"),'none');assert.equal(await run("getComputedStyle(document.querySelector('#panel-layers')).display"),'none');
 await click('[data-layer-material=cement]');await settle();assert.equal((await state()).layers.find(layer=>layer.id===top).blending.material,'cement');
 assert.equal(await run("document.querySelector('[data-layer-material=cement]').getAttribute('aria-pressed')"),'true');assert.equal(await run("document.querySelector('.layer-material-controls').hidden"),false);
 await field('[data-blending-value=roughness]',78);assert.equal((await state()).layers.find(layer=>layer.id===top).blending.roughness,78);
 await field('[data-blending-color=contrast]','#faf0cc');assert.equal((await state()).layers.find(layer=>layer.id===top).blending.contrast,'#faf0cc');
 await capture('blending-dark');await click('#endo-theme-toggle');await capture('blending-light');
 await page.send('Emulation.setDeviceMetricsOverride',{width:1024,height:640,deviceScaleFactor:1,mobile:false});await capture('blending-compact');
 assert.equal(await run("(()=>{const p=document.querySelector('#layer-properties-panel').getBoundingClientRect(),s=document.querySelector('.shell-right').getBoundingClientRect();return p.x===s.x&&p.width===s.width&&p.height>=s.height-1&&p.bottom<=innerHeight;})()"),true,'Blending uses the whole inspector column at compact sizes');
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});await click('#endo-theme-toggle');await click('#layer-blending-done');await wait("document.querySelector('#layer-properties-panel').hidden");
 assert.equal(await run("getComputedStyle(document.querySelector('#panel-preview')).display!=='none'&&getComputedStyle(document.querySelector('#panel-layers')).display!=='none'"),true);
 console.log('PASS layer Blending Options persist in the inspector, edit material/colors, and restore both fixed panels in dark/light/compact layouts');

 // Keep an editable eraser gesture in the final document; frame/adjustment
 // composition has its own focused browser test.
 await selectLayer(top);await click('.cursor-modes button[data-mode=erase]');
 await drag({x:center.x,y:center.y-45},{x:center.x,y:center.y+45});
 assert.equal((await state()).strokes.at(-1).operation,'erase');
 const beforeAdjustmentPaint=await signature(),layerCount=(await state()).layers.length;
 await addAdjustment('brightness');const adjustmentId=await activeId();await key('Escape');await click('.cursor-modes button[data-mode=draw]');await drag(farA,farB);
 const onAdjustment=await state(),newPaint=onAdjustment.layers.find(layer=>layer.id===onAdjustment.activeLayerId);
 assert.equal(onAdjustment.layers.length,layerCount+2);assert.equal(newPaint.kind,'paint');assert.equal(onAdjustment.layers.findIndex(layer=>layer.id===newPaint.id),onAdjustment.layers.findIndex(layer=>layer.id===adjustmentId)+1,'Painting on an adjustment creates one editable paint layer immediately above it');
 assert.equal(onAdjustment.strokes.at(-1).layerId,newPaint.id);await click('#return');assert.equal((await state()).layers.length,layerCount+1,'One Undo removes the stroke and its automatically created layer together');await click('#return');assert.equal(await signature(),beforeAdjustmentPaint);
 console.log('PASS repeated paint reuses the active layer; painting on an adjustment creates one new layer with atomic Undo');
 await inspect('color');await capture('color');await click('#color-popover-cancel');
 const finalSignature=await signature(),finalState=await state();await click('.folder-studio-tools [data-studio-save]');await wait('!window.basementStudioSession.dirty()');
 assert.equal(await run("(await import('/ment-format.js')).documentSignature((await(await import('/project-store.js')).getProject('endo-editing-test')).state)"),finalSignature);
 await run(`(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});window.testDownloads=[];const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.testDownloads.push({name:this.download,url:this.href});return;}return original.call(this);};})()`);
 await click('#export');await click('#export-ment');await wait('window.testDownloads.length===1');
 const ment=await run("fetch(window.testDownloads[0].url).then(r=>r.json())");
 assert.equal(ment.version,2);assert.equal(ment.artboard.settings.frameVersion,1);assert.deepEqual(ment.artboard.settings.frames,finalState.frames);assert.equal(ment.artboard.layers.length,finalState.layers.length);
 assert.ok(ment.artboard.layers.every(layer=>layer.frameId===finalState.activeFrameId));
 assert.ok(ment.artboard.layers.flatMap(layer=>layer.strokes).some(stroke=>stroke.operation==='erase'),'Portable .ment keeps the editable eraser gesture');
 await click('.main-page-link');await wait("location.pathname==='/hub/'&&!!document.querySelector('#project-list')");
 await page.send('Page.navigate',{url:origin+'/?project=endo-editing-test'});await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')");await settle();
 assert.equal(await signature(),finalSignature,'Reopening preserves the legacy frame, layers, colors and editable erasing');
 assert.deepEqual((await state()).strokes.map(stroke=>stroke.points),finalState.strokes.map(stroke=>stroke.points));
 assert.deepEqual(nativeDialogs,[],'Editing, saving and reopening never show a browser leave prompt');
 console.log('PASS v1 legacy content saves as a portable v2 frame document and reopens with layers, colors and erasing intact');
 console.log('PASS Endo editing tools and persistence in isolated Chrome/OPFS');
}finally{
 page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
