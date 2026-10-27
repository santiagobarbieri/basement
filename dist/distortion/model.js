import {styleDefaults,paletteDefaults,OVERRIDE_KEYS} from './style-model.js';
export const TYPES=['original','contour','ascii','pixel','halftone'];
export const LEGACY_TYPES=['dither','lines','duotone','invert','solid'];
const DOCUMENT_TYPES=[...TYPES,...LEGACY_TYPES];
export const defaults=()=>({size:12,scale:1,contrast:1,threshold:.5,levels:0,foreground:'#171717',background:'#f1f0e6'});
export const initialState=()=>({version:1,style:styleDefaults(),palette:paletteDefaults(),source:null,grid:{columns:8,rows:8,skewX:0,skewY:0,originX:0,originY:0,visible:true},fragments:[],seed:1,randomizer:{amount:100,originalColors:false},weights:{original:40,ascii:25,pixel:20,dither:0,halftone:10,lines:0,duotone:0,invert:0,solid:0,contour:5},jitter:{position:0,rotation:0,scale:0},active:'ascii',brush:defaults()});
export const base=()=>({x:0,y:0,angle:0,sx:1,sy:1,opacity:1});
export const bounds=points=>({x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))});
export const center=f=>{const b=bounds(f.source.polygon);return {x:(b.x+b.right)/2,y:(b.y+b.bottom)/2}};
function clip(poly,axis,value,keep){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],aa=keep*(a[axis]-value)>=-1e-8,bb=keep*(b[axis]-value)>=-1e-8;if(aa)out.push(a);if(aa!==bb){const t=(value-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}}return out;}
export function buildGrid(source,g){if(!source)return [];const w=source.width,h=source.height,kx=g.skewX,ky=g.skewY,det=1-kx*ky,unmap=p=>({x:(p.x-kx*p.y)/det,y:(p.y-ky*p.x)/det}),map=(x,y)=>({x:x+kx*y,y:ky*x+y}),b=bounds([{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}].map(unmap)),cw=(b.right-b.x)/g.columns,ch=(b.bottom-b.y)/g.rows,result=[];
 for(let row=-1;row<=g.rows;row++)for(let col=-1;col<=g.columns;col++){const x=b.x+(col+g.originX)*cw,y=b.y+(row+g.originY)*ch;let poly=[map(x,y),map(x+cw,y),map(x+cw,y+ch),map(x,y+ch)];for(const [axis,value,keep]of [['x',0,1],['x',w,-1],['y',0,1],['y',h,-1]])poly=clip(poly,axis,value,keep);if(poly.length<3)continue;const area=Math.abs(poly.reduce((sum,a,i)=>{const p=poly[(i+1)%poly.length];return sum+a.x*p.y-a.y*p.x},0)/2);if(area<1e-5)continue;result.push({id:`${source.id}:${row}:${col}`,source:{imageId:source.id,row,col,polygon:poly},transform:base(),jitter:{x:0,y:0,angle:0,scale:1},type:'original',params:defaults(),deleted:false,z:result.length});}return result;}
export function regrid(s,g){const old=new Map(s.fragments.map(f=>[f.id,f]));const same=s.grid.rows===g.rows&&s.grid.columns===g.columns;if(!same)delete s.splits;s.fragments=adaptiveGrid(s.source,g,s.splits).map(f=>{const prev=same&&old.get(f.id);return prev?{...structuredClone(prev),source:f.source}:f});s.grid={...g};}
export function matrix(f){const c=center(f),t=f.transform,j=f.jitter,a=(t.angle+j.angle)*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),sx=t.sx*j.scale,sy=t.sy*j.scale;return [cos*sx,sin*sx,-sin*sy,cos*sy,c.x+t.x+j.x-c.x*cos*sx+c.y*sin*sy,c.y+t.y+j.y-c.x*sin*sx-c.y*cos*sy];}
export const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
export const polygon=f=>f.source.polygon.map(p=>point(matrix(f),p));
export function contains(poly,p){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside;}
export const ordered=s=>s.fragments.filter(f=>!f.deleted).slice().sort((a,b)=>a.z-b.z);
export const pick=(s,p)=>ordered(s).reverse().find(f=>f.transform.opacity>0&&contains(polygon(f),p));
export function selectionBox(s,ids){const fs=ordered(s).filter(f=>!ids||ids.has(f.id));return fs.length?bounds(fs.flatMap(polygon)):null;}
export function rectSelect(s,rect){return ordered(s).filter(f=>{const p=polygon(f),b=bounds(p);return b.right>=rect.x&&b.x<=rect.right&&b.bottom>=rect.y&&b.y<=rect.bottom}).map(f=>f.id);}
export function hash(seed,id){let h=seed>>>0;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return (h>>>0)/4294967296;}
export function distribute(s,ids){const entries=TYPES.filter(t=>s.weights[t]>0),total=entries.reduce((v,t)=>v+s.weights[t],0);if(!total)throw Error('Activá al menos un tratamiento.');for(const f of s.fragments){if(f.deleted||f.locked||f.protected||(ids&& !ids.has(f.id)))continue;let n=hash(s.seed,f.id)*total;f.type=entries.find(t=>(n-=s.weights[t])<0)||entries.at(-1);f.params=structuredClone(s.brush);}}
export function jitter(s,ids){for(const f of s.fragments){if(f.deleted||(ids&&!ids.has(f.id)))continue;const n=suffix=>hash(s.seed,f.id+suffix)*2-1;f.jitter={x:n('x')*s.jitter.position||0,y:n('y')*s.jitter.position||0,angle:n('a')*s.jitter.rotation||0,scale:1+n('s')*s.jitter.scale/100};}}
export function reset(f,kind){if(kind==='transform'||kind==='all'){f.transform=base();f.jitter={x:0,y:0,angle:0,scale:1}}if(kind==='treatment'||kind==='all'){f.type='original';f.params=defaults()}}
export class History{constructor(){this.past=[];this.future=[]}commit(before,after){if(JSON.stringify(before)===JSON.stringify(after))return;this.past.push(before);if(this.past.length>40)this.past.shift();this.future=[]}step(s,redo=false){const from=redo?this.future:this.past,to=redo?this.past:this.future;if(!from.length)return s;to.push(s);return from.pop()}}
export const capture=s=>({...structuredClone({...s,source:null}),source:s.source});
export function validate(s){s=structuredClone(s);if(s?.weights)for(const type of DOCUMENT_TYPES)if(s.weights[type]===undefined)s.weights[type]=0;const range=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;if(!s||s.version!==1||!s.grid||!Array.isArray(s.fragments)||s.fragments.length>1800)throw Error('Proyecto Distortion inválido');const g=s.grid;if(![g.rows,g.columns].every(v=>Number.isInteger(v)&&range(v,1,32))||![g.skewX,g.skewY].every(v=>range(v,-.4,.4))||![g.originX,g.originY].every(v=>range(v,-.9,.9))||typeof g.visible!=='boolean')throw Error('Grilla inválida');
 if(s.source&&(!/^data:image\/(png|jpeg|webp);base64,/.test(s.source.data)||typeof s.source.id!=='string'||![s.source.width,s.source.height].every(n=>Number.isInteger(n)&&range(n,1,8192))||s.source.width*s.source.height>16000000))throw Error('Imagen inválida');if(!s.source&&s.fragments.length)throw Error('Falta imagen');
 if(s.collage&&(!range(s.collage.amount,0,100)||!range(s.collage.clustering,0,100)||!range(s.collage.scale,0.5,2)||!['graphic','source'].includes(s.collage.palette)))throw Error('Composición inválida');
 if(s.randomizer&&(!range(s.randomizer.amount,0,100)||typeof s.randomizer.originalColors!=='boolean'))throw Error('Randomizador inválido');
 validateExtras(s,range);validateUnified(s,range);
 const params=p=>{validateTreatmentExtras(p,range);if(!p||(p.originalColors!==undefined&&typeof p.originalColors!=='boolean')||(p.sampledBackground!==undefined&&typeof p.sampledBackground!=='boolean')||!range(p.size,2,100)||!range(p.scale,.3,2)||!range(p.contrast,.2,3)||!range(p.threshold,0,1)||![0,2,4,8,16].includes(p.levels)||![p.foreground,p.background].every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw Error('Tratamiento inválido')};params(s.brush);if(!DOCUMENT_TYPES.includes(s.active)||!range(s.seed,0,4294967295)||!TYPES.every(t=>range(s.weights?.[t],0,100))||!range(s.jitter?.position,0,300)||!range(s.jitter.rotation,0,90)||!range(s.jitter.scale,0,75))throw Error('Distribución inválida');const ids=new Set(),expected=new Map(adaptiveGrid(s.source,g,s.splits).map(f=>[f.id,f]));for(const f of s.fragments){if(ids.has(f.id)||!expected.has(f.id)||!DOCUMENT_TYPES.includes(f.type))throw Error('Fragmento inválido');ids.add(f.id);if(JSON.stringify(f.source)!==JSON.stringify(expected.get(f.id).source))throw Error('Recorte de origen inválido');if(['locked','protected'].some(k=>f[k]!==undefined&&typeof f[k]!=='boolean'))throw Error('Protección inválida');params(f.params);const t=f.transform,j=f.jitter;if(!t||![t.x,t.y].every(n=>range(n,-1e6,1e6))||!range(t.angle,-1e6,1e6)||![t.sx,t.sy].every(n=>range(n,.05,20))||!range(t.opacity,0,1)||!j||![j.x,j.y].every(n=>range(n,-300,300))||!range(j.angle,-90,90)||!range(j.scale,.25,1.75)||!range(f.z,-1e5,1e5)||typeof f.deleted!=='boolean')throw Error('Transformación inválida');}return capture(s);}
export function ment(s,{id,name,preview}){return JSON.stringify({format:'basement.ment',version:1,artboard:{id,name,studio:'distortion',layers:[{id:'fragments',type:'distortion.fragments'}],settings:s,preview}})}
export function exportSize(s,longSide=4096){const b=selectionBox(s);if(!b)throw Error('No hay fragmentos para exportar.');const width=b.right-b.x,height=b.bottom-b.y;if(width<=0||height<=0)throw Error('Composición vacía');const scale=Math.min(longSide/Math.max(width,height),Math.sqrt(16000000/(width*height)));return {...b,scale,width:Math.max(1,Math.ceil(width*scale)),height:Math.max(1,Math.ceil(height*scale))};}

// One seeded operation; never changes the source image or project identity.
export function randomizeAll(s,seed,ids){
 if(!s.source)throw Error('Cargá una imagen primero.');
 const config=s.randomizer||{amount:100,originalColors:false};
 if(config.amount===0)return;
 const types=TYPES.filter(t=>s.weights[t]>0&&(!config.originalColors||!['duotone','invert'].includes(t))),total=types.reduce((n,t)=>n+s.weights[t],0);
 if(!total)throw Error('Activá al menos un efecto compatible con el modo de color.');
 s.seed=seed>>>0;
 const eligible=s.fragments.filter(f=>!f.deleted&&!f.locked&&!f.protected&&(!ids||ids.has(f.id))).sort((a,b)=>hash(s.seed,a.id+'choose')-hash(s.seed,b.id+'choose'));
 const count=Math.round(eligible.length*config.amount/100);
 for(const f of eligible.slice(0,count)){
 const r=k=>hash(s.seed,f.id+':'+k),color=k=>'#'+Math.floor(r(k)*16777216).toString(16).padStart(6,'0');let n=r('type')*total;
 f.type=types.find(t=>(n-=s.weights[t])<0)||types.at(-1);
 f.textureScale=.8+r('size')*.4;
 f.params={size:Math.round(3+r('size')*37),scale:.6+r('scale')*.9,contrast:.6+r('contrast')*1.9,threshold:.2+r('threshold')*.6,levels:config.originalColors?0:[0,2,4,8,16][Math.floor(r('levels')*5)],foreground:color('fg'),background:color('bg'),originalColors:config.originalColors};
 }
}

export const GRID_PRESETS=[
 {id:'large',name:'Amplia · 4 × 4',columns:4,rows:4},
 {id:'classic',name:'Clásica · 8 × 8',columns:8,rows:8},
 {id:'fine',name:'Fina · 16 × 16',columns:16,rows:16},
 {id:'columns',name:'Bandas verticales · 12 × 1',columns:12,rows:1},
 {id:'rows',name:'Bandas horizontales · 1 × 12',columns:1,rows:12},
 {id:'diagonal',name:'Diagonal · 8 × 8',columns:8,rows:8,skewX:.3}
].map(p=>({...p,skewX:p.skewX||0,skewY:0,originX:0,originY:0}));
export function restoreComposition(s){
 const restored=initialState();restored.source=s.source;restored.grid={...s.grid};
 restored.fragments=buildGrid(restored.source,restored.grid);return restored;
}

// Smooth seeded field makes neighboring cells share treatments without changing geometry.
export const collageDefaults=()=>({amount:60,clustering:65,scale:1,palette:'graphic'});
function field(seed,x,y,key){
 const ix=Math.floor(x),iy=Math.floor(y),smooth=t=>t*t*(3-2*t),u=smooth(x-ix),v=smooth(y-iy);
 const at=(dx,dy)=>hash(seed,`${ix+dx}:${iy+dy}:${key}`);
 return (at(0,0)*(1-u)+at(1,0)*u)*(1-v)+(at(0,1)*(1-u)+at(1,1)*u)*v;
}
export function composeCollage(s,seed=s.seed,ids){
 if(!s.source)throw Error('Cargá una imagen primero.');
 const config={...collageDefaults(),...s.collage};
 const eligible=s.fragments.filter(f=>!f.deleted&&!f.locked&&!f.protected&&(!ids||ids.has(f.id)));
 if(!eligible.length)return;
 s.seed=seed>>>0;
 const mix=config.clustering/100;
 const noise=(f,key)=>{const {row,col}=f.source;return field(s.seed,col/2.5,row/2.5,key)*mix+hash(s.seed,f.id+':collage:'+key)*(1-mix)};
 const ranked=eligible.slice().sort((a,b)=>noise(a,'coverage')-noise(b,'coverage')||a.id.localeCompare(b.id));
 const treated=new Set(ranked.slice(0,Math.round(eligible.length*config.amount/100)).map(f=>f.id));
 const palette=['#ed4435','#5558ca','#eee4bb','#151a18'];
 // Explicit proportions keep small grids varied; a second field groups similar effects.
 const effects=['ascii','pixel','halftone','contour'].filter(t=>s.weights[t]>0),total=effects.reduce((n,t)=>n+s.weights[t],0);if(!total)throw Error('Activá al menos un efecto.');const weights=effects.map(t=>s.weights[t]/total);
 const byStyle=ranked.filter(f=>treated.has(f.id)).sort((a,b)=>noise(a,'style')-noise(b,'style')||a.id.localeCompare(b.id));
 const style=new Map();byStyle.forEach((f,i)=>{const t=(i+.5)/byStyle.length;let sum=0;style.set(f.id,effects.find((_,j)=>(sum+=weights[j])>=t)||'contour')});
 for(const f of eligible){
  if(!treated.has(f.id)){f.type='original';f.params=defaults();continue;}
  f.type=style.get(f.id);
  const r=k=>hash(s.seed,f.id+':collage:'+k),source=config.palette==='source';
  f.textureScale=.8+r('size')*.4;
 const unit=f.type==='ascii'?2.5+r('size')*3.5:f.type==='pixel'?7+r('size')*13:2+r('size')*3;
  f.params={...defaults(),size:Math.max(2,Math.min(100,unit*config.scale)),scale:.85+r('scale')*.3,contrast:1.15+r('contrast')*.7,threshold:.42+r('threshold')*.16,levels:f.type==='pixel'&&!source?4:0,
   foreground:'#171b18',background:'#f2e8c9',originalColors:source&&f.type==='solid',sampledBackground:source&&['ascii','halftone','contour'].includes(f.type)};
  if(f.type==='solid')f.params.foreground=palette[Math.floor(r('color')*palette.length)];
 if(s.style)f.params=defaults();
 }
}

export const ASCII_SETS={classic:'@%#*+=-:. ',blocks:'█▓▒░· ',symbols:'MWH8&Xx+=-:. ',binary:'10:. '};
export const colorKeys=['foreground','background','originalColors','sampledBackground','palette','paletteMix','paletteSolid'];
export function mergeVariation(before,after,channels){
 for(const f of after.fragments){const old=before.fragments.find(o=>o.id===f.id);if(!old)continue;
 if(old.locked||old.protected){Object.assign(f,structuredClone(old));continue;}
 if(!channels.distribution)f.type=old.type;if(!channels.textures){if(old.textureScale===undefined)delete f.textureScale;else f.textureScale=old.textureScale;}
 for(const key of new Set([...Object.keys(old.params),...Object.keys(f.params)])){
  if((colorKeys.includes(key)?channels.colors:channels.textures))continue;
  if(key in old.params)f.params[key]=structuredClone(old.params[key]);else delete f.params[key];
 }
 if(!channels.textures)f.params.motionSeed=old.params.motionSeed??before.seed;
 }
}
function children(f){
 const b=bounds(f.source.polygon),mx=(b.x+b.right)/2,my=(b.y+b.bottom)/2;
 return [[b.x,b.y,mx,my],[mx,b.y,b.right,my],[b.x,my,mx,b.bottom],[mx,my,b.right,b.bottom]].flatMap(([x,y,right,bottom],i)=>{
 let poly=f.source.polygon;for(const [axis,value,keep]of [['x',x,1],['x',right,-1],['y',y,1],['y',bottom,-1]])poly=clip(poly,axis,value,keep);
 if(poly.length<3||Math.abs(poly.reduce((sum,a,j)=>{const v=poly[(j+1)%poly.length];return sum+a.x*v.y-a.y*v.x},0))<1e-5)return [];
 const child=structuredClone(f);child.id=f.id+'/'+i;child.source={...child.source,polygon:poly};
 const c=center(child),mapped=point(matrix(f),c);child.transform.x=mapped.x-c.x-f.jitter.x;child.transform.y=mapped.y-c.y-f.jitter.y;child.z=f.z+i*.0001;return [child];
 });
}
export function adaptiveGrid(source,grid,splits=[]){
 if(!Array.isArray(splits)||splits.length>600||new Set(splits).size!==splits.length||splits.some(id=>typeof id!=='string'||id.split('/').length>3))throw Error('Subdivisiones inválidas');
 const split=new Set(splits),seen=new Set();
 function walk(f){if(!split.has(f.id))return [f];seen.add(f.id);return children(f).flatMap(walk)}
 const result=buildGrid(source,grid).flatMap(walk);
 if(seen.size!==split.size||result.length>1800)throw Error('Subdivisiones fuera de la grilla');return result;
}
export function subdivide(s,ids){
 const candidates=s.fragments.filter(f=>!f.deleted&&!f.locked&&!f.protected&&ids.has(f.id)&&f.id.split('/').length<4);
 const next=s.fragments.flatMap(f=>candidates.includes(f)?children(f):[f]);if(next.length>1800)throw Error('Máximo 1800 piezas. Seleccioná menos fragmentos.');
 s.splits=[...(s.splits||[]),...candidates.map(f=>f.id)];s.fragments=next;return next.filter(f=>candidates.some(p=>f.id.startsWith(p.id+'/'))).map(f=>f.id);
}
export function extractPalette(data,count=6){
 const bins=new Map();for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;const key=[0,1,2].map(k=>Math.min(7,Math.floor(data[i+k]/32))).join(',');const b=bins.get(key)||{sum:[0,0,0],n:0};b.n++;for(let k=0;k<3;k++)b.sum[k]+=data[i+k];bins.set(key,b);}
 const candidates=[...bins.values()].sort((a,b)=>b.n-a.n),chosen=[];
 for(const b of candidates){const rgb=b.sum.map(v=>Math.round(v/b.n));if(chosen.some(c=>c.rgb.reduce((n,v,k)=>n+(v-rgb[k])**2,0)<1600))continue;chosen.push({rgb,n:b.n});if(chosen.length>=count)break;}
 return chosen.map(({rgb,n})=>({color:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),weight:Math.max(1,Math.round(n/(data.length/4)*100)),enabled:true}));
}
export function applyPalette(s,ids){
 const palette=s.palette?.colors?.filter(c=>c.enabled&&c.weight>0);if(!palette?.length)return;
 for(const f of s.fragments){if(f.deleted||f.locked||f.protected||(ids&&!ids.has(f.id)))continue;
 f.params.palette=structuredClone(palette);f.params.paletteMix=s.palette.influence;
 const total=palette.reduce((n,c)=>n+c.weight,0);let n=hash(s.seed,f.id+':palette')*total;
 const chosen=palette.find(c=>(n-=c.weight)<0)||palette.at(-1);if(f.type==='solid'&&s.palette.influence>0)f.params.paletteSolid=chosen.color;
 }
}
function validateTreatmentExtras(p,r){if(!p)return;
 if(p.motionEnabled!==undefined&&typeof p.motionEnabled!=='boolean'||p.motionFps!==undefined&&(!Number.isInteger(p.motionFps)||!r(p.motionFps,1,24)))throw Error('Jitter inválido');
 if(p.charset!==undefined&&!Object.hasOwn(ASCII_SETS,p.charset)||p.backdrop!==undefined&&!['paper','local','transparent'].includes(p.backdrop)||p.density!==undefined&&!r(p.density,.25,2)||p.jitterAmount!==undefined&&!r(p.jitterAmount,0,20))throw Error('Textura inválida');
 if(p.motionSeed!==undefined&&!r(p.motionSeed,0,4294967295)||p.paletteSolid!==undefined&&!/^#[0-9a-f]{6}$/i.test(p.paletteSolid))throw Error('Textura inválida');if(p.palette!==undefined)validatePalette(p.palette,r);if(p.paletteMix!==undefined&&!r(p.paletteMix,0,100))throw Error('Paleta inválida');
}
function validatePalette(colors,r){if(!Array.isArray(colors)||colors.length>8||colors.some(c=>!/^#[0-9a-f]{6}$/i.test(c.color)||!r(c.weight,0,100)||typeof c.enabled!=='boolean'))throw Error('Paleta inválida');}
function validateExtras(s,r){
 if(s.ascii&&(!Object.hasOwn(ASCII_SETS,s.ascii.charset)||!r(s.ascii.density,.25,2))||s.patternBackdrop!==undefined&&!['paper','local','transparent'].includes(s.patternBackdrop))throw Error('ASCII inválido');
 if(s.palette){validatePalette(s.palette.colors,r);if(s.palette.influence!==undefined&&!r(s.palette.influence,0,100))throw Error('Paleta inválida');}
 if(s.variation&&['distribution','textures','colors'].some(k=>typeof s.variation[k]!=='boolean'))throw Error('Variación inválida');
 if(s.motion&&(!r(s.motion.amount,0,20)||!r(s.motion.fps,1,24)||typeof s.motion.enabled!=='boolean'))throw Error('Jitter inválido');
}

function validateUnified(s,r){
 const numeric={brightness:[-1,1],contrast:[.2,3],threshold:[0,1],size:[2,100],scale:[.3,2],density:[.25,2],jitterAmount:[0,20],motionSpeed:[.5,3]};
 const check=(p,override=false)=>{if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Ajustes inválidos');for(const [key,value]of Object.entries(p)){
 if(override&&!OVERRIDE_KEYS.includes(key))throw Error('Ajuste local inválido');
 if(numeric[key]&&!r(value,...numeric[key]))throw Error('Ajuste fuera de rango');
 if(key==='motionSpeed'&&value*2%1)throw Error('Velocidad inválida');
 if(key==='charset'&&!Object.hasOwn(ASCII_SETS,value)||key==='motionEnabled'&&typeof value!=='boolean')throw Error('Ajuste inválido');
 }};
 if(s.style?.colorMode==='palette'&&!s.palette?.colors?.some(c=>c.enabled&&c.weight>0))throw Error('Activá al menos un color de la paleta.');
 if(s.style){check(s.style);if(s.style.version!==1||!['palette','source'].includes(s.style.colorMode)||!['paper','transparent'].includes(s.style.backdrop)||!/^#[0-9a-f]{6}$/i.test(s.style.background))throw Error('Estilo inválido');}
 if(s.motion?.speed!==undefined&&(!r(s.motion.speed,.5,3)||s.motion.speed*2%1))throw Error('Velocidad inválida');
 for(const f of s.fragments){if(f.overrides)check(f.overrides,true);if(f.textureScale!==undefined&&!r(f.textureScale,.5,2))throw Error('Textura inválida');}
}
