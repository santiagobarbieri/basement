import { ChromeSurface, rebuild } from './engine.js';
self.onmessage = async ({ data }) => {
  const { id, strokes, scene, view, background } = data;
  try {
    let resolution = Math.max(.1, view.scale * Math.min(view.dpr, 2));
    const compute = () => {
      const width = Math.max(1, Math.ceil(view.width / view.scale * resolution));
      const height = Math.max(1, Math.ceil(view.height / view.scale * resolution));
      const pad = Math.ceil((scene.merge + 2) * resolution);
      return { width, height, pad };
    };
    let size = compute();
    while ((size.width + size.pad * 2) * (size.height + size.pad * 2) > 4_000_000) {
      resolution *= .9; size = compute();
    }
    const { width, height, pad } = size;
    const originX = -view.x / view.scale, originY = -view.y / view.scale;
    const canvas = new OffscreenCanvas(width + pad * 2, height + pad * 2);
    const surface = new ChromeSurface(canvas, {
      resolution, originX: originX - pad / resolution, originY: originY - pad / resolution,
      infinite:true,logicalWidth:960,logicalHeight:850,
    });
    rebuild(surface, strokes, scene);
    surface.render(scene, strokes.map(stroke => stroke.settings));
    // Match the live canvas paper, covering the old stroke without double alpha.
    surface.ctx.globalCompositeOperation = 'destination-over';
    surface.ctx.fillStyle = background;
    surface.ctx.fillRect(0,0,canvas.width,canvas.height);
    const bitmap = await createImageBitmap(canvas, pad, pad, width, height);
    self.postMessage({ id, bitmap, resolution, samples: canvas.width * canvas.height }, [bitmap]);
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
