import './endo-shell.js';
import {readQuality,displayPixelRatio,QUALITY_PRESETS} from './endo-quality.js';
import {createFrameEditor} from './frames.js';
import {camera,toWorld,restoreCamera} from './zoom.js';
import { createSaver } from './file-save.js';
import { presetsForBrush } from './color-presets.js';
import { History } from './history.js';
import { symmetrySurface, toolTransforms, transformPoint,toolRegion } from './symmetry.js';
import { ChromeSurface, StrokeBuilder } from './engine.js';
import {FrameSurface,rebuildLayers} from './endo-renderer.js';
import {normalizeEndoState,createFrame,createLayer,addAdjustmentLayer,addLayer,removeLayer,duplicateSelectedStrokes,moveSelectionToLayer,translateStroke} from './endo-model.js';
import {documentBounds} from './document-bounds.js';
import {createEditorUI} from './endo-editor-ui.js';
import {setupEndoPopovers} from './endo-popovers.js';
import {deleteLayers,duplicateLayers,reorderLayers} from './endo-layer-ops.js';
import {brushPreset,normalizeBlending,validateBlending} from './endo-brushes.js';
import {rasterizeLayers,mergeLayerSelection} from './endo-raster-ops.js';

const strokeControls = [
  ['width', 'Size', 2, 100, 20, 1, 'px', 'Base width of the selected strokes, or of new strokes when nothing is selected.'],
  ['hardness', 'Hardness', 0, 100, 100, 1, '%', 'The softness of the brush edge.'],
  ['inkOpacity', 'Opacity', 0, 100, 100, 1, '%', 'Paint opacity for a complete stroke.'],
  ['angle', 'Angle', 0, 180, 0, 1, '°', 'Rotation of square and chisel tips.'],
  ['variation', 'Width variation', 0, 100, 0, 1, '%', 'How much the width changes along a stroke.'],
  ['speed', 'Speed response', 0, 100, 0, 1, '%', 'How much the original drawing speed affects the width.'],
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
const geometryKeys = new Set(['tip','hardness','inkOpacity','angle','width', 'variation', 'speed', 'relief', 'smooth', 'ridge', 'roughness', 'density', 'particleSize']);
const defaults = { brush: 'basic', tip:'round', brushPreset:'round', density: 65, particleSize: 1.5, ridge: 55, roughness: 40, primary: '#222222', shadow: '#10141b', contrast: '#eff5ff' };
const scene = {};
for (const [key, , , , value] of strokeControls) defaults[key] = value;
for (const [key, , , , value] of sceneControls) scene[key] = value;
const strokes=[],frames=[createFrame('Artboard 1','frame-1',{width:960,height:850,background:null})],layers=[createLayer('Layer 1','layer-1','frame-1')];
let activeLayerId='layer-1',activeFrameId='frame-1';
const art = document.querySelector('#artboard');
const viewport = document.querySelector('#canvas-viewport');
const modeButtons = [...document.querySelectorAll('.cursor-modes button')];
const preview = document.querySelector('#preview');
const overlay = document.querySelector('#selection');
let renderQuality=readQuality(),renderPixelRatio=displayPixelRatio(renderQuality,devicePixelRatio);
function visibleSurface(){
  art.width=Math.max(1,Math.round(viewport.clientWidth*renderPixelRatio));art.height=Math.max(1,Math.round(viewport.clientHeight*renderPixelRatio));
  overlay.width=viewport.clientWidth;overlay.height=viewport.clientHeight;
  return new FrameSurface(art,{infinite:true,quality:renderQuality,resolution:camera.scale*renderPixelRatio,originX:-camera.x/camera.scale,originY:-camera.y/camera.scale,logicalWidth:960,logicalHeight:850});
}
let surface=visibleSurface();const sample=new ChromeSurface(preview);
const fields = new Map();
const tool = { mode: 'none', count: 8, axes: 'vertical', columns: 3, rows: 3 };
const guides = document.querySelector('#guides');
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const history = new History();
let edit = null, nextNumber = 1, uiEditSession = null;
const selectedLayerIds=new Set(['layer-1']);let layerAnchorId='layer-1',layerFocus=false;
const selection=new Set();let frameEditor=null,editor=null,editGesture=null,clipboard=null;
let selected = null, active = null, scheduled = false, geometryDirty = false, shadeDirty = false;
let refinementBusy = false;
const saver = createSaver({
  loadState: saved=>{restoreState({...saved,selected:null,selection:[]});history.past=[];history.future=[];restoreCamera(saved.view);},
  getState: () => ({...snapshot(false),tool:{...tool},view:{...camera},exportTarget:document.querySelector('#export-target').value}),
  isBusy: () => busy(),
  prepare: () => {
    finishEdit();
    surface.setDocument(strokes,layers,frames,activeFrameId);
    if (geometryDirty) rebuildLayers(surface, strokes, scene, layers,frames,activeFrameId);
    surface.render(scene, strokes.map(stroke => stroke.settings), true);
  },
  getPreview: () => art.toDataURL('image/png'),
});


function snapshot(includeUI=true) {
  return {...(includeUI?{selectedLayerIds:[...selectedLayerIds]}:{}), frameVersion:1,activeFrameId,infinite:true, layers:structuredClone(layers),activeLayerId,tool:structuredClone(tool), scene: { ...scene }, defaults: { ...defaults }, selected,selection:[...selection],frames:frames.map(f=>({...f})),nextNumber,
    strokes: strokes.map(s => ({ ...s, settings: { ...s.settings }, tool: structuredClone(s.tool), points: s.points })) };
}
function syncCommands() {
  document.querySelector('#return').disabled = busy() || !history.past.length;
  document.querySelector('#restore').disabled = busy() || !history.future.length;
  document.querySelector('#delete').disabled = busy() || (layerFocus?![...selectedLayerIds].some(id=>!layers.find(layer=>layer.id===id)?.locked):selected===null);
  document.querySelector('#copy-selection').disabled=busy()||!selection.size;
  document.querySelector('#duplicate-selection').disabled=busy()||(layerFocus?!selectedLayerIds.size:!selection.size);
  document.querySelector('#paste-selection').disabled=busy()||!clipboard?.length||activeLayer().kind!=='paint'||activeLayer().locked||!activeLayer().visible;
  saver.update();
}
function recordChange(before,after){
  // A color preview is a single explicit OK/Cancel operation, including presets.
  if(uiEditSession)return false;
  return history.commit(before,after);
}
function finishEdit() {
  if (!edit) return;
  recordChange(edit.before, snapshot()); edit = null; syncCommands();
}
function beginEdit(element) {
  if(uiEditSession){saver.markChanged();return;}
  if (edit?.element !== element) { finishEdit(); edit = { element, before: snapshot() }; }
  saver.markChanged();
}
function restoreState(input) {
  const state=normalizeEndoState(input);
  Object.assign(scene, state.scene); Object.assign(defaults, state.defaults,{brush:'basic',tip:state.defaults.tip??'round',brushPreset:state.defaults.brushPreset??'round'});
  for(const key of Object.keys(tool))delete tool[key];Object.assign(tool,{mode:'none',count:8,axes:'vertical',columns:3,rows:3},structuredClone(state.tool));
  layers.splice(0,layers.length,...structuredClone(state.layers));activeLayerId=state.activeLayerId;activeFrameId=state.activeFrameId;
  strokes.splice(0,strokes.length,...state.strokes.map(stroke=>({...stroke,settings:{...stroke.settings},tool:structuredClone(stroke.tool)})));
  selection.clear();for(const id of state.selection||[])if(strokes[id]&&editableStroke(strokes[id]))selection.add(id);
  selected=selection.size?[...selection].at(-1):null;selectedLayerIds.clear();for(const id of Array.isArray(state.selectedLayerIds)?state.selectedLayerIds:[activeLayerId])if(layers.some(layer=>layer.id===id&&layer.frameId===activeFrameId))selectedLayerIds.add(id);if(!selectedLayerIds.size)selectedLayerIds.add(activeLayerId);layerAnchorId=activeLayerId;frames.splice(0,frames.length,...(state.frames||[]).map(f=>({...f})));nextNumber=state.nextNumber;document.querySelector('#export-target').value=activeFrameId;
  surface.setDocument(strokes,layers,frames,activeFrameId);syncControls();schedule({geometry:true,shade:true});
}
function busy(){return active!==null||!!editGesture||!!frameEditor?.dragging||!!uiEditSession;}
function editableStroke(stroke){const layer=layers.find(item=>item.id===stroke.layerId);return stroke.operation!=='erase'&&layer?.kind==='paint'&&layer.frameId===activeFrameId&&layer.visible!==false&&!layer.locked;}
function activeFrame(){return frames.find(frame=>frame.id===activeFrameId)||frames[0];}
function activeLayer(){return layers.find(layer=>layer.id===activeLayerId)||layers.find(layer=>layer.frameId===activeFrameId&&layer.kind==='paint');}
function activateFrame(id,options={}){
 if(busy())return;finishEdit();const frame=frames.find(frame=>frame.id===id);if(!frame)return;
 activeFrameId=id;if(activeLayer()?.frameId!==id)activeLayerId=[...layers].reverse().find(layer=>layer.frameId===id&&layer.kind==='paint').id;
 selection.clear();selected=null;selectedLayerIds.clear();selectedLayerIds.add(activeLayerId);layerFocus=false;document.querySelector('#export-target').value=id;surface.setDocument(strokes,layers,frames,activeFrameId);syncControls();schedule({geometry:true,shade:true});if(options.view)restoreCamera(options.view);
}
function frameAt(point){return [...frames].reverse().find(frame=>point.x>=frame.x&&point.y>=frame.y&&point.x<=frame.x+frame.width&&point.y<=frame.y+frame.height);}
window.basementFrameBounds=()=>activeFrame();
function feedback(message){document.querySelector('#export-feedback').textContent=message;}
function commitChange(change){if(busy())return;finishEdit();const before=snapshot();change();recordChange(before,snapshot());surface.setDocument(strokes,layers,frames,activeFrameId);syncControls();schedule({geometry:true,shade:true});}
function useState(next){finishEdit();const before=snapshot();restoreState(next);recordChange(before,snapshot());syncControls();}
function selectionBounds(){const chosen=[...selection].map(id=>strokes[id]).filter(Boolean);return chosen.length?documentBounds({...snapshot(),infinite:true,strokes:chosen}):null;}
for (const [id, action] of [['return', 'undo'], ['restore', 'redo']]) {
  document.querySelector('#' + id).addEventListener('click', () => {
    if (busy()) return;
    finishEdit(); const state = history[action](); if (state) restoreState(state);
  });
}
document.querySelector('#delete').addEventListener('click', () => {
  if(busy())return;if(layerFocus){layerAction('delete-layer');return;}if(selected===null)return;
  finishEdit(); const before = snapshot();
  for(const id of [...selection].sort((a,b)=>b-a))strokes.splice(id,1);selection.clear();selected=null;
  recordChange(before, snapshot()); syncControls(); schedule({ geometry: true, shade: true });
});
function editableSettings(){return selection.size?[...selection].filter(id=>editableStroke(strokes[id])).map(id=>strokes[id].settings):[defaults]}
function currentSettings() { return selected === null ? defaults : strokes[selected].settings; }
document.addEventListener('endo-color-preset', e => {
  const preset = presetsForBrush(currentSettings().brush)[e.detail];
  if (active || !preset) return;
  finishEdit(); const before = snapshot();
  for(const settings of editableSettings())Object.assign(settings,settings.brush==='basic'?{primary:preset.colors.primary}:preset.colors);
  recordChange(before, snapshot());
  syncControls();
  if (selected !== null) schedule({ geometry: currentSettings().brush==='basic', shade: true });
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
    surface.setDocument(strokes,layers,frames,activeFrameId);
    if (geometryDirty) rebuildLayers(surface, strokes, scene, layers,frames,activeFrameId);
    surface.render(scene, strokes.map(stroke => stroke.settings), geometryDirty || shadeDirty);
    geometryDirty = false;
    shadeDirty = false;
    highlight();
    if (refinementChanged) {
      refinementBusy = renderingBusy;
      document.dispatchEvent(new CustomEvent('endo-artboard-rendered', { detail: { strokes, layers, frames,activeFrameId, scene, busy: refinementBusy } }));
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
  document.dispatchEvent(new Event('endo-preview'));
}

function syncControls() {
  const p = currentSettings(),erasing=viewport.dataset.mode==='erase';
  document.querySelector('.brush-switch').hidden=erasing;document.querySelector('.brush-panel .section-heading').hidden=erasing;
  document.querySelector('#eraser-help').hidden=!erasing;document.querySelector('#brush-preview').hidden=erasing;document.querySelector('.scene-card').hidden=erasing;
  document.querySelector('#color-presets').dataset.brush = p.brush || 'cromo';
  window.basementSyncBrushTips?.(p);
  for (const button of document.querySelectorAll('.brush-switch [data-brush-tip]'))button.disabled=active!==null;
  for (const [key, field] of fields) {
    field.input.value = field.global ? scene[key] : (p[key] ?? (key === 'ridge' ? 55 : key === 'roughness' ? 40 : defaults[key]));
    if(!field.global)field.input.closest('.control').hidden=false;
    if(key==='angle')field.input.closest('.control').hidden=!['square','chisel','marker'].includes(p.tip);
    if (key === 'ridge' || key === 'roughness') field.input.closest('.control').hidden = p.brush !== 'relief';
    if (key === 'density' || key === 'particleSize') field.input.closest('.control').hidden = !['sand', 'crayon', 'cement', 'dust'].includes(p.brush);
    if(erasing&&!field.global&&!['width','hardness','inkOpacity'].includes(key))field.input.closest('.control').hidden=true;
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
  const label=selection.size>1?`${selection.size} strokes selected`:selected===null?(activeLayer().kind==='adjustment'?'Adjustment layer':'New stroke'):`Stroke ${strokes[selected].number} selected`;
  document.querySelector('#stroke-scope').textContent=label;
  const scopeHelp=document.querySelector('#stroke-scope-help');
  if(scopeHelp)scopeHelp.textContent=activeLayer().kind==='adjustment'?'Affects content below in '+activeFrame().name+'. Painting starts a new drawing layer above it.':activeLayer().locked?'This layer is locked. Unlock it or choose another layer.':selected===null?'New strokes on '+activeLayer().name+'. Select a stroke to edit it.':'Changes apply to the selected strokes. Esc edits new strokes.';
  frameEditor?.refresh();editor?.render();
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
addControls(sceneControls, '#scene-controls', true);
document.addEventListener('endo-brush-tip',event=>{
  if(busy())return;
  finishEdit();const before=snapshot(),preset=brushPreset(event.detail?.id??event.detail?.tip);
  for(const settings of editableSettings()){
    settings.brush='basic';settings.tip=event.detail?.tip??preset.tip;settings.brushPreset=preset.id;
    for(const key of ['width','hardness','inkOpacity','angle'])settings[key]=Number(event.detail?.[key]??preset[key]);
  }
  recordChange(before,snapshot());syncControls();if(selected!==null)schedule({geometry:true,shade:true});
});
for (const key of ['primary', 'shadow', 'contrast']) {
  document.querySelector(`#${key}`).addEventListener('input', e => {
    beginEdit(e.target);
    for(const settings of editableSettings()){
      settings[key]=e.target.value;
      if(key==='primary'&&settings.brush!=='basic'&&document.querySelector('#color-link').checked){
        const rgb=[1,3,5].map(i=>parseInt(e.target.value.slice(i,i+2),16));
        const hex=values=>'#'+values.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');
        settings.shadow=hex(rgb.map(value=>value*.22));settings.contrast=hex(rgb.map(value=>value*.35+255*.65));
      }
    }
    for(const role of ['primary','shadow','contrast'])document.querySelector('#'+role).value=currentSettings()[role];
    document.dispatchEvent(new Event('endo-colors-changed'));refreshPreview();
    if (selected !== null) schedule({ geometry: currentSettings().brush==='basic', shade: true });
  });
  document.querySelector(`#${key}`).addEventListener('change', finishEdit);
  document.querySelector(`#${key}`).addEventListener('blur', finishEdit);
}

function point(e,finish=false){return {...toWorld(e.clientX,e.clientY),time:e.timeStamp,pressure:e.pointerType==='pen'?Math.max(.08,e.pressure):1,finish};}

function pickStroke(event){
  if(geometryDirty){rebuildLayers(surface,strokes,scene,layers,frames,activeFrameId);geometryDirty=false;surface.render(scene,strokes.map(s=>s.settings),true);}
  const rect=art.getBoundingClientRect(),p={x:(event.clientX-rect.left)*art.width/rect.width,y:(event.clientY-rect.top)*art.height/rect.height};let best=Infinity,picked=null;
  for(let y=Math.max(0,Math.floor(p.y)-6);y<=Math.min(art.height-1,Math.ceil(p.y)+6);y++)for(let x=Math.max(0,Math.floor(p.x)-6);x<=Math.min(art.width-1,Math.ceil(p.x)+6);x++){
    const id=surface.owner[y*art.width+x],distance=(x-p.x)**2+(y-p.y)**2;
    if(id>=0&&editableStroke(strokes[id])&&distance<=36&&distance<best){picked=id;best=distance;}
  }
  return picked;
}
art.addEventListener('pointerdown', e => {
  if(window.basementEndoColorOpen||active!==null||editGesture||e.button!==0||e.ctrlKey&&navigator.platform.includes('Mac')||['pan','frame'].includes(viewport.dataset.mode))return;
  const pointerFrame=frameAt(toWorld(e.clientX,e.clientY));
  if(!pointerFrame&&!['select','marquee'].includes(viewport.dataset.mode)){feedback('Draw inside an artboard. Press F to create one.');return;}
  if(pointerFrame&&pointerFrame.id!==activeFrameId)activateFrame(pointerFrame.id);
  if(['select','marquee'].includes(viewport.dataset.mode)){
    e.preventDefault();finishEdit();layerFocus=false;frameEditor?.deselect();const picked=viewport.dataset.mode==='marquee'?null:pickStroke(e);
    if(e.shiftKey&&picked!==null){if(selection.has(picked))selection.delete(picked);else selection.add(picked);}
    else if(picked!==null&&!selection.has(picked)){selection.clear();selection.add(picked);}
    else if(picked===null&&!e.shiftKey)selection.clear();
    selected=selection.size?[...selection].at(-1):null;if(selected!==null){activeLayerId=strokes[selected].layerId;selectedLayerIds.clear();selectedLayerIds.add(activeLayerId);document.dispatchEvent(new CustomEvent('endo-inspect',{detail:{name:'brush'}}));}
    const rect=art.getBoundingClientRect(),startScreen={x:e.clientX-rect.left,y:e.clientY-rect.top};
    editGesture={id:e.pointerId,kind:picked!==null?'move':'marquee',start:toWorld(e.clientX,e.clientY),startScreen,endScreen:startScreen,before:snapshot(),originals:[...selection].map(id=>[id,structuredClone(strokes[id])]),additive:e.shiftKey,initial:[...selection],moved:false};
    art.setPointerCapture(e.pointerId);syncControls();schedule();return;
  }
  let layer=activeLayer();if(layer.locked||!layer.visible){feedback(layer.locked?'Unlock the active layer to draw.':'Show the active layer to draw.');return;}if(layer.kind==='adjustment'&&viewport.dataset.mode==='erase'){feedback('Select a drawing layer to erase.');return;}
  e.preventDefault();finishEdit();feedback('');const before=snapshot();
  if(geometryDirty){rebuildLayers(surface,strokes,scene,layers,frames,activeFrameId);geometryDirty=false;shadeDirty=true;}
  const erasing=viewport.dataset.mode==='erase',settings={...defaults,brush:'basic',...(erasing?{variation:0,speed:0}:{})};
  const id=strokes.length,strokeTool=erasing?{mode:'none'}:{...structuredClone(tool),region:{x:activeFrame().x,y:activeFrame().y,width:activeFrame().width,height:activeFrame().height}},p=point(e);
  if(layer.kind==='adjustment'){
    if(layers.length>=512){feedback('The Project has reached its layer limit.');return;}
    let n=1;while(layers.some(item=>item.frameId===activeFrameId&&item.name==='Layer '+n))n++;
    const fresh=createLayer('Layer '+n,crypto.randomUUID(),activeFrameId);layers.splice(layers.indexOf(layer)+1,0,fresh);layer=fresh;activeLayerId=fresh.id;
  }
  selectedLayerIds.clear();selectedLayerIds.add(layer.id);layerFocus=false;

  const stroke={number:nextNumber++,layerId:layer.id,operation:erasing?'erase':'paint',settings,tool:strokeTool,points:[]};strokes.push(stroke);
  selection.clear();selected=null;
  surface.setDocument(strokes,layers,frames,activeFrameId);
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
    if(gesture.kind==='move'&&gesture.moved)recordChange(gesture.before,snapshot());
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
  recordChange(before, snapshot());
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
  document.querySelector('.session').textContent = mode + ' · ' + (currentSettings().brush==='basic'?brushPreset(currentSettings().brushPreset??currentSettings().tip).label:brushNames[currentSettings().brush]||'Brush');
  viewport.dataset.repetition=tool.mode;drawGuides();
  saver.update();
}
function drawGuides() {
  const ctx=guides.getContext('2d'),region=activeFrame(),w=region.width,h=region.height;
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
  ctx.stroke();ctx.restore();
}
for (const button of toolButtons) button.addEventListener('click', () => {
  commitChange(()=>{tool.mode=tool.mode===button.dataset.tool?'none':button.dataset.tool;delete tool.region;});
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
  if(['draw','erase'].includes(button.dataset.mode)){selection.clear();selected=null;selectedLayerIds.clear();selectedLayerIds.add(activeLayerId);layerFocus=false;}syncControls();
  viewport.classList.remove('dragging');frameEditor?.refresh();drawGuides();
});
art.addEventListener('pointerup', end);
art.addEventListener('pointercancel', end);
art.addEventListener('lostpointercapture', end);
syncControls();

document.addEventListener('endo-camera-change',()=>{
 if(active)return;
 surface.setView({resolution:camera.scale*renderPixelRatio,originX:-camera.x/camera.scale,originY:-camera.y/camera.scale},Math.round(viewport.clientWidth*renderPixelRatio),Math.round(viewport.clientHeight*renderPixelRatio));overlay.width=viewport.clientWidth;overlay.height=viewport.clientHeight;guides.width=viewport.clientWidth;guides.height=viewport.clientHeight;drawGuides();schedule({geometry:true,shade:true});
});
guides.width=viewport.clientWidth;guides.height=viewport.clientHeight;drawGuides();schedule({geometry:true,shade:true});

frameEditor=createFrameEditor({
 art,viewport,camera,toWorld,getState:snapshot,apply:useState,onActivate:activateFrame,
 hitStroke:pickStroke,preview:restoreState,
 commit:(before,next)=>{restoreState(next);recordChange(before,snapshot());syncControls();},
 onPaint:()=>{drawGuides();highlight();},getBusy:()=>active!==null||!!editGesture||!!uiEditSession
});
frameEditor.refresh();highlight();
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||window.basementEndoPopoverOpen||active||frameEditor.dragging||e.target.closest('input,select,textarea,[contenteditable=true]'))return;
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&viewport.dataset.mode==='select'){e.preventDefault();finishEdit();frameEditor.deselect();selection.clear();strokes.forEach((stroke,i)=>{if(editableStroke(stroke))selection.add(i)});selected=selection.size?[...selection].at(-1):null;syncControls();highlight();}
 if(e.key==='Escape'){if(editGesture){const before=editGesture.before,id=editGesture.id;editGesture=null;if(art.hasPointerCapture(id))art.releasePointerCapture(id);restoreState(before);}finishEdit();selection.clear();selected=null;syncControls();highlight();}
});

function layerAction(action,data={}){
 if(action==='finish-edit'){finishEdit();syncControls();return;}
 if(busy())return;
 const layer=activeLayer();
 if(action==='select-all-layers'){selection.clear();selected=null;selectedLayerIds.clear();for(const item of layers.filter(item=>item.frameId===activeFrameId))selectedLayerIds.add(item.id);layerFocus=true;syncControls();return;}
 if(action==='select-layers'){
  const target=layers.find(item=>item.id===data.id&&item.frameId===activeFrameId);if(!target)return;finishEdit();frameEditor?.deselect();if(!data.range&&!data.additive&&!data.toggle&&!selection.size&&activeLayerId===target.id&&selectedLayerIds.size===1&&selectedLayerIds.has(target.id)){layerFocus=true;syncCommands();return;}selection.clear();selected=null;
  const local=layers.filter(item=>item.frameId===activeFrameId).reverse();
  if(data.range){const a=local.findIndex(item=>item.id===layerAnchorId),b=local.indexOf(target);if(!data.additive)selectedLayerIds.clear();for(const item of local.slice(Math.min(a<0?b:a,b),Math.max(a<0?b:a,b)+1))selectedLayerIds.add(item.id);}
  else if(data.additive||data.toggle){if(selectedLayerIds.has(target.id)&&selectedLayerIds.size>1)selectedLayerIds.delete(target.id);else selectedLayerIds.add(target.id);layerAnchorId=target.id;}
  else{selectedLayerIds.clear();selectedLayerIds.add(target.id);layerAnchorId=target.id;}
  activeLayerId=selectedLayerIds.has(target.id)?target.id:[...selectedLayerIds].at(-1);layerFocus=true;syncControls();return;
 }
 if(action==='reorder-layer'){const ids=selectedLayerIds.has(data.id)?[...selectedLayerIds]:[data.id];useState(reorderLayers(snapshot(),ids,data.targetId,data.before));layerFocus=true;return;}
 if(action==='edit-filter'){activeLayerId=data.id;selectedLayerIds.clear();selectedLayerIds.add(data.id);layerFocus=true;selection.clear();selected=null;syncControls();editor?.openFilter(data.id);return;}
 if(action==='add-filter'){layerFocus=true;const next=addAdjustmentLayer(snapshot(),data.type);next.selectedLayerIds=[next.activeLayerId];next.selected=null;next.selection=[];useState(next);layerFocus=true;editor?.openFilter(activeLayerId);return;}
 if(action==='filter-remove'){useState(removeLayer(snapshot(),data.id));return;}
 if(action==='activate-layer')return layerAction('select-layers',{id:data.id});
 if(action==='add-layer'){editor?.openNewLayer();return;}
 if(action==='create-layer'){layerFocus=true;const next=addLayer(snapshot(),{name:data.name||undefined});next.selectedLayerIds=[next.activeLayerId];next.selected=null;next.selection=[];useState(next);return;}
 if(action==='layer-blending'){
  const target=layers.find(item=>item.id===data.id&&item.kind==='paint'&&item.frameId===activeFrameId);if(!target||target.locked)return;
  try{const value=normalizeBlending(data.value);validateBlending(value);beginEdit(data.element);target.blending=value;surface.setDocument(strokes,layers,frames,activeFrameId);schedule({geometry:true,shade:true});}catch(error){feedback(error.message);}return;
 }
 if(action==='rasterize-layer'||action==='merge-layers'){
  try{const ids=data.ids??[...selectedLayerIds],next=action==='merge-layers'?mergeLayerSelection(snapshot(),ids):rasterizeLayers(snapshot(),ids);layerFocus=true;useState(next);feedback(action==='merge-layers'?'Layers merged. Undo restores the source layers.':'Layer rasterized. Undo restores the editable strokes.');}catch(error){feedback(error.message);}return;
 }
 if(action==='duplicate-layer'){layerFocus=true;useState(duplicateLayers(snapshot(),[...selectedLayerIds]));return;}
 if(action==='delete-layer'){layerFocus=true;useState(deleteLayers(snapshot(),[...selectedLayerIds]));return;}
 if(action==='layer-up'||action==='layer-down'){
  const local=layers.filter(item=>item.frameId===activeFrameId),positions=local.map((item,index)=>selectedLayerIds.has(item.id)&&!item.locked?index:-1).filter(index=>index>=0),up=action==='layer-up';
  const target=positions.length?local[(up?Math.max(...positions):Math.min(...positions))+(up?1:-1)]:null;
  if(target)useState(reorderLayers(snapshot(),[...selectedLayerIds],target.id,!up));return;
 }
 if(action==='selection-to-layer'){
  if(!selection.size)return;let next=addLayer(snapshot(),{name:'Selection'});next=moveSelectionToLayer(next,[...selection],next.activeLayerId);useState(next);return;
 }
 if(action==='layer-opacity'){const targets=layers.filter(item=>selectedLayerIds.has(item.id)&&!item.locked),wasEmpty=targets.some(item=>item.opacity===0);beginEdit(data.element);for(const target of targets)target.opacity=data.value;surface.setDocument(strokes,layers,frames,activeFrameId);schedule({geometry:wasEmpty&&data.value>0,shade:true});return;}
 if(action==='filter-input'){const target=layers.find(item=>item.id===data.id),filter=target?.filter;if(target?.locked)return;if(filter){beginEdit(data.element);filter[data.key]=data.value;surface.setDocument(strokes,layers,frames,activeFrameId);schedule({shade:true});}return;}
 commitChange(()=>{
  if(action==='layer-visible'){const item=layers.find(l=>l.id===data.id);item.visible=!item.visible;if(!item.visible){for(const id of [...selection])if(strokes[id].layerId===item.id)selection.delete(id);selected=selection.size?[...selection].at(-1):null;}}
  if(action==='layer-lock'){const item=layers.find(l=>l.id===data.id);item.locked=!item.locked;if(item.locked){for(const id of [...selection])if(strokes[id].layerId===item.id)selection.delete(id);selected=selection.size?[...selection].at(-1):null;}}
  if(action==='rename-layer')layers.find(l=>l.id===data.id).name=data.name;
  if(action==='filter-toggle'){const target=layers.find(item=>item.id===data.id);if(target?.filter&&!target.locked)target.filter.enabled=!target.filter.enabled;}
 });
}
editor=createEditorUI({getState:()=>({...snapshot(),selection:[...selection]}),onAction:layerAction,getBusy:busy});
function copySelection(){if(busy()||!selection.size)return;clipboard=[...selection].map(id=>structuredClone(strokes[id]));feedback('Copied '+clipboard.length+' stroke'+(clipboard.length===1?'':'s'));syncCommands();}
function pasteSelection(){
 if(busy()||!clipboard?.length||activeLayer().kind!=='paint'||activeLayer().locked||!activeLayer().visible)return;
 commitChange(()=>{selection.clear();for(const source of clipboard){const stroke=translateStroke(source,20,20);stroke.layerId=activeLayerId;stroke.number=nextNumber++;strokes.push(stroke);selection.add(strokes.length-1);}selected=[...selection].at(-1);});
}
function duplicateSelection(){if(layerFocus&&!busy()){layerAction('duplicate-layer');return;}if(!busy()&&selection.size)useState(duplicateSelectedStrokes(snapshot(),[...selection]));}
document.querySelector('#copy-selection').addEventListener('click',copySelection);
document.querySelector('#paste-selection').addEventListener('click',pasteSelection);
document.querySelector('#duplicate-selection').addEventListener('click',duplicateSelection);
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||window.basementEndoPopoverOpen||busy()||window.basementSessionBlocked||document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
 const key=event.key.toLowerCase();
 if(layerFocus&&['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();layerAction('delete-layer');return;}
 if(layerFocus&&(event.metaKey||event.ctrlKey)&&key==='j'){event.preventDefault();event.stopImmediatePropagation();layerAction('duplicate-layer');return;}
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

// The picker owns a temporary document preview; disk saving waits until OK/Cancel.
window.basementEndoEditSession={
 begin(kind){
  if(busy()||window.basementSessionBlocked||document.querySelector('dialog[open]'))return null;
  finishEdit();uiEditSession={id:crypto.randomUUID(),kind,before:snapshot()};syncCommands();
  return uiEditSession.id;
 },
 commit(token){
  if(uiEditSession?.id!==token)return;
  const before=uiEditSession.before;edit=null;uiEditSession=null;
  recordChange(before,snapshot());syncControls();
 },
 cancel(token){
  if(uiEditSession?.id!==token)return;
  const before=uiEditSession.before;edit=null;uiEditSession=null;restoreState(before);
 }
};
setupEndoPopovers();
syncControls();

document.addEventListener('endo-finish-edit',finishEdit);

window.basementRenderQuality=renderQuality;
document.addEventListener('endo-quality-change',event=>{
 if(busy()||!QUALITY_PRESETS[event.detail?.mode])return;
 renderQuality=event.detail.mode;window.basementRenderQuality=renderQuality;renderPixelRatio=displayPixelRatio(renderQuality,devicePixelRatio);surface.setQuality(renderQuality);
 try{localStorage.setItem('basement-endo-quality',renderQuality);}catch{}
 document.dispatchEvent(new Event('endo-camera-change'));
});
