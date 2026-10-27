import assert from 'node:assert/strict';
import {initialState,validate,resizeGrid,ment} from '../dist/foundry/model.js';
import {primitives,glyphSVG,textSVG} from '../dist/foundry/render.js';
import {importMent,projectUrl} from '../dist/project-store.js';
const state=initialState();assert.ok(Object.values(state.glyphs).every(c=>c.length===0));state.glyphs.A=[0,1,5];assert.equal(primitives(state,'A').length,3);state.shape='rounded';assert.ok(primitives(state,'A').some(p=>p.type==='line'));assert.ok(!glyphSVG(state,'A').includes('background'));state.previewText='<A&';assert.ok(textSVG(state).startsWith('<svg'));const bigger=resizeGrid(state,7,9);assert.equal(bigger.columns,7);assert.equal(bigger.glyphs.A.length,3);assert.equal(state.columns,5);
const imported=importMent(ment(state,{id:'test',name:'Foundry'}));assert.equal(imported.studio,'foundry');assert.deepEqual(imported.state,state);assert.ok(projectUrl(imported).startsWith('/foundry/'));assert.throws(()=>validate({...state,glyphs:{A:[999]}}));assert.throws(()=>validate({...state,color:'red" onload="alert(1)'}));
console.log('PASS: blank alphabet, shapes, resizing, SVG and Foundry .ment roundtrip');

const extended=initialState();extended.glyphs.A=[0];extended.overrides={A:{weight:50,shape:'squares',advance:3}};extended.tester={size:48,leading:1.5,align:'right',bg:'dark'};extended.previewText='A\nAA';assert.equal(primitives(extended,'A')[0].width,.5);assert.equal(primitives(extended,'A')[0].type,'rect');assert.match(textSVG(extended),/translate\(0,10.5\)/);assert.deepEqual(validate(extended),extended);assert.throws(()=>validate({...extended,overrides:{A:{advance:-1}}}));
