// Installed before the generated WASM loader, only in the architecture prototype.
window.__basementFrameProbe = { logs: [], errors: [] };
for (const level of ['info', 'warn', 'error', 'log']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    window.__basementFrameProbe.logs.push({ level, text: args.map(String).join(' ') });
    original(...args);
  };
}
addEventListener('error', event => window.__basementFrameProbe.errors.push(String(event.message)));
addEventListener('unhandledrejection', event => window.__basementFrameProbe.errors.push(String(event.reason)));
