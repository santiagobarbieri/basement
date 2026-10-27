export function dimensions(state) {
  if (!state.source) return { width: 960, height: 850 };
  let width = state.source.width, height = state.source.height;
  if (state.tool === 'tiles' && state.output && state.tiles.aspect !== 'free') {
    const ratio = { square: 1, portrait: 4 / 5, wide: 16 / 9 }[state.tiles.aspect];
    width = Math.max(width, height); height = Math.round(width / ratio);
    const factor = Math.min(1, Math.sqrt(16_000_000 / (width * height)));
    width = Math.floor(width * factor); height = Math.floor(height * factor);
  }
  return { width, height };
}
export function luminance(r, g, b) { return (.2126 * r + .7152 * g + .0722 * b) / 255; }
export function random(seed) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function grid(width, height, size) {
  const spacing = Math.max(width, height) * size / 1000;
  const cols = Math.max(1, Math.ceil(width / spacing)), rows = Math.max(1, Math.ceil(height / spacing));
  return { cols, rows, dx: width / cols, dy: height / rows };
}
function clip(polygon, a, b, c) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = a * p.x + b * p.y - c, dq = a * q.x + b * q.y - c;
    if (dp <= 1e-7) out.push(p);
    if ((dp > 1e-7) !== (dq > 1e-7)) {
      const t = dp / (dp - dq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}
export function voronoi(width, height, size, irregularity, seed) {
  const { cols, rows, dx, dy } = grid(width, height, size), rng = random(seed), sites = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    sites.push({ x: (col + .5 + (rng() - .5) * .9 * irregularity / 100) * dx,
      y: (row + .5 + (rng() - .5) * .9 * irregularity / 100) * dy, col, row });
  }
  const cells = sites.map((site, index) => {
    let polygon = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
    const applied = new Set();
    const cut = j => {
      if (j === index || applied.has(j)) return;
      applied.add(j); const other = sites[j], a = other.x - site.x, b = other.y - site.y;
      polygon = clip(polygon, a, b, (other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2) / 2);
    };
    const neighbors = (rx, ry, callback) => {
      for (let r = Math.max(0, site.row - ry); r <= Math.min(rows - 1, site.row + ry); r++)
        for (let c = Math.max(0, site.col - rx); c <= Math.min(cols - 1, site.col + rx); c++) callback(r * cols + c);
    };
    neighbors(2, 2, cut);
    // Exact pruning: a site more than 2R away cannot cut this polygon.
    const radius = Math.max(...polygon.map(p => Math.hypot(p.x - site.x, p.y - site.y)));
    neighbors(Math.ceil(2 * radius / dx) + 1, Math.ceil(2 * radius / dy) + 1, j => {
      if (Math.hypot(sites[j].x - site.x, sites[j].y - site.y) <= 2 * radius + 1e-7) cut(j);
    });
    return { site, polygon };
  });
  return { cells, spacing: Math.min(dx, dy) };
}
export function contains(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const p = polygon[i], q = polygon[j];
    if ((p.y > y) !== (q.y > y) && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) inside = !inside;
  }
  return inside;
}
export function statistics(image, x0, y0, x1, y1, polygon = null) {
  let weight = 0, count = 0, r = 0, g = 0, b = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(image.height, Math.ceil(y1)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(image.width, Math.ceil(x1)); x++) {
      if (polygon && !contains(polygon, x + .5, y + .5)) continue;
      const i = (y * image.width + x) * 4, alpha = image.data[i + 3] / 255;
      count++; weight += alpha; r += image.data[i] * alpha; g += image.data[i + 1] * alpha; b += image.data[i + 2] * alpha;
    }
  if (!weight || !count) return { rgb: [255, 255, 255], luma: 1, alpha: 0 };
  const rgb = [r / weight, g / weight, b / weight];
  return { rgb, luma: luminance(...rgb), alpha: weight / count };
}
export function blur(image, radius) {
  if (!radius) return image;
  const { width: w, height: h, data } = image, out = new Uint8ClampedArray(data.length), temp = new Float32Array(data.length);
  // Separable, alpha-weighted box blur avoids dark halos around cutout images.
  const premult = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) { const a = data[i + 3] / 255; premult[i] = data[i] * a; premult[i + 1] = data[i + 1] * a; premult[i + 2] = data[i + 2] * a; premult[i + 3] = data[i + 3]; }
  const pass = (src, dst, horizontal) => {
    const lines = horizontal ? h : w, length = horizontal ? w : h;
    for (let line = 0; line < lines; line++) for (let c = 0; c < 4; c++) {
      let sum = 0, n = 0;
      const at = p => horizontal ? (line * w + p) * 4 + c : (p * w + line) * 4 + c;
      for (let p = 0; p < Math.min(length, radius + 1); p++) { sum += src[at(p)]; n++; }
      for (let p = 0; p < length; p++) {
        dst[at(p)] = sum / n;
        if (p - radius >= 0) { sum -= src[at(p - radius)]; n--; }
        if (p + radius + 1 < length) { sum += src[at(p + radius + 1)]; n++; }
      }
    }
  };
  pass(premult, temp, true); const result = new Float32Array(data.length); pass(temp, result, false);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = result[i + 3] / 255; out[i + 3] = result[i + 3];
    if (alpha) for (let c = 0; c < 3; c++) out[i + c] = result[i + c] / alpha;
  }
  return { width: w, height: h, data: out };
}

export function pngDimensions(state) {
 const {width,height}=dimensions(state);
 const scale=Math.min(Math.max(1,6000/Math.max(width,height)),8192/Math.max(width,height),Math.sqrt(32_000_000/(width*height)));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
