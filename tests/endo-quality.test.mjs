import assert from 'node:assert/strict';
import {QUALITY_PRESETS,qualityMode,readQuality,displayPixelRatio} from '../dist/endo-quality.js';
import {FrameSurface,rebuildLayers,renderLayerDocument} from '../dist/endo-renderer.js';

assert.equal(qualityMode(undefined),'high');assert.equal(qualityMode('unknown'),'high');assert.equal(qualityMode('__proto__'),'high');
for(const mode of Object.keys(QUALITY_PRESETS))assert.equal(qualityMode(mode),mode);
assert.equal(QUALITY_PRESETS.draft.pixelBudget,1_200_000);assert.equal(QUALITY_PRESETS.standard.pixelBudget,3_000_000);assert.equal(QUALITY_PRESETS.high.pixelBudget,6_000_000);
for(const [mode,cap]of [['draft',1],['standard',1.5],['high',2]]){
 assert.equal(displayPixelRatio(mode,3),cap);assert.equal(displayPixelRatio(mode,1),1);assert.equal(displayPixelRatio(mode,0),1);assert.equal(displayPixelRatio(mode,-2),1);assert.equal(displayPixelRatio(mode,NaN),1);
}
assert.equal(displayPixelRatio('high',1.25),1.25);assert.equal(displayPixelRatio('unknown',4),2);
const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
try{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(key){assert.equal(key,'basement-endo-quality');return 'draft';}}});assert.equal(readQuality(),'draft');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){return 'bad';}}});assert.equal(readQuality(),'high');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw Error('Denied');}}});assert.equal(readQuality(),'high','An unavailable preference never prevents drawing');
}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}

const context={clearRect(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},putImageData(){}};
const canvas=(width,height)=>({width,height,getContext(){return context;}});
const frames=[{id:'active',name:'Active',x:0,y:0,width:320,height:256,background:null},{id:'other',name:'Other',x:400,y:0,width:320,height:256,background:null}];
const paint=(id,frameId)=>({id,name:id,frameId,kind:'paint',visible:true,locked:false,opacity:1,filters:[]});
const layers=[paint('a','active'),paint('b','other')];
const settings={width:21,variation:0,speed:0,brush:'cromo',contrast:'#eff5ff',primary:'#8795a8',shadow:'#10141b'};
const scene={merge:1,light:225,relief:.8,smooth:0,shine:75,grain:12};
const stroke=(number,layerId,dx)=>({number,layerId,operation:'paint',settings:{...settings},tool:{mode:'none'},points:[{x:40+dx,y:80,time:0,pressure:1},{x:220+dx,y:140,time:100,pressure:1,finish:true}]});
const strokes=[stroke(1,'a',0),stroke(2,'b',400)];
const documentBefore=structuredClone({frames,layers,strokes});
const surface=new FrameSurface(canvas(720,280),{resolution:2,quality:'draft'});surface.setDocument(strokes,layers,frames,'active');rebuildLayers(surface,strokes,scene,layers);surface.render(scene,strokes.map(stroke=>stroke.settings));
const draft=surface.qualityInfo.find(item=>item.active),other=surface.qualityInfo.find(item=>!item.active),draftEntry=surface.entries.get('active');
assert.ok(other.width<=96&&other.height<=96,'Inactive artboards keep bounded flattened thumbnails');assert.equal(surface.entries.get('other').inner,null);
surface.setQuality('high');assert.equal(surface.entries.size,0,'Changing preview quality releases stale rasters');surface.render(scene,strokes.map(stroke=>stroke.settings));
const highEntry=surface.entries.get('active'),high=surface.qualityInfo.find(item=>item.active);
assert.notEqual(highEntry,draftEntry);assert.ok(high.width*high.height>draft.width*draft.height*2,'High retains substantially more editing detail than Draft');
assert.equal(surface.qualityInfo.find(item=>!item.active).width,other.width,'Raising quality never refines inactive artboards');
const count=highEntry.renders;surface.render(scene,strokes.map(stroke=>stroke.settings));assert.equal(highEntry.renders,count,'A settled quality change replays each frame only once');
surface.setQuality('high');surface.render(scene,strokes.map(stroke=>stroke.settings));assert.equal(surface.entries.get('active'),highEntry,'Selecting the current quality preserves the existing cache');assert.equal(highEntry.renders,count);
surface.setView({resolution:2,originX:15,originY:12});surface.render(scene,strokes.map(stroke=>stroke.settings));assert.equal(surface.entries.get('active'),highEntry,'Panning at the chosen quality does not replay source gestures');assert.equal(highEntry.renders,count);

const large={id:'large',name:'Large',x:0,y:0,width:2048,height:2048,background:null},many=Array.from({length:64},(_,i)=>paint('layer-'+i,'large'));
let previousArea=0;
for(const mode of ['draft','standard','high']){
 const bounded=new FrameSurface(canvas(40,40),{resolution:3,quality:mode});bounded.setDocument([],many,[large],'large');bounded.render(scene,[]);
 const info=bounded.qualityInfo[0],area=info.width*info.height;
 assert.ok(area*info.paintLayers<=QUALITY_PRESETS[mode].pixelBudget,mode+' bounds the whole layer stack');
 assert.ok(area>previousArea,mode+' receives a larger memory budget than the preceding mode');previousArea=area;
}
assert.deepEqual({frames,layers,strokes},documentBefore,'Preview quality never mutates portable document data');
const fullBefore=renderLayerDocument(canvas(640,512),strokes,scene,layers,{resolution:2,infinite:true,originX:0,originY:0,frame:frames[0]}).image.data;
surface.setQuality('draft');surface.render(scene,strokes.map(stroke=>stroke.settings));
const fullAfter=renderLayerDocument(canvas(640,512),strokes,scene,layers,{resolution:2,infinite:true,originX:0,originY:0,frame:frames[0]}).image.data;
assert.deepEqual(fullAfter,fullBefore,'Export reconstructs the same full-quality image regardless of the editing preference');
assert.ok(fullAfter.some((value,index)=>index%4===3&&value>0),'The export comparison includes rendered paint');
console.log('PASS quality presets, preference fallback, display DPR caps, detail/budget tradeoff, cache invalidation, inactive thumbnails and export independence');
