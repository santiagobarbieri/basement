import assert from 'node:assert/strict';
import {moveFrameBounds,resizeFrameBounds} from '../dist/endo-transform.js';

const frame={id:'frame-1',x:100,y:200,width:400,height:200};
assert.deepEqual(moveFrameBounds(frame,21,17),{x:121,y:217,width:400,height:200});
assert.deepEqual(moveFrameBounds(frame,21,17,{shiftKey:true}),{x:121,y:200,width:400,height:200});
assert.deepEqual(moveFrameBounds(frame,17,-21,{shiftKey:true}),{x:100,y:179,width:400,height:200});
assert.deepEqual(resizeFrameBounds(frame,'se',50,30),{x:100,y:200,width:450,height:230});
assert.deepEqual(resizeFrameBounds(frame,'nw',50,30),{x:150,y:230,width:350,height:170});
assert.deepEqual(resizeFrameBounds(frame,'e',50,100),{x:100,y:200,width:450,height:200});
assert.deepEqual(resizeFrameBounds(frame,'s',100,50),{x:100,y:200,width:400,height:250});
assert.deepEqual(resizeFrameBounds(frame,'w',5000,0),{x:436,y:200,width:64,height:200});
assert.deepEqual(resizeFrameBounds(frame,'n',0,5000),{x:100,y:336,width:400,height:64});
assert.deepEqual(resizeFrameBounds(frame,'nw',-5000,-5000),{x:-1548,y:-1648,width:2048,height:2048});
assert.deepEqual(resizeFrameBounds(frame,'se',50,30,{altKey:true}),{x:50,y:170,width:500,height:260});
assert.deepEqual(resizeFrameBounds(frame,'se',50,50,{shiftKey:true}),{x:100,y:200,width:500,height:250});
assert.deepEqual(resizeFrameBounds(frame,'e',100,0,{shiftKey:true}),{x:100,y:175,width:500,height:250});
assert.deepEqual(resizeFrameBounds(frame,'nw',-100,-50,{shiftKey:true,altKey:true}),{x:0,y:150,width:600,height:300});
for(const handle of ['nw','n','ne','e','se','s','sw','w']){
 for(const dx of [-5000,-200,0,200,5000])for(const dy of [-5000,-200,0,200,5000])for(const altKey of [false,true])for(const shiftKey of [false,true]){
  const result=resizeFrameBounds(frame,handle,dx,dy,{altKey,shiftKey});
  assert.ok(result.width>=64&&result.width<=2048);assert.ok(result.height>=64&&result.height<=2048);
  if(altKey){assert.equal(result.x+result.width/2,300);assert.equal(result.y+result.height/2,300);}
  else{
   if(handle.includes('w'))assert.equal(result.x+result.width,500);
   if(handle.includes('e'))assert.equal(result.x,100);
   if(handle.includes('n'))assert.equal(result.y+result.height,400);
   if(handle.includes('s'))assert.equal(result.y,200);
  }
  if(shiftKey)assert.ok(Math.abs(result.width/result.height-2)<.02,'Proportions stay constrained within pixel rounding');
 }
}
assert.deepEqual(frame,{id:'frame-1',x:100,y:200,width:400,height:200});
console.log('PASS artboard move and eight resize handles: opposite anchors, min/max, Shift proportions, Alt center and immutable inputs');
