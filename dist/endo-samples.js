import {BRUSH_PRESETS,brushPreset,normalizeBlending,DEFAULT_BLENDING} from './endo-brushes.js';
import {renderLayerDocument} from './endo-renderer.js';

// The galleries use the same editable gesture, rasterizer and material shader
// as an Artboard. A CSS checkerboard stays outside these transparent pixels.
const WIDTH=240,HEIGHT=96;
const SCENE=Object.freeze({merge:2,light:225,relief:.8,smooth:0,shine:75,grain:12});
const canvasPaint=new WeakMap(),canvasSize=new WeakMap(),imageCache=new Map();
const numeric=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value.toLowerCase():fallback;
function dimensions(canvas,pixelRatio){
 if(pixelRatio!==undefined){
  let size=canvasSize.get(canvas);
  if(!size||canvas.width!==size.width||canvas.height!==size.height)size={baseWidth:canvas.width,baseHeight:canvas.height};
  const ratio=pixelRatio==='auto'?(globalThis.devicePixelRatio||1):pixelRatio;
  const factor=numeric(ratio,1,1,2),width=Math.max(1,Math.round(size.baseWidth*factor)),height=Math.max(1,Math.round(size.baseHeight*factor));
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  Object.assign(size,{width,height});canvasSize.set(canvas,size);
 }
 return{width:canvas.width,height:canvas.height};
}
function gesture(settings){
 const points=[];
 for(let i=0;i<=80;i++){const t=i/80;points.push({x:28+184*t,y:48+12*Math.sin((t-.5)*Math.PI*2),time:i*10,pressure:1,finish:i===80});}
 return{number:1,layerId:'sample-layer',operation:'paint',settings,tool:{mode:'none'},points};
}
function draw(canvas,settings,blending,pixelRatio){
 const{width,height}=dimensions(canvas,pixelRatio);if(!width||!height)return canvas;
 const signature=JSON.stringify([width,height,settings,blending]);
 if(canvasPaint.get(canvas)===signature)return canvas;
 const ctx=canvas.getContext('2d');let data=imageCache.get(signature);
 if(!data){
  const resolution=Math.min(width/WIDTH,height/HEIGHT),originX=-(width/resolution-WIDTH)/2,originY=-(height/resolution-HEIGHT)/2;
  const frame={id:'sample-frame',name:'Sample',x:0,y:0,width:WIDTH,height:HEIGHT,background:null};
  const layer={id:'sample-layer',name:'Sample',frameId:frame.id,kind:'paint',visible:true,locked:false,opacity:1,filters:[],...(blending?{blending}:{} )};
  const rendered=renderLayerDocument(canvas,[gesture(settings)],SCENE,[layer],{infinite:true,resolution,originX,originY,logicalWidth:WIDTH,logicalHeight:HEIGHT,frame});
  data=rendered.image.data.slice();
  if(imageCache.size>=96)imageCache.delete(imageCache.keys().next().value);
  imageCache.set(signature,data);
 }else{
  const image=ctx.createImageData(width,height);image.data.set(data);ctx.putImageData(image,0,0);
 }
 canvasPaint.set(canvas,signature);return canvas;
}
function paintSettings(preset,options){
 return{brush:'basic',tip:options.tip||preset.tip||'round',width:numeric(options.width,preset.width||20,1,100),hardness:numeric(options.hardness,preset.hardness??100,0,100),inkOpacity:numeric(options.inkOpacity,preset.inkOpacity??100,0,100),angle:numeric(options.angle,preset.angle||0,0,360),variation:numeric(options.variation,0,0,100),speed:0,primary:color(options.primary||options.color,'#8795a8'),shadow:color(options.shadow,'#10141b'),contrast:color(options.contrast,'#eff5ff')};
}
export function renderBrushSample(canvas,preset=BRUSH_PRESETS[0],options={}){
 const source=typeof preset==='string'?brushPreset(preset):preset||BRUSH_PRESETS[0];
 return draw(canvas,paintSettings(source,options),null,options.pixelRatio);
}
export function renderMaterialSample(canvas,material='none',settings={}){
 const id=typeof material==='string'?material:material?.id||'none';
 const parameters=Object.fromEntries(Object.keys(DEFAULT_BLENDING).filter(key=>key!=='material'&&settings[key]!==undefined).map(key=>[key,settings[key]]));
 const blending=normalizeBlending({...parameters,material:id});
 for(const key of ['primary','shadow','contrast'])if(settings[key]!==undefined)blending[key]=color(settings[key],key==='primary'?'#8795a8':key==='shadow'?'#10141b':'#eff5ff');
 const stroke=paintSettings({tip:'round',width:42,hardness:100,inkOpacity:100,angle:0},{primary:settings.primary||settings.color});
 return draw(canvas,stroke,blending,settings.pixelRatio);
}
