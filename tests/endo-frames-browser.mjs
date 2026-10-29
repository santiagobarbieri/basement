// Real Chrome, a temporary profile and an OPFS library. Never opens user files.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,extname} from 'node:path';

const root=resolve('dist'),temp=await mkdtemp('/private/tmp/basement-endo-frames-');
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
 const click=async selector=>{const parent=await run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing '+${JSON.stringify(selector)});const menus=[];for(let p=element.parentElement;p;p=p.parentElement)if(p.getAttribute('role')==='menu'&&p.hidden&&p.id)menus.unshift(p.id);return menus.map(id=>document.querySelector('[aria-controls="'+id+'"]')?.id).find(Boolean)||null;})()`);if(parent)await click('#'+parent);const p=await run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'nearest',inline:'nearest'});const r=element.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await pointer('mousePressed',p,1);await pointer('mouseReleased',p,0);};
 const pointer=(type,point,buttons,modifiers=0)=>page.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons,clickCount:1,modifiers});
 const key=async (key,modifiers=0)=>{const codes={Escape:27,Enter:13,Tab:9,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Home:36,End:35};const code=key===' '?'Space':key;await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:codes[key]||0,modifiers});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:codes[key]||0,modifiers});};
 const closePopovers=async()=>{for(const [id,close]of [['color-popover','color-popover-cancel'],['brush-popover','brush-popover-close'],['filter-properties','filter-properties-close'],['artboard-panel','artboard-panel-close'],['layer-properties-panel','layer-properties-close']])if(await run(`!!document.querySelector('#${id}')&&!document.querySelector('#${id}').hidden`))await click('#'+close);};
 const inspect=async name=>{await closePopovers();if(name==='color'){await run("window.basementOpenColor('primary')");await wait("!document.querySelector('#color-popover').hidden");return;}if(name==='brush'){await run('window.basementOpenBrush()');await wait("!document.querySelector('#brush-popover').hidden");return;}if(name==='areas'){await run('window.basementOpenArtboards()');await wait("!document.querySelector('#artboard-panel').hidden");return;}if(name==='filters'||name==='adjustment'){await click('.layer-row.active [data-filter-open]');await wait("!document.querySelector('#filter-properties').hidden");return;}throw Error('Unknown panel '+name);};
 const openBrush=async()=>inspect('brush');
 const addAdjustment=async type=>{await closePopovers();await click('#add-adjustment');await wait("!document.querySelector('#adjustment-menu').hidden");await click(`#adjustment-menu [data-adjustment=${type}]`);await wait("!document.querySelector('#filter-properties').hidden");};
 const capture=async name=>{await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await delay(500);const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/private/tmp/basement-endo-frames-'+name+'.png',Buffer.from(data,'base64'));};
 await wait('window.basementSessionReady');
 await run(`(async()=>{localStorage.setItem('basement-theme','dark');const store=await import('/project-store.js');const root=await(await navigator.storage.getDirectory()).getDirectoryHandle('Endo Frames Test',{create:true});await store.connectProjectFolder(root);const state=await(await import('/hub/studios.js')).createInitial('endo');const legacy={format:'basement.ment',version:1,savedAt:new Date().toISOString(),artboard:{id:'endo-frames-test',name:'Frame studies',studio:'endo',width:960,height:850,layers:[{id:'cromo-1',type:'endo.cromo',strokes:[]}],settings:{infinite:true,scene:state.scene,defaults:state.defaults,tool:state.tool,nextNumber:1,frames:[]}}};const file=await root.getFileHandle('Frame studies--endo-frames-test.ment',{create:true}),writer=await file.createWritable();await writer.write(JSON.stringify(legacy));await writer.close();})()`);
 await page.send('Page.navigate',{url:origin+'/?project=endo-frames-test'});
 await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')&&!!window.basementStudioSession");

 const state=()=>run('window.basementStudioSession.capture().state');
 const signature=()=>run("(await import('/ment-format.js')).documentSignature(window.basementStudioSession.capture().state)");
 const settle=async()=>{await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await delay(120);};
 const field=async(selector,value,event='input')=>{await run(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});field.focus();field.value=${JSON.stringify(String(value))};field.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));${event==='input'?"field.dispatchEvent(new Event('change',{bubbles:true}));":''}field.blur();})()`);await settle();};
 const drag=async(a,b,steps=12)=>{await pointer('mousePressed',a,1);for(let i=1;i<=steps;i++){await pointer('mouseMoved',{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},1);await delay(8);}await pointer('mouseReleased',b,0);await settle();};
 const world=async(x,y)=>run(`(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect(),v=window.basementStudioSession.capture().state.view;return{x:r.x+v.x+${x}*v.scale,y:r.y+v.y+${y}*v.scale};})()`);
 const draw=async(a,b)=>{await click('.cursor-modes button[data-mode=draw]');await drag(await world(a.x,a.y),await world(b.x,b.y));};
 const pixel=async(x,y)=>{const p=await world(x,y);return run(`(()=>{const canvas=document.querySelector('#artboard'),r=canvas.getBoundingClientRect();return[...canvas.getContext('2d').getImageData(Math.max(0,Math.min(canvas.width-1,Math.round((${p.x}-r.x)*canvas.width/r.width))),Math.max(0,Math.min(canvas.height-1,Math.round((${p.y}-r.y)*canvas.height/r.height))),1,1).data];})()`);};
 const palette=async hex=>{await inspect('color');await field('#color-hex',hex);await click('#color-popover-ok');await click('.cursor-modes button[data-mode=draw]');await key('Escape');};
 const frameUi=async()=>inspect('areas');
 const currentFrame=async()=>{const s=await state();return s.frames.find(frame=>frame.id===s.activeFrameId);};
 const selectFrame=async id=>{await frameUi();await field('#active-frame-select',id,'change');await wait(`window.basementStudioSession.capture().state.activeFrameId===${JSON.stringify(id)}`);await click('#zoom-fit');await settle();};
 const quality=()=>run(`(()=>{const element=document.querySelector('#artboard'),view=document.querySelector('#canvas-viewport');const raw=element.dataset.frameQuality||view.dataset.frameQuality;return raw?JSON.parse(raw):null;})()`);
 const rgbNear=(actual,expected,message)=>{for(let i=0;i<3;i++)assert.ok(Math.abs(actual[i]-expected[i])<4,message+': '+JSON.stringify(actual));assert.equal(actual[3],255,message+' alpha');};
 const initial=await state();assert.equal(initial.frameVersion,1);assert.ok(initial.frames.length>=1,'An old document acquires a finite frame');
 const first=initial.activeFrameId;assert.ok(initial.layers.every(layer=>layer.frameId===first));
 await frameUi();
 await field('#frame-width',640,'change');await field('#frame-height',480,'change');await field('#frame-x',100,'change');await field('#frame-y',100,'change');await field('#frame-name','Frame one','change');
 await click('#zoom-fit');await settle();
 let frame=await currentFrame();assert.equal(frame.width,640);assert.equal(frame.height,480);assert.equal(frame.name,'Frame one');
 await inspect('brush');
 await field('#controls [data-control=width] input[type=number]',40);
 await field('#controls [data-control=variation] input[type=number]',0);
 await field('#controls [data-control=speed] input[type=number]',0);
 await palette('#dc1e3c');
 const a={x:frame.x+100,y:frame.y+160},b={x:frame.x+450,y:a.y},center={x:(a.x+b.x)/2,y:a.y};
 const beforeOutside=(await state()).strokes.length;
 await draw({x:frame.x-30,y:frame.y+80},{x:frame.x+60,y:frame.y+80});
 assert.equal((await state()).strokes.length,beforeOutside,'A gesture starting outside every frame creates no paint');
 await draw(a,b);const redStroke=(await state()).strokes.at(-1),redLayer=redStroke.layerId;
 rgbNear(await pixel(center.x,center.y),[220,30,60],'The active frame displays its red stroke');
 await draw({x:frame.x+580,y:frame.y+300},{x:frame.x+710,y:frame.y+300});assert.equal((await state()).strokes.at(-1).layerId,redLayer,'Painting reuses the active layer across gestures');
 assert.ok((await pixel(frame.x+625,frame.y+300))[3]>200,'Crossing stroke paints inside the frame');
 assert.equal((await pixel(frame.x+645,frame.y+300))[3],0,'Crossing stroke is clipped at the fixed frame boundary');
 await click('#layer-add');await wait("!document.querySelector('#layer-properties-panel').hidden");await click('#new-layer-create');await palette('#2266dd');await draw(a,b);const blueStroke=(await state()).strokes.at(-1),blueLayer=blueStroke.layerId;
 assert.notEqual(blueLayer,redLayer,'A manually created layer lets adjustments be interleaved between paint layers');
 rgbNear(await pixel(center.x,center.y),[34,102,221],'The new blue stroke covers the red stroke');
 console.log('PASS real drawing is confined to finite frames, including gestures crossing a frame edge');

 await frameUi();await click('#frame-add');await wait('window.basementStudioSession.capture().state.frames.length===2');
 const second=(await state()).activeFrameId;assert.notEqual(second,first);
 await field('#frame-width',320,'change');await field('#frame-height',240,'change');await field('#frame-x',950,'change');await field('#frame-y',100,'change');await field('#frame-name','Frame two','change');await click('#zoom-fit');await settle();
 const secondFrame=await currentFrame();await palette('#229966');
 const greenA={x:secondFrame.x+40,y:secondFrame.y+100},greenB={x:secondFrame.x+260,y:greenA.y},greenCenter={x:(greenA.x+greenB.x)/2,y:greenA.y};
 await draw(greenA,greenB);const greenStroke=(await state()).strokes.at(-1),greenLayer=greenStroke.layerId;
 assert.equal((await state()).layers.find(layer=>layer.id===greenLayer).frameId,second);
 rgbNear(await pixel(greenCenter.x,greenCenter.y),[34,153,102],'The second frame has independent green content');
 assert.ok(await run(`Array.from(document.querySelectorAll('#layer-list [data-layer-id]')).every(row=>window.basementStudioSession.capture().state.layers.find(layer=>layer.id===row.dataset.layerId).frameId===${JSON.stringify(second)})`),'Layers lists only the active frame');
 let qualityInfo=await quality();assert.ok(qualityInfo,'Rendering exposes the actual per-frame raster quality');
 const entries=Array.isArray(qualityInfo)?qualityInfo:Object.entries(qualityInfo).map(([id,item])=>({id,...item}));
 const entry=(list,id)=>list.find(item=>(item.id||item.frameId)===id);
 const area=item=>(item.width??item.rasterWidth??item.pixelWidth)*(item.height??item.rasterHeight??item.pixelHeight);
 const longSide=item=>Math.max(item.width??item.rasterWidth??item.pixelWidth,item.height??item.rasterHeight??item.pixelHeight);
 assert.ok(area(entry(entries,second))>area(entry(entries,first)),'Only the edited frame retains a larger working raster');
 assert.ok(longSide(entry(entries,first))<=160,'Inactive frames are limited to thumbnails');
 await selectFrame(first);
 qualityInfo=await quality();const switched=Array.isArray(qualityInfo)?qualityInfo:Object.entries(qualityInfo).map(([id,item])=>({id,...item}));
 assert.ok(area(entry(switched,first))>area(entry(switched,second)));assert.ok(longSide(entry(switched,second))<=160);
 console.log('PASS frames own their layers; switching active frames lowers the previous frame to a small thumbnail');

 await addAdjustment('invert');await settle();
 let adjustment=(await state()).layers.find(layer=>layer.kind==='adjustment'&&layer.filter.type==='invert');assert.ok(adjustment);assert.equal(adjustment.frameId,first);
 await wait("!document.querySelector('#filter-properties').hidden");assert.equal(await run("document.querySelector('#panel-settings')===null"),true,'Each adjustment opens its own properties without a Settings panel');
 assert.match(await run("document.querySelector('#filter-properties-title').textContent"),/Invert/);
 rgbNear(await pixel(center.x,center.y),[221,153,34],'Adjustment layers filter all content below them in their frame');
 await key('Escape');assert.equal(await run("document.querySelector('#filter-properties').hidden"),true,'Escape closes the individual adjustment window');
 await click('#layer-down');await settle();
 const local=(await state()).layers.filter(layer=>layer.frameId===first);assert.ok(local.findIndex(layer=>layer.id===adjustment.id)<local.findIndex(layer=>layer.id===blueLayer));
 rgbNear(await pixel(center.x,center.y),[34,102,221],'Moving an adjustment below the blue stroke leaves that stroke unfiltered');
 await selectFrame(second);rgbNear(await pixel(greenCenter.x,greenCenter.y),[34,153,102],'An adjustment never leaks into another frame');
 await selectFrame(first);
 // Exercise the same drag/drop events the visible layer list receives from the browser.
 await closePopovers();await run(`(()=>{const source=document.querySelector('[data-layer-id="${adjustment.id}"]'),target=document.querySelector('[data-layer-id="${blueLayer}"]'),data=new DataTransfer(),r=target.getBoundingClientRect();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data,clientY:r.top+2}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientY:r.top+2}));})()`);await settle();
 rgbNear(await pixel(center.x,center.y),[221,153,34],'Dragging an adjustment back above a stroke changes its pixels');
 await click(`[data-layer-id="${adjustment.id}"] [data-filter-open]`);await wait("!document.querySelector('#filter-properties').hidden");
 await click('[data-filter-preview]');await settle();rgbNear(await pixel(center.x,center.y),[34,102,221],'Preview toggle disables the adjustment non-destructively');
 await key('Escape');
 await addAdjustment('threshold');
 const threshold=(await state()).layers.filter(layer=>layer.kind==='adjustment'&&layer.filter.type==='threshold').at(-1);
 await field('#filter-list [data-filter-parameter=amount]',255);rgbNear(await pixel(center.x,center.y),[0,0,0],'Threshold properties update the frame live');
 await field('#filter-list [data-filter-value=amount]',0);rgbNear(await pixel(center.x,center.y),[255,255,255],'Numeric Threshold control uses the same live effect');
 await click('[data-filter-preview]');await settle();
 await click('#project-title');assert.equal(await run("document.querySelector('#filter-properties').hidden"),true,'An outside click closes the adjustment window without removing its effect');
 await addAdjustment('dither');
 await field('#filter-list [data-filter-parameter=scale]',3);
 const patch=await run(`(()=>{const v=window.basementStudioSession.capture().state.view,r=document.querySelector('#canvas-viewport').getBoundingClientRect(),canvas=document.querySelector('#artboard'),c=canvas.getContext('2d'),x=Math.round(v.x+${center.x}*v.scale),y=Math.round(v.y+${center.y}*v.scale),pixels=c.getImageData(x-15,y-10,30,20).data;let min=255,max=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>200){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);}}return{min,max};})()`);
 assert.ok(patch.min<80&&patch.max>175,'Dither properties produce a visible tonal pattern');
 await capture('adjustment-window');await key('Escape');
 console.log('PASS adjustment layers reorder among paint, affect only lower content in their frame, and expose individual adjustment properties windows');

 await frameUi();let beforeMove=await state();frame=beforeMove.frames.find(item=>item.id===first);
 await field('#frame-x',frame.x+35,'change');await field('#frame-y',frame.y+25,'change');let afterMove=await state();
 const firstLayerIds=new Set(beforeMove.layers.filter(layer=>layer.frameId===first).map(layer=>layer.id));
 for(const prior of beforeMove.strokes){const after=afterMove.strokes.find(stroke=>stroke.number===prior.number);if(firstLayerIds.has(prior.layerId)){assert.ok(Math.abs(after.points[0].x-prior.points[0].x-35)<.001);assert.ok(Math.abs(after.points[0].y-prior.points[0].y-25)<.001);}else assert.deepEqual(after.points,prior.points);}
 const beforeResize=structuredClone(afterMove.strokes);
 await field('#frame-width',320,'change');await field('#frame-height',320,'change');
 assert.deepEqual((await state()).strokes,beforeResize,'Resizing crops the frame without scaling or destroying its source content');
 const fixed=structuredClone((await state()).frames);
 await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await settle();assert.deepEqual((await state()).frames,fixed,'Viewport size never changes a frame size');
 await field('#frame-width',99999,'change');assert.ok((await currentFrame()).width<=2048,'Frame dimensions have a fixed maximum');await field('#frame-width',320,'change');
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});await click('#zoom-fit');await settle();
 await capture('frames');
 console.log('PASS frame moves carry their own content, frame resizes crop without scaling, and fixed limits do not depend on the page');

 // Direct artboard manipulation belongs to Select, without entering F. Titles
 // and all eight handles remain usable at any zoom, outside the drawing area.
 await selectFrame(first);await click('.cursor-modes button[data-mode=select]');
 await click(`[data-frame-title="${first}"]`);await settle();
 assert.equal(await run("document.querySelector('#canvas-viewport').dataset.frameSelection"),first);
 assert.equal(await run("[...document.querySelectorAll('[data-frame-handle]')].filter(node=>node.getBoundingClientRect().width>0).length"),8,'Select exposes corner and edge handles');await capture('transform-handles');
 let directBefore=await state(),directFrame=directBefore.frames.find(item=>item.id===first),scale=directBefore.view.scale;
 let titlePoint=await run(`(()=>{const r=document.querySelector('[data-frame-title="${first}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 let destination={x:titlePoint.x+40*scale,y:titlePoint.y+25*scale};
 await pointer('mousePressed',titlePoint,1);await pointer('mouseMoved',destination,1);await settle();
 let previewFrame=await currentFrame();assert.equal(previewFrame.x,directFrame.x+40);assert.equal(previewFrame.y,directFrame.y+25,'Artboard contents and geometry preview before pointer release');
 let previewState=await state();
 const movedIds=new Set(directBefore.layers.filter(layer=>layer.frameId===first).map(layer=>layer.id));
 for(const stroke of directBefore.strokes){const actual=previewState.strokes.find(item=>item.number===stroke.number);if(movedIds.has(stroke.layerId)){assert.ok(Math.abs(actual.points[0].x-stroke.points[0].x-40)<.001);assert.ok(Math.abs(actual.points[0].y-stroke.points[0].y-25)<.001);}else assert.deepEqual(actual.points,stroke.points);}
 await pointer('mouseReleased',destination,0);await settle();assert.equal(await run("document.querySelector('#canvas-viewport').dataset.mode"),'select','Moving keeps Select active');
 await click('#return');await settle();assert.deepEqual((await state()).frames,directBefore.frames);assert.deepEqual((await state()).strokes,directBefore.strokes,'One Undo restores a whole drag');
 await click(`[data-frame-title="${first}"]`);directBefore=await state();directFrame=await currentFrame();scale=directBefore.view.scale;
 const handlePoint=async handle=>run(`(()=>{const r=document.querySelector('[data-frame-handle="${handle}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 let start=await handlePoint('e');destination={x:start.x+37*scale,y:start.y};
 await pointer('mousePressed',start,1);await pointer('mouseMoved',destination,1);await settle();assert.equal((await currentFrame()).width,directFrame.width+37,'An edge handle resizes live');
 await pointer('mouseReleased',destination,0);await settle();assert.equal((await currentFrame()).height,directFrame.height);assert.deepEqual((await state()).strokes,directBefore.strokes,'Canvas Size crops rather than scaling source points');
 await click('#return');await settle();assert.deepEqual((await state()).frames,directBefore.frames);
 await click(`[data-frame-title="${first}"]`);start=await handlePoint('se');destination={x:start.x+80*scale,y:start.y+20*scale};
 await pointer('mousePressed',start,1,8);await pointer('mouseMoved',destination,1,8);await settle();await pointer('mouseReleased',destination,0,8);await settle();
 const proportional=await currentFrame();assert.ok(Math.abs(proportional.width/proportional.height-directFrame.width/directFrame.height)<.01,'Shift preserves aspect ratio');
 await click('#return');await settle();await click(`[data-frame-title="${first}"]`);
 start=await handlePoint('e');destination={x:start.x+20*scale,y:start.y};await pointer('mousePressed',start,1,1);await pointer('mouseMoved',destination,1,1);await pointer('mouseReleased',destination,0,1);await settle();
 const centered=await currentFrame();assert.equal(centered.width,directFrame.width+40);assert.equal(centered.x+centered.width/2,directFrame.x+directFrame.width/2,'Alt resizes around the center');
 await click('#return');await settle();await click(`[data-frame-title="${first}"]`);
 start=await handlePoint('s');destination={x:start.x,y:start.y+55*scale};await pointer('mousePressed',start,1);await pointer('mouseMoved',destination,1);await settle();await key('Escape');await pointer('mouseReleased',destination,0);await settle();
 assert.deepEqual((await state()).frames,directBefore.frames);assert.deepEqual((await state()).strokes,directBefore.strokes,'Escape restores an in-progress transform');
 await run("document.querySelector('#artboard').focus()");await key('ArrowRight');await key('ArrowDown');await settle();assert.equal((await currentFrame()).x,directFrame.x+1);assert.equal((await currentFrame()).y,directFrame.y+1,'Arrow keys nudge the selected artboard');
 await key('ArrowRight',8);await settle();assert.equal((await currentFrame()).x,directFrame.x+11,'Shift arrows move the artboard ten pixels');
 await click('#return');await click('#return');await click('#return');await settle();
 console.log('PASS Select directly moves artboards and contents live; eight handles, Shift/Alt resize, Escape cancellation and one-gesture Undo');

 // When frames overlap, the frame visually on top owns the pointer even if
 // another frame was active before the click.
 const stableFirst=await currentFrame(),stableSecond=(await state()).frames.find(item=>item.id===second);
 await selectFrame(second);await field('#frame-x',stableFirst.x+80,'change');await field('#frame-y',stableFirst.y+80,'change');
 await selectFrame(first);await click('.cursor-modes button[data-mode=select]');
 const overlapPoint=await world(stableFirst.x+220,stableFirst.y+220);
 await pointer('mousePressed',overlapPoint,1);await pointer('mouseReleased',overlapPoint,0);await settle();
 assert.equal((await state()).activeFrameId,second,'The topmost overlapping frame receives the click');
 await frameUi();await field('#frame-x',stableSecond.x,'change');await field('#frame-y',stableSecond.y,'change');await selectFrame(first);
 // A north-west corner resize that reaches the fixed limit keeps the opposite
 // south-east corner anchored instead of shifting it as the width clamps.
 const beforeCorner=await state(),cornerFrame=beforeCorner.frames.find(item=>item.id===first);
 await click('#draw-frame');
 await drag(await world(cornerFrame.x,cornerFrame.y),await world(cornerFrame.x-2600,cornerFrame.y-2600));
 const grown=await currentFrame();assert.equal(grown.width,2048);assert.equal(grown.height,2048);
 assert.ok(Math.abs(grown.x+grown.width-cornerFrame.x-cornerFrame.width)<.001,'West resize preserves the east edge at the maximum size');
 assert.ok(Math.abs(grown.y+grown.height-cornerFrame.y-cornerFrame.height)<.001,'North resize preserves the south edge at the maximum size');
 assert.deepEqual((await state()).strokes,beforeCorner.strokes,'Corner resizing never moves the source gestures');
 await click('#return');await settle();assert.deepEqual((await state()).frames,beforeCorner.frames);assert.deepEqual((await state()).strokes,beforeCorner.strokes);
 console.log('PASS overlapping frame hit testing chooses the top frame; north-west resizing keeps the opposite corner anchored at the fixed limit');

 // A frame can also be created with the quick tool, then removed with Undo support.
 const countBefore=(await state()).frames.length;
 await click('#draw-frame');const anchor=await currentFrame();
 await drag(await world(anchor.x+50,anchor.y+anchor.height+50),await world(anchor.x+130,anchor.y+anchor.height+130));
 assert.equal((await state()).frames.length,countBefore+1,'The frame tool creates an independent finite frame');
 const drawn=await currentFrame();assert.ok(drawn.width>=64&&drawn.height>=64&&drawn.width<=2048&&drawn.height<=2048);
 await frameUi();await click('#frame-delete');await settle();assert.equal((await state()).frames.length,countBefore);
 await selectFrame(first);
 await run(`(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});window.testDownloads=[];const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.testDownloads.push({name:this.download,url:this.href});return;}return original.call(this);};})()`);
 const downloadPng=async()=>{const before=await run('window.testDownloads.length');await click('#export');await click('#export-png');await wait(`window.testDownloads.length>${before}`);return run(`(async()=>{const blob=await(await fetch(window.testDownloads[${before}].url)).blob(),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);const result={width:bitmap.width,height:bitmap.height,corner:[...context.getImageData(1,1,1,1).data]};bitmap.close();return result;})()`);};
 await frameUi();if(!await run("document.querySelector('#frame-transparent').checked"))await click('#frame-transparent');await settle();
 let exported=await downloadPng();frame=await currentFrame();assert.equal(exported.width,frame.width*2);assert.equal(exported.height,frame.height*2);assert.equal(exported.corner[3],0,'Transparent frame exports no page background');
 await frameUi();await click('#frame-transparent');await field('#frame-background','#fff5dd');
 exported=await downloadPng();assert.equal(exported.width,640);assert.equal(exported.height,640);assert.deepEqual(exported.corner,[255,245,221,255],'An opaque frame exports its own background');
 assert.equal((await state()).frames.find(item=>item.id===second).background,null,'Background belongs only to the selected frame');
 const finalSignature=await signature(),finalState=await state();
 await click('.folder-studio-tools [data-studio-save]');await wait('!window.basementStudioSession.dirty()');
 await click('#export');await click('#export-ment');await wait('window.testDownloads.length===3');
 const portable=await run("fetch(window.testDownloads[2].url).then(r=>r.json())");assert.equal(portable.version,2,'Frame documents use a forward-safe portable format');
 const imported=await run("(await import('/project-store.js')).importMent(await fetch(window.testDownloads[2].url).then(r=>r.text())).state");
 assert.deepEqual(imported.frames,finalState.frames);assert.deepEqual(imported.layers,finalState.layers);assert.deepEqual(imported.strokes,finalState.strokes);
 await click('.main-page-link');await wait("location.pathname==='/hub/'&&!!document.querySelector('#project-list')");
 await page.send('Page.navigate',{url:origin+'/?project=endo-frames-test'});await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')");await settle();
 assert.equal(await signature(),finalSignature);assert.deepEqual((await state()).frames,finalState.frames);assert.deepEqual((await state()).layers,finalState.layers);assert.deepEqual(nativeDialogs,[]);
 console.log('PASS frame-only PNG uses full export resolution and optional background; portable v2 and folder reopen preserve frame contents and adjustment order');
 console.log('PASS Endo finite frames and adjustment layers in isolated Chrome/OPFS');
}finally{
 page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
