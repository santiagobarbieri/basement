export const LIMITS={shapes:180,points:32000};
export const initialState=()=>({version:1,bath:{width:960,height:720,paper:'#f2ebda'},palette:['#253e39','#9bb07a','#d26c44','#e8d6ad'],activeColor:0,tool:{mode:'drop',radius:65,rings:1,strength:1,reach:44,spacing:48,tines:7},motion:{enabled:false,amount:22,duration:8,wavelength:330},seed:1,shapes:[]});
export const copy=s=>structuredClone(s);
export function random(seed){let a=seed>>>0;return ()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function dropPoint(p,c,r){const x=p.x-c.x,y=p.y-c.y,d=x*x+y*y;if(d<1e-12)return {x:c.x+r,y:c.y};const k=Math.sqrt(1+r*r/d);return {x:c.x+x*k,y:c.y+y*k};}
export function strokePoint(p,a,b,tool){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)return {...p};const ux=dx/length,uy=dy/length,perp=(p.x-a.x)*-uy+(p.y-a.y)*ux,n=tool.mode==='comb'?tool.tines:1;let displacement=0;
 for(let i=0;i<n;i++){const offset=(i-(n-1)/2)*tool.spacing;displacement+=Math.exp(-Math.abs(perp-offset)/(tool.mode==='comb'?Math.max(3,tool.reach*.32):tool.reach));}
 return {x:p.x+ux*length*tool.strength*displacement,y:p.y+uy*length*tool.strength*displacement};
}
function transformShapes(s,map){
 let count=0;
 const shapes=s.shapes.map(shape=>{const result=[];const append=(a,b,depth=0)=>{
  const aa=map(a),bb=map(b),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},mm=map(mid),error=Math.hypot(mm.x-(aa.x+bb.x)/2,mm.y-(aa.y+bb.y)/2);
  if(depth<6&&Math.hypot(aa.x-bb.x,aa.y-bb.y)>5&&error>.45){append(a,mid,depth+1);append(mid,b,depth+1);return;}
  if(++count>LIMITS.points)throw Error('La mezcla llegó al límite de detalle. Deshacé o empezá otra.');result.push(aa);
 };
 for(let i=0;i<shape.points.length;i++)append(shape.points[i],shape.points[(i+1)%shape.points.length]);return {...shape,points:result};
 });s.shapes=shapes;
}
export function addDrop(s,c,r=s.tool.radius,color=s.activeColor){
 if(s.shapes.length>=LIMITS.shapes)throw Error('Máximo 180 gotas. Deshacé o empezá otra mezcla.');
 const count=Math.max(64,Math.min(192,Math.ceil(Math.PI*2*r/3))),existing=s.shapes.reduce((n,a)=>n+a.points.length,0);if(existing+count>LIMITS.points)throw Error('La mezcla llegó al límite de detalle.');
 transformShapes(s,p=>dropPoint(p,c,r));
 s.shapes.push({color,ink:s.palette[color],points:Array.from({length:count},(_,i)=>({x:c.x+Math.cos(i/count*Math.PI*2)*r,y:c.y+Math.sin(i/count*Math.PI*2)*r}))});
}
export function drop(s,p,r=s.tool.radius,color=s.activeColor){const before=copy(s);try{addDrop(s,p,r,color);}catch(e){Object.assign(s,before);throw e;}}
export function holdRadius(seconds,rate,bath){return Math.min(Math.min(bath.width,bath.height)*.5,8+Math.max(0,seconds)*rate);}
export function growingDrop(s,before,p,seconds,color=s.activeColor){
 const next={...s,shapes:before.shapes},radius=holdRadius(seconds,s.tool.radius,s.bath);addDrop(next,p,radius,color);s.shapes=next.shapes;return radius;
}
export function stroke(s,a,b,tool=s.tool){transformShapes(s,p=>strokePoint(p,a,b,tool));}
export function sprinkle(s,seed=s.seed,count=10){const before=copy(s),r=random(seed);try{for(let i=0;i<count;i++){s.activeColor=Math.floor(r()*s.palette.length);s.tool.radius=35+r()*65;drop(s,{x:(.08+r()*.84)*s.bath.width,y:(.08+r()*.84)*s.bath.height});}}catch(e){Object.assign(s,before);throw e;}s.activeColor=before.activeColor;s.tool.radius=before.tool.radius;}
export function example(s,seed=s.seed){const before=copy(s);try{s.shapes=[];sprinkle(s,seed,14);}catch(e){Object.assign(s,before);throw e;}}
export function validate(s){
 const range=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b,hex=c=>/^#[0-9a-f]{6}$/i.test(c);
 if(!s||s.version!==1||!s.bath||!Number.isInteger(s.bath.width)||!Number.isInteger(s.bath.height)||![s.bath.width,s.bath.height].every(v=>range(v,200,2048))||!hex(s.bath.paper))throw Error('Baño Marble inválido');
 if(!Array.isArray(s.palette)||s.palette.length<2||s.palette.length>6||!s.palette.every(hex)||!Number.isInteger(s.activeColor)||!range(s.activeColor,0,s.palette.length-1))throw Error('Paleta Marble inválida');
 const t=s.tool,m=s.motion;if(!t||!['drop','stroke','comb','pan'].includes(t.mode)||!range(t.radius,8,180)||!Number.isInteger(t.rings)||!range(t.rings,1,6)||!range(t.strength,.1,2)||!range(t.reach,8,120)||!range(t.spacing,12,140)||!Number.isInteger(t.tines)||!range(t.tines,2,13))throw Error('Herramienta Marble inválida');
 if(!m||typeof m.enabled!=='boolean'||!range(m.amount,0,60)||!range(m.duration,4,16)||!range(m.wavelength,100,800)||!Number.isInteger(s.seed)||!range(s.seed,0,4294967295))throw Error('Movimiento Marble inválido');
 if(!Array.isArray(s.shapes)||s.shapes.length>LIMITS.shapes)throw Error('Demasiadas gotas');let points=0;
 for(const shape of s.shapes){if(shape.ink!==undefined&&!hex(shape.ink))throw Error('Color de gota inválido');if(!Number.isInteger(shape.color)||!range(shape.color,0,s.palette.length-1)||!Array.isArray(shape.points)||shape.points.length<3)throw Error('Gota inválida');points+=shape.points.length;if(points>LIMITS.points)throw Error('Demasiados puntos');for(const p of shape.points)if(!p||!range(p.x,-1e6,1e6)||!range(p.y,-1e6,1e6))throw Error('Geometría inválida');}
 const result=copy(s);for(const shape of result.shapes)shape.ink??=result.palette[shape.color];return result;
}
export class History{constructor(){this.past=[];this.future=[];}commit(before,after){if(JSON.stringify(before)===JSON.stringify(after))return;this.past.push(before);if(this.past.length>16)this.past.shift();this.future=[];}step(s,redo=false){const from=redo?this.future:this.past,to=redo?this.past:this.future;if(!from.length)return s;to.push(copy(s));return from.pop();}}
export function ment(s,{id,name,preview}){return JSON.stringify({format:'basement.ment',version:1,artboard:{id,name,studio:'marble',width:s.bath.width,height:s.bath.height,preview,layers:[{id:'bath',type:'marble.bath'}],settings:s}});}
