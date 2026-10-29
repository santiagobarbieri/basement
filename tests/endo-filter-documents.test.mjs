import assert from 'node:assert/strict';
import {normalizeEndoState,addAdjustmentLayer,validateEndoState} from '../dist/endo-model.js';
import {FILTER_DEFINITIONS} from '../dist/endo-filter-catalog.js';
import {serializeMent} from '../dist/ment-format.js';
import {importMent} from '../dist/project-store.js';
const seed=normalizeEndoState({scene:{merge:2,light:225,relief:.8,smooth:45,shine:75,grain:12},defaults:{width:28,primary:'#8795a8',contrast:'#eff5ff',shadow:'#10141b'},tool:{mode:'none'},strokes:[]});
for(const definition of FILTER_DEFINITIONS){
 const state=addAdjustmentLayer(seed,definition.type),filter=state.layers.at(-1).filter;
 assert.equal(filter.amount,definition.defaultAmount);assert.equal(filter.scale,definition.defaultScale);
 const saved=serializeMent(state,{id:'catalog-test',name:'Paint effects'}),loaded=await importMent(saved);
 assert.deepEqual(loaded.state.layers.at(-1).filter,filter,definition.label+' roundtrips through .ment v2');
 const malformed=structuredClone(state);malformed.layers.at(-1).filter.amount=definition.amountMax+1;assert.throws(()=>validateEndoState(malformed),/filter/);
}
assert.equal(seed.layers.length,1);assert.equal(seed.strokes.length,0);
console.log('PASS all 14 adjustment defaults, portable .ment v2 roundtrips, bounds and unchanged source');
