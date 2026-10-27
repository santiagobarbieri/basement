// A new spatial noise field at each tick makes the contour boil in place.
// Frame keys repeat every two seconds, matching the GIF loop.
function hash(x,y,frame,seed) {
  let n=Math.imul(x+seed,374761393)^Math.imul(y+37,668265263)^Math.imul(frame+11,1274126177);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296*2-1;
}
function field(x,y,frame,seed,spacing) {
  const px=x/spacing,py=y/spacing,ix=Math.floor(px),iy=Math.floor(py);
  const ease=t=>t*t*(3-2*t),fx=ease(px-ix),fy=ease(py-iy);
  const top=hash(ix,iy,frame,seed)*(1-fx)+hash(ix+1,iy,frame,seed)*fx;
  const bottom=hash(ix,iy+1,frame,seed)*(1-fx)+hash(ix+1,iy+1,frame,seed)*fx;
  return top*(1-fy)+bottom*fy;
}
export function livePoints(stroke,time) {
  const p=stroke.settings,rate=Math.max(1,p.rate||12),frame=((Math.floor(time*rate/1000)%(2*rate))+(2*rate))%(2*rate);
  const age=Math.max(0,time-(stroke.createdAt??time));
  const decay=p.settle>0?Math.exp(-age/1000*p.settle/100/4):1;
  const amount=(p.amount||0)*decay,rough=(p.roughness||0)/100;
  if(amount<.001)return stroke.points.map(point=>({...point}));
  // Resample long gestures so a straight segment also trembles along its length.
  const points=[];
  stroke.points.forEach((b,i)=>{
    if(!i){points.push({...b});return;}
    const a=stroke.points[i-1],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));
    for(let j=1;j<=steps;j++){
      const t=j/steps;
      points.push({...b,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,time:a.time+(b.time-a.time)*t,pressure:a.pressure+(b.pressure-a.pressure)*t,finish:j===steps&&b.finish===true});
    }
  });
  const seed=(stroke.number||1)*97;
  return points.map(point=>{
    const animation=p.animation || (['antenna','signal','ghost'].includes(p.brush)?p.brush:'antenna');
    const displacement=offset=>field(point.x,point.y,frame,seed+offset,14)*(1-rough)+field(point.x,point.y,frame,seed+offset,4)*rough;
    // Small width changes make the edge feel redrawn rather than translated.
    const pressure=point.pressure*(1+Math.min(.12,amount*.04)*rough*field(point.x,point.y,frame,seed+311,6));
    if(animation==='signal') {
      // Horizontal signal interference varies by scanline rather than brush shape.
      const scan=field(0,point.y,frame,seed,8);
      return {...point,pressure,x:point.x+amount*scan,y:point.y+amount*.2*displacement(173)};
    }
    return {...point,pressure,x:point.x+amount*displacement(0),y:point.y+amount*displacement(173)};
  });
}
