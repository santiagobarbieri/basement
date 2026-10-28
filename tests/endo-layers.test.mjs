import assert from 'node:assert/strict';
import { ChromeSurface, StrokeBuilder, rebuild } from '../dist/engine.js';
import { symmetrySurface } from '../dist/symmetry.js';
import { LayeredSurface, rebuildLayers, renderLayerDocument } from '../dist/endo-renderer.js';
import { applyFilters } from '../dist/endo-filters.js';

const context = { clearRect() {}, createImageData(w,h) { return { data:new Uint8ClampedArray(w*h*4) }; }, putImageData() {} };
const canvas = (width=100,height=80) => ({width,height,getContext() {return context;}});
const scene = {merge:2,light:225,relief:.8,smooth:0,shine:75,grain:0};
const settings = color => ({width:28,variation:0,speed:0,brush:'cromo',contrast:color,primary:color,shadow:color});
const line = (layerId,color,operation='paint') => ({layerId,operation,settings:settings(color),tool:{mode:'none'},points:[{x:20,y:40,time:0,pressure:1},{x:80,y:40,time:100,pressure:1,finish:true}]});
const layers = [{id:'bottom',name:'Bottom',opacity:1,visible:true,filters:[]},{id:'top',name:'Top',opacity:1,visible:true,filters:[]}];
const strokes = [line('bottom','#ff0000'),line('top','#0000ff')];
const source = structuredClone(strokes),surface = new LayeredSurface(canvas());
const pixel = (s,x=50,y=40) => [...s.image.data.slice((y*s.w+x)*4,(y*s.w+x)*4+4)];
const render = () => {rebuildLayers(surface,strokes,scene,layers);surface.render(scene,strokes.map(s=>s.settings));};
render(); assert.deepEqual(pixel(surface),[0,0,255,255]);assert.equal(surface.owner[40*100+50],1,'The upper visible stroke owns selection hits');
layers.reverse();surface.setDocument(strokes,layers);surface.render(scene,strokes.map(s=>s.settings));assert.deepEqual(pixel(surface),[255,0,0,255],'Layer order changes actual pixels');
layers.reverse();layers[1].opacity=.5;surface.setDocument(strokes,layers);surface.render(scene,strokes.map(s=>s.settings));assert.deepEqual(pixel(surface),[128,0,128,255],'Opacity uses source-over compositing');
layers[1].visible=false;surface.setDocument(strokes,layers);surface.render(scene,strokes.map(s=>s.settings));assert.deepEqual(pixel(surface),[255,0,0,255]);assert.equal(surface.owner[40*100+50],0,'Hidden layers cannot be selected on canvas');
assert.equal(surface.rasters.has('top'),false,'Hiding a layer releases its viewport raster');
render();assert.equal(surface.rasters.has('top'),false,'Replay never allocates hidden-layer rasters');
layers[1].visible=true;layers[1].opacity=1;render();assert.deepEqual(pixel(surface),[0,0,255,255],'Showing a layer replays its original appearance');
layers[1].opacity=0;render();assert.equal(surface.rasters.has('top'),false,'Zero-opacity layers do not retain rasters');assert.deepEqual(pixel(surface),[255,0,0,255]);
layers[1].visible=true;layers[1].opacity=1;
const eraser=line('top','#000000','erase');eraser.settings.width=10;eraser.points=[{x:50,y:20,time:0,pressure:1},{x:50,y:60,time:100,pressure:1,finish:true}];strokes.push(eraser);render();
assert.deepEqual(pixel(surface),[255,0,0,255],'An eraser clears only the top layer and reveals the lower layer');assert.deepEqual(pixel(surface,65),[0,0,255,255],'Erasing preserves neighboring pixels');
assert.equal(surface.owner[40*100+50],0,'Erased pixels hit the revealed lower stroke');
const incremental = new LayeredSurface(canvas());incremental.setDocument(strokes,layers);
for(let id=0;id<strokes.length;id++){
 const stroke=strokes[id],target=symmetrySurface(incremental.strokeSurface(stroke,id),stroke.tool,stroke.points[0]),builder=new StrokeBuilder(target,{...stroke.settings,...scene},id);
 for(const point of stroke.points)builder.add(point,point.finish);
 incremental.render(scene,strokes.map(s=>s.settings));
}
assert.deepEqual(incremental.image.data,surface.image.data,'Incremental erase/paint and replay produce identical composites');
const exported=renderLayerDocument(canvas(),strokes,scene,layers);assert.deepEqual(exported.image.data,surface.image.data,'Worker/export sequential rendering agrees with editing');
assert.equal(surface.image.data[3],0,'The composite keeps an unpainted background transparent');
assert.deepEqual(strokes.slice(0,2),source,'Layer rendering preserves editable source gestures');

const legacyStrokes=source.map(({layerId,operation,...stroke})=>stroke),legacy=new ChromeSurface(canvas()),migrated=new LayeredSurface(canvas());
rebuild(legacy,legacyStrokes,scene);legacy.render(scene,legacyStrokes.map(s=>s.settings));rebuildLayers(migrated,legacyStrokes,scene);migrated.render(scene,legacyStrokes.map(s=>s.settings));
assert.deepEqual(migrated.image.data,legacy.image.data,'A legacy single-surface document retains its exact appearance');

const clipped=new ChromeSurface(canvas(),{infinite:true});clipped.segment({x:0,y:40},{x:100,y:40},20,20,{...settings('#ff0000'),...scene,clipRect:{x:30,y:30,width:20,height:20}});clipped.render(scene,[settings('#ff0000')]);
assert.equal(clipped.image.data[(40*100+29)*4+3],0);assert.equal(clipped.image.data[(40*100+50)*4+3],0);assert.ok(clipped.image.data[(40*100+40)*4+3]>0,'Repeat regions clip pixel centers to their bounds');

const input = new Uint8ClampedArray([40,100,200,128,250,250,250,255,128,64,32,0]);
const original=input.slice(),threshold=applyFilters(input,3,1,[{type:'threshold',amount:128}]);
assert.deepEqual([...threshold],[0,0,0,128,255,255,255,255,128,64,32,0]);
const grayscale=applyFilters(input,3,1,[{type:'grayscale'}]);assert.equal(grayscale[0],grayscale[1]);assert.equal(grayscale[1],grayscale[2]);assert.equal(grayscale[3],128);
const invert=applyFilters(input,3,1,[{type:'invert'}]);assert.deepEqual([...invert.slice(0,4)],[215,155,55,128]);
assert.deepEqual(applyFilters(input,3,1,[{type:'invert',enabled:false}]),input);assert.deepEqual(input,original,'Effects never mutate source pixels or alpha');
const flat=new Uint8ClampedArray(16*16*4);for(let i=0;i<flat.length;i+=4){flat[i]=flat[i+1]=flat[i+2]=128;flat[i+3]=77;}
const dither=applyFilters(flat,16,16,[{type:'dither',amount:128,scale:2}],{resolution:1,originX:-8,originY:-8});
assert.ok(dither.some((value,index)=>index%4===0&&value===0));assert.ok(dither.some((value,index)=>index%4===0&&value===255));
const cropInput=new Uint8ClampedArray(8*8*4);for(let y=0;y<8;y++)for(let x=0;x<8;x++)cropInput.set(flat.slice(((y+4)*16+x+4)*4,((y+4)*16+x+4)*4+4),(y*8+x)*4);
const crop=applyFilters(cropInput,8,8,[{type:'dither',amount:128,scale:2}],{resolution:1,originX:-4,originY:-4});
for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.deepEqual(crop.slice((y*8+x)*4,(y*8+x)*4+4),dither.slice(((y+4)*16+x+4)*4,((y+4)*16+x+4)*4+4),'Dither stays fixed in document coordinates while panning');
for(let i=3;i<dither.length;i+=4)assert.equal(dither[i],77,'Dithering preserves fractional alpha');

layers[1].filters=[{id:'invert',type:'invert',enabled:true}];render();
const filteredExport=renderLayerDocument(canvas(),strokes,scene,layers);assert.deepEqual(filteredExport.image.data,surface.image.data,'Layer effects match in PNG and the live composite');
rebuildLayers(surface,[],scene,layers);surface.render(scene,[]);assert.ok(surface.image.data.every(value=>value===0),'Deleting the last filtered stroke clears cached effect pixels');
console.log('PASS Endo layers: order, opacity, visibility, hit ownership, partial layer erasing, incremental replay, legacy appearance, clipping, editable filters, alpha and document-anchored dither');
