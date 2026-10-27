import { symmetrySurface, toolTransforms, transformPoint } from './symmetry.js';

// All strokes contribute to the same height field. Material ownership stays editable.
export class ChromeSurface {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.height = new Float32Array(this.w * this.h);
    this.owner = new Int32Array(this.w * this.h);
    this.image = this.ctx.createImageData(this.w, this.h);
    this.infinite = options.infinite === true;
    this.resolution = options.resolution || 1;
    this.originX = options.originX || 0;
    this.originY = options.originY || 0;
    this.logicalWidth = options.logicalWidth || this.w / this.resolution;
    this.logicalHeight = options.logicalHeight || this.h / this.resolution;
    this.coverage = new Float32Array(this.w * this.h);
    this.paintId = 0;
    this.clear();
  }

  clear() {
    this.height.fill(0);
    this.owner.fill(-1);
    this.coverage.fill(0);
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.image.data.fill(0);
    this.bounds = null;
  }

  // Rasterize a continuous capsule, with coverage at subpixel boundaries.
  dab(x, y, radius, relief, settings = {}) { this.capsule({ x, y }, { x, y }, radius, radius, relief, settings); }

  capsule(a, b, ra, rb, relief, settings = {}) {
    const q = this.resolution;
    const ax = (a.x - this.originX) * q, ay = (a.y - this.originY) * q;
    const bx = (b.x - this.originX) * q, by = (b.y - this.originY) * q;
    ra *= q; rb *= q;
    if (!Number.isFinite(ax + ay + bx + by + ra + rb) || Math.max(ra, rb) <= 0) return;
    const radius = Math.max(ra, rb) + 1;
    const x0 = Math.max(0, this.infinite ? 0 : Math.ceil(-this.originX * q), Math.floor(Math.min(ax, bx) - radius));
    const x1 = Math.min(this.w - 1, this.infinite ? this.w - 1 : Math.ceil((this.logicalWidth - this.originX) * q) - 1, Math.ceil(Math.max(ax, bx) + radius));
    const y0 = Math.max(0, this.infinite ? 0 : Math.ceil(-this.originY * q), Math.floor(Math.min(ay, by) - radius));
    const y1 = Math.min(this.h - 1, this.infinite ? this.h - 1 : Math.ceil((this.logicalHeight - this.originY) * q) - 1, Math.ceil(Math.max(ay, by) + radius));
    if (x1 < x0 || y1 < y0) return;
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = length ? Math.max(0, Math.min(1, ((x + .5 - ax) * dx + (y + .5 - ay) * dy) / length)) : 0;
      const r = ra + (rb - ra) * t;
      const distance = Math.hypot(x + .5 - ax - t * dx, y + .5 - ay - t * dy);
      let coverage = Math.max(0, Math.min(1, r - distance + .5));
      if (!coverage || r <= 0) continue;
      const d = Math.min(distance, Math.max(0, r - .25)) / r;
      let profile = Math.sqrt(Math.max(0, 1 - d * d));
      if (settings.brush === 'relief') {
        const wx = this.originX + (x + .5) / q, wy = this.originY + (y + .5) / q;
        const ridge = (settings.ridge ?? 55) / 100;
        const roughness = (settings.roughness ?? 40) / 100;
        const noise = surfaceNoise(wx * .65, wy * .65) + surfaceNoise(wx * 2.1, wy * 2.1) * .3;
        profile = Math.max(.02, profile * (1 + ridge * Math.pow(1 - d, 6) + roughness * noise * .55));
      }
      const brush = settings.brush || 'cromo';
      const wx = this.originX + (x + .5) / q, wy = this.originY + (y + .5) / q;
      const scale = Math.max(.4, settings.particleSize ?? 1.5);
      const cellX = Math.floor(wx / scale), cellY = Math.floor(wy / scale);
      const random = particleHash(cellX, cellY);
      const density = (settings.density ?? 65) / 100;
      if (brush === 'sand') {
        const ridge = .5 + .5 * Math.sin(wx * .55 + wy * .23 + surfaceNoise(wx * .07, wy * .07) * 12);
        coverage *= random < density ? .8 + random * .2 : .12;
        profile *= .45 + ridge * .6 + random * .3;
      } else if (brush === 'crayon') {
        coverage *= random < .15 + (1 - density) * .5 ? .08 : .45 + random * .55;
        profile *= .12 + random * .08;
      } else if (brush === 'cement') {
        const pores = random < (1 - density) * .5 ? .35 : 1;
        profile = Math.pow(profile, .6) * pores * (.65 + random * .35);
      } else if (brush === 'dust') {
        const fx = wx / scale - cellX - .5, fy = wy / scale - cellY - .5;
        const particle = Math.max(0, Math.min(1, (.38 - Math.hypot(fx, fy)) * scale * q + .5));
        coverage *= random < density * Math.pow(1 - d, .6) ? particle * (.25 + random * .7) : 0;
        profile *= .08 + random * .1;
      }
      if (!coverage) continue;
      const z = profile * r * relief;
      const i = y * this.w + x;
      this.coverage[i] = Math.max(this.coverage[i], coverage);
      if (z > this.height[i]) { this.height[i] = z; this.owner[i] = this.paintId; }
    }
    this.dirty(x0, y0, x1, y1);
  }

  dirty(x0, y0, x1, y1) {
    const b = this.bounds;
    this.bounds = b
      ? [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)]
      : [x0, y0, x1, y1];
  }

  segment(a, b, ra, rb, settings) {
    this.capsule(a, b, ra, rb, settings.relief, settings);
  }

  render(scene, materials, all = false) {
    if (all) this.bounds = [0, 0, this.w - 1, this.h - 1];
    if (!this.bounds) return;
    const blur = Math.max(1, Math.round(scene.merge * this.resolution));
    const pad = blur + 2;
    const [bx, by, ex, ey] = this.bounds;
    const x0 = Math.max(0, bx - pad), y0 = Math.max(0, by - pad);
    const x1 = Math.min(this.w - 1, ex + pad), y1 = Math.min(this.h - 1, ey + pad);
    const out = this.image.data, height = this.height, w = this.w;
    const angle = scene.light * Math.PI / 180, lx = Math.cos(angle), ly = Math.sin(angle);
    const palette = materials.map(p => ({ ...p, ...scene, primary: hex(p.primary), shadow: hex(p.shadow), contrast: hex(p.contrast) }));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x, j = i * 4, z = height[i];
        if (z <= 0) { out[j + 3] = 0; continue; }
        const p = palette[this.owner[i]];
        const dx = (height[y * w + Math.max(0, x - blur)] - height[y * w + Math.min(w - 1, x + blur)]) / (blur * 2);
        const dy = (height[Math.max(0, y - blur) * w + x] - height[Math.min(this.h - 1, y + blur) * w + x]) / (blur * 2);
        const length = Math.hypot(dx, dy, 1), n = (dx * lx + dy * ly) / length, nz = 1 / length;
        const band = .5 + .5 * Math.sin(n * 8.5 + nz * 3.2);
        const spec = Math.pow(Math.max(0, (n + nz * .8) / 1.2), Math.max(2, 22 - p.shine * .18));
        const v = ['relief', 'sand', 'cement'].includes(p.brush)
          ? Math.max(0, Math.min(1, .24 + (n + nz * .65) * .46 + spec * p.shine / 100 * .28))
          : Math.max(0, Math.min(1, .12 + band * .67 + spec * p.shine / 100));
        const grain = surfaceNoise(this.originX + (x + .5) / this.resolution, this.originY + (y + .5) / this.resolution) * p.grain / 100;
        for (let c = 0; c < 3; c++) {
          const materialValue = ['crayon', 'dust'].includes(p.brush) ? .42 + nz * .12 : v;
          const color = materialValue < .5
            ? p.shadow[c] + (p.primary[c] - p.shadow[c]) * materialValue * 2
            : p.primary[c] + (p.contrast[c] - p.primary[c]) * (materialValue - .5) * 2;
          out[j + c] = Math.max(0, Math.min(255, color + grain * 90));
        }
        out[j + 3] = Math.round(this.coverage[i] * 255);
      }
    }
    this.ctx.putImageData(this.image, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    this.bounds = null;
  }
}

// Raw samples preserve position, timing and pressure so geometry can be replayed.
export class StrokeBuilder {
  constructor(surface, settings, id) {
    this.surface = surface;
    this.settings = settings;
    this.id = id;
    this.previous = null;
    this.distance = 0;
  }

  radius(point, speed) {
    const p = this.settings;
    return Math.max(1, p.width / 2 * point.pressure
      * (1 + p.variation / 100 * .35 * Math.sin(this.distance / 45))
      * (1 - Math.min(.75, speed * .22) * p.speed / 100));
  }

  add(point, finish = false) {
    const p = this.settings;
    this.surface.paintId = this.id;
    if (!this.previous) {
      this.previous = { x: point.x, y: point.y };
      this.raw = point;
      this.r = this.radius(point, 0);
      this.surface.dab(point.x, point.y, this.r, p.relief, p);
      return;
    }
    const travel = Math.hypot(point.x - this.raw.x, point.y - this.raw.y);
    this.distance += travel;
    const alpha = finish ? 1 : 1 - p.smooth / 100 * .8;
    const b = { x: this.previous.x + (point.x - this.previous.x) * alpha, y: this.previous.y + (point.y - this.previous.y) * alpha };
    const target = finish ? this.r : this.radius(point, travel / Math.max(1, point.time - this.raw.time));
    const rb = this.r + (target - this.r) * .35;
    this.surface.segment(this.previous, b, this.r, rb, p);
    this.previous = b;
    this.raw = point;
    this.r = rb;
  }
}

export function rebuild(surface, strokes, scene) {
  surface.clear();
  strokes.forEach((stroke, id) => {
    if (!stroke.points.length || (surface.infinite && !strokeInView(surface,stroke))) return;
    const target = symmetrySurface(surface, stroke.tool, stroke.points[0]);
    const builder = new StrokeBuilder(target, { ...stroke.settings, ...scene }, id);
    stroke.points.forEach(point => builder.add(point, point.finish));
  });
}

function hex(s) {
  return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
}

// Noise is tied to document coordinates, so zooming/panning cannot move the texture.
function surfaceNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const hash = (a, b) => (((Math.imul(a + 17, 374761393) ^ Math.imul(b + 31, 668265263)) >>> 0) % 1000 / 1000 - .5);
  const top = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx;
  const bottom = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

function particleHash(x, y) {
  let value = Math.imul(x + 7919, 374761393) ^ Math.imul(y + 104729, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function strokeInView(surface,stroke){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const p of stroke.points){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y)}
 const pad=stroke.settings.width+16,left=surface.originX-pad,top=surface.originY-pad,right=surface.originX+surface.w/surface.resolution+pad,bottom=surface.originY+surface.h/surface.resolution+pad;
 return toolTransforms(stroke.tool,surface.logicalWidth,surface.logicalHeight,stroke.points[0]).some(t=>{
  const corners=[{x:x0,y:y0},{x:x1,y:y0},{x:x0,y:y1},{x:x1,y:y1}].map(p=>transformPoint(p,t));
  return Math.max(...corners.map(p=>p.x))>=left&&Math.min(...corners.map(p=>p.x))<=right&&Math.max(...corners.map(p=>p.y))>=top&&Math.min(...corners.map(p=>p.y))<=bottom;
 });
}
