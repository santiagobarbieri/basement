import {MIN_FRAME_SIZE,MAX_FRAME_SIZE} from './endo-model.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const size=value=>Math.round(clamp(value,MIN_FRAME_SIZE,MAX_FRAME_SIZE));
const bounds=frame=>({x:frame.x,y:frame.y,width:frame.width,height:frame.height});
const directions={nw:[-1,-1],n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0]};

// Bounds are always derived from the start of the gesture, never the last preview.
export function moveFrameBounds(frame,dx,dy,{shiftKey=false}={}){
 if(shiftKey){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}
 return {...bounds(frame),x:clamp(Math.round(frame.x+dx),-1e7,1e7),y:clamp(Math.round(frame.y+dy),-1e7,1e7)};
}

export function resizeFrameBounds(frame,handle,dx,dy,{shiftKey=false,altKey=false}={}){
 const direction=directions[handle];if(!direction)throw Error('Invalid artboard resize handle.');
 const [hx,hy]=direction,multiple=altKey?2:1;
 let width=hx?frame.width+hx*dx*multiple:frame.width;
 let height=hy?frame.height+hy*dy*multiple:frame.height;
 if(shiftKey){
  const wx=width/frame.width,hyScale=height/frame.height;
  let ratio=hx&&hy?(Math.abs(wx-1)>=Math.abs(hyScale-1)?wx:hyScale):hx?wx:hyScale;
  ratio=clamp(ratio,Math.max(MIN_FRAME_SIZE/frame.width,MIN_FRAME_SIZE/frame.height),Math.min(MAX_FRAME_SIZE/frame.width,MAX_FRAME_SIZE/frame.height));
  width=Math.round(frame.width*ratio);height=Math.round(frame.height*ratio);
 }else{width=size(width);height=size(height);}
 // An untouched axis stays centered when proportional resizing derives its size.
 const x=altKey||!hx?frame.x+(frame.width-width)/2:hx<0?frame.x+frame.width-width:frame.x;
 const y=altKey||!hy?frame.y+(frame.height-height)/2:hy<0?frame.y+frame.height-height:frame.y;
 return {x,y,width,height};
}
