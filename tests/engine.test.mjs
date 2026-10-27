import assert from 'node:assert/strict';
import { ChromeSurface, StrokeBuilder, rebuild } from '../dist/engine.js';
const ctx = { clearRect() {}, createImageData(w,h) { return { data: new Uint8ClampedArray(w*h*4) }; }, putImageData() {} };
const surface = new ChromeSurface({ width: 160, height: 120, getContext() { return ctx; } });
const local = { width: 24, variation: 30, speed: 35, primary: '#8795a8', shadow: '#10141b', contrast: '#eff5ff' };
const scene = { merge: 2, light: 225, relief: .8, smooth: 45, shine: 75, grain: 12 };
const strokes = [20, 80].map(y => ({ settings: { ...local }, points: [
  { x: 20, y, time: 0, pressure: 1 }, { x: 50, y: y + 16, time: 50, pressure: 1 },
  { x: 90, y, time: 100, pressure: 1 }, { x: 140, y, time: 200, pressure: 1, finish: true },
] }));
for (let id=0; id<strokes.length; id++) {
  const b = new StrokeBuilder(surface, { ...strokes[id].settings, ...scene }, id);
  for (const p of strokes[id].points) b.add(p, p.finish);
}
const incremental = surface.height.slice();
rebuild(surface, strokes, scene);
assert.deepEqual(surface.height, incremental, 'Replay must match incremental drawing with global geometry');
const render = () => { surface.render(scene, strokes.map(s=>s.settings), true); return surface.image.data.slice(); };
let previous = render();
for (const [key, value] of [['grain',100], ['shine',20], ['light',45]]) {
  const height = surface.height.slice(), owner = surface.owner.slice();
  scene[key] = value; const next = render();
  assert.deepEqual(surface.height,height,'Shading must preserve fusion geometry');
  for (const id of [0,1]) assert(owner.some((v,i)=>v===id && [0,1,2].some(c=>previous[i*4+c]!==next[i*4+c])), `${key} must change both strokes`);
  previous=next;
}
const raw = structuredClone(strokes);
for (const [key,value] of [['relief',1.6], ['smooth',0]]) {
  const before=surface.height.slice(); scene[key]=value; rebuild(surface,strokes,scene);
  for (const [start,end] of [[0,60],[60,120]]) {
    let changed=false; for(let i=start*160;i<end*160;i++) if(before[i]!==surface.height[i]) changed=true;
    assert(changed,`${key} must update geometry in both strokes`);
  }
  assert.deepEqual(strokes,raw,'Global edits must preserve stroke data'); render();
}
const before=surface.height.slice(); strokes[0].settings.width=48; rebuild(surface,strokes,scene);
assert.notDeepEqual(surface.height,before,'Existing width must remain editable');
assert.deepEqual(strokes[1],raw[1],'Width edit must preserve the other stroke');
previous=render();const heights=surface.height.slice(),owners=surface.owner.slice();
strokes[0].settings.primary='#ff0000';const next=render();assert.deepEqual(surface.height,heights);
for(let i=0;i<owners.length;i++) if(owners[i]!==0) for(let c=0;c<4;c++) assert.equal(next[i*4+c],previous[i*4+c],'Colors remain local');
console.log('PASS: shared texture, shine, lighting, relief and smoothing; deterministic replay; independent width and colors; original gestures preserved');