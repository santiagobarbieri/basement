// Byte accounting for Basement-owned .ment files. This never writes to disk or
// treats the browser's storage allowance as free space in the chosen folder.
const STUDIO_IDS=['kiln','endo','foundry','tremor','contour','marble','distortion'];
const MAX_DOCUMENT_BYTES=128*1024*1024;
const isMent=name=>name.toLowerCase().endsWith('.ment');
const missing=error=>error?.name==='NotFoundError';

export async function scanStorageUsage(handle,{decode}){
 const studios=new Map(STUDIO_IDS.map(id=>[id,{id,bytes:0,count:0}]));
 const result={libraryBytes:0,trashBytes:0,otherBytes:0,totalBytes:0,count:0,trashCount:0,unreadableCount:0,studios:[]};
 const ids=new Set();
 for await(const [name,entry]of handle.entries()){
  if(entry.kind!=='file'||!isMent(name))continue;
  let file;
  try{file=await entry.getFile();}catch(error){if(missing(error))continue;throw error;}
  result.libraryBytes+=file.size;
  try{
   if(file.size>MAX_DOCUMENT_BYTES)throw Error('Artboard exceeds the readable limit.');
   const project=decode(await file.text()),studio=studios.get(project.studio);
   if(!studio||ids.has(project.id))throw Error('Unsupported or duplicate Artboard.');
   ids.add(project.id);studio.bytes+=file.size;studio.count++;result.count++;
  }catch{
   // The bytes still occupy this library even when their contents are invalid.
   result.otherBytes+=file.size;result.unreadableCount++;
  }
 }
 let trash;
 try{trash=await handle.getDirectoryHandle('.basement-trash');}catch(error){if(!missing(error))throw error;}
 if(trash)for await(const [name,entry]of trash.entries()){
  if(entry.kind!=='file'||!isMent(name))continue;
  try{result.trashBytes+=(await entry.getFile()).size;result.trashCount++;}catch(error){if(!missing(error))throw error;}
 }
 result.totalBytes=result.libraryBytes+result.trashBytes;
 result.studios=[...studios.values()];
 return result;
}
