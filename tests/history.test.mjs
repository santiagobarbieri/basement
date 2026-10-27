import assert from 'node:assert/strict';
import {History} from '../dist/history.js';
const h=new History(2),a={v:0},b={v:1},c={v:2};
assert.equal(h.undo(),null);assert.equal(h.commit(a,a),false);h.commit(a,b);h.commit(b,c);
assert.deepEqual(h.undo(),b);assert.deepEqual(h.redo(),c);h.undo();h.commit(b,{v:3});assert.equal(h.redo(),null);
h.commit({v:3},{v:4});assert.equal(h.past.length,2);
console.log('PASS: undo/redo, no-op edits, redo branch invalidation and history limit');
