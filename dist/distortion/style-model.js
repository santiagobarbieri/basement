// One document-wide visual language. Fragments only override numeric/texture controls.
export const styleDefaults=()=>({version:1,colorMode:'palette',background:'#f1f0e6',backdrop:'paper',brightness:0,contrast:1,threshold:.5,size:12,scale:1,charset:'classic',density:1});
export const paletteDefaults=()=>({colors:[{color:'#171717',weight:100,enabled:true}]});
export const OVERRIDE_KEYS=['brightness','contrast','threshold','size','scale','charset','density','motionEnabled','jitterAmount','motionSpeed'];
export function upgradeStyle(s){
 for(const f of s.fragments)f.type=({dither:'halftone',lines:'halftone',duotone:'pixel',invert:'pixel',solid:'pixel'})[f.type]||f.type;
 if(s.style?.version===1)return s;
 const oldPalette=s.palette?.colors?.length?s.palette.colors:s.fragments.find(f=>f.params.palette?.length)?.params.palette;
 s.style={...styleDefaults(),colorMode:s.randomizer?.originalColors||s.collage?.palette==='source'?'source':'palette'};s.palette={colors:structuredClone(oldPalette?.some(c=>c.enabled&&c.weight>0)?oldPalette:paletteDefaults().colors)};
 s.motion={enabled:false,amount:3,fps:12,speed:1,...s.motion};
 for(const f of s.fragments){f.overrides||={};for(const key of ['motionEnabled','jitterAmount'])if(f.params[key]!==undefined)f.overrides[key]=f.params[key];}
 return s;
}
export function resolveTreatment(s,f){
 const style={...styleDefaults(),...s.style},local=f.overrides||{};if(f.protected){style.brightness=0;style.contrast=1;}
 const colors=(s.palette?.colors||paletteDefaults().colors).filter(c=>c.enabled&&c.weight>0);
 return {...style,...local,...(f.protected?{brightness:0,contrast:1}:{}),size:local.size??style.size,unified:true,
  colors,foreground:colors[0]?.color||'#171717',levels:0,originalColors:style.colorMode==='source',sampledBackground:false};
}
export function setAdjustment(s,fragments,key,value){
 if(!OVERRIDE_KEYS.includes(key))throw Error('Ajuste inválido');
 if(fragments)for(const f of fragments){if(f.locked||f.protected||f.deleted)continue;f.overrides={...f.overrides,[key]:value};}
 else if(['motionEnabled','jitterAmount','motionSpeed'].includes(key))s.motion={enabled:false,amount:3,fps:12,speed:1,...s.motion,[{motionEnabled:'enabled',jitterAmount:'amount',motionSpeed:'speed'}[key]]:value};
 else s.style={...styleDefaults(),...s.style,[key]:value};
}
export function tonal(value,p){return Math.max(0,Math.min(1,(value-.5)*(p.contrast??1)+.5+(p.brightness??0)));}
export function paletteRGB(rgb,p){
 if(p.colorMode==='source')return rgb;
 const colors=p.colors?.filter(c=>c.enabled&&c.weight>0)||[];if(!colors.length)return [23,23,23];
 let best=Infinity,result;
 for(const c of colors){const candidate=[1,3,5].map(i=>parseInt(c.color.slice(i,i+2),16)),distance=candidate.reduce((n,v,k)=>n+(v-rgb[k])**2,0)/(.5+c.weight/100);if(distance<best){best=distance;result=candidate;}}
 return result;
}
