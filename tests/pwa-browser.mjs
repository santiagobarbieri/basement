// Isolated Chrome profile, OPFS library and server: never accesses user projects.
// Historical name retained: these checks now verify the online-only website.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),temp=await mkdtemp('/private/tmp/basement-web-');
let revision=0,broken=false,offline=false;
const base=JSON.parse(await readFile(root+'/precache.json','utf8'));
const hash=()=>revision?createHash('sha256').update(base.hash+revision).digest('hex'):base.hash;
const server=createServer(async(req,res)=>{try{
 if(offline){res.destroy();return;}
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';
 const target=resolve(root,'.'+path);if(!target.startsWith(root+'/')){res.writeHead(404).end();return;}
 let data;
 if(path==='/precache.json')data=JSON.stringify({...base,hash:hash()});
 else if(path==='/sw.js')data=(await readFile(target,'utf8')).replace(/const BUILD = '[^']+';/,`const BUILD = '${hash()}';`);
 else data=await readFile(target);
 if(broken&&path==='/pwa.js')data='corrupt update';
 const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.ready=new Promise(r=>this.ws.onopen=r);this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else this.onEvent?.(m);};}
 async send(method,params={}){await this.ready;return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 close(){this.ws.close();}
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,page,otherPage;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(temp+'/DevToolsActivePort','utf8')).split('\n')[0];break;}catch{await delay(100);}}
 assert.ok(port,'Chrome started');const debug='http://127.0.0.1:'+port;
 browser=new CDP((await(await fetch(debug+'/json/version')).json()).webSocketDebuggerUrl);
 const target=(await browser.send('Target.createTarget',{url:origin+'/hub/'})).targetId;
 const info=(await(await fetch(debug+'/json')).json()).find(t=>t.id===target);page=new CDP(info.webSocketDebuggerUrl);await page.send('Page.enable');await page.send('Page.bringToFront');
 const evaluate=async(client,expression)=>{const r=await client.send('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const run=expression=>evaluate(page,expression);
 const nativeDialogs=[];page.onEvent=message=>{if(message.method==='Page.javascriptDialogOpening'){nativeDialogs.push(message.params.type);page.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});}};
 const wait=async(expression,client=page)=>{for(let i=0;i<300;i++){try{if(await evaluate(client,expression))return;}catch{}await delay(100);}throw Error('Timed out: '+expression+'; '+await evaluate(client,"JSON.stringify({url:location.href,title:document.title,cards:document.querySelectorAll('.project-card').length,feedback:document.querySelector('#library-feedback')?.textContent,save:document.querySelector('#save-status')?.textContent,local:document.querySelector('#local-status')?.textContent,error:document.querySelector('#new-error')?.textContent,blocked:window.basementSessionBlocked,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.textContent.slice(0,200))})"));};
 await wait("!!navigator.serviceWorker.controller && !!window.basementUpdates?.state.ready && !!document.querySelector('[data-check]')");
 assert.equal(await run("document.querySelector('link[rel=manifest]')===null"),true);
 assert.equal(await run("document.querySelector('[data-install]')===null"),true);
 assert.equal(await run("(await caches.keys()).some(name=>name.startsWith('basement-app-'))"),false);
 assert.equal(await run('await window.basementSessionReady'),true);
 console.log('PASS online website: no manifest, installation control or offline cache');
 assert.equal(await run("(()=>{const actions=document.querySelector('#footer-actions'),search=document.querySelector('.search-box');return actions.closest('.toolbar')!==null&&!!(actions.compareDocumentPosition(search)&Node.DOCUMENT_POSITION_FOLLOWING)&&document.querySelector('.library-footer #footer-actions')===null;})()"),true,'Export, Import and Trash precede Search in the top toolbar');


 await run(`(async()=>{const root=await(await navigator.storage.getDirectory()).getDirectoryHandle('Basement Test 1',{create:true});await(await import('/project-store.js')).connectProjectFolder(root);const store=await import('/project-store.js');await store.putProject({id:'web-sentinel',name:'Keep this Artboard',studio:'marble',state:(await import('/marble/engine.js')).initialState(),createdAt:Date.now()-86400000,updatedAt:Date.now(),lastOpenedAt:Date.now()-86400000});})()`);
 assert.equal(await run("(await import('/project-store.js')).getProject('web-sentinel').then(p=>p.name)"),'Keep this Artboard');
 console.log('PASS selected OPFS folder stores a portable Artboard in isolated profile');
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
 const key=async key=>{const windowsVirtualKeyCode={Escape:27,Enter:13,Tab:9}[key]||0,nativeVirtualKeyCode={Escape:53,Enter:36,Tab:48}[key]||0;await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code:key,windowsVirtualKeyCode,nativeVirtualKeyCode});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode,nativeVirtualKeyCode});};
 const clickSelector=async selector=>{const point=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});};
 const clickText=async(selector,text)=>run(`(()=>{const button=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Button unavailable: '+${JSON.stringify(text)});button.click();})()`);
 await run(`(async()=>{const store=await import('/project-store.js'),{createInitial}=await import('/hub/studios.js');const canvas=document.createElement('canvas');canvas.width=420;canvas.height=240;const c=canvas.getContext('2d');c.lineCap='round';c.lineWidth=2.5;c.strokeStyle='#97a3b3';for(const path of [[[160,5],[150,100],[175,135],[200,150]],[[155,90],[128,145],[105,170]],[[155,80],[205,70],[250,80],[300,140]],[[30,225],[70,220],[100,180],[150,170]]]){c.beginPath();c.moveTo(...path[0]);for(const point of path.slice(1))c.lineTo(...point);c.stroke();}const preview=canvas.toDataURL('image/png');window.testSourceData=preview;const now=Date.now();await store.putProject({id:'endo-preview',name:'Endo Test 1',studio:'endo',state:await createInitial('endo'),preview,createdAt:now-86400000*20,updatedAt:now,lastOpenedAt:now-3600000});await store.putProject({id:'kiln-preview',name:'Kiln Test 2',studio:'kiln',state:await createInitial('kiln',{data:preview,width:420,height:240}),preview,createdAt:now-86400000*28,updatedAt:now,lastOpenedAt:now-3600000*5});})()`);
 await wait("document.querySelectorAll('.project-card').length===3");

 // Populate a real isolated library so only its Artboard viewport needs to scroll.
 await run(`(async()=>{const store=await import('/project-store.js'),{createInitial}=await import('/hub/studios.js'),state=await createInitial('endo'),now=Date.now();for(let i=0;i<15;i++)await store.putProject({id:'layout-'+i,name:'Layout '+String(i+1).padStart(2,'0'),studio:'endo',state,createdAt:now,updatedAt:now,lastOpenedAt:now-i});await store.deleteProject('layout-0');window.dispatchEvent(new Event('focus'));})()`);
 await wait("document.querySelectorAll('.project-card').length===17");
 const shellFrames=()=>run("Object.fromEntries(['.toolbar','.sidebar','.library-footer'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,[r.x,r.y,r.width,r.height]];}))");
 for(const dimensions of [{width:1512,height:982},{width:1280,height:720}]){
  await page.send('Emulation.setDeviceMetricsOverride',{...dimensions,deviceScaleFactor:1,mobile:false});await delay(120);
  assert.equal(await run("getComputedStyle(document.querySelector('#library-panel')).borderRightWidth"),'0px','No Figma right edge remains');
  const scrolling=await run("(()=>{const nodes=[document.querySelector('#library-panel'),document.querySelector('#projects-view'),document.querySelector('#project-list')],el=nodes.find(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight);if(!el)return null;window.testGridScroll=el;el.scrollTop=0;const r=el.getBoundingClientRect();return {x:r.x+r.width*.6,y:r.y+Math.min(150,r.height*.5)};})()");assert.ok(scrolling,'Artboard viewport scrolls when its cards overflow');assert.equal(await run('window.testGridScroll.id'),'project-list','Only the Artboard list owns the main scroll');
  const beforeFrames=await shellFrames();
  await page.send('Input.dispatchMouseEvent',{type:'mouseWheel',...scrolling,deltaX:0,deltaY:430});await wait('window.testGridScroll.scrollTop>0');
  assert.deepEqual(await shellFrames(),beforeFrames,'Sidebar, toolbar and footer stay fixed as Artboards scroll');
  if(dimensions.width===1512){
   await run("(()=>{const bounds=window.testGridScroll.getBoundingClientRect();window.testFocusedCard=[...document.querySelectorAll('.project-name')].find(node=>{const r=node.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom;});window.testFocusedCard.focus({preventScroll:true});})()");
   const stableOffset=await run('window.testGridScroll.scrollTop');await delay(5500);
   assert.equal(await run('window.testFocusedCard.isConnected&&document.activeElement===window.testFocusedCard'),true,'Background folder refresh preserves the current focused control');assert.equal(await run('window.testGridScroll.scrollTop'),stableOffset,'Unchanged refresh preserves Artboard scroll position');
  }

  assert.equal(await run('document.scrollingElement.scrollTop'),0);assert.equal(await run('document.scrollingElement.scrollHeight<=innerHeight+1'),true);
  const scrollTop=await run('window.testGridScroll.scrollTop');await page.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:50,y:350,deltaX:0,deltaY:430});await delay(150);
  assert.equal(await run('window.testGridScroll.scrollTop'),scrollTop,'Wheeling over the sidebar does not scroll the library');assert.deepEqual(await shellFrames(),beforeFrames);
  await run('window.testGridScroll.scrollTop=0');
 }
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
 // Selecting a navigation row must not shift its neighbors or expose their separator.
 const navFrames=()=>run("[...document.querySelectorAll('.side-nav button')].map(el=>{const r=el.getBoundingClientRect();return [r.y,r.height];})");
 const originalNavFrames=await navFrames();
 for(const section of ['studios','about','contact','projects']){
  await run(`document.querySelector('[data-view=${section}]').click()`);
  assert.deepEqual(await navFrames(),originalNavFrames,'Navigation rows keep identical geometry for every selection');
  assert.equal(await run("(()=>{const selected=document.querySelector('.side-nav [aria-current]'),previous=selected.previousElementSibling;return !previous||getComputedStyle(previous).borderBottomColor==='rgba(0, 0, 0, 0)';})()"),true,'The separator above a rounded selection is hidden');
 }
 for(const mode of ['dark','light']){
  await run(`document.querySelector('[data-theme-choice=${mode}]').click()`);
  for(const name of ['Kiln','Endo','Foundry','Tremor','Contour','Marble','Distortion']){
   await run("document.querySelector('#filter-toggle').click()");await clickText('#filter-menu button',name);
   assert.equal(await run("(()=>{const button=document.querySelector('#filter-toggle'),logo=button.querySelector('.studio-symbol');return getComputedStyle(logo).backgroundColor===getComputedStyle(logo).color&&getComputedStyle(logo).backgroundColor!==getComputedStyle(button).backgroundColor;})()"),true,'Selected Studio logo stays visible against its colored button');
  }
  await run("document.querySelector('#filter-toggle').click()");await clickText('#filter-menu button','All Studios');
 }
 await run("document.querySelector('[data-theme-choice=dark]').click()");
 console.log('PASS stable rounded navigation and visible active-filter logos in both themes');
 console.log('PASS Studio filter stacking, clean right edge and fixed shell with only Artboards scrolling at desktop sizes');
 await clickSelector('[data-settings=storage]');await wait("document.querySelector('#settings').open && document.querySelectorAll('#storage-library-bar [data-storage-segment]').length>=4");
 const actualUsage=await run(`(async()=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('Basement Test 1'),categories={};for await(const [name,entry]of dir.entries()){if(entry.kind!=='file'||!name.endsWith('.ment'))continue;const file=await entry.getFile(),doc=JSON.parse(await file.text()),category=doc.artboard.studio;categories[category]=(categories[category]||0)+file.size;}const trash=await dir.getDirectoryHandle('.basement-trash');for await(const [name,entry]of trash.entries())if(entry.kind==='file'&&name.endsWith('.ment'))categories.trash=(categories.trash||0)+(await entry.getFile()).size;return categories;})()`);
 const drawnUsage=await run("Object.fromEntries([...document.querySelectorAll('#storage-library-bar [data-storage-segment]')].map(el=>[el.dataset.category,Number(el.dataset.bytes)]).filter(([,value])=>value>0))");
 assert.deepEqual(drawnUsage,actualUsage,'Storage segments account for actual Artboard and Trash file sizes');
 assert.equal(await run("document.querySelector('#storage-library-bar').getAttribute('role')"),'img');
 assert.ok(await run("new Set([...document.querySelectorAll('#storage-library-bar [data-storage-segment]')].map(el=>getComputedStyle(el).backgroundColor)).size>=4"),'Studios and Trash use distinct colors');
 await wait("Number(document.querySelector('#storage-browser-bar').getAttribute('aria-valuemax'))>0");
 const browserMeter=await run("(()=>{const el=document.querySelector('#storage-browser-bar');return {role:el.getAttribute('role'),min:Number(el.getAttribute('aria-valuemin')),max:Number(el.getAttribute('aria-valuemax')),value:Number(el.getAttribute('aria-valuenow'))};})()");
 assert.equal(browserMeter.role,'meter');assert.equal(browserMeter.min,0);assert.ok(browserMeter.max>=browserMeter.value&&browserMeter.value>0,'Browser usage is measured against its own allowance');
 for(const dimensions of [{width:1512,height:982},{width:1280,height:720}]){await page.send('Emulation.setDeviceMetricsOverride',{...dimensions,deviceScaleFactor:1,mobile:false});await delay(120);assert.equal(await run("(()=>{const el=document.querySelector('.settings-content');return el.scrollHeight<=el.clientHeight+1;})()"),true,'Storage fits without scrolling its Settings frame');}
 await run("document.querySelector('[data-settings-tab=account]').click();document.querySelector('#account-name').focus()".replace(';',','));
 const focus=await run("(()=>{const s=getComputedStyle(document.querySelector('#account-name'));return {style:s.outlineStyle,width:parseFloat(s.outlineWidth)||0,offset:parseFloat(s.outlineOffset)||0};})()");assert.ok(focus.style==='none'||focus.width<=1&&Math.abs(focus.offset)<=1,'Focus remains visible without an expanded selection frame: '+JSON.stringify(focus));
 await key('Escape');await wait("!document.querySelector('#settings').open");
 await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
 console.log('PASS colored Storage accounts for active and trashed files, separates browser allowance and fits its fixed frame');

 // Remove fixture Artboards using the real storage interface; leave the base cards.
 await run(`(async()=>{const store=await import('/project-store.js');for(let i=1;i<15;i++)await store.deleteProject('layout-'+i);await store.permanentlyDeleteProjects(Array.from({length:15},(_,i)=>'layout-'+i));window.dispatchEvent(new Event('focus'));})()`);
 await wait("document.querySelectorAll('.project-card').length===3");
 await run("document.querySelector('#project-search').value='KEEP';document.querySelector('#project-search').dispatchEvent(new Event('input'))".replace(';',','));
 assert.equal(await run("document.querySelectorAll('.project-card').length"),1);
 await run("document.querySelector('#project-search').value='no-match-at-all';document.querySelector('#project-search').dispatchEvent(new Event('input'))".replace(';',','));
 assert.equal(await run("document.querySelector('#library-empty p').textContent"),'No results.');
 await run("document.querySelector('#project-search').value='';document.querySelector('#project-search').dispatchEvent(new Event('input'))".replace(';',','));
 await run("document.querySelector('[data-layout=list]').click()");assert.equal(await run("document.querySelector('#project-list').className"),'project-list');
 await run("document.querySelector('[data-layout=grid]').click()");
 await clickSelector('#filter-toggle');assert.equal(await run("(()=>{const options=document.querySelectorAll('#filter-menu button'),r=options[options.length-1].getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#filter-menu');})()"),true,'Studio filter stays above the library and receives clicks');await clickText('#filter-menu button','Kiln');
 assert.equal(await run("document.querySelector('#page-title').textContent"),'All Kiln Artboards');assert.equal(await run("document.querySelectorAll('.project-card').length"),1);
 await clickSelector('#new-file');await wait("document.querySelector('#new-artboard').open");
 assert.equal(await run("document.querySelectorAll('.studio-card').length"),7);
 await run("document.querySelector('[data-studio=endo]').click()");await run("document.querySelector('#create-artboard').click()");
 assert.match(await run("document.querySelector('#new-error').textContent"),/name/i);
 await run("document.querySelector('#new-project-name').value='keep this artboard';document.querySelector('#create-artboard').click()".replace(';',','));
 await wait("document.querySelector('#new-error').textContent.length>0");assert.match(await run("document.querySelector('#new-error').textContent"),/name|already/i);
 await run("document.querySelector('#back-to-studios').click()");await run("document.querySelector('[data-studio=kiln]').click()");
 await run("document.querySelector('#new-project-name').value='Source embedded';document.querySelector('#create-artboard').click()".replace(';',','));
 assert.match(await run("document.querySelector('#new-error').textContent"),/initial image/i);
 await run(`(async()=>{const blob=await(await fetch(window.testSourceData)).blob(),dt=new DataTransfer();dt.items.add(new File([blob],'source.png',{type:'image/png'}));const input=document.querySelector('#initial-image');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);await clickSelector('#create-artboard');
 await wait("location.pathname==='/kiln/' && new URLSearchParams(location.search).has('project') && !!window.basementStudioSession");
 const sourceId=await run("new URLSearchParams(location.search).get('project')");
 assert.equal(await run(`(await import('/project-store.js')).getProject('${sourceId}').then(p=>p.state.source.data.startsWith('data:image/png;base64,'))`),true);
 assert.equal(await run("document.querySelector('#basement-session-blocked')===null"),true);assert.deepEqual(nativeDialogs,[],'Creating a saved Artboard must not show a browser leave prompt');
 await wait("document.querySelector('#local-status')?.textContent.startsWith('Saved in ')");
 await run("document.querySelector('.folder-studio-tools button').click()");await wait("!window.basementStudioSession.dirty()");
 await run("document.querySelector('a[href=\"/hub/\"]').click()");await wait("!!document.querySelector('#new-file') && document.querySelectorAll('.project-card').length===4");
 assert.equal(await run("document.querySelector('#filter-label').textContent"),'All Studios');
 console.log('PASS search, Studio filter, grid/list, required unique names and embedded source image creation');
 // Browser Back may restore the hub from BFCache. Its filters are still reset.
 await run("document.querySelector('#filter-toggle').click()");await clickText('#filter-menu button','Endo');
 await run("document.querySelector('[data-layout=list]').click()");await run("document.querySelector('#project-search').value='Endo';document.querySelector('#project-search').dispatchEvent(new Event('input'))".replace(';',','));
 const hubHistory=await page.send('Page.getNavigationHistory'),hubEntry=hubHistory.entries[hubHistory.currentIndex].id;
 await clickSelector('.project-card[data-id=endo-preview] .project-name');
 await wait("location.pathname==='/' && document.querySelector('#local-status')?.textContent.startsWith('Saved in ')");assert.deepEqual(nativeDialogs,[],'Opening an existing saved Artboard must not show a browser leave prompt');
 await page.send('Page.navigateToHistoryEntry',{entryId:hubEntry});
 await wait("!!document.querySelector('#project-list') && document.querySelectorAll('.project-card').length===4 && document.querySelector('#filter-label').textContent==='All Studios'");
 assert.equal(await run("document.querySelector('#project-search').value"),'');assert.equal(await run("document.querySelector('#project-list').className"),'project-grid');
 assert.equal(await run('window.basementSessionBlocked'),false);
 console.log('PASS browser Back returns to an unfiltered grid without a second active session');


 await clickSelector('#profile-open');await run("document.querySelector('#account-name').value='Unsaved profile';document.querySelector('#account-name').dispatchEvent(new Event('input'))".replace(';',','));
 const protectedTime=await run('performance.timeOrigin');await page.send('Page.reload');for(let i=0;i<30&&!nativeDialogs.length;i++)await delay(100);assert.deepEqual(nativeDialogs,['beforeunload'],'Unsaved profile changes still protect a real navigation');assert.equal(await run('performance.timeOrigin'),protectedTime);nativeDialogs.length=0;
 await key('Escape');await wait("document.querySelector('#action-dialog').open");
 assert.equal(await run("document.querySelector('#action-title').textContent"),'Discard changes?');await clickText('#action-buttons button','Keep editing');assert.equal(await run("document.querySelector('#settings').open"),true);
 await key('Escape');await wait("document.querySelector('#action-dialog').open");await clickText('#action-buttons button','Discard changes');await wait("!document.querySelector('#settings').open");
 await wait("document.querySelector('#account-panel').dataset.unsaved==='false'");assert.equal(await run("document.querySelector('#account-panel').dataset.unsaved"),'false');
 assert.equal(await run("document.querySelector('#profile-name').textContent"),'Local profile');
 await clickSelector('#profile-open');await run("document.querySelector('#account-name').value='Studio tester';document.querySelector('#account-name').dispatchEvent(new Event('input'))".replace(';',','));await run("document.querySelector('#account-panel').requestSubmit()");
 await wait("document.querySelector('#profile-name').textContent==='Studio tester' && !document.querySelector('#settings').open");
 assert.equal(await run("JSON.parse(localStorage.getItem('basement-profile')).name"),'Studio tester');
 console.log('PASS local profile save and confirmation before discarding unsaved changes');

 // Import through the actual file input, resolve a collision, then exercise ZIP export.
 await run(`(async()=>{const store=await import('/project-store.js'),raw=await store.encodeProject(await store.getProject('web-sentinel')),dt=new DataTransfer();dt.items.add(new File([raw],'existing.ment',{type:'application/json'}));const input=document.querySelector('#ment-file');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
 await wait("document.querySelector('#action-dialog').open && document.querySelector('#action-title').textContent==='Artboard already exists'");await clickText('#action-buttons button','Import as copy');
 await wait("document.querySelectorAll('.project-card').length===5 && document.querySelector('.hub').dataset.busy==='false'");
 const copyId=await run("(await import('/project-store.js')).listProjects().then(ps=>ps.find(p=>p.name==='Keep this Artboard Copy').id)");
 await run(`document.querySelector('.project-card[data-id="${copyId}"] .more-button').click()`);await clickText('#project-menu button','Rename');await wait("document.querySelector('#action-dialog').open");
 await run("document.querySelector('#action-input').value='Imported copy'");await clickText('#action-buttons button','Rename');await wait("[...document.querySelectorAll('.project-name')].some(p=>p.textContent==='Imported copy')");
 await run(`(()=>{window.testDownloads=[];const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.testDownloads.push({name:this.download,url:this.href});return;}return click.call(this);};document.querySelector('#export-library').click();})()`);
 await wait("window.testDownloads.length===1 && document.querySelector('.hub').dataset.busy==='false'");
 assert.equal(await run("window.testDownloads[0].name"),'Basement Artboards.zip');
 assert.equal(await run("(await import('/hub/archive.js')).readArchive(new File([await(await fetch(window.testDownloads[0].url)).blob()],'library.zip')).then(entries=>entries.length)"),5);
 await run(`document.querySelector('.project-card[data-id="${copyId}"] .more-button').click()`);await clickText('#project-menu button','Select');assert.equal(await run("document.querySelector('#selection-count').textContent"),'1 selected');
 await run("document.querySelector('#download-selection').click()");await wait('window.testDownloads.length===2');
 assert.equal(await run("(await import('/hub/archive.js')).readArchive(new File([await(await fetch(window.testDownloads[1].url)).blob()],'selection.zip')).then(entries=>entries.length)"),1);
 await run("document.querySelector('#cancel-selection').click()");
 console.log('PASS multi-file import collision handling, rename, complete-library ZIP and selected ZIP export');

 const trashOne=async id=>{await run(`document.querySelector('.project-card[data-id="${id}"] .more-button').click()`);await clickText('#project-menu button','Move to trash');await wait("document.querySelector('#action-dialog').open");await clickText('#action-buttons button','Move to trash');await wait(`!document.querySelector('.project-card[data-id="${id}"]') && document.querySelector('.hub').dataset.busy==='false'`);};
 await trashOne(copyId);await run("document.querySelector('[data-trash-open]').click()");await wait("document.querySelector('#trash-dialog').open && document.querySelectorAll('.trash-row').length===1");assert.match(await run("document.querySelector('.trash-row small').textContent"),/30 days remaining/);
 await clickText('.trash-row button','Restore');await wait("document.querySelectorAll('.trash-row').length===0 && document.querySelector('.hub').dataset.busy==='false'");await key('Escape');
 await wait(`!!document.querySelector('.project-card[data-id="${copyId}"]')`);await trashOne(copyId);await run("document.querySelector('[data-trash-open]').click()");await wait("document.querySelector('#trash-dialog').open");
 await clickText('.trash-row button','Delete permanently');await wait("document.querySelector('#action-dialog').open");await clickText('#action-buttons button','Cancel');assert.equal(await run("document.querySelectorAll('.trash-row').length"),1);
 await clickText('.trash-row button','Delete permanently');await wait("document.querySelector('#action-dialog').open");await clickText('#action-buttons button','Delete permanently');await wait("document.querySelectorAll('.trash-row').length===0 && document.querySelector('.hub').dataset.busy==='false'");await key('Escape');
 await trashOne(sourceId);await run("document.querySelector('[data-trash-open]').click()");await wait("document.querySelector('#trash-dialog').open");await run("document.querySelector('#empty-trash').click()");await wait("document.querySelector('#action-dialog').open");await clickText('#action-buttons button','Delete permanently');await wait("document.querySelectorAll('.trash-row').length===0 && document.querySelector('.hub').dataset.busy==='false'");await key('Escape');
 assert.equal(await run("(await import('/project-store.js')).getProject('web-sentinel').then(p=>p.name)"),'Keep this Artboard');
 console.log('PASS Trash restore, 30-day countdown, permanent-delete cancellation and confirmed emptying');


 const other=(await browser.send('Target.createTarget',{url:origin+'/hub/'})).targetId;
 const otherInfo=(await(await fetch(debug+'/json')).json()).find(t=>t.id===other);otherPage=new CDP(otherInfo.webSocketDebuggerUrl);
 await wait("window.basementSessionBlocked===true && !!document.querySelector('#basement-session-blocked')",otherPage);
 assert.equal(await evaluate(otherPage,'await window.basementSessionReady'),false);
 assert.equal(await run('window.basementSessionBlocked'),false);
 await browser.send('Target.closeTarget',{targetId:other});otherPage.close();otherPage=null;
 console.log('PASS second tab is blocked without interrupting the active tab');

 // An already-open Artboard can still use local disk while disconnected.
 offline=true;await page.send('Network.enable');await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await wait("navigator.onLine===false && document.querySelector('#basement-connection').hidden===false");
 await run(`(async()=>{const store=await import('/project-store.js'),p=await store.getProject('web-sentinel');p.name='Saved while offline';p.updatedAt=2;await store.putProject(p);})()`);
 assert.equal(await run("(await import('/project-store.js')).getProject('web-sentinel').then(p=>p.name)"),'Saved while offline');
 await page.send('Page.reload');await delay(1500);
 assert.equal(await run("!!document.querySelector('.hub')"),false);
 offline=false;await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await page.send('Page.navigate',{url:origin+'/hub/'});await wait('!!window.basementUpdates?.state.ready');
 assert.equal(await run("(await import('/project-store.js')).getProject('web-sentinel').then(p=>p.name)"),'Saved while offline');
 console.log('PASS open-session disk saving works offline; a fresh visit requires network');

 revision=1;broken=true;await run('window.basementUpdates.check()');
 await wait("window.basementUpdates.state.message.includes('could not be verified')");
 assert.equal(await run('(await navigator.serviceWorker.getRegistration()).waiting===null'),true);
 assert.equal(await run("(await caches.keys()).some(name=>name.startsWith('basement-app-'))"),false);
 console.log('PASS incomplete release is rejected without caching or replacing the active version');
 broken=false;revision=2;await run('window.basementUpdates.check()');await wait('window.basementUpdates.state.waiting');
 const before=await run('performance.timeOrigin');
 await run("document.querySelector('.hub').dataset.busy='true'");await run('window.basementUpdates.update()');
 await wait("window.basementUpdates.state.message.includes('current operation')");assert.equal(await run('performance.timeOrigin'),before);
 await run("document.querySelector('.hub').dataset.busy='false'");
 await run("document.querySelector('.hub').dataset.pendingSave='true'");await run('window.basementUpdates.update()');
 assert.equal(await run('window.basementUpdates.state.updating'),false);assert.match(await run('window.basementUpdates.state.message'),/current operation/);assert.equal(await run('performance.timeOrigin'),before);
 await run("document.querySelector('.hub').dataset.pendingSave='false'");
 const second=(await browser.send('Target.createTarget',{url:origin+'/hub/'})).targetId;
 await delay(300);await run('window.basementUpdates.update()');
 await wait("window.basementUpdates.state.message.includes('Close all other')");assert.equal(await run('performance.timeOrigin'),before);
 await browser.send('Target.closeTarget',{targetId:second});
 await page.send('Page.navigate',{url:origin+'/marble/'});await wait('!!navigator.serviceWorker.controller && !window.basementSessionBlocked');
 const studioReply=await run(`new Promise(resolve=>{navigator.serviceWorker.getRegistration().then(reg=>{const channel=new MessageChannel();channel.port1.onmessage=e=>resolve(e.data);reg.waiting.postMessage({type:'APPLY_UPDATE'},[channel.port2]);});})`);
 assert.equal(studioReply.ok,false);
 await page.send('Page.navigate',{url:origin+'/hub/'});await wait('!!window.basementUpdates?.state.waiting');
 await run('window.basementUpdates.update()');await wait(`performance.timeOrigin!==${before} && window.basementUpdates?.state.build==='${hash()}'`);
 assert.equal(await run("(await import('/project-store.js')).getProject('web-sentinel').then(p=>p.name)"),'Saved while offline');
 assert.equal(await run("(await caches.keys()).some(name=>name.startsWith('basement-app-'))"),false);
 console.log('PASS updates wait for operations and all tabs; Studios cannot apply them; hub update preserves disk data');

 // Releasing the session on navigation allows reopening in the same tab.
 await page.send('Page.navigate',{url:origin+'/marble/'});await wait('await window.basementSessionReady');
 await page.send('Page.navigate',{url:origin+'/hub/'});await wait('await window.basementSessionReady');
 assert.equal(await run('window.basementSessionBlocked'),false);
 console.log('PASS single-tab ownership survives hub / Studio navigation');
 if(process.env.BASEMENT_SCREENSHOTS==='1'){
  await page.send('Page.bringToFront');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});
  await wait("!!document.querySelector('#project-list')?.children.length");
  const capture=async name=>{await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await delay(500);const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/private/tmp/basement-beta2-'+name+'.png',Buffer.from(data,'base64'));};
  await run("document.querySelector('[data-theme-choice=dark]').click()");await capture('dark');
  await run("document.querySelector('[data-theme-choice=light]').click()");await wait("getComputedStyle(document.querySelector('#profile-open')).color==='rgb(17, 17, 17)' && getComputedStyle(document.querySelector('[data-view=projects]')).backgroundColor==='rgb(17, 17, 17)'");await capture('light');
  await run("document.querySelector('[data-theme-choice=dark]').click()");
  await clickSelector('#profile-open');await capture('settings');
  await run("document.querySelector('[data-settings-tab=storage]').click()");await wait("!!document.querySelector('#storage-library-bar [data-storage-segment]')");await capture('storage');
  await run("document.querySelector('[data-theme-choice=light]').click()");await capture('storage-light');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await capture('storage-compact');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1512,height:982,deviceScaleFactor:1,mobile:false});await run("document.querySelector('[data-theme-choice=dark]').click()");
  await run("document.querySelector('#settings').close()");
  await run("document.querySelector('#new-file').click()");await capture('new-artboard');
  await run("document.querySelector('#studio-grid [data-studio=endo]').click()");await capture('new-artboard-details');
  console.log('PASS QA screenshots saved in /private/tmp/basement-beta2-*.png');
 }
}finally{
 otherPage?.close();page?.close();if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}chrome.kill();await new Promise(r=>server.close(r));await delay(500);await rm(temp,{recursive:true,force:true,maxRetries:3});
}
