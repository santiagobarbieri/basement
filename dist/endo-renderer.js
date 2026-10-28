import { ChromeSurface, StrokeBuilder } from './engine.js';
import { symmetrySurface } from './symmetry.js';
import { applyFilters } from './endo-filters.js';

const legacyLayer = { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 1, filters: [] };
// Layer rasters need only CPU pixels; one actual canvas presents the composite.
function rasterCanvas(width, height) {
  const context = { clearRect() {}, putImageData() {}, createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; } };
  return { width, height, getContext() { return context; } };
}

export class LayeredSurface {
  constructor(canvas, options = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.w = canvas.width; this.h = canvas.height; this.options = options;
    this.infinite = options.infinite === true; this.resolution = options.resolution || 1;
    this.originX = options.originX || 0; this.originY = options.originY || 0;
    this.logicalWidth = options.logicalWidth || this.w / this.resolution;
    this.logicalHeight = options.logicalHeight || this.h / this.resolution;
    this.owner = new Int32Array(this.w * this.h); this.owner.fill(-1);
    this.height = new Float32Array(this.w * this.h); this.coverage = new Float32Array(this.w * this.h);
    this.image = this.ctx.createImageData(this.w, this.h);
    this.rasters = new Map(); this.strokes = []; this.layers = [legacyLayer]; this.compositionDirty = true;
    this.setDocument([], this.layers);
  }
  get bounds() { return this.compositionDirty || [...this.rasters.values()].some(item => item.surface.bounds) ? [0, 0, this.w - 1, this.h - 1] : null; }
  setDocument(strokes, layers) {
    this.strokes = strokes;
    this.layers = Array.isArray(layers) && layers.length ? layers : [legacyLayer];
    const signature = JSON.stringify(this.layers);
    if (signature !== this.layerSignature) this.compositionDirty = true;
    this.layerSignature = signature;
    // Hidden and fully transparent layers keep their editable gestures, but
    // need no viewport-sized raster. Showing one again replays its gestures.
    const ids = new Set(this.layers.filter(layer => layer.visible !== false && Number(layer.opacity ?? 1) > 0).map(layer => layer.id));
    for (const id of this.rasters.keys()) if (!ids.has(id)) this.rasters.delete(id);
  }
  rasterFor(id) {
    if (!this.rasters.has(id)) {
      this.rasters.set(id, { surface: new ChromeSurface(rasterCanvas(this.w, this.h), this.options) });
      this.compositionDirty = true;
    }
    return this.rasters.get(id);
  }
  clear() {
    for (const entry of this.rasters.values()) {
      entry.surface.clear(); entry.filtered = undefined; entry.filterSignature = undefined;
    }
    this.owner.fill(-1); this.height.fill(0); this.coverage.fill(0); this.image.data.fill(0);
    this.ctx.clearRect(0, 0, this.w, this.h); this.compositionDirty = true;
  }
  strokeSurface(stroke, index) {
    const layerId = stroke.layerId || this.layers[0].id;
    const entry = this.rasterFor(this.layers.some(layer => layer.id === layerId) ? layerId : this.layers[0].id);
    const surface = entry.surface, document = this;
    return {
      logicalWidth: surface.logicalWidth, logicalHeight: surface.logicalHeight, w: surface.w, h: surface.h,
      set paintId(id) { surface.paintId = id; },
      dab(x, y, radius, relief, settings) {
        surface.paintId = index;
        surface.dab(x, y, radius, relief, stroke.operation === 'erase' ? { ...settings, operation: 'erase' } : settings);
        document.compositionDirty = true;
      },
      segment(a, b, ra, rb, settings) {
        surface.paintId = index;
        surface.segment(a, b, ra, rb, stroke.operation === 'erase' ? { ...settings, operation: 'erase' } : settings);
        document.compositionDirty = true;
      }
    };
  }
  render(scene, materials, all = false) {
    this.setDocument(this.strokes, this.layers);
    if (!all && !this.bounds) return;
    for (const entry of this.rasters.values()) {
      entry.changed = all || !!entry.surface.bounds;
      entry.surface.render(scene, materials, all);
    }
    const output = this.image.data;
    output.fill(0); this.owner.fill(-1); this.height.fill(0); this.coverage.fill(0);
    for (const layer of this.layers) {
      const opacity = Math.max(0, Math.min(1, Number(layer.opacity ?? 1)));
      if (layer.visible === false || !opacity) continue;
      const entry = this.rasters.get(layer.id);
      if (!entry) continue;
      const surface = entry.surface;
      const filterSignature = JSON.stringify(layer.filters || []);
      if (entry.changed || entry.filterSignature !== filterSignature) {
        entry.filtered = layer.filters?.some(filter => filter.enabled !== false)
          ? applyFilters(surface.image.data, this.w, this.h, layer.filters, this) : surface.image.data;
        entry.filterSignature = filterSignature;
      }
      const pixels = entry.filtered || surface.image.data;
      for (let pixel = 0; pixel < this.owner.length; pixel++) {
        const index = pixel * 4, sourceAlpha = pixels[index + 3] / 255 * opacity;
        if (!sourceAlpha) continue;
        const destinationAlpha = output[index + 3] / 255;
        const alpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
        for (let c = 0; c < 3; c++) output[index + c] = (pixels[index + c] * sourceAlpha + output[index + c] * destinationAlpha * (1 - sourceAlpha)) / alpha;
        output[index + 3] = Math.round(alpha * 255);
        this.owner[pixel] = surface.owner[pixel]; this.height[pixel] = surface.height[pixel]; this.coverage[pixel] = alpha;
      }
    }
    this.ctx.putImageData(this.image, 0, 0); this.compositionDirty = false;
  }
}

// Workers and PNG export replay one layer at a time rather than retaining a
// full-resolution height field for every layer in a large document.
export function renderLayerDocument(canvas, strokes, scene, layers, options = {}) {
  const list = Array.isArray(layers) && layers.length ? layers : [legacyLayer];
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(canvas.width, canvas.height);
  const surface = new ChromeSurface(rasterCanvas(canvas.width, canvas.height), options);
  const materials = strokes.map(stroke => stroke.settings);
  for (const layer of list) {
    const opacity = Math.max(0, Math.min(1, Number(layer.opacity ?? 1)));
    if (layer.visible === false || !opacity) continue;
    surface.clear();
    strokes.forEach((stroke, index) => {
      if (!stroke.points?.length || (stroke.layerId || list[0].id) !== layer.id) return;
      const destination = stroke.operation === 'erase' ? eraseTarget(surface) : surface;
      const target = symmetrySurface(destination, stroke.tool, stroke.points[0]);
      const builder = new StrokeBuilder(target, { ...stroke.settings, ...scene }, index);
      for (const point of stroke.points) builder.add(point, point.finish);
    });
    surface.render(scene, materials);
    const pixels = layer.filters?.some(filter => filter.enabled !== false)
      ? applyFilters(surface.image.data, canvas.width, canvas.height, layer.filters, surface) : surface.image.data;
    for (let index = 0; index < image.data.length; index += 4) {
      const sourceAlpha = pixels[index + 3] / 255 * opacity;
      if (!sourceAlpha) continue;
      const destinationAlpha = image.data[index + 3] / 255;
      const alpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      for (let c = 0; c < 3; c++) image.data[index + c] = (pixels[index + c] * sourceAlpha + image.data[index + c] * destinationAlpha * (1 - sourceAlpha)) / alpha;
      image.data[index + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return { canvas, ctx, image };
}

function eraseTarget(surface) {
  return {
    logicalWidth: surface.logicalWidth, logicalHeight: surface.logicalHeight, w: surface.w, h: surface.h,
    set paintId(id) { surface.paintId = id; },
    dab(x, y, radius, relief, settings) { surface.dab(x, y, radius, relief, { ...settings, operation: 'erase' }); },
    segment(a, b, ra, rb, settings) { surface.segment(a, b, ra, rb, { ...settings, operation: 'erase' }); }
  };
}

export function rebuildLayers(surface, strokes, scene, layers) {
  surface.setDocument(strokes, layers); surface.clear();
  const visible = new Set(surface.layers.filter(layer => layer.visible !== false && Number(layer.opacity ?? 1) > 0).map(layer => layer.id));
  strokes.forEach((stroke, index) => {
    if (!stroke.points?.length || !visible.has(stroke.layerId || surface.layers[0].id)) return;
    const target = symmetrySurface(surface.strokeSurface(stroke, index), stroke.tool, stroke.points[0]);
    const builder = new StrokeBuilder(target, { ...stroke.settings, ...scene }, index);
    for (const point of stroke.points) builder.add(point, point.finish);
  });
}
