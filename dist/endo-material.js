import {normalizeBlending} from './endo-brushes.js';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const noise=(x,y)=>{let a=Math.imul(Math.floor(x)+7919,374761393)^Math.imul(Math.floor(y)+104729,668265263);a=Math.imul(a^(a>>>13),1274126177);return((a^(a>>>16))>>>0)/4294967296;};
// Surface appearance is evaluated after paint, never stored on an individual mark.
// Height comes from editable gestures; baked pixels use an alpha-derived relief.
export function applyLayerMaterial(pixels,width,height,layer,view={},surface){
 if(!layer.blending||layer.blending.material==='none'||layer.blending.strength===0)return pixels;
 const p=normalizeBlending(layer.blending),out=new Uint8ClampedArray(pixels.length),q=view.resolution||1,angle=p.light*Math.PI/180,lx=Math.cos(angle),ly=Math.sin(angle),blur=Math.max(1,Math.round(2*q));
 const reliefAt=(x,y)=>{const i=Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x));return surface?.height?.[i]??pixels[i*4+3]/255*8*q;};
 const primary=p.primary?rgb(p.primary):null,shadow=p.shadow?rgb(p.shadow):null,contrast=p.contrast?rgb(p.contrast):null,strength=p.strength/100;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,j=i*4,alpha=pixels[j+3]/255;if(!alpha)continue;
  const wx=(view.originX||0)+(x+.5)/q,wy=(view.originY||0)+(y+.5)/q,scale=p.particleSize,n=noise(wx/scale,wy/scale),density=p.density/100;
  let dx=(reliefAt(x-blur,y)-reliefAt(x+blur,y))/(2*blur)*p.relief,dy=(reliefAt(x,y-blur)-reliefAt(x,y+blur))/(2*blur)*p.relief,coverage=1;
  const texture=(noise(wx*.65,wy*.65)-.5)*p.roughness/100;
  if(p.material==='cement'){dx+=texture*.85;dy+=(noise(wx*1.7,wy*1.7)-.5)*p.roughness/100;}
  if(p.material==='relief'){dx+=texture*p.ridge/100;dy+=texture*.35;}
  if(p.material==='sand'){dx+=Math.sin(wx*.55+wy*.23)*.4;dy+=(n-.5)*.65;coverage=n<density?.85+n*.15:.12;}
  if(p.material==='crayon')coverage=n<.15+(1-density)*.5?.08:.45+n*.55;
  if(p.material==='dust'){const fx=wx/scale-Math.floor(wx/scale)-.5,fy=wy/scale-Math.floor(wy/scale)-.5;coverage=n<density?Math.max(0,Math.min(1,(.38-Math.hypot(fx,fy))*scale*q+.5))*(.25+n*.7):0;}
  const length=Math.hypot(dx,dy,1),normal=(dx*lx+dy*ly)/length,nz=1/length,band=.5+.5*Math.sin(normal*8.5+nz*3.2),spec=Math.pow(Math.max(0,(normal+nz*.8)/1.2),Math.max(2,22-p.shine*.18));
  let value=['relief','sand','cement'].includes(p.material)?Math.max(0,Math.min(1,.24+(normal+nz*.65)*.46+spec*p.shine/100*.28)):Math.max(0,Math.min(1,.12+band*.67+spec*p.shine/100));
  if(['crayon','dust'].includes(p.material))value=.42+nz*.12;
  if(p.material==='cement'&&n<(1-density)*.5)value*=.55;
  const nextAlpha=alpha*coverage,outAlpha=alpha*(1-strength)+nextAlpha*strength;
  for(let c=0;c<3;c++){
   const mid=primary?.[c]??pixels[j+c],low=shadow?.[c]??mid*.12,high=contrast?.[c]??(mid+(255-mid)*.88);
   const color=(value<.5?low+(mid-low)*value*2:mid+(high-mid)*(value-.5)*2)+(n-.5)*p.grain/100*90;
   out[j+c]=(pixels[j+c]*alpha*(1-strength)+color*nextAlpha*strength)/Math.max(.00001,outAlpha);
  }
  out[j+3]=Math.round(outAlpha*255);
 }
 return out;
}
