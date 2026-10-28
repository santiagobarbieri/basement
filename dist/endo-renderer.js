import { ChromeSurface, StrokeBuilder } from './engine.js';
import { symmetrySurface } from './symmetry.js';
import { applyFilters } from './endo-filters.js';

const legacyLayer = { id:'layer-1', name:'Layer 1', kind:'paint', visible:true, locked:false, opacity:1, filters:[] };
const isAdjustment = layer => layer.kind === 'adjustment';
const shown = layer => layer.visible !== false && Number(layer.opacity ?? 1) > 0;
const amountOf = layer => Math.max(0, Math.min(1, Number(layer.opacity ?? 1)));
function rasterCanvas(width, height) {
 const context={clearRect(){},putImageData(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}}};
 return {width,height,getContext(){return context}};
}
function presentationCanvas(width,height){
 if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(width,height);
 if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
 return rasterCanvas(width,height);
}
function intersection(a,b){
 if(!a)return b?{...b}:null;if(!b)return{...a};
 const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);
 return{x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
}
function strokeTarget(surface,stroke,index,frame,onChange=()=>{}){
 const settingsFor=settings=>{
  const clip=intersection(frame,settings.clipRect);
  if(clip&&(!clip.width||!clip.height))return null;
  return{...settings,...(clip?{clipRect:clip}:{}),...(stroke.operation==='erase'?{operation:'erase'}:{})};
 };
 return {
  logicalWidth:surface.logicalWidth,logicalHeight:surface.logicalHeight,w:surface.w,h:surface.h,
  set paintId(id){surface.paintId=id;},
  dab(x,y,radius,relief,settings){const q=settingsFor(settings);if(!q)return;surface.paintId=index;surface.dab(x,y,radius,relief,q);onChange();},
  segment(a,b,ra,rb,settings){const q=settingsFor(settings);if(!q)return;surface.paintId=index;surface.segment(a,b,ra,rb,q);onChange();}
 };
}
function filterCoordinates(view){
 const frame=view.frame||view.options?.frame;
 return frame?{resolution:view.resolution||1,originX:(view.originX||0)-frame.x,originY:(view.originY||0)-frame.y}:view;
}
function paintFilters(pixels,width,height,layer,layers,view){
 let result=layer.filters?.some(filter=>filter.enabled!==false)?applyFilters(pixels,width,height,layer.filters,filterCoordinates(view)):pixels;
 // Earlier per-layer effects migrate as clipped adjustment layers. They keep
 // the original appearance until the user moves them into the common stack.
 for(const adjustment of layers){
  if(isAdjustment(adjustment)&&adjustment.clipToLayerId===layer.id&&shown(adjustment))result=adjusted(result,width,height,adjustment,view);
 }
 return result;
}
function adjusted(pixels,width,height,layer,view){
 if(!layer.filter||layer.filter.enabled===false||!shown(layer))return pixels;
 const result=applyFilters(pixels,width,height,[layer.filter],filterCoordinates(view)),opacity=amountOf(layer);
 if(opacity===1)return result;
 for(let i=0;i<result.length;i+=4)for(let c=0;c<3;c++)result[i+c]=pixels[i+c]+(result[i+c]-pixels[i+c])*opacity;
 return result;
}
function composite(output,pixels,opacity,owner,surface){
 for(let index=0;index<output.length;index+=4){
  const sourceAlpha=pixels[index+3]/255*opacity;if(!sourceAlpha)continue;
  const destinationAlpha=output[index+3]/255,alpha=sourceAlpha+destinationAlpha*(1-sourceAlpha);
  for(let c=0;c<3;c++)output[index+c]=(pixels[index+c]*sourceAlpha+output[index+c]*destinationAlpha*(1-sourceAlpha))/alpha;
  output[index+3]=Math.round(alpha*255);
  if(owner){const p=index/4;owner[p]=surface.owner[p];}
 }
}
function paperBehind(image,background){
 if(!/^#[0-9a-f]{6}$/i.test(background||''))return;
 const rgb=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16));
 for(let i=0;i<image.length;i+=4){const alpha=image[i+3]/255;for(let c=0;c<3;c++)image[i+c]=image[i+c]*alpha+rgb[c]*(1-alpha);image[i+3]=255;}
}

// One bounded frame owns its layer rasters. Full-quality export uses the
// sequential renderer below rather than keeping one raster for every layer.
export class LayeredSurface {
 constructor(canvas,options={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.w=canvas.width;this.h=canvas.height;this.options=options;
  this.infinite=options.infinite===true;this.resolution=options.resolution||1;this.originX=options.originX||0;this.originY=options.originY||0;
  this.logicalWidth=options.logicalWidth||this.w/this.resolution;this.logicalHeight=options.logicalHeight||this.h/this.resolution;
  this.owner=new Int32Array(this.w*this.h);this.owner.fill(-1);this.height=new Float32Array(this.w*this.h);this.coverage=new Float32Array(this.w*this.h);
  this.image=this.ctx.createImageData(this.w,this.h);this.rasters=new Map();this.strokes=[];this.layers=[legacyLayer];this.compositionDirty=true;
  this.setDocument([],this.layers);
 }
 get bounds(){return this.compositionDirty||[...this.rasters.values()].some(item=>item.surface.bounds)?[0,0,this.w-1,this.h-1]:null;}
 setDocument(strokes,layers){
  this.strokes=strokes;this.layers=Array.isArray(layers)&&layers.length?layers:[legacyLayer];
  const signature=JSON.stringify(this.layers);if(signature!==this.layerSignature)this.compositionDirty=true;this.layerSignature=signature;
  const ids=new Set(this.layers.filter(layer=>!isAdjustment(layer)&&shown(layer)).map(layer=>layer.id));
  for(const id of this.rasters.keys())if(!ids.has(id))this.rasters.delete(id);
 }
 rasterFor(id){if(!this.rasters.has(id)){this.rasters.set(id,{surface:new ChromeSurface(rasterCanvas(this.w,this.h),this.options)});this.compositionDirty=true;}return this.rasters.get(id);}
 clear(){
  for(const entry of this.rasters.values()){entry.surface.clear();entry.filtered=undefined;entry.filterSignature=undefined;}
  this.owner.fill(-1);this.height.fill(0);this.coverage.fill(0);this.image.data.fill(0);this.ctx.clearRect(0,0,this.w,this.h);this.compositionDirty=true;
 }
 strokeSurface(stroke,index){
  const layerId=stroke.layerId||this.layers[0].id,layer=this.layers.find(item=>item.id===layerId)||this.layers.find(item=>!isAdjustment(item));
  if(!layer||isAdjustment(layer))return strokeTarget(this.rasterFor('__unused').surface,{...stroke,operation:'erase'},index,{x:0,y:0,width:0,height:0});
  return strokeTarget(this.rasterFor(layer.id).surface,stroke,index,this.options.frame,()=>{this.compositionDirty=true;});
 }
 render(scene,materials,all=false){
  this.setDocument(this.strokes,this.layers);if(!all&&!this.bounds)return;
  for(const entry of this.rasters.values()){entry.changed=all||!!entry.surface.bounds;entry.surface.render(scene,materials,all);}
  let output=this.image.data;output.fill(0);this.owner.fill(-1);this.height.fill(0);this.coverage.fill(0);
  for(const layer of this.layers){
   if(!shown(layer))continue;
   if(isAdjustment(layer)){
    if(!layer.clipToLayerId){const filtered=adjusted(output,this.w,this.h,layer,this);if(filtered!==output)output.set(filtered);}
    continue;
   }
   const entry=this.rasters.get(layer.id);if(!entry)continue;
   const filters=JSON.stringify([layer.filters||[],this.layers.filter(item=>isAdjustment(item)&&item.clipToLayerId===layer.id)]);
   if(entry.changed||entry.filterSignature!==filters){entry.filtered=paintFilters(entry.surface.image.data,this.w,this.h,layer,this.layers,this);entry.filterSignature=filters;}
   const pixels=entry.filtered||entry.surface.image.data;composite(output,pixels,amountOf(layer),this.owner,entry.surface);
  }
  const surfaces=this.strokes.map(stroke=>this.rasters.get(stroke.layerId||this.layers[0]?.id)?.surface);
  for(let i=0;i<this.owner.length;i++){this.coverage[i]=output[i*4+3]/255;const surface=surfaces[this.owner[i]];if(surface)this.height[i]=surface.height[i];}
  this.ctx.putImageData(this.image,0,0);this.compositionDirty=false;
 }
}

// Effects are real entries in this ordered stack. An adjustment processes the
// accumulated content below it, so moving it changes what receives the effect.
export function renderLayerDocument(canvas,strokes,scene,layers,options={}){
 const list=(Array.isArray(layers)&&layers.length?layers:[legacyLayer]).filter(layer=>!options.frame||!layer.frameId||layer.frameId===options.frame.id);
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height),surface=new ChromeSurface(rasterCanvas(canvas.width,canvas.height),options);
 const materials=strokes.map(stroke=>stroke.settings),filterView={resolution:surface.resolution,originX:surface.originX,originY:surface.originY,frame:options.frame};
 for(const layer of list){
  if(!shown(layer))continue;
  if(isAdjustment(layer)){if(!layer.clipToLayerId){const filtered=adjusted(image.data,canvas.width,canvas.height,layer,filterView);if(filtered!==image.data)image.data.set(filtered);}continue;}
  surface.clear();
  strokes.forEach((stroke,index)=>{
   if(!stroke.points?.length||(stroke.layerId||list.find(item=>!isAdjustment(item))?.id)!==layer.id)return;
   const target=symmetrySurface(strokeTarget(surface,stroke,index,options.frame),stroke.tool,stroke.points[0]),builder=new StrokeBuilder(target,{...stroke.settings,...scene},index);
   for(const point of stroke.points)builder.add(point,point.finish);
  });
  surface.render(scene,materials);
  const pixels=paintFilters(surface.image.data,canvas.width,canvas.height,layer,list,filterView);composite(image.data,pixels,amountOf(layer));
 }
 paperBehind(image.data,options.frame?.background);ctx.putImageData(image,0,0);return{canvas,ctx,image};
}

const pointHashes=new WeakMap(),floatBytes=new DataView(new ArrayBuffer(8));
function pointsKey(points){
 if(!points?.length)return '0';
 const first=points[0],last=points.at(-1),firstKey=[first.x,first.y,first.time,first.pressure,first.finish].join(','),lastKey=[last.x,last.y,last.time,last.pressure,last.finish].join(',');
 let entry=pointHashes.get(points);
 if(!entry||entry.count>points.length||entry.first!==firstKey||(entry.count===points.length&&entry.last!==lastKey))entry={count:0,hash:2166136261,first:firstKey};
 for(let i=entry.count;i<points.length;i++){
  const point=points[i];for(const value of [point.x,point.y,point.time,point.pressure,point.finish?1:0]){floatBytes.setFloat64(0,value||0,true);entry.hash=Math.imul(entry.hash^floatBytes.getUint32(0,true),16777619);entry.hash=Math.imul(entry.hash^floatBytes.getUint32(4,true),16777619);}
 }
 entry.count=points.length;entry.last=lastKey;pointHashes.set(points,entry);return points.length+':'+(entry.hash>>>0);
}
function sourceKey(strokes,layers,frame,scene){
 const ids=new Set(layers.map(layer=>layer.id));
 return JSON.stringify([frame,layers,scene,strokes.filter(stroke=>ids.has(stroke.layerId)).map(stroke=>[stroke.number,stroke.layerId,stroke.operation,stroke.settings,stroke.tool,pointsKey(stroke.points)])]);
}

// Only the frame being edited owns interactive layer rasters. Other frames are
// tiny flattened previews, independent of viewport size and never refined.
export class FrameSurface {
 constructor(canvas,options={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.options=options;this.entries=new Map();this.frames=[];this.layers=[];this.strokes=[];this.activeFrameId=null;this.scene=null;this.compositionDirty=true;
  this.setView(options,canvas.width,canvas.height);
 }
 setView(view={},width=this.canvas.width,height=this.canvas.height){
  this.resolution=view.resolution||this.resolution||1;this.originX=view.originX??this.originX??0;this.originY=view.originY??this.originY??0;
  this.infinite=true;this.logicalWidth=960;this.logicalHeight=850;
  if(width!==this.canvas.width)this.canvas.width=width;if(height!==this.canvas.height)this.canvas.height=height;
  if(this.w!==width||this.h!==height){this.w=width;this.h=height;this.owner=new Int32Array(width*height);this.height=new Float32Array(width*height);this.coverage=new Float32Array(width*height);this._image=this.ctx.createImageData(width,height);}
  this.owner.fill(-1);this.compositionDirty=true;
 }
 get image(){if(this.fastComposite&&this.ctx.getImageData)return this.ctx.getImageData(0,0,this.w,this.h);return this._image;}
 get bounds(){return this.compositionDirty||[...this.entries.values()].some(entry=>entry.incremental||entry.needsReplay||entry.inner?.bounds)?[0,0,this.w-1,this.h-1]:null;}
 get qualityInfo(){return[...this.entries.values()].map(entry=>({frameId:entry.frame.id,active:entry.active,width:entry.width,height:entry.height,resolution:entry.resolution,paintLayers:entry.paintCount,renders:entry.renders}));}
 setDocument(strokes,layers,frames=this.frames,activeFrameId=this.activeFrameId){
  this.strokes=strokes;this.layers=Array.isArray(layers)&&layers.length?layers:[legacyLayer];
  this.frames=Array.isArray(frames)&&frames.length?frames:[{id:'frame-1',name:'Frame 1',x:0,y:0,width:960,height:850,background:null}];
  this.activeFrameId=activeFrameId&&this.frames.some(frame=>frame.id===activeFrameId)?activeFrameId:this.frames[0].id;
  const ids=new Set(this.frames.map(frame=>frame.id));for(const id of this.entries.keys())if(!ids.has(id))this.entries.delete(id);
  const signature=JSON.stringify([this.frames,this.layers,this.activeFrameId]);if(signature!==this.documentSignature)this.compositionDirty=true;this.documentSignature=signature;
 }
 frameLayers(frame){return this.layers.filter(layer=>!layer.frameId?frame.id===this.frames[0].id:layer.frameId===frame.id);}
 ensureEntry(frame){
  const active=frame.id===this.activeFrameId,layers=this.frameLayers(frame);
  const paintCount=Math.max(1,layers.filter(layer=>!isAdjustment(layer)&&shown(layer)).length);
  let resolution=active?Math.max(.001,Math.min(this.resolution*.65,Math.sqrt(1_200_000/(frame.width*frame.height*paintCount)))):Math.min(1,96/Math.max(frame.width,frame.height));
  let width=Math.max(1,Math.ceil(frame.width*resolution)),height=Math.max(1,Math.ceil(frame.height*resolution));
  while(active&&width*height*paintCount>1_200_000){resolution*=.995;width=Math.max(1,Math.ceil(frame.width*resolution));height=Math.max(1,Math.ceil(frame.height*resolution));}
  let entry=this.entries.get(frame.id);
  if(!entry||entry.active!==active||entry.width!==width||entry.height!==height||entry.frame.x!==frame.x||entry.frame.y!==frame.y){
   const canvas=presentationCanvas(width,height),view={infinite:true,resolution,originX:frame.x,originY:frame.y,logicalWidth:960,logicalHeight:850,frame:{...frame}};
   entry={canvas,inner:active?new LayeredSurface(canvas,view):null,frame:{...frame},active,width,height,resolution,paintCount,needsReplay:true,incremental:false,renders:entry?.renders||0};this.entries.set(frame.id,entry);this.compositionDirty=true;
  }
  entry.layers=layers;entry.frame={...frame};entry.paintCount=paintCount;
  if(entry.inner){entry.inner.options.frame={...frame};entry.inner.setDocument(this.strokes,layers);}
  return entry;
 }
 replay(entry,scene,skip=-1){
  const options={infinite:true,resolution:entry.resolution,originX:entry.frame.x,originY:entry.frame.y,logicalWidth:960,logicalHeight:850,frame:entry.frame};
  if(entry.inner){
   entry.inner.clear();entry.inner.setDocument(this.strokes,entry.layers);
   const visible=new Set(entry.layers.filter(layer=>!isAdjustment(layer)&&shown(layer)).map(layer=>layer.id));
   this.strokes.forEach((stroke,index)=>{if(index===skip||!stroke.points?.length||!visible.has(stroke.layerId))return;const builder=new StrokeBuilder(symmetrySurface(entry.inner.strokeSurface(stroke,index),stroke.tool,stroke.points[0]),{...stroke.settings,...scene},index);for(const point of stroke.points)builder.add(point,point.finish);});
   entry.inner.render(scene,this.strokes.map(stroke=>stroke.settings),true);paperBehind(entry.inner.image.data,entry.frame.background);entry.inner.ctx.putImageData(entry.inner.image,0,0);entry.pixels=entry.inner.image.data;
  }else{
   const rendered=renderLayerDocument(entry.canvas,this.strokes,scene,entry.layers,options);entry.pixels=rendered.image.data;
  }
  entry.sourceKey=sourceKey(this.strokes,entry.layers,entry.frame,scene);entry.needsReplay=false;entry.incremental=false;entry.renders++;
 }
 rebuild(strokes,scene,layers){
  this.setDocument(strokes,layers);this.scene=scene;
  for(const frame of this.frames){const entry=this.ensureEntry(frame),key=sourceKey(strokes,entry.layers,frame,scene);if(entry.needsReplay||entry.sourceKey!==key)this.replay(entry,scene);}
  this.compositionDirty=true;
 }
 strokeSurface(stroke,index){
  const layer=this.layers.find(item=>item.id===stroke.layerId),frame=this.frames.find(item=>item.id===(layer?.frameId||this.activeFrameId))||this.frames.find(item=>item.id===this.activeFrameId);
  const entry=this.ensureEntry(frame);if(!entry.active||!entry.inner)throw Error('Activate the frame before drawing.');
  if(entry.needsReplay)this.replay(entry,this.scene||{merge:2,light:225,relief:.8,smooth:45,shine:75,grain:12},index);
  const target=entry.inner.strokeSurface(stroke,index),document=this;
  return{logicalWidth:target.logicalWidth,logicalHeight:target.logicalHeight,w:target.w,h:target.h,set paintId(id){target.paintId=id;},dab(...args){target.dab(...args);entry.incremental=true;document.compositionDirty=true;},segment(...args){target.segment(...args);entry.incremental=true;document.compositionDirty=true;}};
 }
 clear(){for(const entry of this.entries.values()){entry.needsReplay=true;entry.incremental=false;}this.owner.fill(-1);this.ctx.clearRect(0,0,this.w,this.h);this.compositionDirty=true;}
 render(scene,materials,all=false){
  this.scene=scene;
  for(const frame of this.frames){
   const entry=this.ensureEntry(frame),key=sourceKey(this.strokes,entry.layers,frame,scene);
   if(entry.incremental&&entry.inner){entry.inner.render(scene,materials,all);paperBehind(entry.inner.image.data,frame.background);entry.inner.ctx.putImageData(entry.inner.image,0,0);entry.pixels=entry.inner.image.data;entry.sourceKey=key;entry.incremental=false;entry.needsReplay=false;entry.renders++;}
   else if(entry.needsReplay||entry.sourceKey!==key)this.replay(entry,scene);
  }
  this.composite();this.compositionDirty=false;
  if(this.canvas.dataset)this.canvas.dataset.frameQuality=JSON.stringify(this.qualityInfo);
 }
 composite(){
  this.owner.fill(-1);this.coverage.fill(0);this.height.fill(0);this.fastComposite=typeof this.ctx.drawImage==='function';
  if(this.fastComposite){this.ctx.clearRect(0,0,this.w,this.h);}
  else this._image.data.fill(0);
  const scale=this.resolution;
  for(const frame of this.frames){
   const entry=this.entries.get(frame.id);if(!entry?.pixels)continue;
   const left=(frame.x-this.originX)*scale,top=(frame.y-this.originY)*scale,width=frame.width*scale,height=frame.height*scale;
   const x0=Math.max(0,Math.ceil(left)),y0=Math.max(0,Math.ceil(top)),x1=Math.min(this.w,Math.ceil(left+width)),y1=Math.min(this.h,Math.ceil(top+height));
   if(x1<=x0||y1<=y0)continue;
   if(this.fastComposite){this.ctx.save();this.ctx.beginPath();this.ctx.rect(left,top,width,height);this.ctx.clip();this.ctx.imageSmoothingEnabled=entry.active;this.ctx.drawImage(entry.canvas,left,top,width,height);this.ctx.restore();}
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const sx=Math.min(entry.width-1,Math.max(0,Math.floor((x+.5-left)/width*entry.width))),sy=Math.min(entry.height-1,Math.max(0,Math.floor((y+.5-top)/height*entry.height))),source=sy*entry.width+sx,destination=y*this.w+x,si=source*4,di=destination*4;
    if(!this.fastComposite){const alpha=entry.pixels[si+3]/255,dAlpha=this._image.data[di+3]/255,outAlpha=alpha+dAlpha*(1-alpha);if(outAlpha){for(let c=0;c<3;c++)this._image.data[di+c]=(entry.pixels[si+c]*alpha+this._image.data[di+c]*dAlpha*(1-alpha))/outAlpha;this._image.data[di+3]=Math.round(outAlpha*255);}}
    if(entry.active&&entry.inner){this.owner[destination]=entry.inner.owner[source];this.coverage[destination]=entry.inner.coverage[source];this.height[destination]=entry.inner.height[source];}
   }
  }
  if(!this.fastComposite)this.ctx.putImageData(this._image,0,0);
 }
}

export function rebuildLayers(surface,strokes,scene,layers,frames,activeFrameId){
 if(surface instanceof FrameSurface){if(frames)surface.setDocument(strokes,layers,frames,activeFrameId);surface.rebuild(strokes,scene,layers);return;}
 surface.setDocument(strokes,layers);surface.clear();const visible=new Set(surface.layers.filter(layer=>!isAdjustment(layer)&&shown(layer)).map(layer=>layer.id));
 strokes.forEach((stroke,index)=>{if(!stroke.points?.length||!visible.has(stroke.layerId||surface.layers[0].id))return;const builder=new StrokeBuilder(symmetrySurface(surface.strokeSurface(stroke,index),stroke.tool,stroke.points[0]),{...stroke.settings,...scene},index);for(const point of stroke.points)builder.add(point,point.finish);});
}
