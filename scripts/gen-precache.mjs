import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('../dist/',import.meta.url));
const hash=data=>createHash('sha256').update(data).digest('hex');
export async function buildPrecache(root=ROOT){
 const names=[];
 async function walk(dir=''){for(const e of await readdir(resolve(root,dir),{withFileTypes:true})){if(e.name.startsWith('.')||['sw.js','precache.json'].includes(e.name)||e.name.endsWith('.md'))continue;const name=dir?dir+'/'+e.name:e.name;if(e.isDirectory())await walk(name);else if(e.isFile())names.push(name);}}
 await walk();const files=[];
 for(const name of names.sort()){const bytes=await readFile(resolve(root,name));files.push({url:'/'+name.split('/').map(encodeURIComponent).join('/'),hash:hash(bytes),bytes:bytes.length});}
 const worker=(await readFile(resolve(root,'sw.js'),'utf8')).replace(/const BUILD = '[^']+';/,"const BUILD = '__PRECACHE_REVISION__';");
 return {schema:1,hash:hash(JSON.stringify(files)+worker),bytes:files.reduce((sum,f)=>sum+f.bytes,0),files};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=await buildPrecache();await writeFile(resolve(ROOT,'precache.json'),JSON.stringify(manifest,null,2)+'\n');
 const worker=(await readFile(resolve(ROOT,'sw.js'),'utf8')).replace(/const BUILD = '[^']+';/,`const BUILD = '${manifest.hash}';`);await writeFile(resolve(ROOT,'sw.js'),worker);
 console.log(`${manifest.files.length} recursos · ${(manifest.bytes/1024/1024).toFixed(1)} MB · ${manifest.hash.slice(0,12)}`);
}
