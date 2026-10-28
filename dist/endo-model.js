// Endo document metadata is independent from the canvas and the browser.
export const DEFAULT_LAYER_ID = 'layer-1';
export const MAX_LAYERS = 64;
export const MAX_FILTERS = 8;
const filterTypes = new Set(['threshold', 'dither', 'grayscale', 'invert']);
const modes = new Set(['none', 'mandala', 'mirror', 'grid', 'mosaic']);
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const fail = message => { throw Error(message); };
const clone = value => structuredClone(value);
const absent = (value, fallback) => value === undefined ? fallback : value;
const newId = () => crypto.randomUUID();
export function createLayer(name = 'Layer 1', id = newId()) {
  return { id, name, visible: true, locked: false, opacity: 1, filters: [] };
}

export function validateRegion(region) {
  if (region == null) return;
  if (typeof region !== 'object' || !finite(region.x, -1e7, 1e7) || !finite(region.y, -1e7, 1e7) ||
      !finite(region.width, 1, 1e7) || !finite(region.height, 1, 1e7)) fail('The repetition area is invalid.');
}
function validateTool(tool = {}) {
  if (typeof tool !== 'object' || !modes.has(tool.mode ?? 'none')) fail('The repetition mode is invalid.');
  validateRegion(tool.region);
  for (const [key, min, max] of [['count', 2, 16], ['columns', 1, 6], ['rows', 1, 6]]) {
    if (tool[key] !== undefined && (!Number.isInteger(tool[key]) || !finite(tool[key], min, max))) fail('The repetition settings are invalid.');
  }
  if (tool.axes !== undefined && !['vertical', 'horizontal', 'both'].includes(tool.axes)) fail('The mirror axis is invalid.');
}
function layerMetadata(layer, index) {
  return {
    id: absent(layer.id, index === 0 ? DEFAULT_LAYER_ID : undefined),
    name: absent(layer.name, 'Layer ' + (index + 1)),
    visible: absent(layer.visible, true), locked: absent(layer.locked, false), opacity: absent(layer.opacity, 1),
    filters: (layer.filters ?? []).map(filter => ({
      ...filter, enabled: absent(filter.enabled, true), amount: absent(filter.amount, 128), scale: absent(filter.scale, 2),
    })),
  };
}

export function normalizeEndoState(input) {
  if (!input || typeof input !== 'object') fail('Missing Endo Artboard settings.');
  // Default only absent legacy metadata. Supplied values are validated below.
  if (input.layers !== undefined && (!Array.isArray(input.layers) || !input.layers.length || input.layers.length > MAX_LAYERS)) fail('The Artboard layers are invalid.');
  if (input.strokes !== undefined && (!Array.isArray(input.strokes) || input.strokes.length > 10000)) fail('The Artboard contains invalid strokes.');
  const source = clone(input);
  source.layers = (source.layers ?? [createLayer('Layer 1', DEFAULT_LAYER_ID)]).map((layer, i) => {
    if (!layer || typeof layer !== 'object' || (layer.filters !== undefined && (!Array.isArray(layer.filters) || layer.filters.length > MAX_FILTERS))) fail('The Artboard layers are invalid.');
    return layerMetadata(layer, i);
  });
  source.activeLayerId = absent(source.activeLayerId, source.layers.at(-1).id);
  source.tool = source.tool ?? { mode: 'none' };
  source.strokes = (source.strokes ?? []).map((stroke, index) => ({
    ...stroke, number: absent(stroke.number, index + 1), layerId: absent(stroke.layerId, source.layers[0].id), operation: absent(stroke.operation, 'paint'),
    settings: { ...stroke.settings }, tool: clone(stroke.tool ?? { mode: 'none' }),
    points: (stroke.points ?? []).map(point => ({ ...point })),
  }));
  source.frames ??= [];
  source.nextNumber = Math.max(source.nextNumber ?? 1, ...source.strokes.map(stroke => (stroke.number ?? 0) + 1));
  return validateNormalized(source);
}

function validateNormalized(state) {
  if (!Array.isArray(state.layers) || !state.layers.length || state.layers.length > MAX_LAYERS) fail('The Artboard must contain between 1 and 64 layers.');
  const ids = new Set();
  for (const layer of state.layers) {
    if (!identifier(layer.id) || ids.has(layer.id) || typeof layer.name !== 'string' || !layer.name.trim() || layer.name.length > 80 ||
        typeof layer.visible !== 'boolean' || typeof layer.locked !== 'boolean' || !finite(layer.opacity, 0, 1)) fail('The Artboard contains an invalid layer.');
    ids.add(layer.id);
    if (!Array.isArray(layer.filters) || layer.filters.length > MAX_FILTERS) fail('A layer may contain at most 8 filters.');
    const filters = new Set();
    for (const filter of layer.filters) {
      if (!filter || !identifier(filter.id) || filters.has(filter.id) || !filterTypes.has(filter.type) || typeof filter.enabled !== 'boolean' ||
          !finite(filter.amount, 0, 255) || !Number.isInteger(filter.scale) || !finite(filter.scale, 1, 64)) fail('The Artboard contains an invalid filter.');
      filters.add(filter.id);
    }
  }
  if (!ids.has(state.activeLayerId)) fail('The active layer is invalid.');
  if (!Array.isArray(state.strokes) || state.strokes.length > 10000 || !state.scene || !state.defaults) fail('Missing Artboard settings.');
  for (const value of [...Object.values(state.scene), ...Object.values(state.defaults)]) if (typeof value === 'number' && !Number.isFinite(value)) fail('The Artboard settings contain an invalid number.');
  validateTool(state.tool);
  let total = 0;
  const strokeNumbers = new Set();
  for (const stroke of state.strokes) {
    if (!Number.isInteger(stroke.number) || stroke.number < 1 || strokeNumbers.has(stroke.number)) fail('The stroke identifiers are invalid.');
    strokeNumbers.add(stroke.number);
    if (!ids.has(stroke.layerId) || !['paint', 'erase'].includes(stroke.operation)) fail('A stroke references an invalid layer or operation.');
    if (!Array.isArray(stroke.points) || !stroke.settings || !finite(stroke.settings.width, Number.MIN_VALUE, 100)) fail('The Artboard contains invalid strokes.');
    validateTool(stroke.tool);
    for (const value of Object.values(stroke.settings)) if (typeof value === 'number' && !Number.isFinite(value)) fail('The Artboard stroke settings contain an invalid number.');
    for (const key of ['primary', 'shadow', 'contrast']) if (!/^#[0-9a-f]{6}$/i.test(stroke.settings[key] || '')) fail('The Artboard contains invalid colors.');
    total += stroke.points.length;
    for (const point of stroke.points) if (![point.x, point.y, point.time, point.pressure].every(Number.isFinite) || Math.abs(point.x) > 1e7 || Math.abs(point.y) > 1e7) fail('The Artboard contains invalid coordinates.');
  }
  if (total > 1000000) fail('The Artboard contains too many points.');
  if (!Number.isInteger(state.nextNumber) || state.nextNumber < 1) fail('The stroke numbering is invalid.');
  if (!Array.isArray(state.frames) || state.frames.length > 50) fail('The Artboard export areas are invalid.');
  const frameIds = new Set();
  for (const frame of state.frames) {
    if (!identifier(frame.id) || frameIds.has(frame.id) || typeof frame.name !== 'string' || frame.name.length > 80 ||
        ![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) || frame.width <= 0 || frame.height <= 0 ||
        [frame.x, frame.y, frame.width, frame.height].some(value => Math.abs(value) > 1e7)) fail('The Artboard contains an invalid export area.');
    frameIds.add(frame.id);
  }
  return state;
}
export function validateEndoState(input) { return normalizeEndoState(input); }

// Mutations return independent snapshots; the UI owns history and disk writes.
export function addLayer(input, { name, id = newId() } = {}) {
  const state = normalizeEndoState(input);
  if (state.layers.length >= MAX_LAYERS) fail('The Artboard already has 64 layers.');
  state.layers.push(createLayer(name ?? ('Layer ' + (state.layers.length + 1)), id));
  state.activeLayerId = id;
  return normalizeEndoState(state);
}
export function removeLayer(input, id) {
  const state = normalizeEndoState(input), index = state.layers.findIndex(layer => layer.id === id);
  if (index < 0) return state;
  state.layers.splice(index, 1); state.strokes = state.strokes.filter(stroke => stroke.layerId !== id);
  if (!state.layers.length) state.layers.push(createLayer('Layer 1'));
  if (state.activeLayerId === id) state.activeLayerId = state.layers[Math.min(index, state.layers.length - 1)].id;
  state.selected = null; state.selection = [];
  return state;
}
export function reorderLayer(input, id, delta) {
  const state = normalizeEndoState(input), index = state.layers.findIndex(layer => layer.id === id);
  if (index < 0) return state;
  const target = Math.max(0, Math.min(state.layers.length - 1, index + Math.trunc(delta)));
  const [layer] = state.layers.splice(index, 1); state.layers.splice(target, 0, layer);
  return state;
}
export function translateStroke(stroke, dx, dy) {
  const translated = clone(stroke);
  translated.points = translated.points.map(point => ({ ...point, x: point.x + dx, y: point.y + dy }));
  if (translated.tool?.mode && translated.tool.mode !== 'none') {
    const region = translated.tool.region ?? { x: 0, y: 0, width: 960, height: 850 };
    translated.tool.region = { ...region, x: region.x + dx, y: region.y + dy };
  }
  return translated;
}
export function duplicateLayer(input, id, { newLayerId = newId() } = {}) {
  const state = normalizeEndoState(input), index = state.layers.findIndex(layer => layer.id === id);
  if (index < 0) return state;
  if (state.layers.length >= MAX_LAYERS) fail('The Artboard already has 64 layers.');
  const layer = clone(state.layers[index]); layer.id = newLayerId; layer.name = (layer.name + ' Copy').slice(0, 80);
  layer.filters = layer.filters.map(filter => ({ ...filter, id: newId() }));
  state.layers.splice(index + 1, 0, layer);
  for (const stroke of state.strokes.filter(stroke => stroke.layerId === id)) state.strokes.push({ ...clone(stroke), layerId: layer.id, number: state.nextNumber++ });
  state.activeLayerId = layer.id; state.selected = null; state.selection = [];
  return state;
}
export function duplicateSelectedStrokes(input, indices, { dx = 20, dy = 20, targetLayerId } = {}) {
  const state = normalizeEndoState(input), chosen = new Set(indices), added = [];
  if (targetLayerId && !state.layers.some(layer => layer.id === targetLayerId)) fail('The destination layer is invalid.');
  for (const [index, stroke] of state.strokes.entries()) if (chosen.has(index)) {
    const copy = translateStroke(stroke, dx, dy); copy.number = state.nextNumber++;
    if (targetLayerId) copy.layerId = targetLayerId;
    added.push(copy);
  }
  state.selection = added.map((_, index) => state.strokes.length + index);
  state.strokes.push(...added); state.selected = state.selection.at(-1) ?? null;
  return state;
}
export function moveSelectionToLayer(input, indices, targetLayerId) {
  const state = normalizeEndoState(input);
  if (!state.layers.some(layer => layer.id === targetLayerId)) fail('The destination layer is invalid.');
  for (const index of new Set(indices)) if (state.strokes[index]) state.strokes[index].layerId = targetLayerId;
  state.activeLayerId = targetLayerId;
  return state;
}
