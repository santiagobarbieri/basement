import {detectForeground} from './foreground.js';
import { initialState, capture, signature } from './model.js';
import { COLOR_PRESETS } from './color-presets.js';
import { createSaver } from './file-save.js';
import { dimensions, pngDimensions } from './geometry.js';
import { renderModel } from './renderer.js';
let state = initialState(), edit = null, loading = false, rendering = false, renderError = '', revision = 0, inFlight = false, pending = false, timer;
let stageSize = '960x850';
const past = [], future = [], art = document.querySelector('#artboard'), preview = document.querySelector('#preview');
const saver = createSaver({ getState: () => capture(state), prepare: finishEdit, isBusy: () => loading || rendering || !state.source || !!renderError,
  loadState: saved=>{const base=initialState();state={...base,...saved,shared:{...base.shared,...saved.shared},contour:{...base.contour,...saved.contour}};past.length=0;future.length=0;syncUI();request();},
  getPreview: () => art.toDataURL('image/png') });
let worker;
if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => { inFlight = false; if (data.id === revision) receive(data); else data.bitmap?.close(); if (pending) send(); };
  worker.onerror = () => { worker.terminate(); worker = null; inFlight = false; pending = true; send(); };
}
function commit(before) {
  const after=capture(state);
  if (signature(before) !== signature(after)) { past.push({ before, after }); if (past.length > 40) past.shift(); future.length = 0; }
  syncCommands();
}
function beginEdit(element) { if (edit?.element !== element) { finishEdit(); edit = { element, before: capture(state) }; } saver.markChanged(); }
function finishEdit() { if (edit) { const before = edit.before; edit = null; commit(before); } }
function action(change) { finishEdit(); const before = capture(state); change(); commit(before); syncUI(); request(); }
function syncCommands() {
  document.querySelector('#return').disabled = loading || !past.length;
  document.querySelector('#restore').disabled = loading || !future.length;
  document.querySelector('#delete').disabled = loading || !state.source || (state.selectedLayer === 'output' && !state.output);
  document.querySelector('#load-image').disabled = loading; saver.update();
}
for (const [id, undo] of [['return', true], ['restore', false]]) document.querySelector('#' + id).addEventListener('click', () => {
  finishEdit(); const from = undo ? past : future, to = undo ? future : past, entry = from.pop(); if (!entry) return;
  to.push(entry); state = capture(undo ? entry.before : entry.after); syncUI(); request();
});
document.querySelector('#delete').addEventListener('click', () => action(() => {
  if (state.selectedLayer === 'source') { state.source = null; state.output = true; }
  else { state.output = false; state.selectedLayer = 'source'; }
}));
let detecting=null;
function request(){
 const source=state.source;
 if(source&&['auto','foreground'].includes(state.contour.mask)&&!source.foreground&&!source.hasAlpha){
  if(detecting)return;
  loading=true;syncUI();const note=document.querySelector('#render-error');
  detecting=detectForeground(source,status=>{note.textContent=status;}).then(result=>{if(state.source?.id===source.id)state.source=result;loading=false;detecting=null;syncUI();requestRender();}).catch(error=>{loading=false;detecting=null;renderError=error.message;syncUI();note.textContent='No se pudo detectar la figura. Probá Mask: Transparency o Light background.';console.error(error);});return;
 }
 requestRender();
}
function requestRender() {
  revision++; pending = true; rendering = !!state.source; renderError = ''; document.querySelector('#render-error').textContent = '';
  document.querySelector('#empty-state').hidden = !!state.source; saver.update();
  clearTimeout(timer);
  if (!state.source) {
    pending = false; art.getContext('2d').clearRect(0, 0, art.width, art.height); preview.getContext('2d').clearRect(0, 0, preview.width, preview.height);
    rendering = false; saver.update(); return;
  }
  timer = setTimeout(send, 55);
}
async function send() {
  if (!pending || inFlight || !state.source) return;
  pending = false; inFlight = true; const id = revision, captured = capture(state);
  captured.motionTime = performance.now();
  if (worker) worker.postMessage({ id, state: captured });
  else {
    try { const result = await renderModel(captured, 1000); if (id === revision) receive({ id, canvas: result.canvas, width: result.width, height: result.height }); }
    catch (error) { if (id === revision) receive({ error: error.message }); }
    inFlight = false; if (pending) send();
  }
}
function receive(data) {
  rendering = false;
  if (data.error) { renderError = data.error; console.error('Contour render:', data.error); document.querySelector('#render-error').textContent = 'No se pudo procesar la imagen. Probá otra imagen.'; saver.update(); return; }
  const image = data.bitmap || data.canvas, size = `${image.width}x${image.height}`;
  art.width = image.width; art.height = image.height; art.getContext('2d').drawImage(image, 0, 0);
  const scale = Math.min(1, 360 / image.width, 160 / image.height);
  preview.width = Math.max(1, Math.round(image.width * scale)); preview.height = Math.max(1, Math.round(image.height * scale));
  preview.getContext('2d').drawImage(image, 0, 0, preview.width, preview.height); data.bitmap?.close();
  for (const el of [document.querySelector('.canvas-wrap'), document.querySelector('.canvas-overlays')]) { el.style.width = art.width + 'px'; el.style.height = art.height + 'px'; }
  if (stageSize !== size) { stageSize = size; document.dispatchEvent(new Event('contour-artboard-size')); }
  const pngLabel = document.querySelector('#export-png small'); const pngSize=pngDimensions(state); pngLabel.textContent = `PNG HD · ${pngSize.width} × ${pngSize.height}`;
  saver.update();
}
function slider(parent, group, key, label, min, max, step = 1, unit = '') {
  const row = document.createElement('div'); row.className = 'control';
  row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}"><span class="numeric-value"><input type="number" min="${min}" max="${max}" step="${step}" aria-label="${label} valor"><span>${unit}</span></span>`;
  const range = row.querySelector('input[type=range]'), number = row.querySelector('input[type=number]');
  range.value = state[group][key]; number.value = range.value;
  const paint = () => range.style.setProperty('--fill', (Number(range.value) - min) / (max - min) * 100 + '%'); paint();
  const change = element => { beginEdit(element); state[group][key] = Number(range.value); if (document.activeElement !== number) number.value = range.value; paint(); request(); };
  range.addEventListener('input', () => change(range));
  number.addEventListener('input', () => { if (!Number.isFinite(number.valueAsNumber)) return; range.value = Math.max(min, Math.min(max, number.valueAsNumber)); change(number); });
  for (const input of [range, number]) { input.disabled = loading || !state.output; input.addEventListener('change', finishEdit); input.addEventListener('blur', () => { finishEdit(); number.value = range.value; }); }
  number.addEventListener('keydown', e => { if (e.key === 'Enter') number.blur(); }); parent.append(row); return row;
}
function choice(parent, group, key, label, choices, onChange) {
  const row = document.createElement('div'); row.className = 'control choice';
  const title = document.createElement('span'); title.textContent = label; const select = document.createElement('select'); select.setAttribute('aria-label', label);
  for (const [value, text] of choices) select.append(new Option(text, value)); select.value = String(state[group][key]); select.disabled = loading || !state.output;
  select.addEventListener('change', () => action(() => { state[group][key] = typeof state[group][key] === 'boolean' ? select.value === 'true' : select.value; onChange?.(); }));
  row.append(title, select); parent.append(row);
}
function seedControl(parent){
 const row=document.createElement('div');row.className='control motion-seed';
 row.innerHTML='<span>Seed</span><input type="number" min="0" max="4294967295" step="1" aria-label="Movement seed"><button type="button" aria-label="Generar nueva seed" title="Generar nueva seed">↻ Random</button>';
 const input=row.querySelector('input'),button=row.querySelector('button');input.value=state.contour.seed??1;
 input.disabled=button.disabled=loading||!state.output;
 input.addEventListener('change',()=>{if(!Number.isFinite(input.valueAsNumber)){input.value=state.contour.seed??1;return;}const value=Math.max(0,Math.min(4294967295,Math.round(input.valueAsNumber)));action(()=>{state.contour.seed=value;});});
 button.addEventListener('click',()=>action(()=>{let seed;do{seed=crypto.getRandomValues(new Uint32Array(1))[0];}while(seed===(state.contour.seed??1));state.contour.seed=seed;}));
 parent.append(row);
}
function controls(){
 const shared=document.querySelector('#shared-controls'),own=document.querySelector('#tool-controls');shared.replaceChildren();own.replaceChildren();
 choice(shared,'contour','mask','Mask',[['auto','Auto · Figure'],['foreground','Foreground'],['alpha','Transparency'],['light','Light background']]);
 slider(shared,'contour','threshold','Threshold',1,99,1,'%');
 choice(shared,'contour','figures','Figures',[['all','All figures'],['main','Main figure']]);
 slider(shared,'contour','roughness','Roughness',0,12,.5,'px');
 choice(shared,'contour','fill','Fill',[['true','On'],['false','Off']]);
 slider(shared,'contour','stroke','Stroke Width',0,20,.5,'px');
 choice(shared,'shared','background','Background',[['transparent','Transparent'],['image','Original image'],['color','Solid color']]);
 slider(own,'contour','jitter','Jitter',0,20,.5,'px');
 slider(own,'contour','fps','FPS',1,24,1);
 seedControl(own);
 choice(own,'contour','labels','Labels',[['false','Off'],['true','On']]);
 slider(own,'contour','labelSize','Label Size',8,80,1,'px');
}
function syncUI() {
  controls();syncCommands();
  for (const button of document.querySelectorAll('[data-tool]')) { button.setAttribute('aria-pressed', String(state.output && button.dataset.tool === state.tool)); button.disabled = loading; }
  const title=state.output?'Silhouette':'Source'; document.querySelector('#tool-title').textContent = title;
  document.querySelector('.session').textContent = title + (state.output ? ' Tool Active' : ' Image');
  document.querySelector('#image-info').textContent = state.source ? `${state.source.name} · ${state.source.width} × ${state.source.height}` : 'PNG · JPG · WebP';
  document.querySelector('#image-info').title = state.source?.name || '';
  for (const key of ['primary', 'contrast', 'shadow']) { const input = document.querySelector('#' + key); input.value = state.colors[key]; input.disabled = loading; }
  const layers = document.querySelector('#layers'); layers.replaceChildren();
  if (state.source) for (const [id, label, detail] of [['source', 'Source', state.source.name], ...(state.output ? [['output', title, 'Units']] : [])]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'layer-row'; button.dataset.layer = id; button.setAttribute('aria-pressed', String(state.selectedLayer === id));
    button.textContent = label; const span = document.createElement('span'); span.textContent = detail; button.append(span); button.disabled = loading;
    button.addEventListener('click', () => { finishEdit(); state.selectedLayer = id; for (const b of layers.children) b.setAttribute('aria-pressed', String(b === button)); syncCommands(); }); layers.append(button);
  }
  document.dispatchEvent(new Event('endo-settings'));
}
for (const button of document.querySelectorAll('[data-tool]')) button.addEventListener('click', () => action(() => { state.tool = button.dataset.tool; state.output = true; state.selectedLayer = 'output'; }));
for (const button of document.querySelectorAll('.cursor-modes button')) button.addEventListener('click', () => { document.querySelector('#canvas-viewport').dataset.mode = button.dataset.mode; for (const b of document.querySelectorAll('.cursor-modes button')) b.setAttribute('aria-pressed', String(b === button)); });
for (const key of ['primary', 'contrast', 'shadow']) {
  const input = document.querySelector('#' + key); input.addEventListener('input', () => { beginEdit(input); state.colors[key] = input.value; request(); }); input.addEventListener('change', finishEdit); input.addEventListener('blur', finishEdit);
}
document.addEventListener('endo-color-preset', e => { const preset = COLOR_PRESETS[e.detail]; if (preset && !loading) action(() => { Object.assign(state.colors, preset.colors);  }); });
async function readImage(file, tile = false) {
  if (file.size > 128 * 1024 * 1024) throw new Error('La imagen supera 128 MB');
  let image;
  try { image = await createImageBitmap(file); }
  catch { throw new Error('No se pudo abrir la imagen. Probá PNG, JPG, WebP o AVIF; para HEIC, exportala como PNG o JPG.'); }
  try {
    const originalWidth = image.width, originalHeight = image.height;
    const factor = tile ? Math.min(1, 512 / Math.max(originalWidth, originalHeight)) : Math.min(1, Math.sqrt(16_000_000 / (originalWidth * originalHeight)), 8192 / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.floor(originalWidth * factor)), height = Math.max(1, Math.floor(originalHeight * factor));
    let data;
    if (tile || factor < 1 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo preparar la imagen');
      data = await readData(blob);
    } else data = await readData(file);
    return { id: crypto.randomUUID(), name: file.name, width, height, originalWidth, originalHeight, data };
  } finally { image.close(); }
}
function readData(blob) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo leer la imagen')); reader.readAsDataURL(blob); });
}
document.querySelector('#load-image').addEventListener('click', () => document.querySelector('#image-file').click());
document.querySelector('#image-file').addEventListener('change',async event=>{
 const file=event.target.files[0];event.target.value='';if(!file||loading)return;finishEdit();loading=true;syncUI();
 try{const source=await readImage(file);loading=false;action(()=>{state.source=source;state.output=true;state.selectedLayer='output';});}
 catch(error){loading=false;syncUI();document.querySelector('#render-error').textContent=error.message;}
});
syncUI(); request();

// Animation frames never mutate the document or enter undo/autosave history.
setInterval(() => {
  if (document.hidden || !state.contour.jitter || !state.output || !state.source || loading || rendering || inFlight || pending || renderError) return;
  pending = true; send();
}, 1000/24);
