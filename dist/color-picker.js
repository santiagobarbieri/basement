import { presetsForBrush } from './color-presets.js';
import { hsvToRgb, rgbToHsv, rgbToHex, hexToRgb } from './color-space.js';
const square = document.querySelector('#color-square'), cursor = document.querySelector('#color-cursor');
const hue = document.querySelector('#color-hue'), roles = [...document.querySelectorAll('.color-role')];
const hexField = document.querySelector('#color-hex');
const roleHelp = document.querySelector('#color-role-help');
const editHelp = document.querySelector('#color-edit-help');
const activeName = document.querySelector('#color-active-name');
const activeSwatch = document.querySelector('#color-active-swatch');
const roleLabels = {
  primary: { name: 'Paint color', help: 'The foreground color used by your brush.', editing: 'Editing the paint color. Use HEX or RGB for an exact color.' },
  contrast: { name: 'Material highlight', help: 'The highlight color of a legacy material stroke.', editing: 'Editing the material highlight.' },
  shadow: { name: 'Material shadow', help: 'The shadow color of a legacy material stroke.', editing: 'Editing the material shadow.' },
};
let presetButtons = [], presetBrush = null;
const presetPanel = document.querySelector('#color-presets');
function syncPresets() {
  const brush = presetPanel.dataset.brush || 'cromo';
  if (brush === presetBrush) return;
  presetBrush = brush; presetButtons = []; presetPanel.replaceChildren();
  for (const [id, preset] of Object.entries(presetsForBrush(brush))) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.preset = id; button.title = 'Apply ' + preset.name;
    button.setAttribute('aria-label', button.title);
    button.innerHTML = '<span class="preset-swatch" aria-hidden="true"></span>';
    button.querySelector('.preset-swatch').style.background = brush==='basic'?preset.colors.primary:`linear-gradient(135deg, ${preset.colors.shadow}, ${preset.colors.primary} 35%, ${preset.colors.contrast} 55%, ${preset.colors.primary} 75%, ${preset.colors.shadow})`;
    button.addEventListener('click', () => document.dispatchEvent(new CustomEvent('endo-color-preset', { detail: id })));
    const label=document.createElement('span');label.className='preset-name';label.textContent=preset.name;button.append(label);
    presetPanel.append(button); presetButtons.push(button);
  }
}
const channels = ['r','g','b'].map(key => document.querySelector('#color-' + key));
const hsbChannels = ['h','s','v'].map(key=>document.querySelector('#color-'+key));
let role = 'primary', hsv = { h: 210, s: 0, v: 1 }, pointer = null;
const source = () => document.querySelector('#' + role);
function explainRole() {
  const label = roleLabels[role];
  if (activeName) activeName.textContent = label.name;
  if (activeSwatch) activeSwatch.style.backgroundColor = source().value;
  if (roleHelp) roleHelp.textContent = label.help;
  if (editHelp) editHelp.textContent = hexField?.getAttribute('aria-invalid') === 'true'
    ? 'Use six hexadecimal digits, for example #3A7BD5.' : label.editing;
}
function view() {
  syncPresets();
  square.style.setProperty('--hue', `hsl(${hsv.h} 100% 50%)`);
  cursor.style.left = `clamp(5px, ${hsv.s * 100}%, calc(100% - 5px))`; cursor.style.top = `clamp(5px, ${(1-hsv.v) * 100}%, calc(100% - 5px))`;
  hue.value = hsv.h;
  square.setAttribute('aria-valuenow', Math.round(hsv.s * 100));
  square.setAttribute('aria-valuetext', `Saturation ${Math.round(hsv.s*100)}%, brightness ${Math.round(hsv.v*100)}%`);
  const rgb = hexToRgb(source().value);
  hsbChannels.forEach((input,i)=>{if(!input)return;if(document.activeElement!==input)input.value=Math.round([hsv.h,hsv.s*100,hsv.v*100][i]);input.disabled=source().disabled;});
  channels.forEach((input, i) => { if (document.activeElement !== input) input.value = rgb[i]; input.disabled = source().disabled; });
  if (hexField) {
    hexField.disabled = source().disabled;
    if (document.activeElement !== hexField) {
      hexField.value = source().value.toUpperCase();
      hexField.removeAttribute('aria-invalid');
    }
  }
  hue.disabled = source().disabled;
  square.setAttribute('aria-disabled', String(source().disabled)); square.tabIndex = source().disabled ? -1 : 0;
  for (const button of presetButtons) {
    button.disabled = source().disabled;
    const colors = presetsForBrush(presetBrush)[button.dataset.preset].colors;
    button.setAttribute('aria-pressed', String(Object.entries(colors).every(([key, value]) => document.querySelector('#' + key).value === value)));
  }
  for (const button of roles) {
    button.setAttribute('aria-pressed', String(button.dataset.color === role));
    button.disabled = source().disabled;
    button.querySelector('span').style.backgroundColor = document.querySelector('#' + button.dataset.color).value;
    button.title = roleLabels[button.dataset.color].help;
  }
  explainRole();
}
function refresh() { hsv = rgbToHsv(hexToRgb(source().value), hsv.h); view(); }
function apply(finish = false) {
  if (source().disabled) return;
  source().value = rgbToHex(hsvToRgb(hsv.h, hsv.s, hsv.v));
  source().dispatchEvent(new Event('input')); view();
  if (finish) source().dispatchEvent(new Event('change'));
}
function finish() { source().dispatchEvent(new Event('change')); }
for (const button of roles) button.addEventListener('click', () => { finish(); role = button.dataset.color; refresh(); });
function position(e) {
  const rect = square.getBoundingClientRect();
  hsv.s = Math.max(0, Math.min(1, (e.clientX-rect.left)/rect.width));
  hsv.v = 1 - Math.max(0, Math.min(1, (e.clientY-rect.top)/rect.height));
  apply();
}
square.addEventListener('pointerdown', e => {
  if (source().disabled || e.button !== 0 || pointer !== null) return;
  e.preventDefault(); square.focus(); pointer = e.pointerId; square.setPointerCapture(pointer); position(e);
});
square.addEventListener('pointermove', e => { if (pointer === e.pointerId) position(e); });
function end(e) {
  if (pointer !== e.pointerId) return;
  if (e.type === 'pointerup') position(e);
  const id = pointer; pointer = null; finish();
  if (square.hasPointerCapture(id)) square.releasePointerCapture(id);
}
for (const event of ['pointerup','pointercancel','lostpointercapture']) square.addEventListener(event,end);
square.addEventListener('keydown', e => {
  if (source().disabled || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
  e.preventDefault(); const step = e.shiftKey ? .1 : .01;
  if (e.key === 'ArrowLeft') hsv.s = Math.max(0,hsv.s-step);
  if (e.key === 'ArrowRight') hsv.s = Math.min(1,hsv.s+step);
  if (e.key === 'ArrowUp') hsv.v = Math.min(1,hsv.v+step);
  if (e.key === 'ArrowDown') hsv.v = Math.max(0,hsv.v-step);
  apply(true);
});
hue.addEventListener('input', () => { hsv.h = Number(hue.value); apply(); });
hue.addEventListener('change', finish); hue.addEventListener('blur',finish);
channels.forEach((input, i) => {
  input.addEventListener('input', () => {
    if (!Number.isFinite(input.valueAsNumber)) return;
    const rgb = hexToRgb(source().value); rgb[i] = Math.round(Math.max(0,Math.min(255,input.valueAsNumber)));
    hsv = rgbToHsv(rgb,hsv.h); apply();
  });
  input.addEventListener('change',finish);
  input.addEventListener('blur', () => { finish(); input.value = hexToRgb(source().value)[i]; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
});
if (hexField) {
  hexField.addEventListener('input', () => {
    if (source().disabled) return;
    const value = hexField.value.trim();
    if (!/^#?[0-9a-f]{6}$/i.test(value)) {
      hexField.setAttribute('aria-invalid', 'true');
      explainRole();
      return;
    }
    hexField.removeAttribute('aria-invalid');
    source().value = '#' + value.replace(/^#/, '').toLowerCase();
    hsv = rgbToHsv(hexToRgb(source().value), hsv.h);
    source().dispatchEvent(new Event('input'));
    view();
  });
  hexField.addEventListener('change', finish);
  hexField.addEventListener('blur', () => {
    finish();
    hexField.value = source().value.toUpperCase();
    hexField.removeAttribute('aria-invalid');
    view();
  });
  hexField.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); hexField.blur(); }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      hexField.value = source().value.toUpperCase();
      hexField.removeAttribute('aria-invalid'); hexField.blur();
    }
  });
}
document.addEventListener('endo-settings',refresh);
refresh();

hsbChannels.forEach((input,i)=>{if(!input)return;
 input.addEventListener('input',()=>{if(!Number.isFinite(input.valueAsNumber))return;const key=['h','s','v'][i];hsv[key]=Math.max(0,Math.min(i===0?360:100,input.valueAsNumber))/(i===0?1:100);apply();});
 input.addEventListener('change',finish);input.addEventListener('blur',()=>{finish();view();});
});
