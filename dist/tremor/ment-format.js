export const MENT_VERSION = 1;
export function editableContent(state) {
  return {
    infinite:state.infinite===true,frames:(state.frames||[]).map(f=>({...f})),view:state.view?{...state.view}:undefined,scene: Object.fromEntries(Object.entries(state.scene).filter(([key])=>key!=='frameTime')), defaults: { ...state.defaults }, tool: { ...state.tool }, nextNumber: state.nextNumber,
    strokes: state.strokes.map(stroke => ({
      number: stroke.number, age: Math.max(0,(state.scene.frameTime||0)-(stroke.createdAt||0)), settings: { ...stroke.settings }, tool: { ...stroke.tool },
      points: stroke.points.map(p => ({ x: p.x, y: p.y, time: p.time, pressure: p.pressure, finish: p.finish === true })),
    })),
  };
}
export function documentSignature(state) { const c=editableContent(state);delete c.view; for(const s of c.strokes) delete s.age; return JSON.stringify(c); }
export function serializeMent(state, { id, name = 'TREMOR', preview = null, savedAt = new Date().toISOString() }) {
  const content = editableContent(state);
  return JSON.stringify({
    format: 'basement.ment', version: MENT_VERSION, savedAt,
    artboard: {
      id, name, studio:'tremor',infinite:content.infinite,width: 960, height: 850, background: content.scene.background==='color'?content.scene.backgroundColor:null,
      layers: [{ id: 'cromo-1', type: 'tremor.live', strokes: content.strokes }],
      settings:{infinite:content.infinite,frames:content.frames,view:content.view,scene: content.scene, defaults: content.defaults, tool: content.tool, nextNumber: content.nextNumber },
      preview,
    },
  });
}
