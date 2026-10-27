import {paintMaterial} from './materials.js';
import {TILES} from '../model.js';
import {statistics,luminance} from '../geometry.js';
const circle=(ctx,x,y,r,fill=true)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);fill?ctx.fill():ctx.stroke()};
function flower(ctx,x,y,r,count=8){for(let i=0;i<count;i++){ctx.save();ctx.translate(x,y);ctx.rotate(i*Math.PI*2/count);ctx.beginPath();ctx.ellipse(r*.48,0,r*.5,r*.18,0,0,Math.PI*2);ctx.fill();ctx.restore()}}
export function paintTile(ctx,name,w,h,colors,settings={}){
 ctx.save();ctx.scale(w/100,h/100);ctx.fillStyle=colors.shadow;ctx.fillRect(0,0,100,100);ctx.fillStyle=ctx.strokeStyle=colors.primary;ctx.lineWidth=3;
 if(settings.material&&settings.material!=='ceramic'){ctx.beginPath();ctx.rect(0,0,100,100);ctx.clip();paintMaterial(ctx,Math.max(0,TILES.indexOf(name)),colors,settings);ctx.restore();return;}
 if(name==='Ivory'){circle(ctx,50,50,3);ctx.strokeStyle=colors.contrast;ctx.lineWidth=1;circle(ctx,50,50,8,false)}
 if(name==='Petals'){flower(ctx,50,50,30,4);ctx.fillStyle=colors.contrast;circle(ctx,50,50,5);for(const [x,y]of [[0,0],[100,0],[0,100],[100,100]])circle(ctx,x,y,8)}
 if(name==='Rosette'){flower(ctx,50,50,35,8);ctx.lineWidth=2;circle(ctx,50,50,39,false);ctx.fillStyle=colors.contrast;circle(ctx,50,50,7);for(const [x,y]of [[12,12],[88,12],[12,88],[88,88]])circle(ctx,x,y,4)}
 if(name==='Corner'){for(const [x,y]of [[0,0],[100,100]]){circle(ctx,x,y,47);ctx.fillStyle=colors.shadow;circle(ctx,x,y,33);ctx.fillStyle=colors.primary;circle(ctx,x,y,22)}flower(ctx,50,50,22,4);ctx.fillStyle=colors.contrast;circle(ctx,50,50,6);ctx.lineWidth=2;ctx.strokeRect(5,5,90,90)}
 if(name==='Arabesque'){ctx.lineWidth=13;for(const [x,y]of [[0,50],[100,50],[50,0],[50,100]])circle(ctx,x,y,42,false);flower(ctx,50,50,26,4);ctx.fillStyle=colors.contrast;circle(ctx,50,50,6)}
 if(name==='Lattice'){ctx.lineWidth=10;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(i*34,0);ctx.lineTo(i*34+100,100);ctx.stroke();ctx.beginPath();ctx.moveTo(i*34,100);ctx.lineTo(i*34+100,0);ctx.stroke()}ctx.fillStyle=colors.contrast;for(const [x,y]of [[25,25],[75,25],[25,75],[75,75]])circle(ctx,x,y,5)}
 if(name==='Medallion'){ctx.fillRect(0,0,100,100);ctx.fillStyle=colors.shadow;ctx.beginPath();ctx.moveTo(50,7);ctx.lineTo(93,50);ctx.lineTo(50,93);ctx.lineTo(7,50);ctx.closePath();ctx.fill();ctx.fillStyle=colors.primary;flower(ctx,50,50,34,8);ctx.fillStyle=colors.contrast;circle(ctx,50,50,7);ctx.strokeStyle=colors.shadow;ctx.lineWidth=2;ctx.strokeRect(3,3,94,94)}
 if(name==='Cobalt'){ctx.fillRect(0,0,100,100)}
 const texture=(settings.texture||0)/100;
 if(texture){for(let i=0;i<220;i++){const x=(i*37.17)%100,y=(i*71.31)%100;ctx.fillStyle=i%2?'rgba(255,255,255,'+texture*.2+')':'rgba(0,0,0,'+texture*.16+')';ctx.fillRect(x,y,.8,.8)}}
 const glaze=(settings.glaze||0)/100;
 if(glaze){const sheen=ctx.createLinearGradient(0,0,100,100);sheen.addColorStop(0,'rgba(255,255,255,'+glaze*.2+')');sheen.addColorStop(.5,'rgba(255,255,255,0)');sheen.addColorStop(1,'rgba(0,0,0,'+glaze*.08+')');ctx.fillStyle=sheen;ctx.fillRect(0,0,100,100);ctx.strokeStyle='rgba(255,255,255,'+glaze*.45+')';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,99);ctx.lineTo(0,0);ctx.lineTo(99,0);ctx.stroke();ctx.strokeStyle='rgba(0,0,0,'+glaze*.35+')';ctx.beginPath();ctx.moveTo(1,99);ctx.lineTo(99,99);ctx.lineTo(99,1);ctx.stroke()}
 ctx.restore();
}
function tones(state,helpers){
 return state.tiles.enabled.filter(name=>TILES.includes(name)).map(name=>{
  const key='mosaic-tone:'+name+':'+(state.tiles.material||'ceramic')+':'+state.tiles.texture+':'+state.tiles.glaze+':'+JSON.stringify(state.colors);
  const canvas=helpers.cached(key,32,32,(ctx,w,h)=>paintTile(ctx,name,w,h,state.colors,{...state.tiles,texture:state.tiles.material&&state.tiles.material!=='ceramic'?state.tiles.texture:0,glaze:state.tiles.material&&state.tiles.material!=='ceramic'?state.tiles.glaze:0}));const data=canvas.getContext('2d').getImageData(0,0,32,32).data;let value=0;for(let i=0;i<data.length;i+=4)value+=luminance(data[i],data[i+1],data[i+2]);return {name,tone:value/1024};
 }).sort((a,b)=>a.tone-b.tone);
}
export function chooseTile(catalog,tone){const min=catalog[0].tone,max=catalog.at(-1).tone,target=min+Math.max(0,Math.min(1,tone))*(max-min);return catalog.reduce((best,tile)=>Math.abs(tile.tone-target)<Math.abs(best.tone-target)?tile:best)}
// Seeded independent tile rhythms; periodic noise closes the four-second GIF loop.
function tileRandom(col,row,seed,knot){
 let n=(Math.imul(col+1,374761393)^Math.imul(row+1,668265263)^Math.imul(seed|0,1442695041)^Math.imul(knot+1,1274126177))>>>0;
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
}
export function motionTone(tone,col,row,time,enabled,seed=1,amount=100,speed=1){
 if(!enabled||!Number.isFinite(time))return tone;
 time*=Math.max(.25,Math.min(3,speed));
 const strength=Math.max(0,Math.min(200,amount))/100;
 const count=4+Math.floor(tileRandom(col,row,seed,30)*5);
 const phase=((time%4000+4000)%4000)/4000*count+tileRandom(col,row,seed,31)*count;
 const index=Math.floor(phase),fraction=phase-index,t=fraction*fraction*(3-2*fraction);
 const a=tileRandom(col,row,seed,index%count)*2-1,b=tileRandom(col,row,seed,(index+1)%count)*2-1;
 const noise=(a+(b-a)*t)*strength;
 const contrast=Math.pow(2,noise*1.2);
 return Math.max(0,Math.min(1,(tone-.5)*contrast+.5+noise*.16));
}
export async function renderTiles(ctx,state,sample,sx,sy,helpers){
 const catalog=tones(state,helpers);if(!catalog.length)throw Error('Elegí al menos un azulejo');
 const spacing=Math.max(sample.width,sample.height)*state.shared.size/1000,cols=Math.ceil(sample.width/spacing),rows=Math.ceil(sample.height/spacing),size=spacing*sx;
 const gap=0,drawSize=size*(1-gap),atlasSize=Math.max(8,Math.min(1024,Math.ceil(drawSize*2))),texture=state.tiles.texture??20,glaze=state.tiles.glaze??35;
 ctx.save();ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.clip();
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const stats=statistics(sample,col*spacing,row*spacing,(col+1)*spacing,(row+1)*spacing);if(!stats.alpha)continue;const tile=chooseTile(catalog,motionTone(stats.luma,col,row,state.motionTime,state.tiles.motion,state.tiles.seed??1,state.tiles.amount??100,state.tiles.speed??1));
  const colors={...state.colors};if(state.shared.palette==='image')colors.primary='#'+stats.rgb.map(c=>Math.min(255,Math.max(0,Math.round(c/8)*8)).toString(16).padStart(2,'0').slice(-2)).join('');if(state.shared.palette==='mono')colors.contrast=colors.primary;
  const stamp=helpers.cached('mosaic:'+(state.tiles.material||'ceramic')+':'+tile.name+':'+JSON.stringify(colors)+':'+texture+':'+glaze+':'+atlasSize,atlasSize,atlasSize,(c,w,h)=>paintTile(c,tile.name,w,h,colors,{texture,glaze,material:state.tiles.material}));
  ctx.globalAlpha=stats.alpha;const x=col*size,y=row*spacing*sy,dy=spacing*sy;
  if(gap){ctx.fillStyle=colors.shadow;ctx.fillRect(x,y,size,dy)}
  ctx.save();ctx.translate(x+size/2,y+dy/2);if(state.tiles.rotate)ctx.rotate(((col*17+row*31)%4)*Math.PI/2);ctx.drawImage(stamp,-drawSize/2-.5,-dy*(1-gap)/2-.5,drawSize+1,dy*(1-gap)+1);ctx.restore();
 }
 ctx.restore();
}
