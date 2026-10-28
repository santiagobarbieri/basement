import assert from 'node:assert/strict';
import { toolTransforms, transformPoint, symmetrySurface, toolRegion } from '../dist/symmetry.js';
import { ChromeSurface, StrokeBuilder, rebuild } from '../dist/engine.js';
const w=160,h=120,anchor={x:30,y:20};
const near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} ≠ ${b}`);
for (const tool of [{mode:'none'},{mode:'mandala',count:8},{mode:'mirror',axes:'both'},{mode:'grid',columns:3,rows:2},{mode:'mosaic',columns:3,rows:2}]) {
 const transforms=toolTransforms(tool,w,h,anchor);
 for(const t of transforms){const a=transformPoint(anchor,t),b=transformPoint({x:45,y:35},t);near(Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(15,15));}
}
assert.equal(toolTransforms({mode:'mandala',count:8},w,h,anchor).length,8);
const mirrored=toolTransforms({mode:'mirror',axes:'both'},w,h,anchor).map(t=>transformPoint(anchor,t));assert.deepEqual(mirrored,[anchor,{x:130,y:20},{x:30,y:100},{x:130,y:100}]);
for (const axes of ['vertical','horizontal']) assert.equal(toolTransforms({mode:'mirror',axes},w,h,anchor).length,2);
const grid=toolTransforms({mode:'grid',columns:2,rows:2},w,h,anchor).map(t=>transformPoint(anchor,t));assert.deepEqual(grid,[anchor,{x:110,y:20},{x:30,y:80},{x:110,y:80}]);
const mosaic=toolTransforms({mode:'mosaic',columns:2,rows:2},w,h,anchor).map(t=>transformPoint(anchor,t));assert.deepEqual(mosaic,[anchor,{x:130,y:20},{x:30,y:100},{x:130,y:100}]);

// Moving a repeat region moves its axes, center and source cell by the same
// world-space offset. The brush and distances are never scaled by the region.
const region={x:-260,y:370,width:160,height:120};
const shiftedAnchor={x:region.x+anchor.x,y:region.y+anchor.y};
for(const tool of [{mode:'mandala',count:8},{mode:'mirror',axes:'both'},{mode:'mirror',axes:'horizontal'},{mode:'grid',columns:2,rows:2},{mode:'mosaic',columns:2,rows:2}]){
 const local=toolTransforms(tool,w,h,anchor);
 const moved=toolTransforms({...tool,region},960,850,shiftedAnchor);
 assert.equal(moved.length,local.length);
 for(let i=0;i<moved.length;i++){
  const a=transformPoint(shiftedAnchor,moved[i]),b=transformPoint(anchor,local[i]);
  near(a.x,b.x+region.x);near(a.y,b.y+region.y);
  const end=transformPoint({x:shiftedAnchor.x+15,y:shiftedAnchor.y+15},moved[i]);
  near(Math.hypot(end.x-a.x,end.y-a.y),Math.hypot(15,15));
 }
}
const center={x:region.x+region.width/2,y:region.y+region.height/2};
for(const transform of toolTransforms({mode:'mandala',count:5,region},960,850,shiftedAnchor)){
 const p=transformPoint(center,transform);near(p.x,center.x);near(p.y,center.y);
}
const sourceInLastCell={x:region.x+110,y:region.y+80};
assert.deepEqual(toolTransforms({mode:'grid',columns:2,rows:2,region},960,850,sourceInLastCell).map(t=>transformPoint(sourceInLastCell,t)),
 [{x:-230,y:390},{x:-150,y:390},{x:-230,y:450},{x:-150,y:450}]);
assert.deepEqual(toolRegion({region},960,850),region);
assert.deepEqual(toolRegion({region:{...region,width:0}},w,h),{x:0,y:0,width:w,height:h});
assert.deepEqual(toolRegion({region:{...region,x:NaN}},w,h),{x:0,y:0,width:w,height:h});
assert.deepEqual(toolTransforms({mode:'none',region},w,h,shiftedAnchor),[{a:1,b:0,c:0,d:1,tx:0,ty:0}]);

// The renderer receives a clip rectangle only for explicit repeat regions.
const calls=[];
const recorder={logicalWidth:w,logicalHeight:h,dab(...args){calls.push(['dab',...args])},segment(...args){calls.push(['segment',...args])}};
const ink={width:12,primary:'#123456'};
const repeated=symmetrySurface(recorder,{mode:'mirror',axes:'vertical',region},shiftedAnchor);
repeated.paintId=7;repeated.dab(shiftedAnchor.x,shiftedAnchor.y,6,.8,ink);
repeated.segment(shiftedAnchor,{x:shiftedAnchor.x+20,y:shiftedAnchor.y},6,4,ink);
assert.equal(recorder.paintId,7);assert.equal(calls.length,4);
for(const call of calls){assert.deepEqual(call.at(-1).clipRect,region);assert.equal(call.at(-1).width,12)}
assert.equal(ink.clipRect,undefined,'Clipping does not mutate saved material settings');
calls.length=0;symmetrySurface(recorder,{mode:'mirror',axes:'vertical'},anchor).dab(anchor.x,anchor.y,6,.8,ink);
for(const call of calls)assert.equal(call.at(-1),ink,'Legacy strokes remain unclipped');
calls.length=0;symmetrySurface(recorder,{mode:'none',region},shiftedAnchor).dab(shiftedAnchor.x,shiftedAnchor.y,6,.8,ink);
assert.equal(calls[0].at(-1),ink,'Freehand drawing is not clipped by a remembered region');
const ctx={clearRect(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},putImageData(){}};
const scene={merge:2,light:225,relief:.8,smooth:45,shine:75,grain:12};
const settings={width:8,variation:30,speed:35,primary:'#8795a8',shadow:'#10141b',contrast:'#eff5ff'};
for(const tool of [{mode:'mandala',count:8},{mode:'mirror',axes:'both'},{mode:'grid',columns:2,rows:2},{mode:'mosaic',columns:2,rows:2}]){
 const surface=new ChromeSurface({width:w,height:h,getContext(){return ctx}});
 const stroke={settings:{...settings},tool:{...tool},points:[{...anchor,time:0,pressure:1},{x:45,y:25,time:10,pressure:.6},{x:55,y:30,time:20,pressure:1,finish:true}]};
 const b=new StrokeBuilder(symmetrySurface(surface,stroke.tool,anchor),{...settings,...scene},0);for(const p of stroke.points)b.add(p,p.finish);
 const before=surface.height.slice();rebuild(surface,[stroke],scene);assert.deepEqual(surface.height,before,`${tool.mode} must survive rebuild`);
 assert(surface.height.some(v=>v>0));assert(surface.owner.every(v=>v===-1||v===0),'All copies belong to a single stroke');
 const toolBefore=structuredClone(stroke.tool);stroke.settings.width=12;rebuild(surface,[stroke],scene);assert.notDeepEqual(surface.height,before,'Width edits all copies');assert.deepEqual(stroke.tool,toolBefore);
}
console.log('PASS: copy counts, local region centers/axes/cells, negative origins, explicit clipping, legacy replay, brush widths and single editable stroke per gesture');
