import {camera,toWorld,restoreCamera} from './zoom.js';
import {createFrames} from './frames.js';
import { livePoints } from './motion.js';
import { createSaver } from './file-save.js';
import { presetsForBrush } from './color-presets.js';
import { History } from './history.js';
import { symmetrySurface, toolTransforms, transformPoint } from './symmetry.js';
import { ChromeSurface, StrokeBuilder, rebuild } from './engine.js';

const strokeControls = [
  ['width','Base Width',2,100,14,1,'px','Ancho del trazo.'],
  ['inkOpacity','Opacity',5,100,100,1,'%','Opacidad del pincel.'],
  ['amount','Amount',0,6,3,.1,'px','Desplazamiento máximo del trazo.'],
  ['rate','Speed',1,24,12,1,'fps','Frecuencia de renovación del temblor.'],
  ['roughness','Roughness',0,100,70,1,'%','Temblor suave o irregular.'],
  ['settle','Settle',0,100,0,1,'%','Cero mantiene el movimiento; valores altos lo asientan más rápido.'],
  ['noise','Noise',0,100,10,1,'%','Grano fino que cambia con el temblor.'],
];
const sceneControls = [];
const geometryKeys = new Set(strokeControls.map(row=>row[0]));
const defaults = { brush:'tremor', animation:'antenna', variation:0, speed:0, primary:'#d9d2ed', shadow:'#382f4a', contrast:'#ffffff' };
const scene = { background:'transparent', backgroundColor:'#102d40', merge:1, light:225, relief:.8, smooth:25, shine:0, grain:0 };
for (const [key,,,,value] of strokeControls) defaults[key]=value;
const strokes = [];
const art = document.querySelector('#artboard');
const viewport = document.querySelector('#canvas-viewport');
const modeButtons = [...document.querySelectorAll('.cursor-modes button')];
const preview = document.querySelector('#preview');
const overlay = document.querySelector('#selection');
function visibleSurface(){art.width=Math.max(1,viewport.clientWidth);art.height=Math.max(1,viewport.clientHeight);overlay.width=art.width;overlay.height=art.height;return new ChromeSurface(art,{infinite:true,resolution:camera.scale,originX:-camera.x/camera.scale,originY:-camera.y/camera.scale,logicalWidth:960,logicalHeight:850})}
let surface=visibleSurface();const sample=new ChromeSurface(preview);
const fields = new Map();
const tool = { mode: 'none', count: 8, axes: 'vertical', columns: 3, rows: 3 };
const guides = document.querySelector('#guides');
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const history = new History();
let edit = null, nextNumber = 1;
const selection=new Set(),frames=[];let frameEditor=null;
let selected = null, active = null, scheduled = false, geometryDirty = false, shadeDirty = false;
let refinementBusy = false;
const saver = createSaver({
  loadState: saved=>{const normalize=p=>({...defaults,...p,brush:'tremor',animation:p.animation||(['antenna','signal','ghost'].includes(p.brush)?p.brush:'antenna')});saved.defaults=normalize(saved.defaults||{});saved.strokes=saved.strokes.map(stroke=>({...stroke,settings:normalize(stroke.settings)}));Object.assign(tool,saved.tool);restoreState({...snapshot(),...saved,selected:null,selection:[]});history.past=[];history.future=[];restoreCamera(saved.view);},
  getState:()=>({...snapshot(),tool:{...tool},view:{...camera},exportTarget:document.querySelector('#export-target').value}),
  isBusy:()=>active!==null||!!frameEditor?.dragging,
  prepare: () => {
    finishEdit();
    if (geometryDirty) rebuild(surface, strokes, scene);
    surface.render(scene, strokes.map(stroke => stroke.settings), true);
  },
  getPreview: () => art.toDataURL('image/png'),
});


function snapshot() {
  return {infinite:true,frames:frames.map(f=>({...f})),scene:{...scene}, defaults: { ...defaults }, selected, selection:[...selection], nextNumber,
    strokes: strokes.map(s => ({ ...s, settings: { ...s.settings }, tool: { ...s.tool }, points: s.points })) };
}
function syncCommands() {
  document.querySelector('#return').disabled = active !== null || !history.past.length;
  document.querySelector('#restore').disabled = active !== null || !history.future.length;
  document.querySelector('#delete').disabled = active !== null || selected === null;
  saver.update();
}
function finishEdit() {
  if (!edit) return;
  history.commit(edit.before, snapshot()); edit = null; syncCommands();
}
function beginEdit(element) {
  if (edit?.element !== element) { finishEdit(); edit = { element, before: snapshot() }; }
  saver.markChanged();
}
function restoreState(state) {
  Object.assign(scene, state.scene); Object.assign(defaults, state.defaults);
  strokes.splice(0, strokes.length, ...state.strokes.map(s => ({ ...s, settings: { ...s.settings }, tool: { ...s.tool } })));
  frames.splice(0,frames.length,...(state.frames||[]).map(f=>({...f})));selected = state.selected; selection.clear(); for(const id of state.selection || (selected===null?[]:[selected])) selection.add(id); nextNumber = state.nextNumber;
  syncControls(); schedule({ geometry: true, shade: true });
}
for (const [id, action] of [['return', 'undo'], ['restore', 'redo']]) {
  document.querySelector('#' + id).addEventListener('click', () => {
    if (active) return;
    finishEdit(); const state = history[action](); if (state) restoreState(state);
  });
}
document.querySelector('#delete').addEventListener('click', () => {
  if (active || selected === null) return;
  finishEdit(); const before = snapshot();
  for(const id of [...selection].sort((a,b)=>b-a)) strokes.splice(id,1); selection.clear(); selected=null;
  history.commit(before, snapshot()); syncControls(); schedule({ geometry: true, shade: true });
});
function editableSettings() { return selection.size ? [...selection].map(id=>strokes[id].settings) : [defaults]; }
function currentSettings() { return selected === null ? defaults : strokes[selected].settings; }
document.addEventListener('endo-color-preset', e => {
  const preset = presetsForBrush(currentSettings().brush)[e.detail];
  if (active || !preset) return;
  finishEdit(); const before = snapshot();
  for(const settings of editableSettings()) Object.assign(settings,preset.colors);
  history.commit(before, snapshot());
  syncControls();
  if (selected !== null) schedule({ shade: true });
});


function schedule({ geometry = false, shade = false } = {}) {
  geometryDirty ||= geometry;
  shadeDirty ||= shade;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const refinementChanged = geometryDirty || shadeDirty || surface.bounds !== null || (active !== null) !== refinementBusy;
    if (geometryDirty) rebuild(surface, strokes, scene);
    surface.render(scene, strokes.map(stroke => stroke.settings), geometryDirty || shadeDirty);
    geometryDirty = false;
    shadeDirty = false;
    highlight();
    if (refinementChanged) {
      refinementBusy = active !== null;
      document.dispatchEvent(new CustomEvent('endo-artboard-rendered', { detail: { strokes, scene, busy: refinementBusy } }));
    }
  });
}

function highlight() {
  const ctx = overlay.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,overlay.width,overlay.height);frameEditor?.draw(ctx);
  if (selected === null || active) return;
  for(const id of selection) {
  const stroke = strokes[id];
  ctx.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);
  const transforms=toolTransforms(stroke.tool,960,850,stroke.points[0]);
  const points = stroke.points.flatMap(p => transforms.map(t => transformPoint(p, t)));
  const radius = stroke.settings.width * .75 + 4;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  x0-=radius;y0-=radius;x1+=radius;y1+=radius;
  const size = Math.min(10/camera.scale, (x1 - x0) / 2, (y1 - y0) / 2);
  if (size <= 0) continue;
  ctx.strokeStyle = '#a878ef'; ctx.lineWidth=1.5/camera.scale;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.moveTo(x + dx * size, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * size);
  }
  ctx.stroke();
  }
}

function refreshPreview() {
  const q={...currentSettings(),width:Math.min(100,currentSettings().width*1.6)};
  const points=[];
  for(let x=60;x<580;x+=3)points.push({x,y:105+45*Math.sin(x/95),time:x*2,pressure:1});
  const stroke={number:1,settings:q,tool:{mode:'none'},points};
  rebuild(sample,[stroke],scene);sample.render(scene,[q]);
}

function syncControls() {
  const p = currentSettings();
  document.querySelector('#background-mode').value=scene.background;
  document.querySelector('#background-color').value=scene.backgroundColor;
  document.querySelector('#background-color').disabled=active!==null || scene.background==='transparent';
  document.querySelector('#background-mode').disabled=active!==null;
  document.querySelector('.canvas-wrap').style.background=scene.background==='color'?scene.backgroundColor:'#d9d9d9';
  document.querySelector('#color-presets').dataset.brush = p.brush || 'cromo';
  for (const button of document.querySelectorAll('[data-animation]')) {
    button.setAttribute('aria-pressed', String(editableSettings().every(s=>button.dataset.animation === (s.animation || 'antenna'))));
    button.disabled = active !== null;
  }
  for (const [key, field] of fields) {
    field.input.value = field.global ? scene[key] : (p[key] ?? (key === 'ridge' ? 55 : key === 'roughness' ? 40 : defaults[key]));
    field.refresh();
    const mixed=!field.global && editableSettings().some(s=>s[key]!==p[key]);
    field.input.closest('.control').classList.toggle('mixed',mixed);
    field.number.placeholder=mixed?'—':'';
    field.number.title=mixed?'Valores distintos; escribir aplica a todos':'';
    if(mixed)field.number.value='';
    field.input.disabled = active !== null;
    field.number.disabled = active !== null;
  }
  for (const key of ['primary', 'shadow', 'contrast']) {
    const input = document.querySelector(`#${key}`);
    input.value = p[key]; input.disabled = active !== null;
  }
  for (const button of modeButtons) button.disabled = active !== null;
  syncTools();
  syncCommands();
  const label = selection.size>1 ? `${selection.size} trazos seleccionados` : selected === null ? 'Próximo trazo' : `Trazo ${strokes[selected].number}`;
  document.querySelector('#stroke-scope').textContent = label;
  document.querySelector('#animation-scope').textContent=label;frameEditor?.refresh();
  refreshPreview();
  highlight();
  document.dispatchEvent(new Event('endo-settings'));
}

function addControls(controls, target, global) {
  for (const [key, label, min, max, , step, unit, help] of controls) {
    const row = document.createElement('div');
    row.className = 'control'; row.title = help;
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}"><span class="numeric-value"><input type="number" min="${min}" max="${max}" step="${step}" aria-label="${label} valor"><span>${unit}</span></span>`;
    const input = row.querySelector('input[type=range]'), number = row.querySelector('input[type=number]');
    const refresh = () => {
      const value = Number(input.value);
      input.style.setProperty('--fill', `${(value - min) / (max - min) * 100}%`);
      if (document.activeElement !== number) number.value = Number(value.toFixed(2));
    };
    const apply = element => {
      beginEdit(element);
      const settings = global ? scene : currentSettings();
      if(global) settings[key]=Number(input.value); else for(const target of editableSettings()) target[key]=Number(input.value);
      refresh(); refreshPreview();
      if (global || selected !== null) schedule({ geometry: geometryKeys.has(key), shade: true });
    };
    fields.set(key, { input, number, refresh, global });
    input.addEventListener('input', () => apply(input));
    number.addEventListener('input', () => {
      if (!Number.isFinite(number.valueAsNumber)) return;
      input.value = Math.max(min, Math.min(max, number.valueAsNumber));
      apply(number);
    });
    for (const element of [input, number]) {
      element.addEventListener('change', finishEdit);
      element.addEventListener('blur', () => { finishEdit(); number.value = input.value; refresh(); });
    }
    number.addEventListener('keydown', e => { if (e.key === 'Enter') number.blur(); });
    document.querySelector(target).append(row);
  }
}
addControls(strokeControls.slice(0,2), '#controls', false);
addControls(strokeControls.slice(2), '#animation-controls', false);
for (const button of document.querySelectorAll('[data-animation]')) button.addEventListener('click', () => {
  if (active) return;
  finishEdit(); const before = snapshot();
  const p = currentSettings();
  if (editableSettings().every(s=>(s.animation||'antenna')===button.dataset.animation)) return;
  for(const settings of editableSettings()) settings.animation=button.dataset.animation;
  history.commit(before, snapshot()); syncControls();
  if (selected !== null) schedule({ geometry: true, shade: true });
});
for (const key of ['primary', 'shadow', 'contrast']) {
  document.querySelector(`#${key}`).addEventListener('input', e => {
    beginEdit(e.target);
    for(const settings of editableSettings()) settings[key]=e.target.value;
    refreshPreview();
    if (selected !== null) schedule({ shade: true });
  });
  document.querySelector(`#${key}`).addEventListener('change', finishEdit);
  document.querySelector(`#${key}`).addEventListener('blur', finishEdit);
}

function point(e,finish=false){return {...toWorld(e.clientX,e.clientY),time:e.timeStamp,pressure:e.pointerType==='pen'?Math.max(.08,e.pressure):1,finish};}

art.addEventListener('pointerdown', e => {
  if(active!==null||e.button!==0||['pan','frame'].includes(viewport.dataset.mode))return;
  if (viewport.dataset.mode === 'select') {
    e.preventDefault(); finishEdit();
    if (geometryDirty) { rebuild(surface, strokes, scene); geometryDirty = false; shadeDirty = true; }
    const rect=art.getBoundingClientRect(),p={x:(e.clientX-rect.left)*art.width/rect.width,y:(e.clientY-rect.top)*art.height/rect.height};const tolerance=6;
    let best = Infinity, picked = null;
    for (let y = Math.max(0, Math.floor(p.y) - tolerance); y <= Math.min(art.height - 1, Math.ceil(p.y) + tolerance); y++) {
      for (let x = Math.max(0, Math.floor(p.x) - tolerance); x <= Math.min(art.width - 1, Math.ceil(p.x) + tolerance); x++) {
        const id = surface.owner[y * art.width + x], distance = (x - p.x) ** 2 + (y - p.y) ** 2;
        if (id >= 0 && distance <= tolerance ** 2 && distance < best) { picked = id; best = distance; }
      }
    }
    if(e.shiftKey) { if(picked!==null) { if(selection.has(picked))selection.delete(picked);else selection.add(picked); } }
    else { selection.clear(); if(picked!==null)selection.add(picked); }
    selected=selection.size?[...selection].at(-1):null; syncControls(); schedule(); return;
  }
  e.preventDefault();
  finishEdit(); const before = snapshot();
  // Flush any queued geometry edit before an incremental stroke is added.
  if (geometryDirty) { rebuild(surface, strokes, scene); geometryDirty = false; shadeDirty = true; }
  const settings = { ...currentSettings() };
  const id = strokes.length;
  const strokeTool = { ...tool };
  const p = point(e);
  strokes.push({ number: nextNumber++, settings, createdAt: performance.now(), tool: strokeTool, points: [] });
  selection.clear();selection.add(id);selected = id;
  active = { before, pointerId: e.pointerId, id, builder: new StrokeBuilder(symmetrySurface(surface, strokeTool, p), { ...settings, ...scene }, id) };
  art.setPointerCapture(e.pointerId);
  strokes[id].points.push(p); active.builder.add(p);
  syncControls(); schedule();
});
art.addEventListener('pointermove', e => {
  if (active?.pointerId !== e.pointerId) return;
  const events = e.getCoalescedEvents?.() || [];
  for (const event of events.length ? events : [e]) {
    const p = point(event);
    strokes[active.id].points.push(p); active.builder.add(p);
  }
  schedule();
});
function end(e) {
  if (active?.pointerId !== e.pointerId) return;
  if (e.type === 'pointerup') {
    const p = point(e, true);
    strokes[active.id].points.push(p); active.builder.add(p, true);
  }
  const id = active.pointerId, before = active.before;
  active = null;
  history.commit(before, snapshot());
  if (art.hasPointerCapture(id)) art.releasePointerCapture(id);
  syncControls(); schedule();
}
function syncTools() {
  for (const button of toolButtons) {
    button.setAttribute('aria-pressed', String(tool.mode === button.dataset.tool));
    button.disabled = active !== null;
  }
  document.querySelector('#mandala-settings').hidden = tool.mode !== 'mandala';
  document.querySelector('#mirror-settings').hidden = tool.mode !== 'mirror';
  document.querySelector('#tile-settings').hidden = !['grid', 'mosaic'].includes(tool.mode);
  for (const input of document.querySelectorAll('#tool-settings input, #tool-settings select')) input.disabled = active !== null;
  const mode = tool.mode === 'none' ? 'Trazo libre' : tool.mode[0].toUpperCase() + tool.mode.slice(1);
  document.querySelector('.session').textContent = mode + (tool.mode === 'none' ? ' · ' + ({antenna:'Antena',signal:'Señal',ghost:'Fantasma'}[currentSettings().animation] || 'Antena') : ' Tool Active');
  drawGuides();
  saver.update();
}
function drawGuides() {
  const ctx=guides.getContext('2d'),w=960,h=850;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,guides.width,guides.height);ctx.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);
  ctx.strokeStyle = 'rgba(0,85,255,.22)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath();
  if (tool.mode === 'mandala') {
    const r = Math.hypot(w, h);
    for (let i = 0; i < tool.count; i++) {
      const angle = i * Math.PI * 2 / tool.count;
      ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.cos(angle) * r, h / 2 + Math.sin(angle) * r);
    }
  } else if (tool.mode === 'mirror') {
    if (tool.axes !== 'horizontal') { ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); }
    if (tool.axes !== 'vertical') { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
  } else if (['grid', 'mosaic'].includes(tool.mode)) {
    for (let i = 1; i < tool.columns; i++) { ctx.moveTo(w * i / tool.columns, 0); ctx.lineTo(w * i / tool.columns, h); }
    for (let i = 1; i < tool.rows; i++) { ctx.moveTo(0, h * i / tool.rows); ctx.lineTo(w, h * i / tool.rows); }
  }
  ctx.stroke();
}
for (const button of toolButtons) button.addEventListener('click', () => {
  tool.mode = tool.mode === button.dataset.tool ? 'none' : button.dataset.tool;
  syncTools();
});
for (const key of ['count', 'columns', 'rows']) {
  const input = document.querySelector('#tool-' + key), output = document.querySelector('#tool-' + key + '-value');
  const update = () => {
    tool[key] = Number(input.value); if (document.activeElement !== output) output.value = input.value;
    input.style.setProperty('--fill', ((tool[key] - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
    syncTools();
  };
  input.addEventListener('input', update);
  output.addEventListener('input', () => {
    if (!Number.isFinite(output.valueAsNumber)) return;
    input.value = Math.max(Number(input.min), Math.min(Number(input.max), output.valueAsNumber)); update();
  });
  output.addEventListener('blur', () => { output.value = input.value; });
  output.addEventListener('keydown', e => { if (e.key === 'Enter') output.blur(); });
  update();
}
document.querySelector('#tool-axes').addEventListener('change', e => { tool.axes = e.target.value; syncTools(); });
for (const button of modeButtons) button.addEventListener('click', () => {
  if (active) return;
  finishEdit(); viewport.dataset.mode = button.dataset.mode;
  for (const b of modeButtons) b.setAttribute('aria-pressed', String(b === button));
  viewport.classList.remove('dragging');
});
art.addEventListener('pointerup', end);
art.addEventListener('pointercancel', end);
art.addEventListener('lostpointercapture', end);
syncControls();

// Only rendering changes with time; stored gesture samples remain immutable.
setInterval(() => {
  const time=performance.now(); scene.frameTime=time;
  if (strokes.length) { rebuild(surface,strokes,scene); surface.render(scene,strokes.map(s=>s.settings),true); highlight(); }
  refreshPreview();
}, 1000/24);

for(const input of document.querySelectorAll('#background-mode,#background-color')) {
  input.addEventListener('input',()=>{if(active)return;beginEdit(input);scene[input.id==='background-mode'?'background':'backgroundColor']=input.value;syncControls();});
  input.addEventListener('change',finishEdit);input.addEventListener('blur',finishEdit);
}
document.addEventListener('keydown',e=>{
  if(active||frameEditor?.dragging||e.target.closest('input,select,textarea,[contenteditable=true]'))return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&viewport.dataset.mode==='select') {
    e.preventDefault();finishEdit();selection.clear();strokes.forEach((_,i)=>selection.add(i));selected=strokes.length?strokes.length-1:null;syncControls();
  }
  if(e.key==='Escape'){finishEdit();selection.clear();selected=null;syncControls();}
});

document.addEventListener('endo-camera-change',()=>{if(active)return;surface=visibleSurface();guides.width=art.width;guides.height=art.height;drawGuides();schedule({geometry:true,shade:true})});
guides.width=art.width;guides.height=art.height;drawGuides();schedule({geometry:true,shade:true});
frameEditor=createFrames({frames,art,overlay,viewport,camera,toWorld,getState:snapshot,
 commit:change=>{if(active)return;finishEdit();const before=snapshot();change();history.commit(before,snapshot());syncControls();highlight()},
 onChange:()=>{syncControls();highlight()},onPaint:highlight,getBusy:()=>active!==null,getSelection:()=>[...selection].map(id=>strokes[id])});
frameEditor.refresh();highlight();
