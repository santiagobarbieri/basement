import { dimensions, pngDimensions, blur } from './geometry.js';
import { renderTiles } from './renderers/tiles.js';
const bitmaps = new Map(), atlas = new Map();
let bitmapBytes = 0, atlasBytes = 0, sampleCache = null;
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
async function bitmap(asset) {
  if (bitmaps.has(asset.id)) { const entry = bitmaps.get(asset.id); bitmaps.delete(asset.id); bitmaps.set(asset.id, entry); return entry.image; }
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(asset.data)) throw new Error('Formato de imagen no compatible');
  const image = await createImageBitmap(await (await fetch(asset.data)).blob());
  const bytes = image.width * image.height * 4; bitmaps.set(asset.id, { image, bytes }); bitmapBytes += bytes;
  while (bitmapBytes > 96 * 1024 * 1024 && bitmaps.size > 1) {
    const key = bitmaps.keys().next().value, entry = bitmaps.get(key); entry.image.close(); bitmapBytes -= entry.bytes; bitmaps.delete(key);
  }
  return image;
}
function cached(key, w, h, draw) {
  if (atlas.has(key)) { const item = atlas.get(key); atlas.delete(key); atlas.set(key, item); return item; }
  const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h); atlas.set(key, c); atlasBytes += w * h * 4;
  while (atlasBytes > 24 * 1024 * 1024 && atlas.size > 1) {
    const first = atlas.keys().next().value, old = atlas.get(first); atlasBytes -= old.width * old.height * 4; atlas.delete(first);
  }
  return c;
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function color(stats, state) {
  if (state.shared.palette === 'mono') return state.colors.primary;
  if (state.shared.palette === 'palette') {
    const palette = Object.values(state.colors);
    return palette.reduce((best, candidate) => {
      const distance = hex => rgb(hex).reduce((sum, c, i) => sum + (c - stats.rgb[i]) ** 2, 0);
      return distance(candidate) < distance(best) ? candidate : best;
    });
  }
  // Keep the sampled image colors; the LRU limits atlas memory.
  return '#' + stats.rgb.map(c => Math.round(Math.max(0, Math.min(255, c)))).map(c => c.toString(16).padStart(2, '0')).join('');
}
function sourceSample(image, width, height, state) {
  const key = [state.source.id, width, height, state.shared.brightness, state.shared.contrast, state.tool === 'tiles' ? state.tiles.blur : 0].join(':');
  if (sampleCache?.key === key) return sampleCache.image;
  const factor = Math.min(1, 1000 / Math.max(width, height));
  const c = makeCanvas(Math.max(1, Math.round(width * factor)), Math.max(1, Math.round(height * factor))), ctx = c.getContext('2d');
  const cover = Math.max(width / image.width, height / image.height), sw = width / cover, sh = height / cover;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  const raw = ctx.getImageData(0, 0, c.width, c.height), pixels = raw.data;
  const brightness = state.shared.brightness / 100 * 255, contrast = Math.pow(2, state.shared.contrast / 100 * 2);
  for (let i = 0; i < pixels.length; i += 4) for (let channel = 0; channel < 3; channel++) pixels[i + channel] = (pixels[i + channel] - 127.5) * contrast + 127.5 + brightness;
  const sampled = { width: c.width, height: c.height, data: pixels };
  const result = state.tool === 'tiles' ? blur(sampled, state.tiles.blur) : sampled;
  sampleCache = { key, image: result }; return result;
}
export async function renderModel(state, maximum = 1000, outputSize = null) {
  if (!state.source) throw new Error('Cargá una imagen');
  const { width, height } = dimensions(state), ratio = Math.min(1, maximum / Math.max(width, height));
  const target=outputSize||(maximum===Infinity?pngDimensions(state):{width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))});
  const output = makeCanvas(target.width,target.height), ctx = output.getContext('2d');
  const image = await bitmap(state.source);
  if (state.shared.background === 'color') { ctx.fillStyle = state.colors.shadow; ctx.fillRect(0, 0, output.width, output.height); }
  if (!state.output) { ctx.drawImage(image, 0, 0, output.width, output.height); return { canvas: output, width, height }; }
  const sample = sourceSample(image, width, height, state), sx = output.width / sample.width, sy = output.height / sample.height;
  await renderTiles(ctx,state,sample,sx,sy,{cached,makeCanvas,bitmap,color});
  ctx.globalAlpha = 1;
  return { canvas: output, width, height };
}
