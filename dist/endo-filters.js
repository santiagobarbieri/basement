// Layer effects operate on a copy of shaded pixels. Alpha and source gestures stay intact.
const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
export function applyFilters(input, width, height, filters = [], view = {}) {
  const output = new Uint8ClampedArray(input);
  const resolution = view.resolution || 1, originX = view.originX || 0, originY = view.originY || 0;
  for (const filter of filters) {
    if (filter.enabled === false) continue;
    const threshold = clamp(Number(filter.amount ?? 128), 0, 255);
    const scale = clamp(Math.round(Number(filter.scale ?? 2) || 2), 1, 64);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (!output[index + 3]) continue;
      const red = output[index], green = output[index + 1], blue = output[index + 2];
      const luminance = red * .2126 + green * .7152 + blue * .0722;
      if (filter.type === 'invert') {
        output[index] = 255 - red; output[index + 1] = 255 - green; output[index + 2] = 255 - blue;
      } else if (filter.type === 'grayscale') {
        output[index] = output[index + 1] = output[index + 2] = luminance;
      } else if (filter.type === 'threshold' || filter.type === 'dither') {
        let cutoff = threshold;
        if (filter.type === 'dither') {
          // The Bayer lattice is anchored to the document, including negative coordinates.
          const cellX = Math.floor((originX + (x + .5) / resolution) / scale);
          const cellY = Math.floor((originY + (y + .5) / resolution) / scale);
          cutoff += ((bayer[((cellY % 4 + 4) % 4) * 4 + ((cellX % 4 + 4) % 4)] + .5) / 16 - .5) * 255;
        }
        output[index] = output[index + 1] = output[index + 2] = luminance >= cutoff ? 255 : 0;
      }
    }
  }
  return output;
}
