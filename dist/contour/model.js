import {dimensions} from './geometry.js';
export function initialState(){return {source:null,output:true,selectedLayer:'output',shared:{background:'transparent'},colors:{primary:'#ff6b81',contrast:'#201722',shadow:'#f3e8df'},contour:{mask:'auto',figures:'all',threshold:50,roughness:2,jitter:3,fps:12,stroke:2,fill:true,labels:false,labelSize:22,seed:1}};}
export function capture(state){return structuredClone(state)}
export function signature(state){const s=capture(state);delete s.selectedLayer;if(s.source)delete s.source.data;return JSON.stringify(s)}
export function ment(state,{id,name,preview,savedAt=new Date().toISOString()}){return JSON.stringify({format:'basement.ment',version:1,savedAt,artboard:{id,name,studio:'contour',...dimensions(state),preview,layers:[{id:'source',type:'image',image:state.source}],settings:{...state,source:undefined}}})}
