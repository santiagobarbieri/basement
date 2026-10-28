import {camera} from './zoom.js';
// A screen-sized high-resolution view is reconstructed from original gestures.
// Painting stays immediate; expensive refinement runs off the UI thread.
const viewport = document.querySelector('#canvas-viewport'), board = document.querySelector('.canvas-wrap');
const canvas = document.querySelector('#resolution-view'), artboard = document.querySelector('#artboard');
const ctx = canvas.getContext('2d');
let state = null, generation = 0, busy = false, inFlight = false, pending = false, timer;
let worker;
try { worker = new Worker(new URL('./resolution-worker.js', import.meta.url), { type: 'module' }); }
catch { /* Keep the immediate renderer usable if workers are unavailable. */ }
function invalidate() {
  generation++; canvas.style.opacity = '0'; pending = true;
  clearTimeout(timer); timer = setTimeout(send, 70);
}
function send() {
  if (!worker || !state || busy || inFlight || !pending) return;
  const rect = board.getBoundingClientRect(), viewRect = viewport.getBoundingClientRect();
  if (!rect.width || !viewRect.width || !viewRect.height) return;
  pending = false; inFlight = true;
  worker.postMessage({ id: generation, strokes: state.strokes, layers:state.layers, scene: state.scene,
    background: getComputedStyle(viewport).backgroundColor,
    view: { scale:camera.scale,x:camera.x,y:camera.y,
      width: viewport.clientWidth, height: viewport.clientHeight, dpr: window.devicePixelRatio || 1 } });
}
if (worker) {
  worker.onmessage = ({ data }) => {
    inFlight = false;
    if (data.bitmap) {
      if (data.id === generation && !busy) {
        canvas.width = data.bitmap.width; canvas.height = data.bitmap.height;
        ctx.drawImage(data.bitmap, 0, 0); canvas.style.opacity = '1';
        canvas.dataset.resolution = data.resolution;
        canvas.dataset.samples = data.samples;
        canvas.dispatchEvent(new Event('endo-refined'));
      }
      data.bitmap.close();
    }
    if (pending) send();
  };
  worker.onerror = () => { worker.terminate(); worker = null; canvas.style.opacity = '0'; };
}
document.addEventListener('endo-artboard-rendered', ({ detail }) => {
  state = detail; busy = detail.busy; invalidate();
});
artboard.addEventListener('pointerdown', () => {
  if (['draw','erase'].includes(viewport.dataset.mode)) { busy = true; invalidate(); }
});
document.addEventListener('endo-camera-change',invalidate);
new ResizeObserver(invalidate).observe(viewport);
// Discard any bitmap from the previous theme before showing its replacement.
// The paper is presentation only; the editable/exported Artboard stays transparent.
new MutationObserver(invalidate).observe(document.documentElement, {
  attributes: true, attributeFilter: ['data-theme']
});
