import {dimensions,pngDimensions} from './geometry.js';
import {traceMask,simplify,area,jitterPoint,cleanMask,fillSmallHoles} from './contours.js';
let imageId,image,cache,foreground,foregroundData;
const canvas=(w,h)=>{if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c};
export async function renderModel(state,maximum=1000,outputSize=null){
 if(!state.source)throw Error('Cargá una imagen');
 if(imageId!==state.source.id){image?.close();image=await createImageBitmap(await(await fetch(state.source.data)).blob());imageId=state.source.id;cache=null;foreground?.close();foreground=null;foregroundData=null;}
 const size=dimensions(state),factor=Math.min(1,maximum/Math.max(size.width,size.height));
 const target=outputSize||(maximum===Infinity?pngDimensions(state):{width:Math.max(1,Math.round(size.width*factor)),height:Math.max(1,Math.round(size.height*factor))});
 const output=canvas(target.width,target.height),ctx=output.getContext('2d'),settings=state.contour;
 if(state.shared.background==='color'){ctx.fillStyle=state.colors.shadow;ctx.fillRect(0,0,target.width,target.height)}
 if(!state.output||state.shared.background==='image')ctx.drawImage(image,0,0,target.width,target.height);
 if(!state.output)return {canvas:output,...size};
 const key=[imageId,settings.mask,settings.threshold,settings.roughness,settings.figures,!!state.source.foreground].join(':');
 if(cache?.key!==key){
 const scale=Math.min(1,1000/Math.max(size.width,size.height)),w=Math.max(1,Math.round(size.width*scale)),h=Math.max(1,Math.round(size.height*scale));
 const source=canvas(w,h),context=source.getContext('2d');if(state.source.foreground&&foregroundData!==state.source.foreground){foreground?.close();foreground=await createImageBitmap(await(await fetch(state.source.foreground)).blob());foregroundData=state.source.foreground;}
 const useForeground=foreground&&['auto','foreground'].includes(settings.mask);context.drawImage(useForeground?foreground:image,0,0,w,h);const pixels=context.getImageData(0,0,w,h).data;
 let alpha=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]<250){alpha=true;break}
 const useAlpha=useForeground||settings.mask==='alpha'||settings.mask==='auto'&&alpha,mask=new Uint8Array(w*h),threshold=settings.threshold/100;
 for(let i=0;i<mask.length;i++){const j=i*4;mask[i]=useAlpha?Number(pixels[j+3]/255>=threshold):Number(pixels[j+3]>127&&(.2126*pixels[j]+.7152*pixels[j+1]+.0722*pixels[j+2])/255<threshold);}
 const cleaned=cleanMask(mask,w,h,settings.figures==='main');
 const paths=traceMask(useForeground?fillSmallHoles(cleaned,w,h):cleaned,w,h).filter(p=>Math.abs(area(p))>=4).map(p=>simplify(p,Math.max(.25,settings.roughness*.15*scale)).map(p=>({x:p.x/scale,y:p.y/scale})));
 cache={key,paths};
 }
 ctx.scale(target.width/size.width,target.height/size.height);ctx.fillStyle=state.colors.primary;ctx.strokeStyle=state.colors.contrast;ctx.lineWidth=settings.stroke;ctx.lineJoin='round';ctx.lineCap='round';
 const frame=Math.floor((state.motionTime??0)*settings.fps/1000)%(settings.fps*2);let vertex=0,label=0;const labels=[];
 ctx.beginPath();for(const path of cache.paths){const moved=path.map(p=>jitterPoint(p,vertex++,frame,settings.seed,settings.jitter));moved.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(settings.labels&&area(path)>0){let x=0,y=0;const signedArea=area(path);for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length],cross=a.x*b.y-b.x*a.y;x+=(a.x+b.x)*cross;y+=(a.y+b.y)*cross}labels.push({x:x/(6*signedArea),y:y/(6*signedArea),text:String.fromCharCode(65+label++%26)})}}
 if(settings.fill)ctx.fill('evenodd');if(settings.stroke>0)ctx.stroke();
 ctx.fillStyle=state.colors.contrast;ctx.font=`600 ${settings.labelSize}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';for(const label of labels)ctx.fillText(label.text,label.x,label.y);
 return {canvas:output,...size};
}
