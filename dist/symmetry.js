// Isometric copies keep brush width, pressure, speed and smoothing identical.
const identity = () => ({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const count = (value, fallback, max) => Math.max(1, Math.min(max, Math.round(Number(value) || fallback)));
export function transformPoint(point, t) {
  return { x: t.a * point.x + t.c * point.y + t.tx, y: t.b * point.x + t.d * point.y + t.ty };
}

function explicitRegion(tool) {
  const region = tool?.region;
  return region && [region.x, region.y, region.width, region.height].every(Number.isFinite)
    && region.width > 0 && region.height > 0
    ? { x: region.x, y: region.y, width: region.width, height: region.height } : null;
}

// Older strokes keep the original document region. New strokes may repeat in
// any world-space rectangle, independently of the current camera or zoom.
export function toolRegion(tool, width = 960, height = 850) {
  return explicitRegion(tool) || { x: 0, y: 0, width, height };
}

export function toolTransforms(tool, width, height, anchor = { x: 0, y: 0 }) {
  if (!tool || tool.mode === 'none') return [identity()];
  const region = toolRegion(tool, width, height);
  const localAnchor = { x: anchor.x - region.x, y: anchor.y - region.y };
  return localTransforms(tool, region.width, region.height, localAnchor).map(t => ({
    ...t,
    tx: t.tx + region.x * (1 - t.a) - region.y * t.c,
    ty: t.ty + region.y * (1 - t.d) - region.x * t.b,
  }));
}

function localTransforms(tool, width, height, anchor) {
  if (!tool || tool.mode === 'none') return [identity()];
  if (tool.mode === 'mandala') {
    const copies = Math.max(2, count(tool.count, 8, 16));
    return Array.from({ length: copies }, (_, i) => {
      const angle = i * 2 * Math.PI / copies, cos = Math.cos(angle), sin = Math.sin(angle);
      return { a: cos, b: sin, c: -sin, d: cos,
        tx: width / 2 * (1 - cos) + height / 2 * sin,
        ty: height / 2 * (1 - cos) - width / 2 * sin };
    });
  }
  if (tool.mode === 'mirror') {
    const transforms = [identity()];
    if (tool.axes !== 'horizontal') transforms.push({ a: -1, b: 0, c: 0, d: 1, tx: width, ty: 0 });
    if (tool.axes !== 'vertical') {
      transforms.push({ a: 1, b: 0, c: 0, d: -1, tx: 0, ty: height });
      if (tool.axes !== 'horizontal') transforms.push({ a: -1, b: 0, c: 0, d: -1, tx: width, ty: height });
    }
    return transforms;
  }
  if (tool.mode === 'grid' || tool.mode === 'mosaic') {
    const columns = count(tool.columns, 3, 6), rows = count(tool.rows, 3, 6);
    const cellW = width / columns, cellH = height / rows;
    const sourceX = Math.max(0, Math.min(columns - 1, Math.floor(anchor.x / cellW)));
    const sourceY = Math.max(0, Math.min(rows - 1, Math.floor(anchor.y / cellH)));
    const transforms = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const flipX = tool.mode === 'mosaic' && Math.abs(col - sourceX) % 2 === 1;
      const flipY = tool.mode === 'mosaic' && Math.abs(row - sourceY) % 2 === 1;
      transforms.push({ a: flipX ? -1 : 1, b: 0, c: 0, d: flipY ? -1 : 1,
        tx: flipX ? (col + 1 + sourceX) * cellW : (col - sourceX) * cellW,
        ty: flipY ? (row + 1 + sourceY) * cellH : (row - sourceY) * cellH });
    }
    return transforms;
  }
  return [identity()];
}

// One processed gesture feeds all copies into the shared surface and material ID.
export function symmetrySurface(surface, tool, anchor) {
  const transforms = toolTransforms(tool, surface.logicalWidth || surface.w, surface.logicalHeight || surface.h, anchor);
  const region = tool?.mode && tool.mode !== 'none' ? explicitRegion(tool) : null;
  const clippedSettings = settings => region ? { ...settings, clipRect: region } : settings;
  return {
    set paintId(id) { surface.paintId = id; },
    dab(x, y, r, relief, settings) {
      for (const t of transforms) {
        const point = transformPoint({ x, y }, t);
        surface.dab(point.x, point.y, r, relief, clippedSettings(settings));
      }
    },
    segment(a, b, ra, rb, settings) {
      for (const t of transforms) surface.segment(transformPoint(a, t), transformPoint(b, t), ra, rb, clippedSettings(settings));
    },
  };
}
