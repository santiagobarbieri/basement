import {SHAPES,validateTypography} from './typography.js';
export const GROUPS={uppercase:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',lowercase:'abcdefghijklmnopqrstuvwxyz',numbers:'0123456789',symbols:'.,:;!?+-=/()[]&@#%',spanish:'ÁÉÍÓÚÜÑáéíóúüñ¿¡'};
export const ALPHABET=Object.values(GROUPS).join('');
export function initialState(){return {columns:5,rows:7,shape:'dots',weight:105,spacing:1,color:'#202020',previewText:'BASEMENT',glyphs:Object.fromEntries([...ALPHABET].map(c=>[c,[]]))};}
export function validate(state){
 if(!state||![state.columns,state.rows].every(v=>Number.isInteger(v)&&v>=3&&v<=20)||!SHAPES.includes(state.shape)||!Number.isFinite(state.weight)||state.weight<10||state.weight>140||!Number.isFinite(state.spacing)||state.spacing<0||state.spacing>5||!/^#[0-9a-f]{6}$/i.test(state.color)||typeof state.previewText!=='string'||state.previewText.length>160||!state.glyphs||typeof state.glyphs!=='object')throw Error('Alfabeto Foundry inválido');
 const keys=Object.keys(state.glyphs);if(keys.length>200)throw Error('Demasiados glifos');for(const c of keys){const cells=state.glyphs[c];if([...c].length!==1||!Array.isArray(cells)||cells.length>state.columns*state.rows||new Set(cells).size!==cells.length||!cells.every(i=>Number.isInteger(i)&&i>=0&&i<state.columns*state.rows))throw Error('Glifo inválido');}
 for(const entry of Object.values(state.overrides||{})){if(entry.shape&&!SHAPES.includes(entry.shape))throw Error('Forma inválida');for(const [key,min,max]of [['weight',10,140],['advance',1,44]])if(entry[key]!==undefined&&(!Number.isFinite(entry[key])||entry[key]<min||entry[key]>max))throw Error('Ajuste de glifo inválido');}
 if(state.tester){const t=state.tester;if(!Number.isFinite(t.size)||t.size<12||t.size>120||!Number.isFinite(t.leading)||t.leading<1||t.leading>3||!['left','center','right'].includes(t.align)||!['light','dark'].includes(t.bg))throw Error('Type tester inválido');}
 validateTypography(state);
 return structuredClone(state);
}
export function resizeGrid(state,columns,rows){const glyphs={};for(const [c,cells]of Object.entries(state.glyphs))glyphs[c]=[...new Set(cells.map(i=>Math.min(rows-1,Math.round(Math.floor(i/state.columns)*(rows-1)/(state.rows-1)))*columns+Math.min(columns-1,Math.round((i%state.columns)*(columns-1)/(state.columns-1)))))];const result={...state,columns,rows,glyphs};if(state.metrics)result.metrics=Object.fromEntries(Object.entries(state.metrics).map(([k,v])=>[k,v*rows/state.rows]));if(state.components)result.components=Object.fromEntries(Object.entries(state.components).map(([k,v])=>[k,{points:v.points.map(([x,y])=>[Math.round(x*(columns-1)/(state.columns-1)),Math.round(y*(rows-1)/(state.rows-1))])}]));if(state.links)result.links=Object.fromEntries(Object.entries(state.links).map(([k,v])=>[k,v.map(l=>({...l,x:Math.round(l.x*columns/state.columns),y:Math.round(l.y*rows/state.rows)}))]));return result;}
export function ment(state,{id,name,preview}){return JSON.stringify({format:'basement.ment',version:1,savedAt:new Date().toISOString(),artboard:{id,name,studio:'foundry',preview,layers:[{id:'alphabet',type:'foundry.alphabet'}],settings:state}})}
export function alphabetJSON(state){return JSON.stringify({format:'basement.foundry',version:1,alphabet:state},null,2)}

// Main style controls apply to every glyph, including legacy per-glyph exceptions.
export function setGlobalStyle(state,key,value){
 if(!['shape','weight','roundness','separation'].includes(key))throw Error('Control de estilo inválido');
 state[key]=value;
 for(const override of Object.values(state.overrides||{}))delete override[key];
}
