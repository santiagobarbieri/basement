import assert from 'node:assert/strict';
import {initialState,validate,ment,setGlobalStyle} from '../dist/foundry/model.js';
import {primitives} from '../dist/foundry/render.js';
import {autoFit,SHAPES} from '../dist/foundry/typography.js';
import {makePrimitives,outlineBounds} from '../dist/foundry/geometry.js';
import {importMent} from '../dist/project-store.js';
const s=initialState();s.glyphs.A=[0,1,6];s.shape='rounded';const corner=primitives(s,'A');assert.ok(!corner.some(p=>p.type==='line'&&p.x===.5&&p.y===.5&&p.x2===1.5&&p.y2===1.5));s.roundness=0;const angular=JSON.stringify(primitives(s,'A'));s.roundness=90;assert.notEqual(JSON.stringify(primitives(s,'A')),angular);
for(const shape of SHAPES){s.shape=shape;s.separation=15;validate(s);const one=primitives(s,'A');assert.ok(one.length);assert.deepEqual(one,primitives(s,'A'));autoFit(s);assert.ok(s.overrides.A.advance>0);assert.deepEqual(importMent(ment(s,{id:'shapes',name:shape})).state,s)}
const options={shape:'dots',weight:100,separation:0};const touching=makePrimitives([0],5,options)[0].r;assert.ok(makePrimitives([0],5,{...options,separation:40})[0].r<touching);assert.deepEqual(outlineBounds([{type:'rect',x:1,y:1,width:2}],2),[1,3]);assert.throws(()=>validate({...s,roundness:200}));
console.log('PASS connected corners, roundness, deterministic styles, spacing, auto-fit and .ment');

const legacy=initialState();legacy.glyphs.A=[0,1,6];legacy.glyphs.B=[0,1,6];legacy.overrides={A:{shape:'rounded',weight:60,advance:3.5,offsetX:-.2,width:90},B:{shape:'ring'}};const before=structuredClone(legacy);setGlobalStyle(legacy,'shape','triangle');assert.ok(primitives(legacy,'A').every(p=>p.type==='polygon'));assert.ok(primitives(legacy,'B').every(p=>p.type==='polygon'));assert.equal(legacy.overrides.A.advance,3.5);assert.equal(legacy.overrides.A.offsetX,-.2);assert.equal(legacy.overrides.A.width,90);assert.deepEqual(legacy.glyphs,before.glyphs);setGlobalStyle(legacy,'weight',125);assert.equal(legacy.overrides.A.weight,undefined);assert.deepEqual(importMent(ment(legacy,{id:'legacy',name:'Style'})).state,legacy);console.log('PASS global style replaces legacy exceptions and preserves metrics/drawings');
