import { renderModel } from './renderer.js';
self.onmessage = async ({ data }) => {
  try {
    const result = await renderModel(data.state, data.export ? Infinity : 1000);
    if (data.export) self.postMessage({ id: data.id, blob: await result.canvas.convertToBlob({ type: 'image/png' }) });
    else { const bitmap = result.canvas.transferToImageBitmap(); self.postMessage({ id: data.id, bitmap, width: result.width, height: result.height }, [bitmap]); }
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
