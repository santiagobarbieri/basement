import assert from 'node:assert/strict';
import { toolTransforms, transformPoint, symmetrySurface } from '../dist/symmetry.js';
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
console.log('PASS: copy counts, axes, grid offsets, mosaic reflection, width-preserving transforms, deterministic replay, single editable stroke per gesture');
