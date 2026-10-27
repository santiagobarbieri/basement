import assert from 'node:assert/strict';
import {ChromeSurface,rebuild} from '../dist/engine.js';
import {exportGeometry,documentBounds} from '../dist/document-bounds.js';
const ctx={clearRect(){},putImageData(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}}};
const settings={width:24,variation:0,speed:0,primary:'#8795a8',shadow:'#10141b',contrast:'#eff5ff'};
const scene={relief:.8,smooth:0,merge:2,light:225,shine:75,grain:12};
const stroke=(x,y)=>({number:1,settings:{...settings},tool:{mode:'none'},points:[{x,y,time:0,pressure:1},{x:x+50,y:y+20,time:100,pressure:1,finish:true}]});
for(const [x,y] of [[-2000,-3000],[3000,5000]]){
 const surface=new ChromeSurface({width:100,height:100,getContext(){return ctx}},{infinite:true,originX:x-10,originY:y-10,logicalWidth:960,logicalHeight:850});
 const strokes=[stroke(1e6,1e6),stroke(x,y)];rebuild(surface,strokes,scene);surface.render(scene,strokes.map(s=>s.settings));
 assert.ok(surface.image.data.some((v,i)=>i%4===3&&v>0),'Off-board strokes must render');
 assert.ok(surface.owner.some(v=>v===1),'Culling must preserve material IDs');assert.equal(surface.height.length,10000);
 const bounds=documentBounds({infinite:true,strokes:[strokes[1]],scene});assert.ok(bounds.x<x&&bounds.y<y);assert.ok(bounds.width<200&&bounds.height<200);
}
assert.throws(()=>exportGeometry({infinite:true,scene,strokes:[stroke(-100000,0),stroke(100000,0)]}),/demasiado grande/);
assert.deepEqual(exportGeometry({infinite:false,strokes:[stroke(10,10)]}),{x:0,y:0,width:1920,height:1700});
console.log('PASS: negative and distant drawing, bounded viewport allocation, material IDs, export bounds and oversized export rejection');
