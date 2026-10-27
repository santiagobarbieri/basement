import {hash} from './model.js';

// A periodic, spatially correlated oscillation around each source point.
// The anchor never moves; amplitude is capped by the local feature size.
export function anchoredPoint(p,motion={},featureSize=12,box=null,normal=null,strength=1){
 const requested=Math.max(0,motion.amount||0),limit=Math.min(requested,Math.max(0,featureSize)*.22)*(0.35+0.65*Math.min(1,requested/20))*strength;
 if(!limit)return {...p};
 const time=motion.time??((motion.frame||0)/(motion.fps||12)),phase=Math.PI*time*(motion.speed||1);
 const spatial=(axis)=>{
  const x=p.x/48,y=p.y/48,ix=Math.floor(x),iy=Math.floor(y),ease=t=>t*t*(3-2*t),u=ease(x-ix),v=ease(y-iy);
  const at=(dx,dy)=>hash(motion.seed||1,`${ix+dx}:${iy+dy}:${axis}`)*Math.PI*2;
  // Interpolate oscillations, not angles, so neighboring features stay coherent.
  const sample=(dx,dy)=>Math.sin(phase+at(dx,dy))*.78+Math.sin(phase*2+at(dx,dy)*.7)*.22;
  return (sample(0,0)*(1-u)+sample(1,0)*u)*(1-v)+(sample(0,1)*(1-u)+sample(1,1)*u)*v;
 };
 let taper=1;
 if(box){const distance=Math.max(0,Math.min(p.x-box.x,box.right-p.x,p.y-box.y,box.bottom-p.y));taper=Math.min(1,distance/Math.max(1,featureSize));}
 const amount=limit*taper;
 if(normal){const n=Math.hypot(normal.x,normal.y)||1,offset=spatial('normal')*amount;return {x:p.x+normal.x/n*offset,y:p.y+normal.y/n*offset};}
 return {x:p.x+spatial('x')*amount/Math.SQRT2,y:p.y+spatial('y')*amount/Math.SQRT2};
}
export const motionSettings=(state,f)=>{
 const local=state.style?f.overrides||{}:f.params;
 return {enabled:!f.locked&&!f.protected&&(local.motionEnabled??state.motion?.enabled??false),amount:local.jitterAmount??state.motion?.amount??3,fps:state.motion?.fps||12,speed:local.motionSpeed??state.motion?.speed??1,seed:state.seed};
};
export const hasMotion=state=>state.fragments.some(f=>!f.deleted&&['contour','ascii','halftone'].includes(f.type)&&motionSettings(state,f).enabled&&motionSettings(state,f).amount>0);
