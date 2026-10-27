// No imports: the same functions are embedded verbatim into the exported HTML.
export function warp(p,bath,motion,seconds=0,inverse=false){
 if(!motion.enabled||!motion.amount)return {x:p.x,y:p.y};
 const phase=((seconds%motion.duration)+motion.duration)%motion.duration/motion.duration*Math.PI*2,k=Math.PI*2/motion.wavelength,a=motion.amount*Math.sin(phase),b=motion.amount*.65*Math.sin(phase*2);
 if(inverse){const y=p.y-b*Math.sin(k*p.x+1.2),x=p.x-a*Math.sin(k*y);return {x,y};}
 const x=p.x+a*Math.sin(k*p.y),y=p.y+b*Math.sin(k*x+1.2);return {x,y};
}
export function drawMarble(ctx,state,width,height,seconds=0,fit='contain',camera=null){
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
 const scale=camera?.scale??(fit==='cover'?Math.max(width/state.bath.width,height/state.bath.height):Math.min(width/state.bath.width,height/state.bath.height)),x=camera?.x??(width-state.bath.width*scale)/2,y=camera?.y??(height-state.bath.height*scale)/2;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.beginPath();ctx.rect(0,0,state.bath.width,state.bath.height);ctx.clip();ctx.fillStyle=state.bath.paper;ctx.fillRect(0,0,state.bath.width,state.bath.height);
 for(const shape of state.shapes){ctx.beginPath();shape.points.forEach((v,i)=>{const p=warp(v,state.bath,state.motion,seconds);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=shape.ink||state.palette[shape.color];ctx.fill();}ctx.restore();
}
export function mountMarble(canvas,state,fit='cover'){
 const ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),observer=new IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);}),resize=new ResizeObserver(size);let frame=0,last=0,time=0,inView=true,destroyed=false;
 function size(){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));drawMarble(ctx,state,canvas.width,canvas.height,reduce.matches?0:time,fit);}
 function tick(now){if(destroyed)return;frame=requestAnimationFrame(tick);if(!document.hidden&&inView&&!reduce.matches&&state.motion.enabled){if(last)time+=(now-last)/1000;drawMarble(ctx,state,canvas.width,canvas.height,time,fit);}last=now;}
 const visibility=()=>{last=0;};document.addEventListener('visibilitychange',visibility);resize.observe(canvas);observer.observe(canvas);size();frame=requestAnimationFrame(tick);
 return ()=>{destroyed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);};
}
