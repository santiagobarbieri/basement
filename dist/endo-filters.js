import {filterDefinition} from './endo-filter-catalog.js';

// Effects modify only shaded RGB on a copy. Alpha and editable gestures survive.
// Every texture is a function of artboard coordinates, never viewport position,
// random state or neighboring pixels. ROI rendering needs no halo and export
// reconstructs the same pattern at its own sampling resolution.
const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const mod=(value,period)=>((value%period)+period)%period;
function parameter(value,fallback,min,max){const number=Number(value);return clamp(Number.isFinite(number)?number:fallback,min,max);}
function noise(x,y){
 let seed=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0;
 seed=Math.imul(seed^(seed>>>13),1274126177);seed^=seed>>>16;
 return (seed>>>0)/4294967295;
}
function lattice(x,y){return (bayer[mod(y,4)*4+mod(x,4)]+.5)/16;}
function signedAmount(amount){return amount<128?(amount-128)/128:(amount-128)/127;}
export function applyFilters(input,width,height,filters=[],view={}){
 const output=new Uint8ClampedArray(input);
 const resolution=Number.isFinite(view.resolution)&&view.resolution>0?view.resolution:1;
 const originX=Number.isFinite(view.originX)?view.originX:0,originY=Number.isFinite(view.originY)?view.originY:0;
 for(const filter of filters){
  if(!filter||filter.enabled===false)continue;
  const definition=filterDefinition(filter.type);if(!definition)continue;
  const amount=parameter(filter.amount??definition.defaultAmount,definition.defaultAmount,definition.amountMin,definition.amountMax);
  const scale=Math.round(parameter(filter.scale??definition.defaultScale,definition.defaultScale,1,64));
  const signed=signedAmount(amount),strength=amount/100;
  const contrastFactor=filter.type==='contrast'?2**(signed*3):1;
  const exposureFactor=filter.type==='exposure'?2**(signed*3):1;
  const saturationFactor=filter.type==='saturation'?(signed<0?1+signed:1+signed*2):1;
  const levels=Math.round(amount);
  if(definition.amountFormat==='signedPercent'&&amount===128)continue;
  if(['pigment-grain','paper-texture','crosshatch'].includes(filter.type)&&amount===0)continue;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const index=(y*width+x)*4;if(!output[index+3])continue;
   const red=output[index],green=output[index+1],blue=output[index+2];
   const luminance=red*.2126+green*.7152+blue*.0722;
   if(filter.type==='brightness'){
    const delta=signed*255;output[index]=red+delta;output[index+1]=green+delta;output[index+2]=blue+delta;
   }else if(filter.type==='contrast'){
    output[index]=(red-127.5)*contrastFactor+127.5;output[index+1]=(green-127.5)*contrastFactor+127.5;output[index+2]=(blue-127.5)*contrastFactor+127.5;
   }else if(filter.type==='exposure'){
    output[index]=red*exposureFactor;output[index+1]=green*exposureFactor;output[index+2]=blue*exposureFactor;
   }else if(filter.type==='saturation'){
    output[index]=luminance+(red-luminance)*saturationFactor;output[index+1]=luminance+(green-luminance)*saturationFactor;output[index+2]=luminance+(blue-luminance)*saturationFactor;
   }else if(filter.type==='invert'){
    output[index]=255-red;output[index+1]=255-green;output[index+2]=255-blue;
   }else if(filter.type==='grayscale'){
    output[index]=output[index+1]=output[index+2]=luminance;
   }else if(filter.type==='posterize'){
    for(let channel=0;channel<3;channel++)output[index+channel]=Math.round(output[index+channel]/255*(levels-1))/(levels-1)*255;
   }else if(filter.type==='threshold'||filter.type==='dither'){
    let cutoff=amount;
    if(filter.type==='dither'){
     const cellX=Math.floor((originX+(x+.5)/resolution)/scale),cellY=Math.floor((originY+(y+.5)/resolution)/scale);
     cutoff+=(lattice(cellX,cellY)-.5)*255;
    }
    output[index]=output[index+1]=output[index+2]=luminance>=cutoff?255:0;
   }else if(filter.type==='colored-dither'){
    const cellX=Math.floor((originX+(x+.5)/resolution)/scale),cellY=Math.floor((originY+(y+.5)/resolution)/scale),threshold=lattice(cellX,cellY);
    for(let channel=0;channel<3;channel++){
     const value=output[index+channel]/255*(levels-1),base=Math.floor(value);
     output[index+channel]=Math.min(levels-1,base+(value-base>threshold?1:0))/(levels-1)*255;
    }
   }else if(filter.type==='pigment-grain'){
    const cellX=Math.floor((originX+(x+.5)/resolution)/scale),cellY=Math.floor((originY+(y+.5)/resolution)/scale),grain=noise(cellX,cellY);
    const factor=1+strength*((grain*2-1)*.3-(grain<.08?.45:0));
    output[index]=red*factor;output[index+1]=green*factor;output[index+2]=blue*factor;
   }else if(filter.type==='paper-texture'){
    const wx=(originX+(x+.5)/resolution)/scale,wy=(originY+(y+.5)/resolution)/scale;
    const weave=Math.cos(wx*Math.PI*2)*.55+Math.cos(wy*Math.PI*2)*.3+(noise(Math.floor(wx*5),Math.floor(wy*5))*2-1)*.15;
    const factor=1+strength*weave*.28;
    output[index]=red*factor;output[index+1]=green*factor;output[index+2]=blue*factor;
   }else if(filter.type==='crosshatch'){
    const wx=originX+(x+.5)/resolution,wy=originY+(y+.5)/resolution,tone=1-luminance/255;
    const first=mod(wx+wy,scale)<scale*(.04+tone*.2),second=mod(wx-wy,scale)<scale*(.03+tone*.15);
    const ink=(tone>.12&&first||tone>.52&&second)?strength*(.25+.6*tone):0;
    output[index]=red*(1-ink);output[index+1]=green*(1-ink);output[index+2]=blue*(1-ink);
   }else if(filter.type==='ink-wash'){
    const band=Math.round(luminance/255*(levels-1))/(levels-1)*255,factor=luminance>0?band/luminance:0;
    output[index]=red*factor;output[index+1]=green*factor;output[index+2]=blue*factor;
   }
  }
 }
 return output;
}
