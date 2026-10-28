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
 const click=async selector=>{const p=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await pointer('mousePressed',p,1);await pointer('mouseReleased',p,0);};
 const pointer=(type,point,buttons)=>page.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons,clickCount:1});
 const key=async key=>{const codes={Escape:27,Enter:13,Tab:9,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Home:36,End:35};const code=key===' '?'Space':key;await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:codes[key]||0});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:codes[key]||0});};
 const inspect=async name=>{await click(`[data-inspector-tab=${name}]`);await wait(`document.querySelector('[data-inspector-tab=${name}]').getAttribute('aria-selected')==='true'&&!document.querySelector('[data-inspector-panel=${name}]').hidden`);};
 const capture=async name=>{await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await delay(500);const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/private/tmp/basement-endo-'+name+'.png',Buffer.from(data,'base64'));};
 await wait('window.basementSessionReady');
 await run(`(async()=>{localStorage.setItem('basement-theme','dark');const store=await import('/project-store.js');const root=await(await navigator.storage.getDirectory()).getDirectoryHandle('Endo UI Test',{create:true});await store.connectProjectFolder(root);await store.putProject({id:'endo-ui-test',name:'Material studies',studio:'endo',state:await(await import('/hub/studios.js')).createInitial('endo'),createdAt:Date.now(),updatedAt:Date.now()});})()`);
 await page.send('Page.navigate',{url:origin+'/?project=endo-ui-test'});
 await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')&&!!window.basementStudioSession");
 const stroke=async(brush,index)=>{
  await inspect('brush');
  await click('[data-mode=draw]');await key('Escape');
  const selector=`[data-brush=${brush}]`;await run(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);await click(selector);
  const r=await run("(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()");
  const points=Array.from({length:40},(_,i)=>{const t=i/39;return{x:r.x+r.w*(.2+.6*t),y:r.y+r.h*(.24+index*.23+.065*Math.sin(t*Math.PI*3))};});
  await pointer('mousePressed',points[0],1);for(const p of points.slice(1)){await pointer('mouseMoved',p,1);await delay(12);}await pointer('mouseReleased',points.at(-1),0);
  await wait(`window.basementStudioSession.capture().state.strokes.length===${index+1}`);
  return points;
 };
 const paths=[];paths.push(await stroke('cromo',0));paths.push(await stroke('relief',1));paths.push(await stroke('sand',2));
 await click('[data-mode=draw]');await key('Escape');
 await run("document.querySelector('.brush-settings-scroll').scrollTop=0");
 await windowlessSave();
 async function windowlessSave(){await run('window.basementStudioSession.save()');await wait('!window.basementStudioSession.dirty()');}
 if(process.env.BASEMENT_ENDO_BASELINE==='1'){
  await capture('before');console.log('PASS baseline /private/tmp/basement-endo-before.png');
 }else{
  assert.deepEqual(await run('window.basementStudioSession.capture().state.strokes.map(s=>s.settings.brush)'),['cromo','relief','sand']);
  console.log('PASS Endo draws three editable material strokes with real pointer input');


  // One inspector holds all properties; the left rail remains a quick tool switcher.
  const inspectorState=()=>run("(()=>({selected:[...document.querySelectorAll('[data-inspector-tab][aria-selected=true]')].map(t=>t.dataset.inspectorTab),visible:[...document.querySelectorAll('[data-inspector-panel]')].filter(p=>!p.hidden&&getComputedStyle(p).display!=='none').map(p=>p.dataset.inspectorPanel),tabStops:[...document.querySelectorAll('[data-inspector-tab]')].filter(t=>t.tabIndex===0).map(t=>t.dataset.inspectorTab)}))()");
  for(const name of ['color','symmetry','filters','areas','brush']){
   await inspect(name);assert.deepEqual(await inspectorState(),{selected:[name],visible:[name],tabStops:[name]});
   assert.equal(await run("(()=>{const button=document.querySelector('#layer-add'),r=button.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#layer-add')===button;})()"),true,'Layers remain accessible while inspecting '+name);
  }
  await key('ArrowRight');assert.equal(await run('document.activeElement.dataset.inspectorTab'),'color');
  assert.deepEqual((await inspectorState()).selected,['color']);
  await key('End');assert.equal(await run('document.activeElement.dataset.inspectorTab'),'areas');
  await key('Home');assert.equal(await run('document.activeElement.dataset.inspectorTab'),'brush');
  console.log('PASS one inspector panel is visible at a time; tabs work with pointer, arrows, Home and End');

  const beforeArea=await run('window.basementStudioSession.capture().state.strokes.length');
  assert.equal(await run("!!document.querySelector('#draw-frame').closest('.tool-rail')"),true,'Export-area tool belongs to the quick rail');
  await click('#draw-frame');await wait("document.querySelector('#canvas-viewport').dataset.mode==='frame'");
  const box=await run("(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect();return{x:r.x+r.width*.15,y:r.y+r.height*.15,w:r.width*.6,h:r.height*.6};})()");
  await pointer('mousePressed',{x:box.x,y:box.y},1);await pointer('mouseMoved',{x:box.x+box.w,y:box.y+box.h},1);await pointer('mouseReleased',{x:box.x+box.w,y:box.y+box.h},0);
  await wait('window.basementStudioSession.capture().state.frames.length===1');
  await inspect('areas');assert.equal(await run("document.querySelector('#frame-list .frame-row input').value"),'Area 1');
  await click('#frame-list .frame-row button[aria-label^="Remove "]');await wait('window.basementStudioSession.capture().state.frames.length===0');
  assert.equal(await run('window.basementStudioSession.capture().state.strokes.length'),beforeArea);
  await inspect('brush');
  console.log('PASS quick export-area tool draws and removes an area without altering the strokes');

  for(const [shortcut,mode] of [['v','select'],['h','pan'],['f','frame'],['b','draw']]){
   await key(shortcut);assert.equal(await run("document.querySelector('#canvas-viewport').dataset.mode"),mode,'Quick tool shortcut '+shortcut);
   assert.equal(await run('document.activeElement.id'),'artboard','Tool shortcuts return focus to the canvas');
  }
  await run("document.querySelector('#project-title').focus()");await key('v');
  assert.equal(await run("document.querySelector('#canvas-viewport').dataset.mode"),'draw','Tool shortcuts leave text inputs alone');
  await inspect('brush');
  console.log('PASS B / V / H / F shortcuts switch quick tools and do not intercept Artboard naming');

  // A material setting belongs to the selected stroke; history preserves the others.
  await click('[data-mode=select]');await pointer('mousePressed',paths[0][15],1);await pointer('mouseReleased',paths[0][15],0);
  await wait("!document.querySelector('#delete').disabled&&/\\b1\\b/.test(document.querySelector('#stroke-scope').textContent)");
  const widthSelector='#controls .control input[type=number]';
  await run(`(()=>{const field=document.querySelector(${JSON.stringify(widthSelector)});field.value='44';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.deepEqual(await run('window.basementStudioSession.capture().state.strokes.map(s=>s.settings.width)'),[44,28,28]);
  await click('#return');assert.deepEqual(await run('window.basementStudioSession.capture().state.strokes.map(s=>s.settings.width)'),[28,28,28]);
  await click('#restore');assert.deepEqual(await run('window.basementStudioSession.capture().state.strokes.map(s=>s.settings.width)'),[44,28,28]);
  await click('#delete');assert.equal(await run('window.basementStudioSession.capture().state.strokes.length'),2);
  await click('#return');assert.equal(await run('window.basementStudioSession.capture().state.strokes.length'),3);
  await click('[data-mode=draw]');await key('Escape');
  console.log('PASS selection edits one stroke; Undo, Redo and delete preserve editable history');

  const content=()=>run("(await import('/ment-format.js')).documentSignature(window.basementStudioSession.capture().state)");
  const beforeNavigation=await content(),zoom=await run('window.basementStudioSession.capture().state.view.scale');
  await click('#zoom-in');assert.ok(await run('window.basementStudioSession.capture().state.view.scale')>zoom);
  await click('[data-mode=pan]');
  const panPoint=await run("(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await pointer('mousePressed',panPoint,1);await pointer('mouseMoved',{x:panPoint.x+45,y:panPoint.y+20},1);await pointer('mouseReleased',{x:panPoint.x+45,y:panPoint.y+20},0);
  assert.equal(await content(),beforeNavigation,'Pan and zoom never alter drawing content');
  await click('#zoom-fit');await click('[data-mode=draw]');
  assert.equal(await run('document.activeElement.id'),'artboard','Clicking Draw returns focus to the canvas before any pointer gesture');
  const beforeSpace=await run('window.basementStudioSession.capture().state.view.x');
  await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await pointer('mousePressed',panPoint,1);await pointer('mouseMoved',{x:panPoint.x+30,y:panPoint.y+15},1);await pointer('mouseReleased',{x:panPoint.x+30,y:panPoint.y+15},0);
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  assert.equal(await run('window.basementStudioSession.capture().state.view.x'),beforeSpace+30,'Space + drag pans immediately after clicking Draw');
  assert.equal(await content(),beforeNavigation,'Space + drag never creates a paint stroke');
  await click('#zoom-fit');await click('[data-mode=draw]');
  console.log('PASS Draw / Select / Pan, Space + drag and zoom keep viewport changes separate from content');

  // Manual Save must commit the library copy, independently of exporting a download.
  await run("document.querySelector('#project-title').value='Endo material studies',document.querySelector('#project-title').dispatchEvent(new Event('input',{bubbles:true}))");
  await delay(750);
  assert.equal(await run("(await import('/project-store.js')).getProject('endo-ui-test').then(p=>p.name)"),'Material studies');
  await click('.folder-studio-tools button');
  await wait("!window.basementStudioSession.dirty()&&document.querySelector('#local-status').textContent.startsWith('Saved in ')");
  assert.equal(await run("(await import('/project-store.js')).getProject('endo-ui-test').then(p=>p.name)"),'Endo material studies');
  assert.equal(await run("document.querySelector('.folder-studio-tools').closest('header')!==null"),true,'Save and Folder live in the header');
  assert.equal(await run("document.querySelector('#local-status').closest('header')!==null"),true,'Save feedback lives beside the Artboard name');
  console.log('PASS title rename and manual Save persist to the selected folder from the header');

  // Modal controls must receive real focus without moving the editor behind them.
  await click('.folder-studio-tools button:nth-of-type(2)');await wait("document.querySelector('#folder-settings').open");
  assert.equal(await run("document.activeElement.closest('#folder-settings')!==null"),true);
  await key('Tab');assert.equal(await run("document.activeElement===document.body||document.activeElement.closest('#folder-settings')!==null"),true,'Tab never activates controls behind the modal');
  await key('Escape');await wait("!document.querySelector('#folder-settings').open");
  assert.equal(await run("document.activeElement.closest('.folder-studio-tools')!==null"),true);
  await click('.folder-studio-tools button:nth-of-type(2)');await wait("document.querySelector('#folder-settings').open");
  await pointer('mousePressed',{x:5,y:5},1);await pointer('mouseReleased',{x:5,y:5},0);await wait("!document.querySelector('#folder-settings').open");
  console.log('PASS Folder dialog keeps background controls inactive and dismisses with Escape or an outside click');

  // Exercise the real Export menu; intercept only the final browser download.
  await run(`(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});window.testDownloads=[];const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.testDownloads.push({name:this.download,url:this.href});return;}return click.call(this);};})()`);
  await run("document.querySelector('#export').scrollIntoView({block:'nearest'})");await click('#export');
  await wait("!document.querySelector('#export-menu').hidden");
  assert.equal(await run("document.activeElement.id"),'export-ment');await key('ArrowDown');assert.equal(await run("document.activeElement.id"),'export-png');
  await key('Escape');assert.equal(await run("document.querySelector('#export-menu').hidden&&document.activeElement.id==='export'"),true);
  await click('#export');await click('#show-export-areas');
  await wait("document.querySelector('#export-menu').hidden&&document.querySelector('[data-inspector-tab=areas]').getAttribute('aria-selected')==='true'");
  assert.equal(await run("!document.querySelector('[data-inspector-panel=areas]').hidden"),true,'Manage export areas navigates to the inspector');
  await inspect('brush');
  await click('#export');await click('#export-ment');await wait('window.testDownloads.length===1');
  const ment=await run("fetch(window.testDownloads[0].url).then(r=>r.json())");
  assert.equal(ment.format,'basement.ment');assert.equal(ment.artboard.id,'endo-ui-test');assert.equal(ment.artboard.name,'Endo material studies');
  assert.equal(ment.artboard.layers[0].strokes.length,3);assert.deepEqual(ment.artboard.layers[0].strokes.map(s=>s.settings.brush),['cromo','relief','sand']);
  assert.ok(ment.artboard.preview.startsWith('data:image/png;base64,'));
  await click('#export');await click('#export-png');await wait('window.testDownloads.length===2');
  const png=await run(`(async()=>{const blob=await(await fetch(window.testDownloads[1].url)).blob(),bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const c=canvas.getContext('2d');c.drawImage(bitmap,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let transparent=false,painted=false;for(let i=3;i<pixels.length;i+=4){transparent||=pixels[i]===0;painted||=pixels[i]>0;if(transparent&&painted)break;}bitmap.close();return{signature:[...bytes.slice(0,8)],width:view.getUint32(16),height:view.getUint32(20),type:blob.type,transparent,painted,name:window.testDownloads[1].name};})()`);
  assert.deepEqual(png.signature,[137,80,78,71,13,10,26,10]);assert.ok(png.width>0&&png.height>0);assert.equal(png.type,'image/png');assert.ok(png.transparent&&png.painted);assert.match(png.name,/\.png$/);
  assert.equal(await run("document.querySelector('#export-menu').hidden&&document.querySelector('#export').getAttribute('aria-expanded')==='false'"),true);
  console.log('PASS keyboard-accessible Export creates a portable .ment and a valid painted, transparent PNG');

  // Drawing switches from the immediate canvas to a worker-refined bitmap.
  // At 10% zoom (the reported case), both must composite onto the same paper.
  const backgroundContent=await content();
  const backgroundView=await run('({...window.basementStudioSession.capture().state.view})');
  const refinedBackground=()=>run(`(()=>{const viewport=document.querySelector('#canvas-viewport'),refined=document.querySelector('#resolution-view'),base=document.querySelector('#artboard');return{css:getComputedStyle(viewport).backgroundColor.match(/\\d+/g).slice(0,3).map(Number),pixel:[...refined.getContext('2d').getImageData(2,2,1,1).data],baseAlpha:base.getContext('2d').getImageData(2,2,1,1).data[3],opacity:Number(getComputedStyle(refined).opacity)};})()`);
  await run("window.testRefinements=0,document.querySelector('#resolution-view').addEventListener('endo-refined',()=>window.testRefinements++)");
  await run("(await import('/zoom.js')).restoreCamera({scale:.1,x:50,y:50})");
  for(const theme of ['dark','light']){
   if(await run('document.documentElement.dataset.theme')!==theme){
    const before=await run('window.testRefinements');
    await click('#endo-theme-toggle');
    await wait(`window.testRefinements>${before}&&getComputedStyle(document.querySelector('#resolution-view')).opacity==='1'`);
   }
   await wait("getComputedStyle(document.querySelector('#resolution-view')).opacity==='1'");
   let background=await refinedBackground();
   assert.deepEqual(background.pixel,[...background.css,255],theme+' refined paper matches the immediate canvas background');
   assert.equal(background.baseAlpha,0,'Unpainted source pixels remain transparent');
   await click('[data-mode=draw]');await key('Escape');
   const start=await run("(()=>{const r=document.querySelector('#canvas-viewport').getBoundingClientRect();return{x:r.x+r.width*.7,y:r.y+r.height*.8};})()");
   await pointer('mousePressed',start,1);
   await pointer('mouseMoved',{x:start.x+35,y:start.y+15},1);
   background=await refinedBackground();
   assert.equal(background.opacity,0,theme+' uses the immediate canvas during the stroke');
   assert.equal(background.baseAlpha,0,'Drawing never paints the paper into source pixels');
   const during=background.css;
   await pointer('mouseReleased',{x:start.x+35,y:start.y+15},0);
   await wait("getComputedStyle(document.querySelector('#resolution-view')).opacity==='1'");
   background=await refinedBackground();
   assert.deepEqual(background.pixel,[...during,255],theme+' keeps exactly the same paper after releasing the stroke at 10% zoom');
   await click('#return');
   assert.equal(await content(),backgroundContent,'Background regression gestures are fully undone');
  }
  await click('#endo-theme-toggle');
  await run(`(await import('/zoom.js')).restoreCamera(${JSON.stringify(backgroundView)})`);
  await wait("getComputedStyle(document.querySelector('#resolution-view')).opacity==='1'");
  const restoredBackground=await refinedBackground();
  assert.deepEqual(restoredBackground.pixel,[...restoredBackground.css,255],'Theme switch discards the old refined paper');
  console.log('PASS immediate and refined paper match during and after drawing at 10% zoom in both themes; source pixels stay transparent');

  const auditLayout=async label=>{
   const layout=await run(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};return{width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,htmlWidth:document.documentElement.scrollWidth,htmlHeight:document.documentElement.scrollHeight,rail:rect(document.querySelector('.tool-rail')),canvas:rect(document.querySelector('#canvas-viewport')),preview:rect(document.querySelector('.brush-preview-card')),layers:rect(document.querySelector('#layers-dock')),layerList:rect(document.querySelector('#layer-list')),inspectorScroll:rect(document.querySelector('#inspector-scroll')),header:rect(document.querySelector('header')),aside:[...document.querySelectorAll('main>aside')].map(rect),visibleHeaderButtons:[...document.querySelectorAll('.studio-header button')].filter(b=>!b.hidden&&getComputedStyle(b).display!=='none').map(b=>({...rect(b),name:b.getAttribute('aria-label')||b.textContent}))};})()`);
   assert.ok(layout.bodyWidth<=layout.width+1&&layout.htmlWidth<=layout.width+1,label+' has no horizontal page overflow: '+JSON.stringify(layout));
   assert.ok(layout.bodyHeight<=layout.height+1&&layout.htmlHeight<=layout.height+1,label+' has no page scrolling');
   assert.ok(layout.rail.width<=64,label+' keeps a narrow quick tool rail');
   assert.ok(layout.canvas.width>=layout.width-480&&layout.canvas.height>=400,label+' gives the drawing canvas the recovered sidebar space: '+JSON.stringify(layout.canvas));
   assert.ok(layout.layers.bottom<=layout.height+1&&layout.layers.height>=180&&layout.layers.height<=250,label+' keeps the Layers dock visible at a useful height');
   assert.ok(layout.layerList.height>=50&&layout.inspectorScroll.bottom<=layout.layers.y+1,label+' scrollable properties never cover the Layers dock');
   assert.ok(layout.preview.height>=64&&layout.preview.y>=layout.inspectorScroll.y-1&&layout.preview.bottom<=layout.inspectorScroll.bottom+1,label+' exposes the preview at the top of Brush properties');
   for(const a of layout.aside)assert.ok(a.x>=-1&&a.right<=layout.width+1&&a.bottom<=layout.height+1,label+' side panel fits the viewport');
   for(const b of layout.visibleHeaderButtons)assert.ok(b.x>=-1&&b.right<=layout.width+1&&b.y>=-1&&b.bottom<=layout.header.bottom+1,label+' toolbar button fits: '+b.name);
   return layout;
  };
  await run("document.querySelector('.brush-settings-scroll').scrollTop=0");
  await auditLayout('Desktop dark');await capture('dark');
  const savedContent=await content();
  const canvasPixels=await run("document.querySelector('#artboard').toDataURL('image/png')");
  await click('#endo-theme-toggle');await wait("(document.documentElement.dataset.theme||document.body.dataset.theme)==='light'");
  assert.equal(await run("localStorage.getItem('basement-theme')"),'light');assert.equal(await content(),savedContent);
  assert.equal(await run("document.querySelector('#artboard').toDataURL('image/png')"),canvasPixels,'Theme changes leave the drawing pixel buffer unchanged');
  await auditLayout('Desktop light');await capture('light');
  const home=async()=>{await click('.main-page-link');await wait("location.pathname==='/hub/'&&!!document.querySelector('#project-list')");};
  const reopen=async theme=>{await home();await run(`localStorage.setItem('basement-theme',${JSON.stringify(theme)})`);await page.send('Page.navigate',{url:origin+'/?project=endo-ui-test'});await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')");assert.equal(await content(),savedContent,'Theme reopening preserves all material settings and strokes');};
  await reopen('light');
  assert.equal(await run("document.documentElement.dataset.theme||document.body.dataset.theme"),'light');
  await click('#endo-theme-toggle');
  assert.equal(await run("document.documentElement.dataset.theme||document.body.dataset.theme"),'dark');
  assert.equal(await run("localStorage.getItem('basement-theme')"),'dark');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await delay(300);
  await auditLayout('Compact dark');await capture('compact');
  for(const [name,selector] of [['color','#color-square'],['symmetry','[data-tool=grid]'],['filters','#add-filter'],['areas','#frame-from-selection'],['brush','[data-brush=cromo]']]){
   await inspect(name);
   await run(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
   assert.equal(await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),scroll=document.querySelector('#inspector-scroll').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&r.x>=0&&r.right<=innerWidth&&r.y>=scroll.y-1&&r.bottom<=scroll.bottom+1&&(hit===e||e.contains(hit));})()`),true,'Compact inspector exposes '+name+' controls above Layers without page scrolling');
   assert.equal(await run("(()=>{const b=document.querySelector('#layer-add'),r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#layer-add')===b;})()"),true,'Layers remain accessible in compact '+name+' inspector');
  }
  await run("document.querySelector('.scene-card').open=true,document.querySelector('#scene-controls .control:last-child input[type=number]').scrollIntoView({block:'nearest'})");
  assert.equal(await run("(()=>{const f=document.querySelector('#scene-controls .control:last-child input[type=number]'),r=f.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===f&&r.bottom<=document.querySelector('#layers-dock').getBoundingClientRect().top;})()"),true,'Last global control remains reachable above the fixed Layers dock');
  await run("document.querySelector('.brush-settings-scroll').scrollTop=0");
  assert.equal(await content(),savedContent,'Responsive layout preserves the drawing');
  console.log('PASS shared themes and compact editor fit 1512×982 and 1280×720; all five property tabs remain usable above the fixed Layers dock');

  await run("document.querySelector('#project-title').value='Saved on Home',document.querySelector('#project-title').dispatchEvent(new Event('input',{bubbles:true}))");
  await home();assert.equal(await run("(await import('/project-store.js')).getProject('endo-ui-test').then(p=>p.name)"),'Saved on Home');
  assert.deepEqual(nativeDialogs,[],'Opening, saving and returning Home never show a browser leave prompt');
  console.log('PASS Home saves pending edits in the same tab without a browser leave prompt');
  console.log('PASS screenshots: /private/tmp/basement-endo-{dark,light,compact}.png');
 }
}finally{
 page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
