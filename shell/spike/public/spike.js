const invoke = (command, args = {}) => window.__TAURI__.core.invoke(command, args);
const editor = document.querySelector('#editor');
const status = document.querySelector('#status');
const started = performance.now();
const errors = [];
let pendingFile = null;
let hooked = false;
let logs = [];
let options = {};
let tested = false;
let openRequestedAt;
let saveRequestedAt;
let lastExport = null;

async function benchmark() {
  const samples = [];
  let previous;
  await new Promise(resolve => {
    function frame(now) {
      if (previous) samples.push(now - previous);
      previous = now;
      if (samples.length < 180) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
  const sorted = samples.toSorted((a, b) => a - b);
  await invoke('record_probe', { label: 'cadence', data: { samples: samples.length, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length, p95Ms: sorted[Math.floor(sorted.length * .95)] } });
}

async function automatedTrial() {
  if (tested) return;
  tested = true;
  await openBytes(await invoke('load_fixture'));
  setTimeout(() => {
    const canvas = editor.contentWindow.document.querySelector('canvas');
    saveRequestedAt = performance.now();
    key(canvas, 's', true);
    benchmark().catch(error => errors.push(String(error)));
    setTimeout(async () => {
      try {
        const canvas = editor.contentWindow.document.querySelector('canvas');
        const image = await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer();
        await invoke('save_export', { name: 'wasm-canvas.png', bytes: Array.from(new Uint8Array(image)) });
        await invoke('record_probe', { label: 'after-files', data: { pendingFile: Boolean(pendingFile), exportConfirmed: Boolean(lastExport), errors, logs } });
      } catch (error) { errors.push(String(error)); }
    }, 3000);
  }, 4000);
}

function key(target, key, metaKey = false, shiftKey = false) {
  target.focus();
  const Event = target.ownerDocument.defaultView.KeyboardEvent;
  for (const type of ['keydown', 'keyup']) target.dispatchEvent(new Event(type, { key, code: `Key${key.toUpperCase()}`, metaKey, shiftKey, bubbles: true }));
}

function injectFile(input) {
  if (!pendingFile) return;
  const transfer = new editor.contentWindow.DataTransfer();
  transfer.items.add(new editor.contentWindow.File([new Uint8Array(pendingFile.bytes)], pendingFile.name));
  input.files = transfer.files;
  input.dispatchEvent(new editor.contentWindow.Event('change', { bubbles: true }));
  pendingFile = null;
}

async function openBytes(file) {
  if (!file) return;
  pendingFile = file;
  openRequestedAt = performance.now();
  const win = editor.contentWindow;
  win.document.querySelector('canvas')?.focus();
  key(win.document.querySelector('canvas'), 'o', true);
  status.textContent = `Abriendo ${file.name}…`;
}

function hook() {
  if (hooked) return;
  const win = editor.contentWindow;
  const doc = win.document;
  if (!doc.querySelector('canvas')) return;
  hooked = true;
  if (win.__basementFrameProbe) logs = win.__basementFrameProbe.logs;
  const originalClick = win.HTMLInputElement.prototype.click;
  win.HTMLInputElement.prototype.click = function () {
    if (this.type === 'file' && pendingFile) { setTimeout(() => injectFile(this), 0); return; }
    return originalClick.call(this);
  };
  win.addEventListener('error', event => errors.push(String(event.message)));
  win.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
  for (const level of ['info', 'warn', 'error', 'log']) {
    const original = win.console[level].bind(win.console);
    win.console[level] = (...args) => { logs.push({ level, text: args.map(String).join(' ') }); original(...args); };
  }
  new MutationObserver(() => {
    for (const input of doc.querySelectorAll('input[type=file]')) injectFile(input);
  }).observe(doc, { childList: true, subtree: true });
  // Keep the original encoder; redirect its browser download to the native shell.
  doc.addEventListener('click', async event => {
    const anchor = event.target.closest?.('a[download]');
    if (!anchor) return;
    event.preventDefault();
    try {
      const bytes = Array.from(new Uint8Array(await (await win.fetch(anchor.href)).arrayBuffer()));
      const path = await invoke('save_export', { name: anchor.download, bytes });
      lastExport = path;
      document.querySelector('#files').textContent = `Guardado: ${path}`;
      await invoke('record_probe', { label: 'file-export', data: { name: anchor.download, bytes: bytes.length, path, openToExportMs: performance.now() - openRequestedAt, saveLatencyMs: performance.now() - saveRequestedAt } });
    } catch (error) { errors.push(String(error)); }
  }, true);
}

async function probe() {
  try {
    hook();
    const win = editor.contentWindow;
    const loading = win.document.querySelector('#photocraft_loading');
    const ready = hooked && !loading;
    const glCanvas = win.document.createElement('canvas');
    const data = { elapsedMs: Math.round(performance.now() - started), ready, secureContext: win.isSecureContext, webgpu: Boolean(win.navigator.gpu), webgl2: Boolean(glCanvas.getContext('webgl2')), userAgent: win.navigator.userAgent, loading: loading?.textContent || null, canvas: win.document.querySelector('canvas')?.getBoundingClientRect().toJSON(), logs, errors: [...errors, ...(win.__basementFrameProbe?.errors || [])] };
    await invoke('record_probe', { label: 'runtime', data });
    if (ready) { status.textContent = `Motor listo · ${(data.elapsedMs / 1000).toFixed(1)} s`; if (options.auto) automatedTrial().catch(error => errors.push(String(error))); return; }
    if (data.elapsedMs > 90000 || loading?.textContent.includes('failed to start')) {
      status.textContent = 'El motor no pudo iniciar';
      const failure = document.querySelector('#failure');
      failure.className = 'visible'; failure.textContent = loading?.textContent || errors.join(' · ') || 'No hubo confirmación de inicio.';
      return;
    }
  } catch (error) { errors.push(String(error)); }
  setTimeout(probe, 1000);
}

editor.addEventListener('load', () => { hooked = false; hook(); probe(); });
document.querySelector('#fixture').onclick = async () => openBytes(await invoke('load_fixture'));
document.querySelector('#open').onclick = async () => openBytes(await invoke('pick_document'));
document.querySelector('#backend').onchange = event => { editor.src = `prism/index.html${event.target.value}`; };
setTimeout(probe, 1000);
invoke('probe_options').then(async data => {
  options = data;
  if (data.backend) editor.src = `prism/index.html?${data.backend}`;
  const platform = { secureContext: isSecureContext, webgpu: Boolean(navigator.gpu), userAgent: navigator.userAgent, url: location.href };
  try { platform.adapter = navigator.gpu ? Boolean(await navigator.gpu.requestAdapter()) : false; } catch (error) { platform.adapterError = String(error); }
  await invoke('record_probe', { label: 'platform', data: platform });
}).catch(error => errors.push(String(error)));
