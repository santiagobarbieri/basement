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
 const nativeDialogs=[];
 page.onEvent=message=>{if(message.method==='Page.javascriptDialogOpening'){nativeDialogs.push(message.params.type);page.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});}};
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
 const run=async expression=>{const r=await page.send('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<300;i++){try{if(await run(expression))return;}catch{}await delay(100);}throw Error('Timed out: '+expression+'; '+await run("JSON.stringify({url:location.href,status:document.querySelector('#local-status')?.textContent,feedback:document.querySelector('#export-feedback')?.textContent,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.textContent.slice(0,150))})"));};
 const click=async selector=>{const p=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await pointer('mousePressed',p,1);await pointer('mouseReleased',p,0);};
 const pointer=(type,point,buttons)=>page.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons,clickCount:1});
 const key=async key=>{const codes={Escape:27,Enter:13,Tab:9,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Home:36,End:35};const code=key===' '?'Space':key;await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:codes[key]||0});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:codes[key]||0});};
 const inspect=async name=>{await click(`[data-inspector-tab=${name}]`);await wait(`document.querySelector('[data-inspector-tab=${name}]').getAttribute('aria-selected')==='true'&&!document.querySelector('[data-inspector-panel=${name}]').hidden`);};
 const capture=async name=>{await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await delay(500);const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/private/tmp/basement-endo-editing-'+name+'.png',Buffer.from(data,'base64'));};
 await wait('window.basementSessionReady');
 await run(`(async()=>{localStorage.setItem('basement-theme','dark');const store=await import('/project-store.js');const root=await(await navigator.storage.getDirectory()).getDirectoryHandle('Endo Editing Test',{create:true});await store.connectProjectFolder(root);const state=await(await import('/hub/studios.js')).createInitial('endo');const legacy={format:'basement.ment',version:1,savedAt:new Date().toISOString(),artboard:{id:'endo-editing-test',name:'Editing studies',studio:'endo',width:960,height:850,layers:[{id:'cromo-1',type:'endo.cromo',strokes:[]}],settings:{infinite:true,scene:state.scene,defaults:state.defaults,tool:state.tool,nextNumber:1,frames:[]}}};const file=await root.getFileHandle('Editing studies--endo-editing-test.ment',{create:true}),writer=await file.createWritable();await writer.write(JSON.stringify(legacy));await writer.close();})()`);
 await page.send('Page.navigate',{url:origin+'/?project=endo-editing-test'});
 await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')&&!!window.basementStudioSession");
 const state=()=>run('window.basementStudioSession.capture().state');
 const signature=()=>run("(await import('/ment-format.js')).documentSignature(window.basementStudioSession.capture().state)");
 const settle=async()=>{await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await wait("getComputedStyle(document.querySelector('#resolution-view')).opacity==='1'");};
 const field=async(selector,value,event='input')=>run(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});field.focus();field.value=${JSON.stringify(String(value))};field.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));${event==='input'?"field.dispatchEvent(new Event('change',{bubbles:true}));":''}field.blur();})()`);
 const shortcut=async(letter)=>{await run("document.querySelector('#artboard').focus()");for(const type of ['rawKeyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key:letter,code:'Key'+letter.toUpperCase(),windowsVirtualKeyCode:letter.toUpperCase().charCodeAt(0),modifiers:4});};
 const drag=async(a,b,steps=15)=>{await pointer('mousePressed',a,1);for(let i=1;i<=steps;i++){await pointer('mouseMoved',{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},1);await delay(8);}await pointer('mouseReleased',b,0);await settle();};
 const view=await run("(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()");
 const lineA={x:view.x+view.w*.28,y:view.y+view.h*.37},lineB={x:view.x+view.w*.64,y:lineA.y};
 const center={x:(lineA.x+lineB.x)/2,y:lineA.y};
 const pixel=p=>run(`(()=>{const canvas=document.querySelector('#artboard'),r=canvas.getBoundingClientRect();return[...canvas.getContext('2d').getImageData(Math.round((${p.x}-r.x)*canvas.width/r.width),Math.round((${p.y}-r.y)*canvas.height/r.height),1,1).data];})()`);
 const activeId=()=>run('window.basementStudioSession.capture().state.activeLayerId');
 const selectLayer=async id=>{await click(`[data-layer-id="${id}"] .layer-select`);await wait(`window.basementStudioSession.capture().state.activeLayerId===${JSON.stringify(id)}`);};
 const palette=async hex=>{await inspect('color');for(const role of ['primary','contrast','shadow']){await click(`[data-color=${role}]`);await field('#color-hex',hex);}await click('[data-mode=draw]');await key('Escape');};
 assert.equal((await state()).layers.length,1,'A legacy .ment starts with one editable layer');
 assert.equal((await state()).layers[0].id,'cromo-1','Legacy layer identity survives migration');
 const bottom=(await state()).layers[0].id;
 await inspect('brush');await run("document.querySelector('.scene-card').open=true");
 await field('#scene-controls [data-control=grain] input[type=number]',0);
 await field('#controls [data-control=width] input[type=number]',60);
 await field('#controls [data-control=variation] input[type=number]',0);
 await field('#controls [data-control=speed] input[type=number]',0);
 await palette('#dc1e3c');await drag(lineA,lineB);
 const bottomPixel=await pixel(center);assert.deepEqual(bottomPixel,[220,30,60,255]);
 await click('#layer-add');await wait('window.basementStudioSession.capture().state.layers.length===2');
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
 await click('[data-mode=draw]');await drag({x:lineA.x,y:center.y+150},{x:lineB.x,y:center.y+150});
 assert.equal((await state()).strokes.length,lockedCount,'Locked layers cannot be painted');
 await click('[data-mode=erase]');await drag({x:center.x,y:center.y-50},{x:center.x,y:center.y+50});
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
 await click('[data-mode=draw]');await key('Escape');
 const farA={x:view.x+view.w*.73,y:view.y+view.h*.67},farB={x:farA.x+80,y:farA.y+10};
 await drag(farA,farB);const beforeSelect=await state();
 await key('m');await drag({x:lineA.x-45,y:lineA.y-50},{x:lineB.x+45,y:lineB.y+50});
 assert.match(await run("document.querySelector('#stroke-scope').textContent"),/2 strokes selected/);
 await click('[data-mode=select]');
 await drag({x:center.x-80,y:center.y},{x:center.x-50,y:center.y+22});
 const moved=await state(),q=moved.view.scale;
 for(const index of [0,1]){assert.ok(Math.abs(moved.strokes[index].points[0].x-beforeSelect.strokes[index].points[0].x-30/q)<.1);assert.ok(Math.abs(moved.strokes[index].points[0].y-beforeSelect.strokes[index].points[0].y-22/q)<.1);}
 assert.deepEqual(moved.strokes[2].points,beforeSelect.strokes[2].points);
 await click('#return');await settle();assert.deepEqual((await state()).strokes.map(stroke=>stroke.points),beforeSelect.strokes.map(stroke=>stroke.points));
 const beforeCopy=(await state()).strokes.length;
 await shortcut('c');assert.equal(await run("document.querySelector('#paste-selection').disabled"),false);
 await shortcut('v');await settle();assert.equal((await state()).strokes.length,beforeCopy+2);
 assert.ok((await state()).strokes.slice(-2).every(stroke=>stroke.layerId===top));
 await click('#return');await settle();assert.equal((await state()).strokes.length,beforeCopy);
 await shortcut('j');await settle();assert.equal((await state()).strokes.length,beforeCopy+2);
 await click('#return');await settle();assert.equal((await state()).strokes.length,beforeCopy);
 console.log('PASS marquee and drag move multiple strokes; Cmd/Ctrl C/V/J preserve selection and Undo');

 // Color controls distinguish base, highlights and shadow and commit one history step.
 await click('[data-mode=draw]');await key('Escape');await inspect('color');await click('[data-color=primary]');
 assert.equal(await run("document.querySelector('#color-active-name').textContent"),'Base color');
 const colorBefore=structuredClone((await state()).defaults),invalidBefore=await signature();
 await run("document.querySelector('#color-hex').focus(),document.querySelector('#color-hex').value='#zzzzzz',document.querySelector('#color-hex').dispatchEvent(new Event('input',{bubbles:true}))");
 assert.equal(await run("document.querySelector('#color-hex').getAttribute('aria-invalid')"),'true');assert.equal(await signature(),invalidBefore);
 await key('Escape');assert.equal(await run("document.querySelector('#color-hex').hasAttribute('aria-invalid')"),false);
 if(!await run("document.querySelector('#color-link').checked"))await click('#color-link');
 await field('#color-hex','#20a060');const linked=(await state()).defaults;assert.equal(linked.primary,'#20a060');assert.notEqual(linked.shadow,colorBefore.shadow);assert.notEqual(linked.contrast,colorBefore.contrast);
 await click('#return');assert.deepEqual((await state()).defaults,colorBefore,'One Undo reverses base, light and shadow together');
 await click('#color-link');assert.equal(await run("document.querySelector('#color-link').checked"),false);
 await field('#color-hex','#c05080');const unlinked=(await state()).defaults;assert.equal(unlinked.primary,'#c05080');assert.equal(unlinked.shadow,colorBefore.shadow);assert.equal(unlinked.contrast,colorBefore.contrast);
 await capture('color');
 await click('[data-color=contrast]');await field('#color-hex','#faf0cc');assert.equal((await state()).defaults.contrast,'#faf0cc');
 await click('#return');assert.deepEqual((await state()).defaults,unlinked,'A manual Light edit is one independent undo step');
 await click('[data-color=shadow]');await field('#color-hex','#112233');assert.equal((await state()).defaults.shadow,'#112233');
 await click('#return');assert.deepEqual((await state()).defaults,unlinked,'A manual Shadow edit is one independent undo step');
 console.log('PASS Base/Light/Shadow explanations, exact HEX, invalid input, linked tones and independent color history');

 // Repetition regions are chosen in document coordinates and stay editable.
 await inspect('symmetry');await key('r');assert.equal(await run("document.querySelector('#canvas-viewport').dataset.mode"),'repeat-region');
 const regionA={x:view.x+view.w*.17,y:view.y+view.h*.55},regionB={x:regionA.x+260,y:regionA.y+180};
 await drag(regionA,regionB);let region=(await state()).tool.region;assert.ok(region.width>100&&region.height>100);
 const firstRegion={...region};await key('r');await drag({x:regionA.x+90,y:regionA.y+70},{x:regionA.x+115,y:regionA.y+85});
 region=(await state()).tool.region;assert.ok(Math.abs(region.x-firstRegion.x-25/(await state()).view.scale)<.1);assert.equal(region.width,firstRegion.width);
 await field('#repeat-x',125,'change');await field('#repeat-y',420,'change');await field('#repeat-width',300,'change');await field('#repeat-height',180,'change');
 assert.deepEqual((await state()).tool.region,{x:125,y:420,width:300,height:180});
 await click('[data-tool=mirror]');await field('#tool-axes','vertical','change');
 await capture('repeat');
 const drawingView=(await state()).view;
 const worldPoint=(x,y)=>({x:view.x+drawingView.x+x*drawingView.scale,y:view.y+drawingView.y+y*drawingView.scale});
 const repeatCount=(await state()).strokes.length;await click('[data-mode=draw]');await key('Escape');await drag(worldPoint(165,455),worldPoint(190,495));
 assert.equal((await state()).strokes.length,repeatCount+1);const repeated=(await state()).strokes.at(-1);assert.equal(repeated.tool.mode,'mirror');assert.deepEqual(repeated.tool.region,{x:125,y:420,width:300,height:180});
 const sample=await pixel(worldPoint(165,455)),mirrorSample=await pixel(worldPoint(385,455));assert.ok(sample[3]>0&&mirrorSample[3]>0,'Mirrored stroke appears inside the chosen off-center region');
 assert.equal((await pixel(worldPoint(120,455)))[3],0,'Repetition never paints beyond its region');
 await field('#repeat-x',500,'change');assert.equal((await state()).strokes.at(-1).tool.region.x,125,'Editing the next region leaves existing artwork unchanged');
 await click('[data-tool=mirror]');
 console.log('PASS R draws and moves repetition regions; numeric edits place off-center mirror copies and preserve existing strokes');

 // Filters visibly change just the active layer and remain editable after saving.
 await selectLayer(top);await inspect('filters');
 await field('#filter-type','threshold','change');await click('#add-filter');await settle();
 let filters=(await state()).layers.find(layer=>layer.id===top).filters;const threshold=filters[0].id;
 await field(`[data-filter-id="${threshold}"] input[type=range]`,255);await settle();assert.deepEqual((await pixel(center)).slice(0,3),[0,0,0]);
 await click(`[data-filter-id="${threshold}"] input[type=checkbox]`);await settle();assert.deepEqual(await pixel(center),topPixel);
 await field('#filter-type','dither','change');await click('#add-filter');await settle();
 filters=(await state()).layers.find(layer=>layer.id===top).filters;const dither=filters[1].id;
 await field(`[data-filter-id="${dither}"] input[aria-label="Dither pattern size"]`,3);await settle();
 const pattern=await run(`(()=>{const canvas=document.querySelector('#artboard'),r=canvas.getBoundingClientRect(),data=canvas.getContext('2d').getImageData(Math.round(${center.x}-r.x)-15,Math.round(${center.y}-r.y)-10,30,20).data;const colors=new Set();for(let i=0;i<data.length;i+=4)if(data[i+3]===255)colors.add([data[i],data[i+1],data[i+2]].join(','));return [...colors];})()`);
 assert.ok(pattern.includes('0,0,0')&&pattern.includes('255,255,255'),'Dither creates both black and white pattern cells');
 await field('#filter-type','invert','change');await click('#add-filter');await settle();assert.equal((await state()).layers.find(layer=>layer.id===top).filters.length,3);
 await click('#filter-list button[aria-label="Remove Invert"]');await settle();assert.equal((await state()).layers.find(layer=>layer.id===top).filters.length,2);
 await click(`[data-filter-id="${dither}"] input[type=checkbox]`);await settle();assert.deepEqual(await pixel(center),topPixel);
 await click(`[data-filter-id="${dither}"] input[type=checkbox]`);await settle();
 await click('[data-mode=erase]');await drag({x:farA.x+35,y:farA.y-25},{x:farA.x+35,y:farA.y+25});
 assert.equal((await state()).strokes.at(-1).operation,'erase');
 await inspect('filters');await capture('filters');
 const finalSignature=await signature(),finalState=await state();await click('.folder-studio-tools [data-studio-save]');await wait('!window.basementStudioSession.dirty()');
 assert.equal(await run("(await import('/ment-format.js')).documentSignature((await(await import('/project-store.js')).getProject('endo-editing-test')).state)"),finalSignature);
 await run(`(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});window.testDownloads=[];const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.testDownloads.push({name:this.download,url:this.href});return;}return original.call(this);};})()`);
 await click('#export');await click('#export-ment');await wait('window.testDownloads.length===1');
 const ment=await run("fetch(window.testDownloads[0].url).then(r=>r.json())");
 assert.equal(ment.artboard.layers.length,2);assert.deepEqual(ment.artboard.layers.find(layer=>layer.id===top).filters,finalState.layers.find(layer=>layer.id===top).filters);
 assert.ok(ment.artboard.layers.flatMap(layer=>layer.strokes).some(stroke=>stroke.tool.region));
 assert.ok(ment.artboard.layers.flatMap(layer=>layer.strokes).some(stroke=>stroke.operation==='erase'),'Portable .ment keeps the editable eraser gesture');
 await click('.main-page-link');await wait("location.pathname==='/hub/'&&!!document.querySelector('#project-list')");
 await page.send('Page.navigate',{url:origin+'/?project=endo-editing-test'});await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')");await settle();
 assert.equal(await signature(),finalSignature,'Reopening preserves every layer, filter, color and repetition region');
 assert.deepEqual((await state()).strokes.map(stroke=>stroke.points),finalState.strokes.map(stroke=>stroke.points));
 assert.deepEqual(nativeDialogs,[],'Editing, saving and reopening never show a browser leave prompt');
 console.log('PASS Threshold/Dither adjust, toggle and remove visually; Save, portable .ment and reopen retain complete editable state');
 console.log('PASS Endo editing tools and persistence in isolated Chrome/OPFS');
}finally{
 page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
