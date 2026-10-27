import { dimensions } from './geometry.js';
export const CHARACTER_SETS = { ascii: ' .:-=+*#%@', blocks: ' ░▒▓█', punctuation: ' .,:;!?', letters: ' .ilvxyMW' };
export const TILES=['Ivory','Petals','Rosette','Corner','Arabesque','Lattice','Medallion','Cobalt'];
export function initialState() {
  return { source: null, uploads: [], tool:'tiles', output: true, selectedLayer: 'output',
    shared: { size: 24, brightness: 0, contrast: 0, palette:'palette', background: 'transparent' },
    colors: { primary:'#244b73',contrast:'#bf8553',shadow:'#eadfbd' },
    characters: { set: 'ascii', depth: 10, offset: 0, invert: false },
    tiles: { material:'ceramic', enabled: [...TILES], threshold: 50, blur: 0, aspect:'free',joint:0,texture:20,glaze:35,rotate:true,motion:false,amount:100,speed:1,seed:1,version:2 },
    cells: { irregularity: 60, lead: 2, density: 35, dotSize: 4, seed: 1 } };
}
export function capture(state) {
  return { ...state, source: state.source ? { ...state.source } : null, uploads: state.uploads.map(t => ({ ...t })),
    shared: { ...state.shared }, colors: { ...state.colors }, characters: { ...state.characters },
    tiles: { ...state.tiles, enabled: [...state.tiles.enabled] }, cells: { ...state.cells } };
}
export function signature(state) {
  const data = capture(state); delete data.selectedLayer;
  if (data.source) delete data.source.data;
  data.uploads.forEach(t => delete t.data);
  return JSON.stringify(data);
}
export function ment(state, { id, name, preview, savedAt = new Date().toISOString() }) {
  const size = dimensions(state);
  return JSON.stringify({ format: 'basement.ment', version: 1, savedAt, artboard: {
    id, name, studio: 'kiln', ...size, background: state.shared.background === 'color' ? state.colors.shadow : null,
    layers: [{ id: 'source', type: 'image', name: state.source.name, image: state.source },
      ...(state.output ? [{ id: 'units', type: 'kiln.' + state.tool, sourceId: 'source', options: {
        shared: state.shared, characters: state.characters, tiles: state.tiles, cells: state.cells, colors: state.colors, uploads: state.uploads.map(t => t.id),
      } }] : [])], preview,
    assets: { tiles: state.uploads },
    settings: { ...state, selectedLayer: undefined, source: undefined, uploads: undefined },
  } });
}
