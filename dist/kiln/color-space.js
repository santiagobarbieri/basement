export function hsvToRgb(h, s, v) {
  const sector = ((h % 360) + 360) % 360 / 60, c = v * s, x = c * (1 - Math.abs(sector % 2 - 1)), m = v - c;
  const rgb = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(sector)];
  return rgb.map(n => Math.round((n + m) * 255));
}
export function rgbToHsv(rgb, fallbackHue = 210) {
  const [r,g,b] = rgb.map(n => n / 255), max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = fallbackHue;
  if (d) h = ((max === r ? (g-b)/d : max === g ? (b-r)/d+2 : (r-g)/d+4) * 60 + 360) % 360;
  return { h, s: max ? d / max : 0, v: max };
}
export const rgbToHex = rgb => '#' + rgb.map(n => n.toString(16).padStart(2,'0')).join('');
export const hexToRgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
