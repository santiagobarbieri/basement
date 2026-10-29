import assert from 'node:assert/strict';
import {ChromeSurface,rebuild} from '../dist/engine.js';
import {exportGeometry,documentBounds} from '../dist/document-bounds.js';
import {normalizeEndoState} from '../dist/endo-model.js';
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
// Infinite coordinates remain supported by the engine, but downloads now use
// one finite artboard. Legacy overflow is preserved in gestures, never exported
// as an unbounded bitmap or silently deleted during normalization.
const distant=normalizeEndoState({infinite:true,scene,defaults:settings,strokes:[stroke(-100000,0),{...stroke(100000,0),number:2}]});
const exported=exportGeometry(distant);
assert.ok(exported.width<=4096&&exported.height<=4096);
assert.equal(distant.strokes.length,2);
assert.ok(distant.frames[0].legacyOverflow);
const finite=normalizeEndoState({scene,defaults:settings,strokes:[stroke(10,10)]});
const frame=finite.frames[0];
assert.deepEqual(exportGeometry(finite),{x:frame.x,y:frame.y,width:frame.width*2,height:frame.height*2,name:frame.name,frameId:frame.id,background:null});
assert.throws(()=>exportGeometry({...finite,frames:[{...frame,width:4096}]}),/invalid frame/);
console.log('PASS: distant engine coordinates, bounded viewport allocation, finite artboard export and preserved legacy overflow');
