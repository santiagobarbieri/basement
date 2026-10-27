import assert from 'node:assert/strict';
import vm from 'node:vm';
import {initialState,copy,drop,growingDrop,holdRadius,stroke,dropPoint,strokePoint,sprinkle,example,validate,History,ment,LIMITS} from '../dist/marble/engine.js';
import {warp} from '../dist/marble/runtime.js';
import {animatedHTML,svg,embedCode} from '../dist/marble/export.js';
import {importMent,projectUrl} from '../dist/project-store.js';
const s=initialState();drop(s,{x:480,y:360});assert.equal(s.shapes.length,1);assert.deepEqual(validate(s),s);
const first=s.shapes[0],distance=Math.hypot(first.points[0].x-480,first.points[0].y-360);assert.ok(Math.abs(distance-65)<1e-7);
const p={x:35,y:12},c={x:0,y:0},r=10,q=dropPoint(p,c,r);assert.ok(Math.abs(q.x*q.x+q.y*q.y-(p.x*p.x+p.y*p.y)-r*r)<1e-6);
for(const mode of ['stroke','comb']){const t={...s.tool,mode};const a={x:10,y:30},b={x:100,y:80},moved=strokePoint(p,a,b,t),back=strokePoint(moved,b,a,t);assert.ok(Math.hypot(back.x-p.x,back.y-p.y)<1e-7);}
const history=new History(),before=copy(s);stroke(s,{x:50,y:300},{x:400,y:350},{...s.tool,mode:'comb'});assert.notDeepEqual(s.shapes,before.shapes);history.commit(before,s);assert.deepEqual(history.step(s),before);assert.deepEqual(history.step(before,true),s);
for(const seed of [0,1,17,314,4294967295]){const a=initialState(),b=initialState();example(a,seed);example(b,seed);assert.deepEqual(a,b);assert.deepEqual(validate(a),a);assert.equal(a.shapes.length,14);assert.ok(a.shapes.reduce((n,v)=>n+v.points.length,0)<=LIMITS.points);console.log('Seed',seed,':',a.shapes.reduce((n,v)=>n+v.points.length,0),'points');}
const pattern=initialState();example(pattern,7);const original=copy(pattern);for(let i=0;i<20;i++){const point={x:i*40,y:i*30};for(const t of [0,.5,2,8]){const v=warp(point,pattern.bath,pattern.motion,t),back=warp(v,pattern.bath,pattern.motion,t,true);assert.ok(Math.hypot(back.x-point.x,back.y-point.y)<1e-7);}assert.ok(Math.hypot(warp(point,pattern.bath,pattern.motion,0).x-warp(point,pattern.bath,pattern.motion,8).x,warp(point,pattern.bath,pattern.motion,0).y-warp(point,pattern.bath,pattern.motion,8).y)<1e-7);}assert.deepEqual(pattern,original);
const imported=importMent(ment(pattern,{id:'marble-test',name:'Test'}));assert.deepEqual(imported.state,pattern);assert.match(projectUrl(imported),/^\/marble\//);
const html=animatedHTML(pattern,'</script><img src=x onerror=alert(1)>');assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('src="http'));const script=html.match(/<script>([\s\S]*)<\/script>/)[1];new vm.Script(script);assert.ok(!script.includes('import '));assert.match(embedCode('Marble #1'),/Marble%20%231.html/);assert.match(embedCode('Marble #1','video'),/autoplay muted loop playsinline/);
assert.match(svg(pattern),/<clipPath/);const invalid=copy(pattern);invalid.shapes[0].points[0].x=Infinity;assert.throws(()=>validate(invalid));assert.throws(()=>validate({...pattern,palette:['red']}));
const full=initialState();full.shapes=Array.from({length:LIMITS.shapes},()=>({color:0,points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]}));const fullBefore=copy(full);assert.throws(()=>drop(full,{x:30,y:40}));assert.deepEqual(full,fullBefore);
console.log('PASS drops, area relation, inverse strokes/combs, seed determinism, budgets, history, motion loop/inverse, .ment/hub, SVG and self-contained safe HTML');

const bath=initialState(),base=copy(bath),center={x:400,y:300};
growingDrop(bath,base,center,.1,2);const small=bath.shapes[0],smallRadius=Math.hypot(small.points[0].x-center.x,small.points[0].y-center.y);
growingDrop(bath,base,center,1.5,2);const large=bath.shapes[0],largeRadius=Math.hypot(large.points[0].x-center.x,large.points[0].y-center.y);assert.ok(largeRadius>smallRadius);assert.equal(bath.shapes.length,1);assert.equal(large.ink,base.palette[2]);assert.deepEqual(base.shapes,[]);
const withFirst=copy(bath);growingDrop(bath,withFirst,{x:500,y:300},.5,1);growingDrop(bath,withFirst,{x:500,y:300},2,1);const direct=copy(withFirst);growingDrop(direct,withFirst,{x:500,y:300},2,1);assert.deepEqual(bath,direct);assert.equal(bath.shapes.length,2);assert.notDeepEqual(bath.shapes[0].points,withFirst.shapes[0].points);
const ownInk=bath.shapes[0].ink;bath.palette[2]='#ff00ff';assert.equal(bath.shapes[0].ink,ownInk);assert.equal(holdRadius(1000,180,bath.bath),Math.min(bath.bath.width,bath.bath.height)*.5);
const heldHistory=new History();heldHistory.commit(withFirst,bath);assert.deepEqual(heldHistory.step(bath),withFirst);
const legacy=copy(bath);delete legacy.shapes[0].ink;assert.equal(validate(legacy).shapes[0].ink,legacy.palette[legacy.shapes[0].color]);
console.log('PASS single-color drops, hold duration growth, fixed origin, frame-independent displacement, own ink, capped radius, one history entry and old-project ink migration');
