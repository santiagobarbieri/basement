// Brush tips describe marks. Surface materials belong to a layer, never a tip.
export const BRUSH_PRESETS=Object.freeze([
 {id:'round',label:'Round',tip:'round',hardness:100,inkOpacity:100,angle:0,width:20},
 {id:'soft',label:'Soft round',tip:'soft',hardness:15,inkOpacity:100,angle:0,width:42},
 {id:'fine',label:'Fine liner',tip:'round',hardness:100,inkOpacity:100,angle:0,width:3},
 {id:'bold',label:'Bold round',tip:'round',hardness:100,inkOpacity:100,angle:0,width:64},
 {id:'square',label:'Square',tip:'square',hardness:100,inkOpacity:100,angle:0,width:24},
 {id:'chisel',label:'Chisel',tip:'chisel',hardness:100,inkOpacity:100,angle:45,width:32},
 {id:'marker',label:'Marker',tip:'marker',hardness:95,inkOpacity:65,angle:0,width:34},
 {id:'airbrush',label:'Airbrush',tip:'airbrush',hardness:0,inkOpacity:35,angle:0,width:70},
]);
export const BRUSH_TIPS=new Set(['round','soft','square','chisel','marker','airbrush']);
export const brushPreset=id=>BRUSH_PRESETS.find(item=>item.id===id)||BRUSH_PRESETS[0];
export const MATERIALS=Object.freeze([
 {id:'none',label:'None'},{id:'cromo',label:'Chrome'},{id:'relief',label:'Relief'},
 {id:'sand',label:'Magnetic sand'},{id:'crayon',label:'Crayon'},{id:'cement',label:'Cement'},{id:'dust',label:'Powder'},
]);
export const DEFAULT_BLENDING=Object.freeze({material:'none',strength:100,density:65,particleSize:1.5,ridge:55,roughness:40,shine:75,relief:.8,grain:12,light:225});
export function normalizeBlending(value={}) {return {...DEFAULT_BLENDING,...value};}
export function validateBlending(value){
 if(!value||typeof value!=='object'||!MATERIALS.some(item=>item.id===value.material))throw Error('The layer material is invalid.');
 for(const[key,min,max]of [['strength',0,100],['density',0,100],['particleSize',.4,12],['ridge',0,100],['roughness',0,100],['shine',0,100],['relief',.1,2],['grain',0,100],['light',0,360]])if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<min||value[key]>max))throw Error('The layer material settings are invalid.');
 for(const key of ['primary','shadow','contrast'])if(value[key]!==undefined&&!/^#[0-9a-f]{6}$/i.test(value[key]))throw Error('The layer material colors are invalid.');
 return value;
}
