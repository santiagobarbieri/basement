// A portable .ment per Artboard. The browser cache is the recovery copy.
export const safeProjectId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const missing=error=>error?.name==='NotFoundError';
const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const filename=project=>`${project.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\.+|[. ]+$/g,'').slice(0,80)||'Artboard'}--${project.id}.ment`;
function displayedProject(project,name){if(name===filename(project))return project;const suffix='--'+project.id+'.ment';return {...project,name:name.endsWith(suffix)?name.slice(0,-suffix.length):name.replace(/\.ment$/i,'')};}
async function readText(dir,name){const file=await(await dir.getFileHandle(name)).getFile();if(file.size>128*1024*1024)throw Error('The Artboard exceeds 128 MB.');return file.text();}
export async function writeText(dir,name,text){
 let handle,created=false,writer;
 try{handle=await dir.getFileHandle(name);}catch(error){if(!missing(error))throw error;handle=await dir.getFileHandle(name,{create:true});created=true;}
 try{writer=await handle.createWritable();await writer.write(text);await writer.close();}
 catch(error){try{await writer?.abort();}catch{}if(created){try{if((await handle.getFile()).size===0)await dir.removeEntry(name);}catch{}}throw error;}
}
export class FolderWorkspace{
 constructor(handle,{encode,decode}){this.handle=handle;this.encode=encode;this.decode=decode;this.known=new Map();this.paths=new Map();}
 async locate(id){
  if(!safeProjectId(id))throw Error('Invalid Artboard identifier.');
  let found;
  for await(const [name,file]of this.handle.entries()){
   if(file.kind!=='file'||!name.toLowerCase().endsWith('.ment'))continue;
   let raw,project;try{raw=await readText(this.handle,name);project=this.decode(raw);}catch{continue;}
   if(project.id===id){if(found)throw Error('Duplicate Artboard identifier. Resolve the duplicate files before saving.');found={name,raw,project:displayedProject(project,name)};}
  }
  if(found)this.paths.set(id,found.name);return found;
 }
 async read(id,{acceptExternal=true}={}){
  const entry=await this.locate(id);if(!entry)return undefined;
  if(acceptExternal||!this.known.has(id))this.known.set(id,await digest(entry.name+'\n'+entry.raw));
  return entry.project;
 }
 async list(){
  const projects=[],failures=[],ids=new Set();
  for await(const [name,file]of this.handle.entries()){
   if(file.kind!=='file'||!name.toLowerCase().endsWith('.ment'))continue;
   try{const raw=await readText(this.handle,name),project=this.decode(raw);if(ids.has(project.id))throw Error('Duplicate Artboard identifier.');ids.add(project.id);this.paths.set(project.id,name);if(!this.known.has(project.id))this.known.set(project.id,await digest(name+'\n'+raw));projects.push(displayedProject(project,name));}
   catch(error){failures.push({id:name,message:error.message});}
  }
  return {projects,failures};
 }
 async changed(id){const entry=await this.locate(id);return !entry||this.known.has(id)&&this.known.get(id)!==await digest(entry.name+'\n'+entry.raw);}
 async write(project,{overwriteExternal=false}={}){
  if(!safeProjectId(project.id))throw Error('Invalid Artboard identifier.');
  const raw=await this.encode(project),verified=this.decode(raw);
  if(verified.id!==project.id)throw Error('Invalid Artboard.');
  if(new Blob([raw]).size>128*1024*1024)throw Error('The Artboard exceeds 128 MB.');
  const old=await this.locate(project.id);
  if(!old&&this.known.has(project.id))throw Error('The Artboard disappeared from the folder. Reconnect it before saving.');
  if(old&&!overwriteExternal&&(!this.known.has(project.id)||this.known.get(project.id)!==await digest(old.name+'\n'+old.raw))){const error=Error('This Artboard changed outside Basement. Choose which version to keep.');error.code='EXTERNAL_CHANGE';throw error;}
  const name=filename(project);
  // Never replace a different Artboard that happens to have this filename.
  if(!old||name!==old.name){try{const existing=this.decode(await readText(this.handle,name));if(existing.id!==project.id)throw Error('An unrelated file already uses this name.');}catch(error){if(!missing(error))throw error;}}
  await writeText(this.handle,name,raw);
  if(await readText(this.handle,name)!==raw)throw Error('The disk copy could not be verified.');
  if(old&&old.name!==name)await this.handle.removeEntry(old.name);
  this.known.set(project.id,await digest(name+'\n'+raw));this.paths.set(project.id,name);
 }
 async remove(id){const entry=await this.locate(id);if(!entry)throw Error('Artboard unavailable.');await this.handle.removeEntry(entry.name);this.known.delete(id);this.paths.delete(id);}
 async trash(id){
  const entry=await this.locate(id);if(!entry)throw Error('Artboard unavailable.');
  const previousTrash=await this.listTrash();if(previousTrash.some(p=>p.id===id||p.trashFilename===filename(entry.project)))throw Error('An older copy of this Artboard is already in Trash. Restore or permanently delete it first.');
  const dir=await this.handle.getDirectoryHandle('.basement-trash',{create:true}),deletedAt=Date.now();
  const raw=await this.encode({...entry.project,deletedAt});await writeText(dir,filename(entry.project),raw);
  if(await readText(dir,filename(entry.project))!==raw)throw Error('The trash copy could not be verified.');
  await this.remove(id);
 }
 async listTrash(){
  let dir;try{dir=await this.handle.getDirectoryHandle('.basement-trash');}catch(error){if(missing(error))return [];throw error;}
  const rows=[];
  for await(const [name,file]of dir.entries())if(file.kind==='file'&&name.toLowerCase().endsWith('.ment')){
   try{const p=this.decode(await readText(dir,name));const expiresAt=p.deletedAt+30*86400000;rows.push({...p,expiresAt,expired:Date.now()>=expiresAt,trashFilename:name});}catch(error){rows.push({id:name,name,invalid:true,error:error.message,trashFilename:name});}
  }
  return rows;
 }
 async restore(id,name){
  const rows=await this.listTrash(),p=rows.find(p=>p.id===id);if(!p||p.invalid)throw Error('Artboard unavailable.');
  if(await this.locate(id))throw Error('An Artboard with this identifier already exists.');
  const dir=await this.handle.getDirectoryHandle('.basement-trash'),restore={...p,name:name||p.name};delete restore.deletedAt;delete restore.expiresAt;delete restore.expired;delete restore.trashFilename;
  this.known.delete(id);await this.write(restore);await dir.removeEntry(p.trashFilename);return restore;
 }
 async deleteForever(id){const p=(await this.listTrash()).find(p=>p.id===id);if(!p)throw Error('Artboard unavailable.');await(await this.handle.getDirectoryHandle('.basement-trash')).removeEntry(p.trashFilename);}
 async copyTo(target,ids,{move=false}={}){
  const rows=await this.list();if(rows.failures.length)throw Error('Some Artboards could not be read. Resolve them before moving the library.');
  const chosen=ids?rows.projects.filter(p=>ids.includes(p.id)):rows.projects;
  if(ids&&chosen.length!==ids.length)throw Error('Some selected Artboards are unavailable.');
  const other=await target.list();if(other.failures.length)throw Error('The destination contains unreadable Artboards.');
  for(const p of chosen){if(other.projects.some(q=>q.id===p.id||q.name.trim().toLocaleLowerCase()===p.name.trim().toLocaleLowerCase()))throw Error('The destination already contains '+p.name+'.');}
  const trash=ids?[]:await this.listTrash();
  if(trash.some(p=>p.invalid))throw Error('Some trashed Artboards could not be read.');
  const targetTrash=await target.listTrash();
  if(targetTrash.some(p=>p.invalid))throw Error('The destination trash contains unreadable Artboards.');
  if(chosen.some(p=>targetTrash.some(q=>q.id===p.id))||trash.some(p=>other.projects.some(q=>q.id===p.id)||targetTrash.some(q=>q.id===p.id||q.trashFilename===p.trashFilename)))throw Error('The destination already contains one of these Artboards or trash files.');
  // Verify every copy before deleting any source.
  for(const p of chosen){await target.write(p);if(await target.encode(await target.read(p.id))!==await this.encode(p))throw Error('The destination copy could not be verified.');}
  if(trash.length){const from=await this.handle.getDirectoryHandle('.basement-trash'),to=await target.handle.getDirectoryHandle('.basement-trash',{create:true});for(const p of trash){const raw=await readText(from,p.trashFilename);await writeText(to,p.trashFilename,raw);if(await readText(to,p.trashFilename)!==raw)throw Error('The destination trash copy could not be verified.');}}
  if(move){for(const p of chosen)await this.remove(p.id);for(const p of trash)await this.deleteForever(p.id);}
  return chosen.length;
 }
}
