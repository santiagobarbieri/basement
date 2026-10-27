import assert from 'node:assert/strict';
import { voronoi, statistics, blur, dimensions } from '../../dist/kiln/geometry.js';
import { initialState, signature, ment } from '../../dist/kiln/model.js';
for (const [w,h,size,irregularity,seed] of [[100,80,100,0,1],[100,80,100,100,73],[96,121,85,75,0]]) {
 const a=voronoi(w,h,size,irregularity,seed),b=voronoi(w,h,size,irregularity,seed);assert.deepEqual(a,b);let area=0;
 for(const cell of a.cells){assert(cell.polygon.length>=3);for(let i=0;i<cell.polygon.length;i++){const p=cell.polygon[i],q=cell.polygon[(i+1)%cell.polygon.length];assert(p.x>=-1e-6&&p.x<=w+1e-6&&p.y>=-1e-6&&p.y<=h+1e-6);area+=(p.x*q.y-q.x*p.y)/2;const d=Math.hypot(p.x-cell.site.x,p.y-cell.site.y);for(const other of a.cells)assert(d<=Math.hypot(p.x-other.site.x,p.y-other.site.y)+1e-5,'Cell must be exact nearest-site partition');}}
 assert(Math.abs(area-w*h)<1e-4,'Cells must cover the image without gaps');
}
const image={width:3,height:1,data:new Uint8ClampedArray([255,0,0,255,0,0,0,0,255,0,0,255])};const avg=statistics(image,0,0,3,1);assert.deepEqual(avg.rgb,[255,0,0]);assert.equal(avg.alpha,2/3);const blurred=blur(image,1);assert.equal(blurred.data[4],255,'Blur must not introduce black into alpha edges');
const s=initialState(),sig=signature(s);s.selectedLayer='source';assert.equal(signature(s),sig);s.source={id:'image',name:'example.png',width:4000,height:3000,data:'data:image/png;base64,x'};assert.deepEqual(dimensions(s),{width:4000,height:3000});s.tool='tiles';s.tiles.aspect='square';assert.deepEqual(dimensions(s),{width:4000,height:4000});const f=JSON.parse(ment(s,{id:'doc',name:'Test',preview:null}));assert.equal(f.artboard.studio,'kiln');assert.equal(f.artboard.layers[0].image.data,s.source.data);assert.equal(f.artboard.layers[1].type,'kiln.tiles');
console.log('PASS: exact seeded Voronoi, complete partition, alpha-weighted image sampling/blur, aspect dimensions, selection-free dirty state and Kiln .ment');
