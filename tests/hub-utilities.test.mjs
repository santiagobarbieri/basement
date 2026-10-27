import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {zipFiles,readArchive} from '../dist/hub/archive.js';
import {studios,createInitial} from '../dist/hub/studios.js';
import {encodeProject,importMent} from '../dist/project-store.js';

const files=[{name:'Folder/Árbol.ment',data:'{"artboard":"Árbol"}'},{name:'Second.ment',data:'two'}];
const archive=zipFiles(files);
assert.deepEqual(await readArchive(archive),files.map(({name,data})=>({name,text:data})));
await assert.rejects(readArchive(new Blob(['not a ZIP'])),/valid ZIP/);
await assert.rejects(readArchive(zipFiles([{name:'preview.png',data:'ignored'}])),/does not contain/);
assert.throws(()=>zipFiles([{name:'../escape.ment',data:'bad'}]),/unsafe/);
assert.throws(()=>zipFiles([{name:'/absolute.ment',data:'bad'}]),/unsafe/);

// A real raw-DEFLATE stream verifies interoperability with external ZIP tools.
const text='A portable .ment with embedded assets. '.repeat(4000);
const original=new Uint8Array(await zipFiles([{name:'folder/compressed.ment',data:text}]).arrayBuffer());
const view=new DataView(original.buffer),nameLength=view.getUint16(26,true),oldSize=view.getUint32(18,true),local=original.slice(0,30+nameLength),compressed=deflateRawSync(new TextEncoder().encode(text));
const centralOffset=30+nameLength+oldSize,central=original.slice(centralOffset,original.length-22),end=original.slice(-22);
new DataView(local.buffer).setUint16(8,8,true);new DataView(local.buffer).setUint32(18,compressed.length,true);
new DataView(central.buffer).setUint16(10,8,true);new DataView(central.buffer).setUint32(20,compressed.length,true);
new DataView(end.buffer).setUint32(16,local.length+compressed.length,true);
assert.equal((await readArchive(new Blob([local,compressed,central,end])))[0].text,text);

// Modified payload bytes must never be accepted as an intact Artboard.
const damaged=new Uint8Array(await archive.arrayBuffer());
const damageView=new DataView(damaged.buffer);damaged[30+damageView.getUint16(26,true)]^=1;
await assert.rejects(readArchive(new Blob([damaged])),/damaged Artboard/);

// Declared uncompressed sizes are checked before decompression and while streaming.
const bombDirectory=central.slice();new DataView(bombDirectory.buffer).setUint32(24,129*1024*1024,true);
await assert.rejects(readArchive(new Blob([local,compressed,bombDirectory,end])),/import limit/);
const undersizedDirectory=central.slice();new DataView(undersizedDirectory.buffer).setUint32(24,10,true);
await assert.rejects(readArchive(new Blob([local,compressed,undersizedDirectory,end])),/larger than/);
const truncated=new Uint8Array(await archive.arrayBuffer()).slice(0,-4);
await assert.rejects(readArchive(new Blob([truncated])),/valid ZIP/);

// Every available Studio can be created and re-opened through its real format.
const source={id:'image',name:'Initial image',width:2,height:2,data:'data:image/png;base64,AA=='};
for(const studio of studios){
 const state=await createInitial(studio.id,studio.requiredImage?source:null);
 const encoded=await encodeProject({id:'initial-'+studio.id,name:studio.name,studio:studio.id,state,createdAt:1,updatedAt:2});
 const loaded=importMent(encoded);assert.equal(loaded.studio,studio.id);
 if(studio.requiredImage){assert.equal(loaded.state.source.data,source.data);await assert.rejects(createInitial(studio.id),/initial image/);}
}
console.log('PASS ZIP interoperability, Unicode, nested files, CRC, truncation and decompression limits; all Studio creation formats');
