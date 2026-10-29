import assert from 'node:assert/strict';
import {FILTER_DEFINITIONS,filterDefinition,filterDisplayValue,filterStoredValue} from '../dist/endo-filter-catalog.js';
import {applyFilters} from '../dist/endo-filters.js';

const types=FILTER_DEFINITIONS.map(item=>item.type);
assert.equal(new Set(types).size,types.length);
assert.ok(types.length>=14);
assert.deepEqual([...new Set(FILTER_DEFINITIONS.map(item=>item.group))],['Tone & light','Color','Image effects','Paint']);
for(const definition of FILTER_DEFINITIONS){
 assert.equal(filterDefinition(definition.type),definition);
 assert.ok(definition.defaultAmount>=definition.amountMin&&definition.defaultAmount<=definition.amountMax);
 assert.ok(definition.defaultScale>=1&&definition.defaultScale<=64);
 for(const control of definition.controls){assert.ok(control.min<=control.max);assert.equal(control.step,1);}
}
for(const type of ['brightness','contrast','exposure','saturation']){
 assert.equal(filterDisplayValue(type,'amount',0),-100);assert.equal(filterDisplayValue(type,'amount',128),0);assert.equal(filterDisplayValue(type,'amount',255),100);
 assert.equal(filterStoredValue(type,'amount',-100),0);assert.equal(filterStoredValue(type,'amount',0),128);assert.equal(filterStoredValue(type,'amount',100),255);
 for(let amount=0;amount<=255;amount++)assert.ok(Math.abs(filterStoredValue(type,'amount',filterDisplayValue(type,'amount',amount))-amount)<=1);
}

const source=new Uint8ClampedArray([40,100,200,128,250,230,210,255,128,64,32,0,0,0,0,1]);
const before=source.slice();
for(const type of ['brightness','contrast','exposure','saturation'])assert.deepEqual(applyFilters(source,4,1,[{type,amount:128}]),source,type+' neutral is an exact identity');
for(const type of ['pigment-grain','paper-texture','crosshatch'])assert.deepEqual(applyFilters(source,4,1,[{type,amount:0}]),source,type+' zero strength is an exact identity');
for(const definition of FILTER_DEFINITIONS){
 const settings={type:definition.type,amount:definition.defaultAmount,scale:definition.defaultScale};
 const result=applyFilters(source,4,1,[settings],{originX:-15,originY:30,resolution:1});
 assert.notEqual(result,source);
 for(let index=3;index<source.length;index+=4)assert.equal(result[index],source[index],definition.type+' preserves fractional alpha');
 assert.deepEqual(result.slice(8,12),source.slice(8,12),definition.type+' does not alter invisible RGB');
 assert.deepEqual(applyFilters(source,4,1,[{...settings,enabled:false}]),source);
 const high=applyFilters(source,4,1,[{...settings,amount:1e8,scale:1e8}]);
 const bounded=applyFilters(source,4,1,[{...settings,amount:definition.amountMax,scale:64}]);
 assert.deepEqual(high,bounded,definition.type+' clamps parameters');
}
assert.deepEqual(source,before,'The adjustment stack never mutates source pixels');
assert.deepEqual([...applyFilters(source,4,1,[{type:'brightness',amount:0}]).slice(0,4)],[0,0,0,128]);
assert.deepEqual([...applyFilters(source,4,1,[{type:'brightness',amount:255}]).slice(0,4)],[255,255,255,128]);
const grayscale=applyFilters(source,4,1,[{type:'grayscale'}]);
assert.deepEqual(applyFilters(source,4,1,[{type:'saturation',amount:0}]),grayscale,'Zero saturation matches grayscale');
const strongerContrast=applyFilters(source,4,1,[{type:'contrast',amount:200}]);
assert.ok(strongerContrast[0]<source[0]&&strongerContrast[2]>source[2],'Contrast separates shadows from highlights');
const lifted=applyFilters(source,4,1,[{type:'exposure',amount:160}]);
assert.ok(lifted[0]>source[0]&&lifted[1]>source[1],'Exposure raises painted intensity');
const posterized=applyFilters(new Uint8ClampedArray([20,128,220,255]),1,1,[{type:'posterize',amount:2}]);
assert.deepEqual([...posterized],[0,255,255,255],'Posterize reduces channel levels');
assert.notDeepEqual(applyFilters(source,4,1,[{type:'invert'},{type:'brightness',amount:170}]),applyFilters(source,4,1,[{type:'brightness',amount:170},{type:'invert'}]),'Layer order changes the composed effect');

const flat=(width,height,color=[180,110,60,77])=>{
 const pixels=new Uint8ClampedArray(width*height*4);for(let i=0;i<pixels.length;i+=4)pixels.set(color,i);return pixels;
};
const width=32,height=24,pixels=flat(width,height),view={resolution:1.75,originX:-9.25,originY:12.5};
const cropX=7,cropY=5,cropWidth=15,cropHeight=11,cropped=new Uint8ClampedArray(cropWidth*cropHeight*4);
for(let y=0;y<cropHeight;y++)for(let x=0;x<cropWidth;x++)cropped.set(pixels.slice(((y+cropY)*width+x+cropX)*4,((y+cropY)*width+x+cropX)*4+4),(y*cropWidth+x)*4);
for(const type of ['dither','colored-dither','pigment-grain','paper-texture','crosshatch','ink-wash']){
 const definition=filterDefinition(type),filter={type,amount:definition.defaultAmount,scale:definition.defaultScale};
 const rendered=applyFilters(pixels,width,height,[filter],view);
 assert.deepEqual(applyFilters(pixels,width,height,[filter],view),rendered,type+' is deterministic');
 const crop=applyFilters(cropped,cropWidth,cropHeight,[filter],{...view,originX:view.originX+cropX/view.resolution,originY:view.originY+cropY/view.resolution});
 for(let y=0;y<cropHeight;y++)for(let x=0;x<cropWidth;x++)assert.deepEqual(crop.slice((y*cropWidth+x)*4,(y*cropWidth+x)*4+4),rendered.slice(((y+cropY)*width+x+cropX)*4,((y+cropY)*width+x+cropX)*4+4),type+' has ROI equivalence without a neighborhood halo');
 assert.notDeepEqual(rendered,pixels,type+' visibly changes painted pixels');
}
// At integer cell scaling, matched world-space pixel centers see the same
// pattern in a 1× raster and a 3× export; no random field is regenerated.
for(const type of ['dither','colored-dither','pigment-grain','paper-texture','crosshatch']){
 const definition=filterDefinition(type),filter={type,amount:definition.defaultAmount,scale:definition.defaultScale};
 const low=applyFilters(flat(12,10),12,10,[filter],{resolution:1,originX:-6,originY:2});
 const high=applyFilters(flat(36,30),36,30,[filter],{resolution:3,originX:-6,originY:2});
 for(let y=0;y<10;y++)for(let x=0;x<12;x++)assert.deepEqual(low.slice((y*12+x)*4,(y*12+x)*4+4),high.slice(((y*3+1)*36+x*3+1)*4,((y*3+1)*36+x*3+1)*4+4),type+' stays anchored at export sampling centers');
}
const colorDither=applyFilters(flat(20,20),20,20,[{type:'colored-dither',amount:4,scale:2}]);
const unique=new Set();for(let index=0;index<colorDither.length;index+=4){unique.add(colorDither.slice(index,index+3).join(','));for(let channel=0;channel<3;channel++)assert.ok([0,85,170,255].includes(colorDither[index+channel]));}
assert.ok(unique.size>1,'Color dither retains a multicolor pattern');
console.log('PASS 14 filter definitions, neutral tonal controls, clamping, composition, alpha, editable source retention, paint textures, ROI equivalence and export-stable document coordinates');
