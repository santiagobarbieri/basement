export const MENT_VERSION = 1;
export function editableContent(state) {
  return {
    frames:(state.frames||[]).map(f=>({...f})), view: state.view ? {...state.view} : undefined, infinite: state.infinite === true, scene: { ...state.scene }, defaults: { ...state.defaults }, tool: { ...state.tool }, nextNumber: state.nextNumber,
    strokes: state.strokes.map(stroke => ({
      number: stroke.number, settings: { ...stroke.settings }, tool: { ...stroke.tool },
      points: stroke.points.map(p => ({ x: p.x, y: p.y, time: p.time, pressure: p.pressure, finish: p.finish === true })),
    })),
  };
}
export function documentSignature(state) { const content=editableContent(state);delete content.view;return JSON.stringify(content); }
export function serializeMent(state, { id, name = 'ENDO', preview = null, savedAt = new Date().toISOString() }) {
  const content = editableContent(state);
  return JSON.stringify({
    format: 'basement.ment', version: MENT_VERSION, savedAt,
    artboard: {
      id, name, studio: 'endo', infinite:content.infinite, width: 960, height: 850, background: '#d9d9d9',
      layers: [{ id: 'cromo-1', type: content.strokes.some(s => s.settings.brush && s.settings.brush !== 'cromo') ? 'endo.surface' : 'endo.cromo', strokes: content.strokes }],
      settings: {frames:content.frames,view:content.view,infinite:content.infinite, scene: content.scene, defaults: content.defaults, tool: content.tool, nextNumber: content.nextNumber },
      preview,
    },
  });
}
