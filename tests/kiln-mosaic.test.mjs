import assert from 'node:assert/strict';
import {chooseTile,motionTone} from '../dist/kiln/renderers/tiles.js';
import {initialState,TILES} from '../dist/kiln/model.js';
const catalog=[{name:'dark',tone:.1},{name:'mid',tone:.45},{name:'light',tone:.8}];
assert.equal(chooseTile(catalog,0).name,'dark');assert.equal(chooseTile(catalog,1).name,'light');assert.equal(chooseTile(catalog,.5).name,'mid');assert.equal(chooseTile(catalog,-1).name,'dark');assert.equal(chooseTile(catalog,2).name,'light');
const state=initialState();assert.equal(state.tool,'tiles');assert.equal(state.tiles.version,2);assert.equal(TILES.length,8);assert.deepEqual(state.tiles.enabled,TILES);
console.log('PASS: mosaic-only defaults, eight ceramic tiles, tonal matching and clamped input luminance');

assert.equal(motionTone(.3,0,0,1000,false),.3);
assert.equal(motionTone(.3,0,0,undefined,true),.3);
assert.notEqual(motionTone(.3,0,0,1000,true),motionTone(.3,0,0,3000,true));
assert.notEqual(motionTone(.5,0,0,1000,true,1),motionTone(.5,0,0,1000,true,2));
assert.notEqual(motionTone(.3,0,0,1000,true,1),motionTone(.3,1,0,1000,true,1));
assert.equal(motionTone(.3,2,4,1234,true,27),motionTone(.3,2,4,1234,true,27));
assert.ok(Math.abs(motionTone(.3,2,3,0,true)-motionTone(.3,2,3,4000,true))<1e-12);
assert.equal(initialState().tiles.motion,false);

const {pngDimensions}=await import('../dist/kiln/geometry.js');
assert.deepEqual(pngDimensions({...state,source:{width:720,height:960}}),{width:4500,height:6000});
const square=pngDimensions({...state,source:{width:1000,height:1000}});assert.ok(square.width*square.height<=32_000_000);

assert.equal(motionTone(.3,2,4,1234,true,27,0),.3);
assert.equal(motionTone(.3,2,4,500,true,27,100,2),motionTone(.3,2,4,1000,true,27,100,1));
assert.notEqual(motionTone(.3,2,4,1234,true,27,50),motionTone(.3,2,4,1234,true,27,150));
