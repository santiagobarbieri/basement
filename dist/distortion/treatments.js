import {tonal,paletteRGB} from './style-model.js';
import {anchoredPoint} from './motion.js';
import {ASCII_SETS} from './model.js';
import {traceMask,simplify} from '../contour/contours.js';
export const canvas=(w,h)=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
const bayer=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function renderTreatment(image,box,type,p,quality=1,motion={}){const w=Math.max(1,Math.ceil((box.right-box.x)*quality)),h=Math.max(1,Math.ceil((box.bottom-box.y)*quality)),out=canvas(w,h),ctx=out.getContext('2d');ctx.drawImage(image,box.x,box.y,box.right-box.x,box.bottom-box.y,0,0,w,h);if(type==='original'||(p.originalColors&&['duotone','invert'].includes(type)))return out;
 if(type==='solid'||p.sampledBackground||p.backdrop==='local'){const sample=canvas(1,1),sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(out,0,0,1,1);const d=sc.getImageData(0,0,1,1).data,lum=(d[0]*.2126+d[1]*.7152+d[2]*.0722)/255,color=`rgb(${d[0]},${d[1]},${d[2]})`;if(type==='solid'){ctx.globalCompositeOperation='source-in';ctx.fillStyle=p.originalColors?color:p.foreground;ctx.fillRect(0,0,w,h);return out;}p={...p,originalColors:false,background:color,foreground:lum>.45?'#171b18':'#f5ecd2'};}
 if(type==='contour')return contour(out,box,p,quality,motion);
 if(type==='invert'||type==='duotone'){
 const pixels=ctx.getImageData(0,0,w,h),rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),a=rgb(p.foreground),b=rgb(p.background);
 for(let i=0;i<pixels.data.length;i+=4){const d=pixels.data,lum=Math.max(0,Math.min(1,((d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255-.5)*p.contrast+.5));for(let k=0;k<3;k++)d[i+k]=type==='invert'?255-d[i+k]:a[k]+(b[k]-a[k])*lum;}
 ctx.putImageData(pixels,0,0);return out;}

 const cell=Math.max(1,p.size*quality/(p.density||1)),cols=Math.max(1,Math.ceil(w/cell)),rows=Math.max(1,Math.ceil(h/cell)),sample=canvas(cols,rows),sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(out,0,0,cols,rows);const data=sc.getImageData(0,0,cols,rows);if(type==='pixel'){if(p.levels>0&&!p.originalColors)for(let i=0;i<data.data.length;i+=4)for(let k=0;k<3;k++)data.data[i+k]=Math.round(data.data[i+k]/255*(p.levels-1))/(p.levels-1)*255;sc.putImageData(data,0,0);ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;ctx.drawImage(sample,0,0,w,h);return out;}
 ctx.clearRect(0,0,w,h);if(!p.originalColors&&p.backdrop!=='transparent'){ctx.save();ctx.drawImage(image,box.x,box.y,box.right-box.x,box.bottom-box.y,0,0,w,h);ctx.globalCompositeOperation='source-in';ctx.fillStyle=p.background;ctx.fillRect(0,0,w,h);ctx.restore();}ctx.font=`${Math.max(1,cell*p.scale)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';const chars=ASCII_SETS[p.charset]||ASCII_SETS.classic;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=(y*cols+x)*4,alpha=data.data[i+3]/255;if(!alpha)continue;ctx.globalAlpha=alpha;const lum=Math.max(0,Math.min(1,((data.data[i]*.2126+data.data[i+1]*.7152+data.data[i+2]*.0722)/255-.5)*p.contrast+.5)),xx=x*w/cols,yy=y*h/rows,cw=w/cols,ch=h/rows;ctx.fillStyle=p.originalColors?`rgb(${data.data[i]},${data.data[i+1]},${data.data[i+2]})`:p.foreground;const tone=(dx,dy)=>{const j=(Math.min(rows-1,Math.max(0,y+dy))*cols+Math.min(cols-1,Math.max(0,x+dx)))*4;return (data.data[j]*.2126+data.data[j+1]*.7152+data.data[j+2]*.0722)/255},edge=Math.min(1,Math.hypot(tone(1,0)-tone(-1,0),tone(0,1)-tone(0,-1))*3),moved=anchoredPoint({x:box.x+(xx+cw/2)/quality,y:box.y+(yy+ch/2)/quality},motion,Math.min(cw,ch)/quality,box,null,1-edge*.8),jx=(moved.x-box.x)*quality-cw/2,jy=(moved.y-box.y)*quality-ch/2;if(type==='ascii'){const char=chars[Math.min(chars.length-1,Math.floor(lum*chars.length))];ctx.fillText(char,jx+cw/2,jy+ch/2)}else if(type==='halftone'){ctx.beginPath();ctx.ellipse(jx+cw/2,jy+ch/2,cw*.49*Math.sqrt(1-lum),ch*.49*Math.sqrt(1-lum),0,0,Math.PI*2);ctx.fill();}else if(type==='lines'){const thickness=ch*(1-lum);ctx.fillRect(jx,jy+(ch-thickness)/2,cw+.2,thickness);}else if(lum<(bayer[y%4][x%4]+.5)/16+(p.threshold-.5))ctx.fillRect(jx,jy,cw+.2,ch+.2);}ctx.globalAlpha=1;return out;
}

function contour(image,box,p,quality,motion){
 const w=image.width,h=image.height,sourceW=box.right-box.x,sourceH=box.bottom-box.y,ratio=Math.min(1,192/Math.max(sourceW,sourceH)),sw=Math.max(2,Math.round(sourceW*ratio)),sh=Math.max(2,Math.round(sourceH*ratio)),sample=canvas(sw,sh),sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(image,0,0,sw,sh);const data=sc.getImageData(0,0,sw,sh).data;
 const mask=new Uint8Array(sw*sh);for(let i=0;i<mask.length;i++){const k=i*4;const lum=((data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722)/255-.5)*p.contrast+.5;mask[i]=data[k+3]>127&&lum<p.threshold?1:0;}
 const out=canvas(w,h),ctx=out.getContext('2d');if(p.backdrop!=='transparent'){ctx.fillStyle=p.background;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,0);ctx.globalCompositeOperation='source-over';}
 ctx.strokeStyle=p.foreground;ctx.lineWidth=Math.max(.7,p.size*.18)*quality;ctx.lineJoin='round';ctx.lineCap='round';
 ctx.beginPath();for(const path of traceMask(mask,sw,sh)){const points=simplify(path,1);points.forEach((v,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length],normal={x:-(next.y-prev.y)*sourceH/sh,y:(next.x-prev.x)*sourceW/sw},feature=Math.max(1,Math.min(sourceW,sourceH)*.08),moved=anchoredPoint({x:box.x+v.x/sw*sourceW,y:box.y+v.y/sh*sourceH},motion,feature,box,normal),x=(moved.x-box.x)*quality,y=(moved.y-box.y)*quality;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();}ctx.stroke();return out;
}
export function treat(image,box,type,p,quality=1,motion={}){
 if(p.unified&&['original','ascii','pixel','halftone','contour'].includes(type))return unifiedTreatment(image,box,type,p,quality,motion);
 const out=renderTreatment(image,box,type,p,quality,motion);
 if(type==='original'||!p.palette?.length||!p.paletteMix)return out;
 const ctx=out.getContext('2d'),pixels=ctx.getImageData(0,0,out.width,out.height),data=pixels.data,mix=p.paletteMix/100;
 const palette=(type==='solid'&&p.paletteSolid?[{color:p.paletteSolid,enabled:true,weight:100}]:p.palette).filter(c=>c.enabled&&c.weight>0).map(c=>({rgb:[1,3,5].map(i=>parseInt(c.color.slice(i,i+2),16)),weight:c.weight}));if(!palette.length)return out;
 const cache=new Map();for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const key=(data[i]>>3)*1024+(data[i+1]>>3)*32+(data[i+2]>>3);let rgb=cache.get(key);if(!rgb){let best=Infinity;for(const c of palette){const distance=c.rgb.reduce((n,v,k)=>n+(v-data[i+k])**2,0)/(0.5+c.weight/100);if(distance<best){best=distance;rgb=c.rgb;}}cache.set(key,rgb);}for(let k=0;k<3;k++)data[i+k]=Math.round(data[i+k]*(1-mix)+rgb[k]*mix);}
 ctx.putImageData(pixels,0,0);return out;
}

function unifiedTreatment(image,box,type,p,quality,motion){
 const w=Math.max(1,Math.ceil((box.right-box.x)*quality)),h=Math.max(1,Math.ceil((box.bottom-box.y)*quality)),source=canvas(w,h),sc=source.getContext('2d',{willReadFrequently:true});
 sc.drawImage(image,box.x,box.y,box.right-box.x,box.bottom-box.y,0,0,w,h);
 const shift=type==='original'||type==='contour'?0:.5-p.threshold;
 if(p.brightness||p.contrast!==1||shift){const pixels=sc.getImageData(0,0,w,h);for(let i=0;i<pixels.data.length;i+=4)for(let k=0;k<3;k++)pixels.data[i+k]=Math.round(Math.max(0,Math.min(1,tonal(pixels.data[i+k]/255,p)+shift))*255);sc.putImageData(pixels,0,0);}
 if(type==='original')return source;
 const color=rgb=>'rgb('+paletteRGB(rgb,p).join(',')+')';
 if(type==='contour'){
  const average=canvas(1,1),ac=average.getContext('2d',{willReadFrequently:true});ac.drawImage(source,0,0,1,1);const rgb=[...ac.getImageData(0,0,1,1).data].slice(0,3);
  return contour(source,box,{...p,foreground:color(rgb),contrast:1},quality,motion);
 }
 const cell=Math.max(1,p.size*quality/(p.density||1)),cols=Math.max(1,Math.ceil(w/cell)),rows=Math.max(1,Math.ceil(h/cell)),sample=canvas(cols,rows),ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,cols,rows);const pixels=ctx.getImageData(0,0,cols,rows),data=pixels.data;
 if(type==='pixel'){
  for(let i=0;i<data.length;i+=4){const rgb=paletteRGB([data[i],data[i+1],data[i+2]],{...p,colors:[...(p.colors||[]),{color:p.background,enabled:true,weight:100}]});for(let k=0;k<3;k++)data[i+k]=rgb[k];}ctx.putImageData(pixels,0,0);sc.clearRect(0,0,w,h);sc.imageSmoothingEnabled=false;sc.drawImage(sample,0,0,w,h);return source;
 }
 const output=canvas(w,h),out=output.getContext('2d');if(p.backdrop!=='transparent'){out.drawImage(source,0,0);out.globalCompositeOperation='source-in';out.fillStyle=p.background;out.fillRect(0,0,w,h);out.globalCompositeOperation='source-over';}
 const cw=w/cols,ch=h/rows,chars=ASCII_SETS[p.charset]||ASCII_SETS.classic;out.font=`${Math.max(1,cell*p.scale)}px monospace`;out.textAlign='center';out.textBaseline='middle';
 const lumAt=(x,y)=>{const i=(Math.max(0,Math.min(rows-1,y))*cols+Math.max(0,Math.min(cols-1,x)))*4;return (data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;};
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const i=(y*cols+x)*4;if(!data[i+3])continue;const lum=lumAt(x,y),edge=Math.min(1,Math.hypot(lumAt(x+1,y)-lumAt(x-1,y),lumAt(x,y+1)-lumAt(x,y-1))*3),anchor={x:box.x+(x+.5)*cw/quality,y:box.y+(y+.5)*ch/quality},moved=anchoredPoint(anchor,motion,Math.min(cw,ch)/quality,box,null,1-edge*.8),xx=(moved.x-box.x)*quality,yy=(moved.y-box.y)*quality;
  out.globalAlpha=data[i+3]/255;out.fillStyle=color([data[i],data[i+1],data[i+2]]);
  if(type==='ascii')out.fillText(chars[Math.min(chars.length-1,Math.floor(lum*chars.length))],xx,yy);
  else{out.beginPath();out.ellipse(xx,yy,cw*.49*Math.sqrt(1-lum),ch*.49*Math.sqrt(1-lum),0,0,Math.PI*2);out.fill();}
 }
 out.globalAlpha=1;return output;
}
