import {exportGeometry,exportState} from './document-bounds.js';
import { renderLayerDocument } from './endo-renderer.js';
export async function exportPng(input) {
 const state=input;
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./png-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => { worker.terminate(); data.blob ? resolve(data.blob) : reject(new Error(data.error)); };
      worker.onerror = () => { worker.terminate(); reject(new Error('No se pudo generar PNG')); };
      worker.postMessage(state);
    });
  }
  await new Promise(resolve => requestAnimationFrame(resolve));
  const region=exportGeometry(state),canvas=document.createElement('canvas');canvas.width=region.width;canvas.height=region.height;
  const rendered=exportState(state),frame=rendered.frames.find(item=>item.id===rendered.activeFrameId);
  renderLayerDocument(canvas,rendered.strokes,state.scene,rendered.layers,{resolution:2,infinite:true,originX:region.x,originY:region.y,logicalWidth:960,logicalHeight:850,frame});
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo generar PNG')), 'image/png'));
}
