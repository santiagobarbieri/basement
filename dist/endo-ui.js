// Endo's workspace follows the hub. Presentation never mutates the Artboard.
const root = document.documentElement;
const themeButton = document.querySelector('#endo-theme-toggle');
for (const icon of document.querySelectorAll('[data-ui-icon]')) {
  icon.style.setProperty('--icon', `url('/hub/assets/ui/${icon.dataset.uiIcon}.svg')`);
}
function setTheme(theme) {
  root.dataset.theme = theme === 'light' ? 'light' : 'dark';
  const light = root.dataset.theme === 'light';
  const label = 'Switch to ' + (light ? 'dark' : 'light') + ' mode';
  themeButton.setAttribute('aria-label', label);
  themeButton.setAttribute('title', label);
  themeButton.setAttribute('aria-pressed', String(light));
  document.querySelector('meta[name=theme-color]').content = light ? '#dfdfdf' : '#111111';
}
setTheme(root.dataset.theme);
themeButton.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  try { localStorage.setItem('basement-theme', next); } catch {}
});
window.addEventListener('storage', event => {
  if (event.key === 'basement-theme') setTheme(event.newValue);
});
window.addEventListener('pageshow', () => {
  try { setTheme(localStorage.getItem('basement-theme')); } catch {}
});

// One inspector houses each category. A panel keeps its scroll position when
// switching away so a growing set of controls does not require hunting again.
const tabs = [...document.querySelectorAll('[data-inspector-tab]')];
const panels = [...document.querySelectorAll('[data-inspector-panel]')];
const inspector = document.querySelector('.right');
const inspectorScroll = document.querySelector('#inspector-scroll');
const preview = document.querySelector('#brush-preview');
const positions = new Map();
let activePanel = null;
function activateInspector(name, { focus = false } = {}) {
  const tab = tabs.find(item => item.dataset.inspectorTab === name);
  if (!tab) return;
  if (activePanel && inspectorScroll) positions.set(activePanel, inspectorScroll.scrollTop);
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.dataset.inspectorPanel !== name;
  if (preview) preview.hidden = name !== 'brush'||document.querySelector('#canvas-viewport').dataset.mode==='erase';
  if (inspector) inspector.dataset.inspector = name;
  const heading = document.querySelector('#inspector-label');
  if (heading) heading.textContent = { brush: 'Brush', color: 'Color', symmetry: 'Repeat', filters:'Filters', areas: 'Export areas' }[name];
  activePanel = name;
  if (inspectorScroll) inspectorScroll.scrollTop = positions.get(name) || 0;
  if (focus) tab.focus({ preventScroll: true });
}
for (const tab of tabs) {
  tab.addEventListener('click', () => activateInspector(tab.dataset.inspectorTab));
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    activateInspector(tabs[next].dataset.inspectorTab, { focus: true });
  });
}
for (const button of document.querySelectorAll('[data-open-inspector]')) {
  button.addEventListener('click', () => activateInspector(button.dataset.openInspector));
}
activateInspector(tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.inspectorTab || 'brush');

document.querySelector('#show-export-areas').addEventListener('click', () => {
  document.querySelector('#export-menu').hidden = true;
  document.querySelector('#export').setAttribute('aria-expanded', 'false');
  activateInspector('areas');
  document.querySelector('#draw-frame').focus({ preventScroll: true });
});
document.querySelector('#draw-frame').addEventListener('click', () => activateInspector('areas'));
document.querySelector('#repeat-region-draw').addEventListener('click',()=>activateInspector('symmetry'));
function syncFrameTriggers() {
  const command = document.querySelector('#draw-frame');
  for (const button of document.querySelectorAll('[data-trigger-frame]')) {
    button.disabled = command.disabled;
    button.setAttribute('aria-pressed', command.getAttribute('aria-pressed') || 'false');
  }
}
for (const button of document.querySelectorAll('[data-trigger-frame]')) {
  button.addEventListener('click', () => {
    const command = document.querySelector('#draw-frame');
    if (!command.disabled) command.click();
  });
}
new MutationObserver(syncFrameTriggers).observe(document.querySelector('#draw-frame'), {
  attributes: true, attributeFilter: ['disabled', 'aria-pressed']
});
syncFrameTriggers();

const art = document.querySelector('#artboard');
const viewport = document.querySelector('#canvas-viewport');
for (const command of document.querySelectorAll('.cursor-modes button, #draw-frame')) {
  command.addEventListener('click', () => {if(command.dataset.mode==='erase')activateInspector('brush');art.focus({ preventScroll: true });});
}
art.addEventListener('pointerdown', event => {
  if (!window.basementSessionBlocked && !document.querySelector('dialog[open]') && event.button === 0) {
    art.focus({ preventScroll: true });
  }
}, true);
function updateToolContext() {
  const mode = viewport.dataset.mode || 'draw';
  let [label, hint] = {
    draw: ['Draw', 'Drag to draw a stroke'],
    select: ['Select / move', 'Click or drag a stroke · Shift adds · Drag empty space to select'],
    marquee: ['Marquee', 'Drag to select strokes · Shift adds to selection'],
    erase: ['Eraser', 'Drag to erase on the active layer · Undo restores the original'],
    'repeat-region': ['Repeat area', 'Drag a new area · Drag inside to move · Corners resize'],
    pan: ['Hand', 'Drag to move the canvas'],
    frame: ['Export area', 'Drag to define a PNG export area']
  }[mode] || ['Draw', 'Drag to draw a stroke'];
  if(mode==='draw'&&viewport.dataset.repetition&&viewport.dataset.repetition!=='none'){label='Draw · '+viewport.dataset.repetition[0].toUpperCase()+viewport.dataset.repetition.slice(1);hint='Draw inside the repeat area · R moves or resizes it';}
  const toolLabel = document.querySelector('#active-tool-label');
  const toolHint = document.querySelector('#active-tool-hint');
  if (toolLabel) toolLabel.textContent = label;
  if (toolHint) toolHint.textContent = hint;
}
new MutationObserver(updateToolContext).observe(viewport, { attributes: true, attributeFilter: ['data-mode','data-repetition'] });
updateToolContext();

function updateToolbarColors() {
  for (const swatch of document.querySelectorAll('[data-toolbar-color]')) {
    const input = document.querySelector('#' + swatch.dataset.toolbarColor);
    if (input) swatch.style.backgroundColor = input.value;
  }
}
for (const role of ['contrast', 'shadow', 'primary']) {
  document.querySelector('#' + role).addEventListener('input', updateToolbarColors);
}
document.addEventListener('endo-settings', updateToolbarColors);
document.addEventListener('endo-colors-changed', updateToolbarColors);
updateToolbarColors();

// Reuse the editor's existing commands and busy/disabled safeguards. Shortcuts
// are inactive while naming an Artboard, editing values or using a dialog.
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || window.basementEndoBusy?.() || window.basementSessionBlocked || document.querySelector('dialog[open]') ||
      event.target.closest('input,select,textarea,[contenteditable=true]')) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.altKey) {
    event.preventDefault();
    const command = document.querySelector(event.shiftKey ? '#restore' : '#return');
    if (!command.disabled) command.click();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    const command = document.querySelector('#delete');
    if (!command.disabled) { event.preventDefault(); command.click(); }
  } else if (!event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey &&
      !document.querySelector('[role=menu]:not([hidden])')) {
    const target = {
      b: '.cursor-modes button[data-mode=draw]',
      v: '.cursor-modes button[data-mode=select]',
      e: '.cursor-modes button[data-mode=erase]',
      m: '.cursor-modes button[data-mode=marquee]',
      r: '#repeat-region-draw',
      h: '.cursor-modes button[data-mode=pan]',
      f: '#draw-frame'
    }[event.key.toLowerCase()];
    const command = target && document.querySelector(target);
    if (command && !command.disabled) {
      event.preventDefault();
      command.click();
      art.focus({ preventScroll: true });
    }
  }
});

const colorLink=document.querySelector("#color-link");
try{colorLink.checked=localStorage.getItem("endo-linked-colors")!=="false";}catch{}
colorLink.addEventListener("change",()=>{try{localStorage.setItem("endo-linked-colors",String(colorLink.checked));}catch{}});
