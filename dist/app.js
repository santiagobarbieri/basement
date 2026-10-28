import {createFrames} from './frames.js';
import {camera,toWorld,restoreCamera} from './zoom.js';
import { createSaver } from './file-save.js';
import { presetsForBrush } from './color-presets.js';
import { History } from './history.js';
import { symmetrySurface, toolTransforms, transformPoint,toolRegion } from './symmetry.js';
import { ChromeSurface, StrokeBuilder } from './engine.js';
import {LayeredSurface,rebuildLayers} from './endo-renderer.js';
import {normalizeEndoState,createLayer,addLayer,removeLayer,reorderLayer,duplicateLayer,duplicateSelectedStrokes,moveSelectionToLayer,translateStroke} from './endo-model.js';
import {documentBounds} from './document-bounds.js';
import {createRepeatArea} from './endo-repeat-ui.js';
import {createEditorUI} from './endo-editor-ui.js';

const strokeControls = [
  ['width', 'Width', 2, 100, 28, 1, 'px', 'Base width of the selected strokes, or of new strokes when nothing is selected.'],
  ['variation', 'Width variation', 0, 100, 30, 1, '%', 'How much the width changes along a stroke.'],
  ['speed', 'Speed response', 0, 100, 35, 1, '%', 'How much the original drawing speed affects the width.'],
];
const sceneControls = [
  ['shine', 'Shine', 0, 100, 75, 1, '%', 'Surface shine across every stroke in the Artboard.'],
  ['relief', 'Relief depth', .1, 2, .8, .05, '', 'Surface depth across every stroke in the Artboard.'],
  ['smooth', 'Smoothing', 0, 90, 45, 1, '%', 'Smooth the paths of every stroke in the Artboard.'],
  ['grain', 'Texture', 0, 100, 12, 1, '%', 'Surface texture across every stroke in the Artboard.'],
  ['merge', 'Edge blending', 1, 12, 2, 1, 'px', 'Soften the joins between strokes across the Artboard.'],
  ['light', 'Light angle', 0, 360, 225, 1, '°', 'Light direction for the entire Artboard.'],
];
const brushNames = {cromo:'Chrome',relief:'Relief',sand:'Magnetic sand',crayon:'Crayon',cement:'Cement',dust:'Powder'};
const geometryKeys = new Set(['width', 'variation', 'speed', 'relief', 'smooth', 'ridge', 'roughness', 'density', 'particleSize']);
const defaults = { brush: 'cromo', density: 65, particleSize: 1.5, ridge: 55, roughness: 40, primary: '#8795a8', shadow: '#10141b', contrast: '#eff5ff' };
const scene = {};
for (const [key, , , , value] of strokeControls) defaults[key] = value;
for (const [key, , , , value] of sceneControls) scene[key] = value;
const strokes = [], layers=[createLayer('Layer 1','layer-1')];
let activeLayerId='layer-1';
const art = document.querySelector('#artboard');
const viewport = document.querySelector('#canvas-viewport');
const modeButtons = [...document.querySelectorAll('.cursor-modes button')];
const preview = document.querySelector('#preview');
const overlay = document.querySelector('#selection');
function visibleSurface(){
  art.width=Math.max(1,viewport.clientWidth);art.height=Math.max(1,viewport.clientHeight);
  overlay.width=art.width;overlay.height=art.height;
  return new LayeredSurface(art,{infinite:true,resolution:camera.scale,originX:-camera.x/camera.scale,originY:-camera.y/camera.scale,logicalWidth:960,logicalHeight:850});
}
let surface=visibleSurface();const sample=new ChromeSurface(preview);
const fields = new Map();
const tool = { mode: 'none', count: 8, axes: 'vertical', columns: 3, rows: 3 };
const guides = document.querySelector('#guides');
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const history = new History();
let edit = null, nextNumber = 1;
const selection=new Set(),frames=[];let frameEditor=null,repeatEditor=null,editor=null,editGesture=null,clipboard=null;
let selected = null, active = null, scheduled = false, geometryDirty = false, shadeDirty = false;
let refinementBusy = false;
const saver = createSaver({
  loadState: saved=>{Object.assign(tool,saved.tool);restoreState({...snapshot(),...saved,selected:null,selection:[]});history.past=[];history.future=[];restoreCamera(saved.view);},
  getState: () => ({...snapshot(),tool:{...tool},view:{...camera},exportTarget:document.querySelector('#export-target').value}),
  isBusy: () => busy(),
  prepare: () => {
    finishEdit();
    surface.setDocument(strokes,layers);
    if (geometryDirty) rebuildLayers(surface, strokes, scene, layers);
    surface.render(scene, strokes.map(stroke => stroke.settings), true);
  },
  getPreview: () => art.toDataURL('image/png'),
});


function snapshot() {
  return { infinite:true, layers:structuredClone(layers),activeLayerId,tool:structuredClone(tool), scene: { ...scene }, defaults: { ...defaults }, selected,selection:[...selection],frames:frames.map(f=>({...f})),nextNumber,
    strokes: strokes.map(s => ({ ...s, settings: { ...s.settings }, tool: structuredClone(s.tool), points: s.points })) };
}
function syncCommands() {
  document.querySelector('#return').disabled = active !== null || !history.past.length;
  document.querySelector('#restore').disabled = active !== null || !history.future.length;
  document.querySelector('#delete').disabled = active !== null || selected === null;
  document.querySelector('#copy-selection').disabled=active!==null||!selection.size;
  document.querySelector('#duplicate-selection').disabled=active!==null||!selection.size;
  document.querySelector('#paste-selection').disabled=active!==null||!clipboard?.length||activeLayer().locked||!activeLayer().visible;
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
function restoreState(input) {
  const state=normalizeEndoState(input);
  Object.assign(scene, state.scene); Object.assign(defaults, state.defaults);
  for(const key of Object.keys(tool))delete tool[key];Object.assign(tool,{mode:'none',count:8,axes:'vertical',columns:3,rows:3},structuredClone(state.tool));
  layers.splice(0,layers.length,...structuredClone(state.layers));activeLayerId=state.activeLayerId;
  strokes.splice(0,strokes.length,...state.strokes.map(stroke=>({...stroke,settings:{...stroke.settings},tool:structuredClone(stroke.tool)})));
  selection.clear();for(const id of state.selection||[])if(strokes[id]&&editableStroke(strokes[id]))selection.add(id);
  selected=selection.size?[...selection].at(-1):null;frames.splice(0,frames.length,...(state.frames||[]).map(f=>({...f})));nextNumber=state.nextNumber;
  surface.setDocument(strokes,layers);syncControls();schedule({geometry:true,shade:true});
}
function busy(){return active!==null||!!editGesture||!!frameEditor?.dragging||!!repeatEditor?.dragging;}
function editableStroke(stroke){const layer=layers.find(item=>item.id===stroke.layerId);return stroke.operation!=='erase'&&layer?.visible!==false&&!layer?.locked;}
function activeLayer(){return layers.find(layer=>layer.id===activeLayerId)||layers[0];}
function feedback(message){document.querySelector('#export-feedback').textContent=message;}
function commitChange(change){if(busy())return;finishEdit();const before=snapshot();change();history.commit(before,snapshot());surface.setDocument(strokes,layers);syncControls();schedule({geometry:true,shade:true});}
function useState(next){finishEdit();const before=snapshot();restoreState(next);history.commit(before,snapshot());syncControls();}
function selectionBounds(){const chosen=[...selection].map(id=>strokes[id]).filter(Boolean);return chosen.length?documentBounds({...snapshot(),infinite:true,strokes:chosen}):null;}
for (const [id, action] of [['return', 'undo'], ['restore', 'redo']]) {
  document.querySelector('#' + id).addEventListener('click', () => {
    if (busy()) return;
    finishEdit(); const state = history[action](); if (state) restoreState(state);
  });
}
document.querySelector('#delete').addEventListener('click', () => {
  if (busy() || selected === null) return;
  finishEdit(); const before = snapshot();
  for(const id of [...selection].sort((a,b)=>b-a))strokes.splice(id,1);selection.clear();selected=null;
  history.commit(before, snapshot()); syncControls(); schedule({ geometry: true, shade: true });
});
function editableSettings(){return selection.size?[...selection].filter(id=>editableStroke(strokes[id])).map(id=>strokes[id].settings):[defaults]}
function currentSettings() { return selected === null ? defaults : strokes[selected].settings; }
document.addEventListener('endo-color-preset', e => {
  const preset = presetsForBrush(currentSettings().brush)[e.detail];
  if (active || !preset) return;
  finishEdit(); const before = snapshot();
  for(const settings of editableSettings())Object.assign(settings,preset.colors);
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
    const renderingBusy=active!==null||!!editGesture;
    const refinementChanged = geometryDirty || shadeDirty || surface.bounds !== null || renderingBusy !== refinementBusy;
    surface.setDocument(strokes,layers);
    if (geometryDirty) rebuildLayers(surface, strokes, scene, layers);
    surface.render(scene, strokes.map(stroke => stroke.settings), geometryDirty || shadeDirty);
    geometryDirty = false;
    shadeDirty = false;
    highlight();
    if (refinementChanged) {
      refinementBusy = renderingBusy;
      document.dispatchEvent(new CustomEvent('endo-artboard-rendered', { detail: { strokes, layers, scene, busy: refinementBusy } }));
    }
  });
}

function highlight() {
  const ctx = overlay.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,overlay.width,overlay.height);
  frameEditor?.draw(ctx);
  if(editGesture?.kind==='marquee'){
    const a=editGesture.startScreen,b=editGesture.endScreen;ctx.save();ctx.strokeStyle='#4e7aff';ctx.fillStyle='#2455ee18';ctx.setLineDash([5,4]);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();
  }
  if(selected===null||active)return;
  for(const id of selection){
  const stroke=strokes[id];
  ctx.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);
  const transforms = toolTransforms(stroke.tool,960,850,stroke.points[0]);
  const points = stroke.points.flatMap(p => transforms.map(t => transformPoint(p, t)));
  const radius = stroke.settings.width * .75 + 4;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  x0-=radius;y0-=radius;x1+=radius;y1+=radius;
  const size = Math.min(10/camera.scale, (x1 - x0) / 2, (y1 - y0) / 2);
  if(size<=0)continue;
  ctx.strokeStyle = '#0055ff'; ctx.lineWidth = 1.5/camera.scale;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.moveTo(x + dx * size, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * size);
  }
  ctx.stroke();
  }
}

function refreshPreview() {
  sample.clear();
  const q = { ...currentSettings(), ...scene, width: Math.min(100, currentSettings().width * 1.6) };
  const builder = new StrokeBuilder(sample, q, 0);
  for (let x = 60; x < 580; x += 2) builder.add({ x, y: 105 + 45 * Math.sin(x / 95), time: x * 2, pressure: 1 });
  sample.render(scene, [q]);
}

function syncControls() {
  const p = currentSettings(),erasing=viewport.dataset.mode==='erase';
  document.querySelector('.brush-switch').hidden=erasing;document.querySelector('.brush-panel .section-heading').hidden=erasing;
  document.querySelector('#eraser-help').hidden=!erasing;document.querySelector('#brush-preview').hidden=erasing;document.querySelector('.scene-card').hidden=erasing;
  document.querySelector('#color-presets').dataset.brush = p.brush || 'cromo';
  for (const button of document.querySelectorAll('.brush-switch [data-brush]')) {
    button.setAttribute('aria-pressed', String(editableSettings().every(s=>button.dataset.brush===(s.brush||'cromo'))));
    button.disabled = active !== null;
  }
  for (const [key, field] of fields) {
    field.input.value = field.global ? scene[key] : (p[key] ?? (key === 'ridge' ? 55 : key === 'roughness' ? 40 : defaults[key]));
    if(!field.global)field.input.closest('.control').hidden=false;
    if (key === 'ridge' || key === 'roughness') field.input.closest('.control').hidden = p.brush !== 'relief';
    if (key === 'density' || key === 'particleSize') field.input.closest('.control').hidden = !['sand', 'crayon', 'cement', 'dust'].includes(p.brush);
    if(erasing&&!field.global&&key!=='width')field.input.closest('.control').hidden=true;
    field.refresh();
    const mixed=!field.global && editableSettings().some(s=>s[key]!==p[key]);field.input.closest('.control').classList.toggle('mixed',mixed);field.number.placeholder=mixed?'—':'';field.number.title=mixed?'Mixed values. Enter a value to apply it to all selected strokes.':'';if(mixed)field.number.value='';
    field.input.disabled = active !== null;
    field.number.disabled = active !== null;
  }
  for (const key of ['primary', 'shadow', 'contrast']) {
    const input = document.querySelector(`#${key}`);
    input.value = p[key]; input.disabled = active !== null||(!selection.size&&activeLayer().locked);
  }
  for (const button of modeButtons) button.disabled = active !== null;
  syncTools();
  syncCommands();
  const label=selection.size>1?`${selection.size} strokes selected`:selected===null?'New stroke':`Stroke ${strokes[selected].number} selected`;
  document.querySelector('#stroke-scope').textContent=label;
  const scopeHelp=document.querySelector('#stroke-scope-help');
  if(scopeHelp)scopeHelp.textContent=activeLayer().locked?'This layer is locked. Unlock it or choose another layer.':selected===null?'New strokes on '+activeLayer().name+'. Select a stroke to edit it.':'Changes apply to the selected strokes. Esc edits new strokes.';
  frameEditor?.refresh();repeatEditor?.refresh();editor?.render();
  refreshPreview();
  highlight();
  document.dispatchEvent(new Event('endo-settings'));
}

function addControls(controls, target, global) {
  for (const [key, label, min, max, , step, unit, help] of controls) {
    const row = document.createElement('div');
    row.className = 'control'; row.title = help; row.dataset.control = key;
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}"><span class="numeric-value"><input type="number" min="${min}" max="${max}" step="${step}" aria-label="${label} value"><span>${unit}</span></span>`;
    const input = row.querySelector('input[type=range]'), number = row.querySelector('input[type=number]');
    const refresh = () => {
      const value = Number(input.value);
      input.style.setProperty('--fill', `${(value - min) / (max - min) * 100}%`);
      input.setAttribute('aria-valuetext', `${Number(value.toFixed(2))}${unit}`);
      if (document.activeElement !== number) number.value = Number(value.toFixed(2));
    };
    const apply = element => {
      beginEdit(element);
      const settings = global ? scene : currentSettings();
      if(global)settings[key]=Number(input.value);else for(const target of editableSettings())target[key]=Number(input.value);
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
addControls(strokeControls, '#controls', false);
addControls([
  ['ridge', 'Ridge', 0, 100, 55, 1, '%', 'Height of the central ridge on Relief strokes.'],
  ['roughness', 'Roughness', 0, 100, 40, 1, '%', 'Surface irregularity on Relief strokes.'],
  ['density', 'Density', 5, 100, 65, 1, '%', 'Amount of material in each stroke.'],
  ['particleSize', 'Grain size', .4, 5, 1.5, .1, 'px', 'Size of the material particles in each stroke.'],
], '#controls', false);
addControls(sceneControls, '#scene-controls', true);
for (const button of document.querySelectorAll('.brush-switch [data-brush]')) button.addEventListener('click', () => {
  if (active) return;
  finishEdit(); const before = snapshot();
  const p = currentSettings();
  if(editableSettings().every(s=>(s.brush||'cromo')===button.dataset.brush))return;
  for(const settings of editableSettings()){settings.brush=button.dataset.brush;settings.ridge??=55;settings.roughness??=40;settings.density??=65;settings.particleSize??=1.5;}
  history.commit(before, snapshot()); syncControls();
  if (selected !== null) schedule({ geometry: true, shade: true });
});
for (const key of ['primary', 'shadow', 'contrast']) {
  document.querySelector(`#${key}`).addEventListener('input', e => {
    beginEdit(e.target);
    for(const settings of editableSettings()){
      settings[key]=e.target.value;
      if(key==='primary'&&document.querySelector('#color-link').checked){
        const rgb=[1,3,5].map(i=>parseInt(e.target.value.slice(i,i+2),16));
        const hex=values=>'#'+values.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');
        settings.shadow=hex(rgb.map(value=>value*.22));settings.contrast=hex(rgb.map(value=>value*.35+255*.65));
      }
    }
    for(const role of ['primary','shadow','contrast'])document.querySelector('#'+role).value=currentSettings()[role];
    document.dispatchEvent(new Event('endo-colors-changed'));refreshPreview();
    if (selected !== null) schedule({ shade: true });
  });
  document.querySelector(`#${key}`).addEventListener('change', finishEdit);
  document.querySelector(`#${key}`).addEventListener('blur', finishEdit);
}

function point(e,finish=false){return {...toWorld(e.clientX,e.clientY),time:e.timeStamp,pressure:e.pointerType==='pen'?Math.max(.08,e.pressure):1,finish};}

function pickStroke(event){
  if(geometryDirty){rebuildLayers(surface,strokes,scene,layers);geometryDirty=false;surface.render(scene,strokes.map(s=>s.settings),true);}
  const rect=art.getBoundingClientRect(),p={x:(event.clientX-rect.left)*art.width/rect.width,y:(event.clientY-rect.top)*art.height/rect.height};let best=Infinity,picked=null;
  for(let y=Math.max(0,Math.floor(p.y)-6);y<=Math.min(art.height-1,Math.ceil(p.y)+6);y++)for(let x=Math.max(0,Math.floor(p.x)-6);x<=Math.min(art.width-1,Math.ceil(p.x)+6);x++){
    const id=surface.owner[y*art.width+x],distance=(x-p.x)**2+(y-p.y)**2;
    if(id>=0&&editableStroke(strokes[id])&&distance<=36&&distance<best){picked=id;best=distance;}
  }
  return picked;
}
art.addEventListener('pointerdown', e => {
  if(active!==null||editGesture||e.button!==0||['pan','frame','repeat-region'].includes(viewport.dataset.mode))return;
  if(['select','marquee'].includes(viewport.dataset.mode)){
    e.preventDefault();finishEdit();const picked=viewport.dataset.mode==='marquee'?null:pickStroke(e);
    if(e.shiftKey&&picked!==null){if(selection.has(picked))selection.delete(picked);else selection.add(picked);}
    else if(picked!==null&&!selection.has(picked)){selection.clear();selection.add(picked);}
    else if(picked===null&&!e.shiftKey)selection.clear();
    selected=selection.size?[...selection].at(-1):null;if(selected!==null)activeLayerId=strokes[selected].layerId;
    const rect=art.getBoundingClientRect(),startScreen={x:e.clientX-rect.left,y:e.clientY-rect.top};
    editGesture={id:e.pointerId,kind:picked!==null?'move':'marquee',start:toWorld(e.clientX,e.clientY),startScreen,endScreen:startScreen,before:snapshot(),originals:[...selection].map(id=>[id,structuredClone(strokes[id])]),additive:e.shiftKey,initial:[...selection],moved:false};
    art.setPointerCapture(e.pointerId);syncControls();schedule();return;
  }
  const layer=activeLayer();if(layer.locked||!layer.visible){feedback(layer.locked?'Unlock the active layer to draw.':'Show the active layer to draw.');return;}
  e.preventDefault();finishEdit();const before=snapshot();
  if(geometryDirty){rebuildLayers(surface,strokes,scene,layers);geometryDirty=false;shadeDirty=true;}
  const erasing=viewport.dataset.mode==='erase',settings={...defaults,...(erasing?{brush:'cromo',variation:0,speed:0}:{})};
  const id=strokes.length,strokeTool=erasing?{mode:'none'}:structuredClone(tool),p=point(e);
  if(!erasing&&tool.mode!=='none'){const box=toolRegion(tool);if(p.x<box.x||p.y<box.y||p.x>box.x+box.width||p.y>box.y+box.height){feedback('Start inside the repeat area. Press R to move or resize it.');return;}}
  const stroke={number:nextNumber++,layerId:layer.id,operation:erasing?'erase':'paint',settings,tool:strokeTool,points:[]};strokes.push(stroke);
  selection.clear();selected=null;
  surface.setDocument(strokes,layers);
  active={before,pointerId:e.pointerId,id,builder:new StrokeBuilder(symmetrySurface(surface.strokeSurface(stroke,id),strokeTool,p),{...settings,...scene},id)};
  art.setPointerCapture(e.pointerId);stroke.points.push(p);active.builder.add(p);syncControls();schedule();
});
art.addEventListener('pointermove', e => {
  if(editGesture?.id===e.pointerId){
    const current=toWorld(e.clientX,e.clientY),dx=current.x-editGesture.start.x,dy=current.y-editGesture.start.y;
    editGesture.moved||=Math.hypot(dx,dy)*camera.scale>3;
    if(editGesture.kind==='move'&&editGesture.moved){for(const[id,original]of editGesture.originals)strokes[id]=translateStroke(original,dx,dy);schedule({geometry:true,shade:true});}
    else{const rect=art.getBoundingClientRect();editGesture.endScreen={x:e.clientX-rect.left,y:e.clientY-rect.top};highlight();}
    return;
  }
  if (active?.pointerId !== e.pointerId) return;
  const events = e.getCoalescedEvents?.() || [];
  for (const event of events.length ? events : [e]) {
    const p = point(event);
    strokes[active.id].points.push(p); active.builder.add(p);
  }
  schedule();
});
function end(e) {
  if(editGesture?.id===e.pointerId){
    const gesture=editGesture;editGesture=null;
    if(art.hasPointerCapture(gesture.id))art.releasePointerCapture(gesture.id);
    if(e.type!=='pointerup'&&gesture.kind==='move'){restoreState(gesture.before);return;}
    if(gesture.kind==='move'&&gesture.moved)history.commit(gesture.before,snapshot());
    if(gesture.kind==='marquee'&&gesture.moved){
      const a=gesture.start,b=toWorld(e.clientX,e.clientY),box={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
      selection.clear();for(const id of gesture.additive?gesture.initial:[])selection.add(id);
      strokes.forEach((stroke,id)=>{if(!editableStroke(stroke))return;const bounds=documentBounds({layers,strokes:[stroke],infinite:true});if(bounds.x<=box.x+box.width&&bounds.y<=box.y+box.height&&bounds.x+bounds.width>=box.x&&bounds.y+bounds.height>=box.y)selection.add(id);});selected=selection.size?[...selection].at(-1):null;
    }
    syncControls();schedule();return;
  }
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
  for(const key of ['count','columns','rows']){
    const input=document.querySelector('#tool-'+key),number=document.querySelector('#tool-'+key+'-value');input.value=tool[key];if(document.activeElement!==number)number.value=tool[key];input.style.setProperty('--fill',((tool[key]-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');
  }
  document.querySelector('#tool-axes').value=tool.axes;
  for (const button of toolButtons) {
    button.setAttribute('aria-pressed', String(tool.mode === button.dataset.tool));
    button.disabled = active !== null;
  }
  document.querySelector('#mandala-settings').hidden = tool.mode !== 'mandala';
  document.querySelector('#mirror-settings').hidden = tool.mode !== 'mirror';
  document.querySelector('#tile-settings').hidden = !['grid', 'mosaic'].includes(tool.mode);
  for (const input of document.querySelectorAll('#tool-settings input, #tool-settings select')) input.disabled = active !== null;
  const mode = tool.mode === 'none' ? 'Freehand' : tool.mode[0].toUpperCase() + tool.mode.slice(1);
  document.querySelector('.session').textContent = mode + ' · ' + (brushNames[currentSettings().brush] || 'Chrome');
  viewport.dataset.repetition=tool.mode;drawGuides();
  saver.update();
}
function drawGuides() {
  const ctx=guides.getContext('2d'),region=toolRegion(tool),w=region.width,h=region.height;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,guides.width,guides.height);ctx.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);
  ctx.save();ctx.translate(region.x,region.y);ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
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
  ctx.stroke();ctx.restore();repeatEditor?.draw(ctx);
}
for (const button of toolButtons) button.addEventListener('click', () => {
  commitChange(()=>{tool.mode=tool.mode===button.dataset.tool?'none':button.dataset.tool;if(tool.mode!=='none'&&!tool.region)tool.region=repeatEditor?.visible()||{x:0,y:0,width:960,height:850};});
});
for (const key of ['count', 'columns', 'rows']) {
  const input = document.querySelector('#tool-' + key), output = document.querySelector('#tool-' + key + '-value');
  const update = () => {
    tool[key] = Number(input.value); if (document.activeElement !== output) output.value = input.value;
    input.style.setProperty('--fill', ((tool[key] - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
    syncTools();
  };
  input.addEventListener('input',()=>{if(busy())return;beginEdit(input);update();});
  input.addEventListener('change',finishEdit);
  output.addEventListener('input', () => {
    if (!Number.isFinite(output.valueAsNumber)) return;
    beginEdit(output);input.value = Math.max(Number(input.min), Math.min(Number(input.max), output.valueAsNumber)); update();
  });
  output.addEventListener('change',finishEdit);output.addEventListener('blur', () => { finishEdit();output.value = input.value; });
  output.addEventListener('keydown', e => { if (e.key === 'Enter') output.blur(); });
  update();
}
document.querySelector('#tool-axes').addEventListener('change', e => commitChange(()=>{tool.axes=e.target.value;}));
for (const button of modeButtons) button.addEventListener('click', () => {
  if (busy()) return;
  finishEdit(); viewport.dataset.mode = button.dataset.mode;
  for (const b of modeButtons) b.setAttribute('aria-pressed', String(b === button));
  if(['draw','erase'].includes(button.dataset.mode)){selection.clear();selected=null;}syncControls();
  viewport.classList.remove('dragging');frameEditor?.refresh();repeatEditor?.refresh();drawGuides();
});
art.addEventListener('pointerup', end);
art.addEventListener('pointercancel', end);
art.addEventListener('lostpointercapture', end);
syncControls();

// Actual engine samples make each brush recognizable before selection.
for (const button of document.querySelectorAll('.brush-switch [data-brush]')) {
  const canvas = button.querySelector('canvas'), swatch = new ChromeSurface(canvas);
  const settings = { ...defaults, ...scene, brush: button.dataset.brush, width: 28 };
  const builder = new StrokeBuilder(swatch, settings, 0);
  for (let x = 18; x <= 222; x += 3) builder.add({ x, y: 38 + 12 * Math.sin(x / 35), time: x * 3, pressure: 1 });
  swatch.render(scene, [settings]);
}

document.addEventListener('endo-camera-change',()=>{
 if(active)return;
 surface=visibleSurface();guides.width=art.width;guides.height=art.height;drawGuides();schedule({geometry:true,shade:true});
});
guides.width=art.width;guides.height=art.height;drawGuides();schedule({geometry:true,shade:true});

frameEditor=createFrames({frames,art,overlay,viewport,camera,toWorld,getState:snapshot,
 commit:change=>{if(active||editGesture||repeatEditor?.dragging)return;finishEdit();const before=snapshot();change();history.commit(before,snapshot());syncControls();highlight();},
 onChange:()=>{syncControls();highlight();},onPaint:highlight,getBusy:()=>active!==null||!!editGesture||!!repeatEditor?.dragging,getSelection:()=>[...selection].map(id=>strokes[id])});
frameEditor.refresh();highlight();
document.addEventListener('keydown',e=>{
 if(active||frameEditor.dragging||repeatEditor?.dragging||e.target.closest('input,select,textarea,[contenteditable=true]'))return;
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&viewport.dataset.mode==='select'){e.preventDefault();finishEdit();selection.clear();strokes.forEach((stroke,i)=>{if(editableStroke(stroke))selection.add(i)});selected=selection.size?[...selection].at(-1):null;syncControls();highlight();}
 if(e.key==='Escape'){if(editGesture){const before=editGesture.before,id=editGesture.id;editGesture=null;if(art.hasPointerCapture(id))art.releasePointerCapture(id);restoreState(before);}finishEdit();selection.clear();selected=null;syncControls();highlight();}
});

repeatEditor=createRepeatArea({tool,art,viewport,camera,toWorld,commit:commitChange,onPaint:drawGuides,getBusy:()=>active!==null||!!editGesture||!!frameEditor?.dragging,getSelectionBounds:selectionBounds});
function layerAction(action,data={}){
 if(action==='finish-edit'){finishEdit();syncControls();return;}
 if(busy())return;
 const layer=activeLayer();
 if(action==='activate-layer'){if(activeLayerId===data.id&&!selection.size)return;finishEdit();activeLayerId=data.id;selection.clear();selected=null;syncControls();saver.update();return;}
 if(action==='add-layer'){useState(addLayer(snapshot()));return;}
 if(action==='duplicate-layer'){useState(duplicateLayer(snapshot(),layer.id));return;}
 if(action==='delete-layer'){if(layers.length>1)useState(removeLayer(snapshot(),layer.id));return;}
 if(action==='layer-up'||action==='layer-down'){useState(reorderLayer(snapshot(),layer.id,action==='layer-up'?1:-1));return;}
 if(action==='selection-to-layer'){
  if(!selection.size)return;let next=addLayer(snapshot(),{name:'Selection'});next=moveSelectionToLayer(next,[...selection],next.activeLayerId);useState(next);return;
 }
 if(action==='layer-opacity'){const wasEmpty=layer.opacity===0;beginEdit(data.element);layer.opacity=data.value;surface.setDocument(strokes,layers);schedule({geometry:wasEmpty&&data.value>0,shade:true});return;}
 if(action==='filter-input'){if(layer.locked)return;const filter=layer.filters.find(f=>f.id===data.id);if(filter){beginEdit(data.element);filter[data.key]=data.value;surface.setDocument(strokes,layers);schedule({shade:true});}return;}
 commitChange(()=>{
  if(action==='layer-visible'){const item=layers.find(l=>l.id===data.id);item.visible=!item.visible;if(!item.visible){for(const id of [...selection])if(strokes[id].layerId===item.id)selection.delete(id);selected=selection.size?[...selection].at(-1):null;}}
  if(action==='layer-lock'){const item=layers.find(l=>l.id===data.id);item.locked=!item.locked;if(item.locked){for(const id of [...selection])if(strokes[id].layerId===item.id)selection.delete(id);selected=selection.size?[...selection].at(-1):null;}}
  if(action==='rename-layer')layers.find(l=>l.id===data.id).name=data.name;
  if(action==='add-filter'&&!layer.locked&&layer.filters.length<8)layer.filters.push({id:crypto.randomUUID(),type:data.type,enabled:true,amount:128,scale:2});
  if(action==='filter-toggle'&&!layer.locked){const filter=layer.filters.find(f=>f.id===data.id);filter.enabled=!filter.enabled;}
  if(action==='filter-remove'&&!layer.locked)layer.filters=layer.filters.filter(f=>f.id!==data.id);
 });
}
editor=createEditorUI({getState:()=>({...snapshot(),selection:[...selection]}),onAction:layerAction,getBusy:busy});
function copySelection(){if(busy()||!selection.size)return;clipboard=[...selection].map(id=>structuredClone(strokes[id]));feedback('Copied '+clipboard.length+' stroke'+(clipboard.length===1?'':'s'));syncCommands();}
function pasteSelection(){
 if(busy()||!clipboard?.length||activeLayer().locked||!activeLayer().visible)return;
 commitChange(()=>{selection.clear();for(const source of clipboard){const stroke=translateStroke(source,20,20);stroke.layerId=activeLayerId;stroke.number=nextNumber++;strokes.push(stroke);selection.add(strokes.length-1);}selected=[...selection].at(-1);});
}
function duplicateSelection(){if(!busy()&&selection.size)useState(duplicateSelectedStrokes(snapshot(),[...selection]));}
document.querySelector('#copy-selection').addEventListener('click',copySelection);
document.querySelector('#paste-selection').addEventListener('click',pasteSelection);
document.querySelector('#duplicate-selection').addEventListener('click',duplicateSelection);
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||busy()||window.basementSessionBlocked||document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
 const key=event.key.toLowerCase();
 if((event.metaKey||event.ctrlKey)&&!event.altKey){
  if(key==='c'&&selection.size){event.preventDefault();copySelection();}
  if(key==='x'&&selection.size){event.preventDefault();copySelection();document.querySelector('#delete').click();}
  if(key==='v'&&clipboard?.length){event.preventDefault();pasteSelection();}
  if(key==='j'&&selection.size){event.preventDefault();duplicateSelection();}
 }
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selection.size&&!event.target.closest('[role=tablist],button')){
  event.preventDefault();const amount=event.shiftKey?10:1,dx=event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0,dy=event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0;
  commitChange(()=>{for(const id of selection)strokes[id]=translateStroke(strokes[id],dx,dy);});
 }
});
syncControls();drawGuides();

window.basementEndoBusy=busy;
