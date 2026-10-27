// Standard ZIP containers, with no remote dependencies. Export uses STORE so a
// downloaded library can also be opened by the operating system's archive tool.
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const MAX_FILE=128*1024*1024,MAX_TOTAL=512*1024*1024,MAX_ENTRIES=2000;
const crcTable=Uint32Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
function header(length){const bytes=new Uint8Array(length);return {bytes,view:new DataView(bytes.buffer)};}
function safeName(name){
  if(typeof name!=='string'||!name||name.includes('\0')||name.startsWith('/')||name.startsWith('\\')||/^[a-z]:/i.test(name)||name.replaceAll('\\','/').split('/').some(part=>part==='..'))throw Error('The ZIP contains an unsafe filename.');
  return name.replaceAll('\\','/');
}
export function zipFiles(files){
  if(!Array.isArray(files)||files.length>MAX_ENTRIES)throw Error('Export up to 2,000 Artboards at a time.');
  const local=[],central=[];let offset=0,total=0;
  for(const file of files){
    const name=encoder.encode(safeName(file.name)),data=typeof file.data==='string'?encoder.encode(file.data):file.data;
    if(!(data instanceof Uint8Array)||name.length>65535)throw Error('An export file is not valid.');
    total+=data.length;if(data.length>MAX_FILE||total>MAX_TOTAL)throw Error('This export exceeds the 512 MB library limit.');
    const crc=crc32(data),record=header(30),directory=header(46);
    record.view.setUint32(0,0x04034b50,true);record.view.setUint16(4,20,true);record.view.setUint16(6,0x800,true);
    record.view.setUint16(12,33,true); // 1980-01-01: deterministic archive metadata.
    record.view.setUint32(14,crc,true);record.view.setUint32(18,data.length,true);record.view.setUint32(22,data.length,true);record.view.setUint16(26,name.length,true);
    directory.view.setUint32(0,0x02014b50,true);directory.view.setUint16(4,20,true);directory.view.setUint16(6,20,true);directory.view.setUint16(8,0x800,true);directory.view.setUint16(14,33,true);
    directory.view.setUint32(16,crc,true);directory.view.setUint32(20,data.length,true);directory.view.setUint32(24,data.length,true);directory.view.setUint16(28,name.length,true);directory.view.setUint32(42,offset,true);
    local.push(record.bytes,name,data);central.push(directory.bytes,name);offset+=30+name.length+data.length;
  }
  const centralSize=central.reduce((size,part)=>size+part.length,0),end=header(22);
  end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  return new Blob([...local,...central,end.bytes],{type:'application/zip'});
}

async function inflate(data,expected){
  let stream;
  try {stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
  catch {throw Error('This Chrome version cannot open compressed ZIP files. Update Chrome or import the .ment files directly.');}
  const reader=stream.getReader(),chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>expected||size>MAX_FILE){await reader.cancel();throw Error('A file in the ZIP is larger than its declared size.');}chunks.push(value);}
  } catch(error){try{await reader.cancel();}catch{}throw error;}
  if(size!==expected)throw Error('A file in the ZIP is incomplete.');
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}

export async function readArchive(file){
  if(!file||typeof file.arrayBuffer!=='function'||file.size>MAX_TOTAL)throw Error('Choose a ZIP file of up to 512 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const bounded=(start,size,limit=bytes.length)=>{if(!Number.isSafeInteger(start)||!Number.isSafeInteger(size)||start<0||size<0||start+size>limit)throw Error('The ZIP file is incomplete or damaged.');};
  let end=-1;
  // EOCD may be followed by an archive comment, but never by arbitrary data.
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}}
  if(end<0)throw Error('This is not a valid ZIP file.');
  const count=view.getUint16(end+10,true),centralSize=view.getUint32(end+12,true),centralOffset=view.getUint32(end+16,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count===65535||centralOffset===0xffffffff||centralSize===0xffffffff)throw Error('Split and ZIP64 archives are not supported.');
  if(count>MAX_ENTRIES)throw Error('The ZIP contains more than 2,000 files.');
  bounded(centralOffset,centralSize,end);const centralEnd=centralOffset+centralSize;
  const records=[];let cursor=centralOffset,total=0;
  for(let index=0;index<count;index++){
    bounded(cursor,46,centralEnd);if(view.getUint32(cursor,true)!==0x02014b50)throw Error('The ZIP directory is damaged.');
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),crc=view.getUint32(cursor+16,true),compressed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),disk=view.getUint16(cursor+34,true),offset=view.getUint32(cursor+42,true);
    bounded(cursor+46,nameLength+extraLength+commentLength,centralEnd);
    const nameBytes=bytes.slice(cursor+46,cursor+46+nameLength);let name;
    try{name=decoder.decode(nameBytes);}catch{throw Error('The ZIP contains a filename that is not UTF-8.');}
    name=safeName(name);cursor+=46+nameLength+extraLength+commentLength;
    if(!name.toLowerCase().endsWith('.ment'))continue;
    if(flags&1||disk||![0,8].includes(method))throw Error('Encrypted or unsupported ZIP entries cannot be imported.');
    total+=size;if(size>MAX_FILE||total>MAX_TOTAL)throw Error('The uncompressed Artboards exceed the 512 MB import limit.');
    if(size===0xffffffff||compressed===0xffffffff||offset===0xffffffff)throw Error('ZIP64 Artboards are not supported.');
    bounded(offset,30,centralOffset);if(view.getUint32(offset,true)!==0x04034b50||view.getUint16(offset+8,true)!==method||(view.getUint16(offset+6,true)&1))throw Error('The ZIP entry header is damaged.');
    const localName=view.getUint16(offset+26,true),localExtra=view.getUint16(offset+28,true),dataOffset=offset+30+localName+localExtra;
    bounded(offset+30,localName+localExtra,centralOffset);bounded(dataOffset,compressed,centralOffset);
    if(localName!==nameBytes.length||!nameBytes.every((byte,i)=>byte===bytes[offset+30+i]))throw Error('The ZIP filename does not match its directory.');
    if(method===0&&compressed!==size)throw Error('The ZIP entry size is invalid.');
    records.push({name,method,crc,size,dataOffset,compressed});
  }
  if(cursor!==centralEnd)throw Error('The ZIP directory size is invalid.');
  const results=[];
  for(const record of records){
    const packed=bytes.subarray(record.dataOffset,record.dataOffset+record.compressed),data=record.method===0?packed:await inflate(packed,record.size);
    if(crc32(data)!==record.crc)throw Error('The ZIP contains a damaged Artboard: '+record.name);
    let text;try{text=decoder.decode(data);}catch{throw Error('The Artboard is not valid UTF-8: '+record.name);}
    results.push({name:record.name,text});
  }
  if(!results.length)throw Error('The ZIP does not contain any .ment Artboards.');
  return results;
}
