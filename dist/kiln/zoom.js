const viewport = document.querySelector('#canvas-viewport');
const board = document.querySelector('.canvas-wrap');
const canvas = document.querySelector('#artboard');
const minus = document.querySelector('#zoom-out');
const plus = document.querySelector('#zoom-in');
const fit = document.querySelector('#zoom-fit');
let scale = 1, x = 0, y = 0, fitting = true, drawing = false;
let pan = null;
let previousWidth = 0, previousHeight = 0;
const maxScale = () => fitScale() * 8;
const fitScale = () => Math.min(viewport.clientWidth / canvas.width, viewport.clientHeight / canvas.height);
const minScale = () => fitScale();

function render() {
  viewport.classList.toggle('pan-locked', scale <= minScale() + 1e-6);
  board.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  document.querySelector('.canvas-overlays').style.transform = board.style.transform;
  fit.textContent = `${Math.round(scale / fitScale() * 100)} %`;
  fit.setAttribute('aria-label', `Escala ${Math.round(scale / fitScale() * 100)} por ciento. Ajustar a la ventana`);
  minus.disabled = drawing || !!pan || scale <= minScale() + 1e-6;
  plus.disabled = drawing || !!pan || scale >= maxScale() - 1e-6;
  fit.disabled = drawing || !!pan;
}
function fitBoard() {
  scale = fitScale();
  x = (viewport.clientWidth - canvas.width * scale) / 2;
  y = (viewport.clientHeight - canvas.height * scale) / 2;
  fitting = true;
  render();
}
function zoom(factor, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) {
  if (drawing || pan) return;
  const next = Math.max(minScale(), Math.min(maxScale(), scale * factor));
  if (next <= minScale() + 1e-6) { fitBoard(); return; }
  const ratio = next / scale;
  x = anchorX - (anchorX - x) * ratio;
  y = anchorY - (anchorY - y) * ratio;
  scale = next; fitting = false; render();
}
minus.addEventListener('click', () => zoom(1 / 1.2));
plus.addEventListener('click', () => zoom(1.2));
fit.addEventListener('click', fitBoard);
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientHeight : 1;
  const delta = Math.max(-200, Math.min(200, e.deltaY * unit));
  const rect = viewport.getBoundingClientRect();
  zoom(Math.exp(-delta * (e.ctrlKey ? .01 : .002)), e.clientX - rect.left, e.clientY - rect.top);
}, { passive: false });
// Safari emits gesture events for trackpad pinch rather than Ctrl+wheel.
let gestureScale = 1;
viewport.addEventListener('gesturestart', e => { e.preventDefault(); gestureScale = 1; }, { passive: false });
viewport.addEventListener('gesturechange', e => {
  e.preventDefault();
  if (!Number.isFinite(e.scale) || e.scale <= 0) return;
  const rect = viewport.getBoundingClientRect();
  zoom(e.scale / gestureScale, e.clientX - rect.left, e.clientY - rect.top);
  gestureScale = e.scale;
}, { passive: false });
viewport.addEventListener('gestureend', e => e.preventDefault(), { passive: false });
canvas.addEventListener('pointerdown', e => { if (e.button === 0 && viewport.dataset.mode === 'draw') { drawing = true; render(); } });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, () => { drawing = false; render(); });
}
new ResizeObserver(() => {
  const width = viewport.clientWidth, height = viewport.clientHeight;
  if (!width || !height) return;
  if (fitting) fitBoard();
  else {
    const oldFit = Math.min(previousWidth / canvas.width, previousHeight / canvas.height);
    const worldX = (previousWidth / 2 - x) / scale, worldY = (previousHeight / 2 - y) / scale;
    scale = fitScale() * scale / oldFit;
    x = width / 2 - worldX * scale; y = height / 2 - worldY * scale; render();
  }
  previousWidth = width; previousHeight = height;
}).observe(viewport);
fitBoard();

viewport.addEventListener('pointerdown', e => {
  if (viewport.dataset.mode !== 'pan' || e.button !== 0 || pan || scale <= minScale() + 1e-6) return;
  e.preventDefault();
  pan = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x, y };
  viewport.setPointerCapture(e.pointerId); viewport.classList.add('dragging');
  for (const button of document.querySelectorAll('.cursor-modes button')) button.disabled = true;
  render();
});
viewport.addEventListener('pointermove', e => {
  if (pan?.id !== e.pointerId) return;
  x = pan.x + e.clientX - pan.startX; y = pan.y + e.clientY - pan.startY;
  fitting = false; render();
});
function endPan(e) {
  if (pan?.id !== e.pointerId) return;
  const id = pan.id; pan = null;
  if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
  viewport.classList.remove('dragging');
  for (const button of document.querySelectorAll('.cursor-modes button')) button.disabled = false;
  render();
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(event, endPan);

document.addEventListener('kiln-artboard-size', () => { fitting = true; fitBoard(); });
