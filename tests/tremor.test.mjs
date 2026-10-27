import assert from 'node:assert/strict';
import {livePoints} from '../dist/tremor/motion.js';
import {documentSignature,serializeMent} from '../dist/tremor/ment-format.js';
const stroke={number:1,createdAt:0,tool:{mode:'none'},settings:{brush:'antenna',amount:3,rate:12,roughness:50,settle:0},points:[{x:30,y:20,pressure:1,time:0}]};
const original=structuredClone(stroke);
assert.notDeepEqual(livePoints(stroke,80),livePoints(stroke,400));assert.deepEqual(stroke,original);
for(let t=0;t<2000;t+=80){const p=livePoints(stroke,t)[0];assert.ok(Math.abs(p.x-30)<=3);assert.ok(Math.abs(p.y-20)<=3)}
stroke.settings.amount=0;assert.deepEqual(livePoints(stroke,800),stroke.points);
stroke.settings.amount=3;stroke.settings.settle=100;assert.ok(Math.abs(livePoints(stroke,60000)[0].x-30)<.001);
const state={scene:{frameTime:1000},defaults:{},tool:{mode:'none'},strokes:[stroke],nextNumber:2};const signature=documentSignature(state);state.scene.frameTime=2000;assert.equal(documentSignature(state),signature);
const doc=JSON.parse(serializeMent(state,{id:'test'}));assert.equal(doc.artboard.studio,'tremor');assert.deepEqual(doc.artboard.layers[0].strokes[0].points[0],{...stroke.points[0],finish:false});
console.log('PASS: bounded per-stroke motion, original samples, zero amount, settling, stable save status, Tremor .ment');
