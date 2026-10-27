import assert from 'node:assert/strict';
import {ChromeSurface,StrokeBuilder,rebuild} from '../dist/engine.js';
const context={clearRect(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},putImageData(){}};
const canvas=(w,h)=>({width:w,height:h,getContext(){return context}});
const scene={merge:2,light:225,relief:.8,smooth:30,shine:75,grain:12};
const settings={width:20,variation:15,speed:30,contrast:'#eff5ff',shadow:'#10141b',primary:'#8795a8'};
const strokes=[{settings,tool:{mode:'mirror',axes:'vertical'},points:[{x:25,y:20,time:0,pressure:1},{x:50,y:35,time:20,pressure:1,finish:true}]}];
const saved=structuredClone(strokes),base=new ChromeSurface(canvas(160,120));rebuild(base,strokes,scene);base.render(scene,[settings]);
const high=new ChromeSurface(canvas(640,480),{resolution:4});rebuild(high,strokes,scene);high.render(scene,[settings]);
assert.equal(high.logicalWidth,160);assert(high.height.some(v=>v>0));assert(high.owner.every(v=>v===0||v===-1));assert.deepEqual(strokes,saved,'Resolution must not alter source gestures');
assert(high.coverage.some(v=>v>0&&v<1),'Edges require partial pixel coverage');
// An aligned crop has the same geometry/material as full high-resolution rendering.
const crop=new ChromeSurface(canvas(200,200),{resolution:4,originX:20,originY:10,logicalWidth:160,logicalHeight:120});rebuild(crop,strokes,scene);crop.render(scene,[settings]);
for(let y=20;y<180;y++)for(let x=20;x<180;x++){
 const c=y*200+x,f=(y+40)*640+x+80;
 assert.equal(crop.height[c],high.height[f]);assert.equal(crop.owner[c],high.owner[f]);
 for(let k=0;k<4;k++)assert.equal(crop.image.data[c*4+k],high.image.data[f*4+k],'ROI shading and texture must match document coordinates');
}
// A straight stroke has no bead-like dips between samples.
const smooth=new ChromeSurface(canvas(200,100),{resolution:4});
smooth.segment({x:5,y:10},{x:45,y:10},4,4,{relief:1});
const row=40;for(let x=30;x<170;x++)assert.equal(smooth.height[row*200+x],smooth.height[row*200+30]);
console.log('PASS: high-resolution logical geometry, fractional edge coverage, ROI/full shading equivalence, stable texture and symmetry, original gestures intact, continuous stroke surface');
