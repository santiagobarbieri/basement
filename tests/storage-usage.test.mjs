import assert from 'node:assert/strict';
import {scanStorageUsage} from '../dist/storage-usage.js';
import {encodeProject,decodeProject} from '../dist/project-store.js';
import {initialState as marble} from '../dist/marble/engine.js';
import {initialState as foundry} from '../dist/foundry/model.js';
const missing=()=>new DOMException('Missing','NotFoundError');
class Directory{
 constructor(){this.kind='directory';this.items=new Map();}
 async *entries(){yield* this.items;}
 async getDirectoryHandle(name,options){assert.equal(options,undefined,'usage scans must never create a directory');const value=this.items.get(name);if(!value)throw missing();return value;}
 file(name,text){const blob=new Blob([text]);this.items.set(name,{kind:'file',getFile:async()=>blob});return blob.size;}
}
const root=new Directory(),trash=new Directory();root.items.set('.basement-trash',trash);
const record=(id,name,studio,state)=>({id,name,studio,state,createdAt:1,updatedAt:2});
const marbleText=await encodeProject(record('marble','Mármol — 一','marble',marble()));
const foundryText=await encodeProject(record('foundry','Font','foundry',foundry()));
const marbleBytes=root.file('Mármol--marble.ment',marbleText);
const foundryBytes=root.file('Font--foundry.MENT',foundryText);
const corruptBytes=root.file('broken.ment','{broken');
const unsupportedBytes=root.file('unknown.ment',JSON.stringify({format:'basement.ment',version:1,artboard:{id:'future',name:'Future',studio:'future',layers:[]}}));
const duplicateBytes=root.file('duplicate.ment',marbleText);
const trashBytes=trash.file('deleted.ment','The trash bytes are counted without decoding.');
root.file('image.png','not an Artboard');trash.file('.DS_Store','not an Artboard');
root.items.set('nested-artboards',new Directory());
root.items.set('gone.ment',{kind:'file',getFile:async()=>{throw missing();}});
const usage=await scanStorageUsage(root,{decode:decodeProject});
assert.equal(usage.libraryBytes,marbleBytes+foundryBytes+corruptBytes+unsupportedBytes+duplicateBytes);
assert.equal(usage.trashBytes,trashBytes);
assert.equal(usage.totalBytes,usage.libraryBytes+trashBytes);
assert.equal(usage.otherBytes,corruptBytes+unsupportedBytes+duplicateBytes);
assert.equal(usage.count,2);assert.equal(usage.trashCount,1);assert.equal(usage.unreadableCount,3);
assert.deepEqual(usage.studios.find(s=>s.id==='marble'),{id:'marble',bytes:marbleBytes,count:1});
assert.deepEqual(usage.studios.find(s=>s.id==='foundry'),{id:'foundry',bytes:foundryBytes,count:1});
assert.equal(usage.studios.reduce((sum,s)=>sum+s.bytes,0)+usage.otherBytes+usage.trashBytes,usage.totalBytes);
assert.ok(marbleBytes>marbleText.length,'Unicode totals must use actual UTF-8 file bytes, not string length');

const empty=new Directory(),emptyUsage=await scanStorageUsage(empty,{decode:decodeProject});
assert.equal(emptyUsage.totalBytes,0);assert.equal(emptyUsage.count,0);assert.equal(empty.items.size,0);
const denied=new Directory();denied.items.set('denied.ment',{kind:'file',getFile:async()=>{throw new DOMException('Denied','NotAllowedError');}});
await assert.rejects(scanStorageUsage(denied,{decode:decodeProject}),{name:'NotAllowedError'});
const trashDenied=new Directory();trashDenied.getDirectoryHandle=async()=>{throw new DOMException('Denied','NotAllowedError');};
await assert.rejects(scanStorageUsage(trashDenied,{decode:decodeProject}),{name:'NotAllowedError'});
const oversized=new Directory(),size=128*1024*1024+1;
oversized.items.set('large.ment',{kind:'file',getFile:async()=>({size,text:async()=>{throw Error('Large contents must not be loaded');}})});
const largeUsage=await scanStorageUsage(oversized,{decode:()=>{throw Error('Large contents must not be decoded');}});
assert.equal(largeUsage.totalBytes,size);assert.equal(largeUsage.otherBytes,size);assert.equal(largeUsage.unreadableCount,1);
console.log('PASS actual per-Studio/trash byte totals, Unicode, unreadable/duplicate files, empty libraries and permission failures');
