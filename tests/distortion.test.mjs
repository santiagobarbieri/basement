import assert from 'node:assert/strict';
import {subdivide,adaptiveGrid,extractPalette,applyPalette,mergeVariation,point,matrix,composeCollage,collageDefaults,initialState,buildGrid,polygon,pick,regrid,reset,base,distribute,jitter,History,capture,ment,validate,exportSize,selectionBox,randomizeAll,TYPES,GRID_PRESETS,restoreComposition} from '../dist/distortion/model.js';
import {importMent,projectUrl} from '../dist/project-store.js';
const s=initialState();s.source={id:'image',name:'test',width:800,height:600,data:'data:image/png;base64,AA=='};s.fragments=buildGrid(s.source,s.grid);assert.equal(s.fragments.length,64);const area=p=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-a.y*b.x},0)/2);assert.equal(s.fragments.reduce((n,f)=>n+area(f.source.polygon),0),480000);
for(const skew of [0,.25,-.4]){const g={...s.grid,skewX:skew,skewY:-.2,originX:.45,originY:-.35};const cells=buildGrid(s.source,g);assert.ok(Math.abs(cells.reduce((n,f)=>n+area(f.source.polygon),0)-480000)<1e-6);assert.equal(new Set(cells.map(f=>f.id)).size,cells.length);assert.deepEqual(cells,buildGrid(s.source,g));for(let y=13;y<600;y+=47)for(let x=17;x<800;x+=41)assert.ok(pick({...s,fragments:cells},{x,y}));}
const f=s.fragments[0],source=structuredClone(f.source);f.transform.x=450;f.transform.angle=35;assert.deepEqual(f.source,source);assert.notDeepEqual(polygon(f),source.polygon);reset(f,'transform');assert.deepEqual(polygon(f),source.polygon);
s.fragments[1].transform.x=-100;s.fragments[1].z=999;assert.equal(pick(s,{x:50,y:30}).id,s.fragments[1].id);reset(s.fragments[1],'transform');
s.seed=67;distribute(s);const types=s.fragments.map(f=>f.type);distribute(s);assert.deepEqual(s.fragments.map(f=>f.type),types);s.jitter={position:40,rotation:15,scale:20};jitter(s);const first=structuredClone(s.fragments);jitter(s);assert.deepEqual(s.fragments,first);s.jitter={position:0,rotation:0,scale:0};jitter(s);assert.ok(s.fragments.every(f=>f.jitter.x===0&&f.jitter.scale===1));
const h=new History(),before=capture(s);s.fragments[0].type='dither';s.fragments[2].type='pixel';h.commit(before,capture(s));assert.equal(h.past.length,1);const back=h.step(capture(s));assert.deepEqual(back,before);assert.deepEqual(h.step(back,true),s);const imported=importMent(ment(s,{id:'a',name:'Fragments'}));assert.deepEqual(imported.state,s);assert.match(projectUrl(imported),/^\/distortion\//);
s.fragments[0].transform.x=-900;const size=exportSize(s,4096);assert.ok(size.x<0);assert.ok(size.width<=4096&&size.width*size.height<=16010000);assert.deepEqual(validate(s),s);assert.throws(()=>validate({...s,grid:{...s.grid,rows:1000}}));const invalid=capture(s);invalid.fragments[0].source.polygon[0].x=9999;assert.throws(()=>validate(invalid));const prior=s.fragments[2].type;regrid(s,{...s.grid,skewX:.1});assert.equal(s.fragments.find(f=>f.source.col===2&&f.source.row===0).type,prior);
console.log('PASS affine partition, coverage, identity, source independence, picking, deterministic tools, history, serialization and export bounds');

const randomBase=capture(s);
randomBase.fragments[0].transform={x:42,y:-17,angle:37,sx:1.4,sy:.7,opacity:.6};
randomBase.jitter={position:18,rotation:12,scale:9};jitter(randomBase);
randomBase.fragments[1].deleted=true;
const geometry=s=>({grid:s.grid,jitter:s.jitter,fragments:s.fragments.map(f=>({id:f.id,source:f.source,transform:f.transform,jitter:f.jitter,z:f.z,deleted:f.deleted}))});
for(let seed=0;seed<50;seed++){
 const a=capture(randomBase),b=capture(randomBase);randomizeAll(a,seed);randomizeAll(b,seed);
 assert.deepEqual(a,b);assert.deepEqual(geometry(a),geometry(randomBase));assert.deepEqual(a.fragments[1],randomBase.fragments[1]);assert.deepEqual(validate(a),a);assert.deepEqual(a.source,randomBase.source);
 assert.deepEqual(importMent(ment(a,{id:'random',name:'Random'})).state,a);
 assert.ok(a.fragments.every(f=>TYPES.includes(f.type)));
 const history=new History();history.commit(randomBase,a);assert.deepEqual(history.step(a),randomBase);
}
const legacy=capture(randomBase);for(const type of ['halftone','lines','duotone','invert'])delete legacy.weights[type];assert.equal(validate(legacy).weights.halftone,0);
console.log('PASS 50 randomizer seeds: deterministic, valid, reversible, serializable, source preserved; legacy weights migrated');

for(const preset of GRID_PRESETS){const g={...initialState().grid};for(const key of ['columns','rows','skewX','skewY','originX','originY'])g[key]=preset[key];const a=capture(randomBase);regrid(a,g);assert.deepEqual(validate(a),a);assert.ok(Math.abs(a.fragments.reduce((n,f)=>n+area(f.source.polygon),0)-480000)<1e-6);}
const restored=restoreComposition(randomBase);assert.deepEqual(restored.grid,randomBase.grid);assert.deepEqual(restored.source,randomBase.source);assert.deepEqual(restored.fragments,buildGrid(randomBase.source,randomBase.grid));assert.deepEqual(validate(restored),restored);const resetHistory=new History();resetHistory.commit(randomBase,restored);assert.deepEqual(resetHistory.step(restored),randomBase);assert.deepEqual(resetHistory.step(randomBase,true),restored);
console.log('PASS six grid presets cover source; global restore preserves grid/source and supports undo/redo');

const controlled=capture(randomBase);controlled.randomizer={amount:0,originalColors:true};const untouched=capture(controlled);randomizeAll(controlled,123);assert.deepEqual(controlled,untouched);
controlled.randomizer.amount=25;const prev=capture(controlled);randomizeAll(controlled,123);const changed=controlled.fragments.filter((f,i)=>JSON.stringify(f)!==JSON.stringify(prev.fragments[i]));assert.equal(changed.length,Math.round(controlled.fragments.filter(f=>!f.deleted).length*.25));assert.ok(changed.every(f=>f.params.originalColors&&!['duotone','invert'].includes(f.type)));assert.deepEqual(geometry(controlled),geometry(prev));
const only=capture(randomBase);only.randomizer={amount:100,originalColors:false};const ids=new Set([only.fragments[0].id]);randomizeAll(only,78,ids);assert.deepEqual(only.fragments.slice(1),randomBase.fragments.slice(1));
console.log('PASS randomizer amount zero/25%, selection scope, original colors and geometry preservation');

for(let seed=0;seed<50;seed++){
 const a=capture(randomBase),b=capture(randomBase);a.collage=collageDefaults();b.collage=collageDefaults();
 composeCollage(a,seed);composeCollage(b,seed);assert.deepEqual(a,b);assert.deepEqual(geometry(a),geometry(randomBase));
 assert.deepEqual(a.fragments[1],randomBase.fragments[1]);assert.deepEqual(validate(a),a);
 const alive=a.fragments.filter(f=>!f.deleted);assert.equal(alive.filter(f=>f.type!=='original').length,Math.round(alive.length*.6));
 assert.ok(['original','ascii','pixel','halftone','contour'].every(t=>alive.some(f=>f.type===t)));
 assert.deepEqual(importMent(ment(a,{id:'collage',name:'Collage'})).state,a);
 const history=new History();history.commit(randomBase,a);assert.deepEqual(history.step(a),randomBase);assert.deepEqual(history.step(randomBase,true),a);
}
const scoped=capture(randomBase);scoped.collage={...collageDefaults(),amount:100,palette:'source'};
composeCollage(scoped,42,new Set([scoped.fragments[0].id]));assert.deepEqual(scoped.fragments.slice(1),randomBase.fragments.slice(1));
assert.equal(scoped.fragments[0].type,'pixel');assert.equal(scoped.fragments[0].params.levels,0);
const zero=capture(randomBase);zero.collage={...collageDefaults(),amount:0};composeCollage(zero,12);assert.ok(zero.fragments.filter(f=>!f.deleted).every(f=>f.type==='original'));
const invalidCollage=capture(zero);invalidCollage.collage.scale=0;assert.throws(()=>validate(invalidCollage));
const old=capture(randomBase);delete old.weights.solid;assert.equal(validate(old).weights.solid,0);
console.log('PASS collage: 50 seeds, exact coverage, all treatments, preserved geometry/deletions, selection, source palette, undo/redo, .ment and legacy migration');

for(const skew of [0,.3,-.3]){
 const a=initialState();a.source=s.source;a.grid.skewX=skew;a.fragments=buildGrid(a.source,a.grid);
 const parent=a.fragments[20];parent.transform={...base(),x:45,y:-20,angle:30,sx:1.2,sy:.8};parent.jitter={x:3,y:4,angle:5,scale:1.1};parent.type='ascii';
 const m=matrix(parent),originalArea=a.fragments.reduce((n,f)=>n+area(f.source.polygon),0),ids=subdivide(a,new Set([parent.id]));assert.ok(ids.length>=2);assert.deepEqual(validate(a),a);
 for(const id of ids){const child=a.fragments.find(f=>f.id===id);assert.equal(child.type,'ascii');for(const v of child.source.polygon){const expected=point(m,v),actual=point(matrix(child),v);assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-6);}}
 assert.ok(Math.abs(a.fragments.reduce((n,f)=>n+area(f.source.polygon),0)-originalArea)<1e-6);
 subdivide(a,new Set(ids));assert.deepEqual(validate(a),a);assert.deepEqual(importMent(ment(a,{id:'split',name:'Split'})).state,a);
 const malformed=capture(a);malformed.splits.push('fake');assert.throws(()=>validate(malformed));
}
const protectedState=capture(randomBase);protectedState.fragments[0].protected=true;protectedState.fragments[2].locked=true;const held=capture(protectedState);composeCollage(protectedState,889);randomizeAll(protectedState,891);for(const index of [0,2])assert.deepEqual(protectedState.fragments[index],held.fragments[index]);assert.deepEqual(subdivide(protectedState,new Set([protectedState.fragments[2].id])),[]);
const priorChannels=capture(randomBase),candidate=capture(randomBase);composeCollage(candidate,178);mergeVariation(priorChannels,candidate,{distribution:false,textures:true,colors:false});assert.deepEqual(candidate.fragments.map(f=>f.type),priorChannels.fragments.map(f=>f.type));for(let i=0;i<candidate.fragments.length;i++)for(const k of ['foreground','background'])assert.equal(candidate.fragments[i].params[k],priorChannels.fragments[i].params[k]);
const colors=extractPalette(Uint8ClampedArray.from([255,0,0,255,255,0,0,255,0,0,255,255,0,255,0,0]));assert.equal(colors.length,2);assert.equal(colors[0].color,'#ff0000');
const pal=capture(protectedState);pal.palette={colors,influence:65};applyPalette(pal);assert.deepEqual(pal.fragments[0],protectedState.fragments[0]);assert.deepEqual(validate(pal),pal);
console.log('PASS mixed-size partitions/skew/transforms, recursive .ment, malformed splits, protected/locked pieces, separate variation channels and extracted palette');

const {anchoredPoint,motionSettings,hasMotion}=await import('../dist/distortion/motion.js');
for(let seed=1;seed<=20;seed++)for(const size of [2,12,80]){
 const box={x:0,y:0,right:800,bottom:600},p={x:270,y:280};
 const first=anchoredPoint(p,{seed,time:0,amount:20},size,box),loop=anchoredPoint(p,{seed,time:2,amount:20},size,box),next=anchoredPoint(p,{seed,time:.001,amount:20},size,box);
 assert.ok(Math.hypot(first.x-p.x,first.y-p.y)<=size*.22+1e-9);assert.ok(Math.hypot(first.x-loop.x,first.y-loop.y)<1e-8);assert.ok(Math.hypot(next.x-first.x,next.y-first.y)<.1);
 assert.deepEqual(anchoredPoint({x:0,y:200},{seed,time:.5,amount:20},size,box),{x:0,y:200});
 const normal=anchoredPoint(p,{seed,time:.7,amount:20},size,box,{x:1,y:0});assert.equal(normal.y,p.y);
}
const localMotion=initialState();localMotion.source=s.source;localMotion.fragments=buildGrid(s.source,localMotion.grid);localMotion.fragments[0].type='ascii';localMotion.fragments[0].overrides={motionEnabled:true,jitterAmount:4};assert.ok(hasMotion(localMotion));assert.equal(motionSettings(localMotion,localMotion.fragments[0]).amount,4);localMotion.fragments[0].locked=true;assert.ok(!hasMotion(localMotion));
const four=initialState();four.source=s.source;four.fragments=buildGrid(s.source,four.grid);four.collage=collageDefaults();composeCollage(four,21);assert.ok(four.fragments.every(f=>TYPES.includes(f.type)));assert.deepEqual(TYPES,['original','contour','ascii','pixel','halftone']);
console.log('PASS anchored motion: bounded displacement, temporal continuity, periodicity, fixed boundaries, normal displacement and per-fragment overrides; four active treatments');

const {styleDefaults,paletteDefaults,resolveTreatment,upgradeStyle,setAdjustment}=await import('../dist/distortion/style-model.js');
const coherent=initialState();coherent.source=s.source;coherent.fragments=buildGrid(s.source,coherent.grid);coherent.palette={colors:[{color:'#f03355',weight:100,enabled:true}]};
for(const f of coherent.fragments){f.params.foreground='#00ff00';f.params.background='#0000ff';f.params.palette=[{color:'#ffff00',weight:100,enabled:true}];f.params.paletteMix=100;}
assert.ok(coherent.fragments.every(f=>resolveTreatment(coherent,f).colors[0].color==='#f03355'));
setAdjustment(coherent,null,'brightness',.2);setAdjustment(coherent,[coherent.fragments[0]],'contrast',2);assert.equal(resolveTreatment(coherent,coherent.fragments[1]).brightness,.2);assert.equal(resolveTreatment(coherent,coherent.fragments[0]).contrast,2);assert.equal(coherent.style.contrast,1);
setAdjustment(coherent,null,'contrast',1.3);assert.equal(resolveTreatment(coherent,coherent.fragments[0]).contrast,2);assert.equal(resolveTreatment(coherent,coherent.fragments[1]).contrast,1.3);delete coherent.fragments[0].overrides;assert.equal(resolveTreatment(coherent,coherent.fragments[0]).contrast,1.3);
composeCollage(coherent,77);assert.ok(coherent.fragments.every(f=>resolveTreatment(coherent,f).colors[0].color==='#f03355'));assert.deepEqual(importMent(ment(coherent,{id:'shared',name:'Shared'})).state,coherent);assert.deepEqual(validate(coherent),coherent);
const legacyStyle=capture(coherent);delete legacyStyle.style;legacyStyle.fragments[0].params.motionEnabled=true;const upgraded=upgradeStyle(legacyStyle);assert.equal(upgraded.style.version,1);assert.equal(upgraded.fragments[0].overrides.motionEnabled,true);assert.deepEqual(upgradeStyle(capture(upgraded)),upgraded);
assert.throws(()=>setAdjustment(coherent,[coherent.fragments[0]],'background','#ffffff'));const invalidOverrides=capture(coherent);invalidOverrides.fragments[0].overrides={foreground:'#ffffff'};assert.throws(()=>validate(invalidOverrides));
console.log('PASS shared style: obsolete local colors ignored, global inheritance, local numeric exceptions, reset, randomization, .ment, legacy upgrade and color override rejection');
