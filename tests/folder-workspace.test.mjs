import assert from 'node:assert/strict';
import {FolderWorkspace} from '../dist/folder-workspace.js';
import {encodeProject,decodeProject,freezeState} from '../dist/project-store.js';
import {initialState as marble} from '../dist/marble/engine.js';
import {initialState as foundry} from '../dist/foundry/model.js';
import {initialState as distortion} from '../dist/distortion/model.js';
import {initialState as kiln} from '../dist/kiln/model.js';
import {initialState as contour} from '../dist/contour/model.js';
const absent=()=>new DOMException('Missing','NotFoundError');
class Directory{
 constructor(name='Projects'){this.kind='directory';this.name=name;this.items=new Map();}
 async getDirectoryHandle(name,{create=false}={}){if(!this.items.has(name)){if(!create)throw absent();this.items.set(name,new Directory(name));}return this.items.get(name);}
 async getFileHandle(name,{create=false}={}){if(!this.items.has(name)){if(!create)throw absent();const file={kind:'file',text:'',fail:false,async getFile(){const s=this.text;return{size:new Blob([s]).size,text:async()=>s};},async createWritable(){let next=this.text;return{write:async value=>{next=value;},close:async()=>{if(file.fail)throw Error('Disk full');file.text=next;},abort:async()=>{}};}};this.items.set(name,file);}return this.items.get(name);}
 async removeEntry(name){this.items.delete(name);}
 async *entries(){yield* this.items.entries();}
}
const encode=encodeProject,decode=decodeProject,root=new Directory(),disk=new FolderWorkspace(root,{encode,decode});
const record={id:'one',name:'Original',studio:'marble',state:marble(),preview:null,createdAt:1,updatedAt:2};
await disk.write(record);assert.equal((await disk.read('one')).name,'Original');
let file=[...root.items.values()].find(f=>f.kind==='file');const original=file.text;
await disk.write({...record,name:'Nuevo',updatedAt:3});assert.equal((await disk.read('one')).name,'Nuevo');
file=[...root.items.values()].find(f=>f.kind==='file');const successful=file.text;file.fail=true;
await assert.rejects(disk.write({...record,name:'Nuevo',updatedAt:4}),/Disk full/);assert.equal(file.text,successful);
file.fail=false;
const other=new FolderWorkspace(root,{encode,decode});await other.read('one');
await disk.write({...record,name:'Cambio externo',updatedAt:5});
await other.list(); // A background scan must never accept an external edit for an open document.
await assert.rejects(other.write(record),/changed outside/);
assert.equal(await other.changed('one'),true);
await other.write(record,{overwriteExternal:true});assert.equal((await other.read('one')).name,'Original');
const beforeRename=[...root.items.keys()][0],renamedFile=root.items.get(beforeRename);root.items.delete(beforeRename);root.items.set('Renamed outside--one.ment',renamedFile);assert.equal((await other.list()).projects[0].name,'Renamed outside');assert.equal(await other.changed('one'),true);await other.read('one');
const currentName=[...root.items.keys()][0];await root.removeEntry(currentName);await assert.rejects(other.write(record),/disappeared/);
await root.getDirectoryHandle('Documents',{create:true});
await disk.write({...record,id:'two'});assert.deepEqual((await disk.list()).projects.map(p=>p.id),['two']);
assert.equal([...root.items.values()].filter(f=>f.kind==='file').length,1);
await disk.trash('two');assert.equal(await disk.read('two'),undefined);assert.deepEqual((await disk.list()).projects,[]);
const trash=await disk.listTrash();assert.equal(trash.length,1);assert.equal(trash[0].expired,false);assert.equal(trash[0].expiresAt-trash[0].deletedAt,30*86400000);
await disk.restore('two','Restored');assert.equal((await disk.read('two')).name,'Restored');assert.deepEqual(await disk.listTrash(),[]);
const destination=new Directory('Other'),target=new FolderWorkspace(destination,{encode,decode});
await disk.copyTo(target,['two']);assert.equal((await target.read('two')).name,'Restored');assert.ok(await disk.read('two'));
await assert.rejects(disk.copyTo(target,['two'],{move:true}),/already contains/);assert.ok(await disk.read('two'));
const finalRoot=new Directory('Final'),finalDisk=new FolderWorkspace(finalRoot,{encode,decode});
await disk.copyTo(finalDisk,['two'],{move:true});assert.equal(await disk.read('two'),undefined);assert.equal((await finalDisk.read('two')).name,'Restored');
await finalDisk.trash('two');await finalDisk.deleteForever('two');assert.deepEqual(await finalDisk.listTrash(),[]);
await assert.rejects(disk.write({...record,id:'../escape'}),/Invalid Artboard identifier/);
console.log('PASS atomic disk writes, external conflict detection, portable single files, verified copy/move, trash restore/delete and safe paths');
const image={id:'image',name:'image.png',width:7,height:7,data:'data:image/png;base64,AAAA'};
const k=kiln();k.source=image;const c=contour();c.source=image;
const drawing={scene:{merge:2,light:225,relief:.8,smooth:45,shine:75,grain:12},defaults:{width:28,variation:30,speed:35,primary:'#8795a8',shadow:'#10141b',contrast:'#eff5ff'},tool:{mode:'none'},nextNumber:2,strokes:[]};
drawing.strokes=[{number:1,settings:{...drawing.defaults},tool:{mode:'none'},points:[{x:30,y:40,time:0,pressure:.5,finish:false}]}];
for(const [studio,state]of [['endo',drawing],['tremor',{...drawing,scene:{...drawing.scene,frameTime:1000},strokes:[{...drawing.strokes[0],createdAt:800}]}],['kiln',k],['contour',c],['foundry',foundry()],['distortion',distortion()],['marble',marble()]]){
 const p={...record,id:studio,studio,state:freezeState(studio,state)};
 const raw=await encode(p),loaded=decode(raw);assert.equal(loaded.id,p.id);assert.equal(loaded.createdAt,1);assert.equal(loaded.updatedAt,2);assert.equal(loaded.studio,studio);
 if(studio==='tremor')assert.ok(Math.abs(loaded.state.strokes[0].age-200)<.01);
 else if(['endo'].includes(studio))assert.deepEqual(loaded.state.strokes,p.state.strokes);
 else if(['kiln','contour'].includes(studio))assert.deepEqual(loaded.state.source,p.state.source);
 else assert.deepEqual(loaded.state,p.state);
 console.log('PASS editable .ment disk roundtrip:',studio);
}
const dated=JSON.parse(await encode({...record,lastOpenedAt:3}));dated.library={createdAt:1e100,updatedAt:-1e100,lastOpenedAt:Infinity,deletedAt:1e100};
const safeDates=decode(JSON.stringify(dated));assert.ok(Number.isFinite(Date.parse(new Date(safeDates.updatedAt).toISOString())));assert.equal(safeDates.deletedAt,undefined);
await assert.rejects(encode({...record,updatedAt:1e100}),/Invalid Artboard date/);
dated.artboard.name='';assert.throws(()=>decode(JSON.stringify(dated)),/Invalid Artboard name/);
console.log('PASS invalid document names and out-of-range dates are rejected or normalized before disk writes');
