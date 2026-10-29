import assert from 'node:assert/strict';
import {renderBrushSample,renderMaterialSample} from '../dist/endo-samples.js';
import {BRUSH_PRESETS,MATERIALS,normalizeBlending} from '../dist/endo-brushes.js';
import {renderLayerDocument} from '../dist/endo-renderer.js';
const makeCanvas=(width=240,height=96)=>{const context={writes:0,last:null,clearRect(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(image){this.writes++;this.last=image.data.slice();}};return{width,height,getContext(){return context;}};};
const scene={merge:2,light:225,relief:.8,smooth:0,shine:75,grain:12},frame={id:'sample-frame',name:'Sample',x:0,y:0,width:240,height:96,background:null};
function actual(settings,blending,width=240,height=96){
 const canvas=makeCanvas(width,height),points=[];
 for(let i=0;i<=80;i++){const t=i/80;points.push({x:28+184*t,y:48+12*Math.sin((t-.5)*Math.PI*2),time:i*10,pressure:1,finish:i===80});}
 const stroke={number:1,layerId:'sample-layer',operation:'paint',settings,tool:{mode:'none'},points};
 const layer={id:'sample-layer',name:'Sample',frameId:frame.id,kind:'paint',visible:true,locked:false,opacity:1,filters:[],...(blending?{blending}:{} )},resolution=Math.min(width/240,height/96);
 return renderLayerDocument(canvas,[stroke],scene,[layer],{infinite:true,resolution,originX:-(width/resolution-240)/2,originY:-(height/resolution-96)/2,logicalWidth:240,logicalHeight:96,frame}).image.data;
}
const hashes=new Set();
for(const preset of BRUSH_PRESETS){
 const canvas=makeCanvas(),source=structuredClone(preset);assert.equal(renderBrushSample(canvas,preset),canvas);const pixels=canvas.getContext().last;
 assert.ok(pixels.some((value,i)=>i%4===3&&value>0),preset.label+' has realpaint');assert.equal(pixels[3],0,'Transparent sample canvas stays transparent');
 const settings={brush:'basic',tip:preset.tip,width:preset.width,hardness:preset.hardness,inkOpacity:preset.inkOpacity,angle:preset.angle,variation:0,speed:0,primary:'#8795a8',shadow:'#10141b',contrast:'#eff5ff'};
 assert.deepEqual(pixels,actual(settings),'Brush sample is exact output of the drawing renderer');hashes.add(pixels.toString());assert.deepEqual(preset,source);
 const writes=canvas.getContext().writes;renderBrushSample(canvas,preset);assert.equal(canvas.getContext().writes,writes,'Unchanged appearance does no rendering or copying');
 renderBrushSample(canvas,preset,{primary:'#ff6600'});assert.notDeepEqual(canvas.getContext().last,pixels,'Gallery updates when actualpaintcolorchanges');
}
assert.equal(hashes.size,BRUSH_PRESETS.length,'Every gallery preset has a distinct actual mark');
const materials=new Set();
for(const material of MATERIALS){
 const canvas=makeCanvas(256,96),settings={primary:'#b35336',shadow:'#160b08',contrast:'#fff4df',strength:85,density:72,roughness:45};renderMaterialSample(canvas,material.id,settings);const pixels=canvas.getContext().last;
 assert.ok(pixels.some((value,i)=>i%4===3&&value>0));materials.add(pixels.toString());
 const stroke={brush:'basic',tip:'round',width:42,hardness:100,inkOpacity:100,angle:0,variation:0,speed:0,primary:settings.primary,shadow:'#10141b',contrast:'#eff5ff'};
 assert.deepEqual(pixels,actual(stroke,normalizeBlending({...settings,material:material.id}),256,96),'Material sample uses exact current layer shader and colors');
 const writes=canvas.getContext().writes;renderMaterialSample(canvas,material.id,settings);assert.equal(canvas.getContext().writes,writes);
}
assert.equal(materials.size,MATERIALS.length,'Normal and all six materials have distinct real appearances');
const inherited=makeCanvas();renderMaterialSample(inherited,'cromo',{primary:'#326799'});const inheritedStroke={brush:'basic',tip:'round',width:42,hardness:100,inkOpacity:100,angle:0,variation:0,speed:0,primary:'#326799',shadow:'#10141b',contrast:'#eff5ff'};
assert.deepEqual(inherited.getContext().last,actual(inheritedStroke,normalizeBlending({material:'cromo',primary:'#326799'})),'Inherited material sample follows actual derived shadow/highlight colors, not an invented palette');
const inheritedWrites=inherited.getContext().writes;renderMaterialSample(inherited,'cromo',{primary:'#326799',unrelatedSelection:42});assert.equal(inherited.getContext().writes,inheritedWrites,'Selection and other unrelated UI state never invalidate visual previews');
const noEffect=makeCanvas();renderMaterialSample(noEffect,'cement',{strength:0});const normal=makeCanvas();renderMaterialSample(normal,'none');assert.deepEqual(noEffect.getContext().last,normal.getContext().last,'Zero-strength preview visibly shows untreated paint');
const first=makeCanvas(120,48);renderBrushSample(first,'round',{pixelRatio:2});assert.deepEqual([first.width,first.height],[240,96]);renderBrushSample(first,'round',{pixelRatio:2});assert.deepEqual([first.width,first.height],[240,96],'DPR never grows exponentially across repeatedpaint');
const second=makeCanvas(240,96);renderBrushSample(second,'round');const writes=second.getContext().writes;renderBrushSample(second,'round');assert.equal(second.getContext().writes,writes,'Sharedcache still honors percanvasno-op');assert.deepEqual(first.getContext().last,second.getContext().last,'DPRoutputmatchesactualphysicalrender');
console.log('PASS real rendered brush/material previews, every preset distinct, exact shader/color parity, transparency, percanvas/no-op caching and stable Retina dimensions');
