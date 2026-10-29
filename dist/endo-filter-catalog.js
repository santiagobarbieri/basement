// One catalogue drives menu groups, portable defaults and adjustment controls.
// Stored fields remain amount (0–255) and scale (1–64), so existing .ment v2
// documents keep their representation and legacy effects keep their defaults.
const signed = {amountMin:0,amountMax:255,amountDisplayMin:-100,amountDisplayMax:100,amountUnit:'%',amountFormat:'signedPercent',defaultAmount:128};
const strength = {amountMin:0,amountMax:100,amountUnit:'%',defaultAmount:30};
const definition=(type,label,group,options={})=>{
 const item={type,label,group,description:'',hasAmount:true,hasScale:false,amountLabel:'Amount',amountMin:0,amountMax:255,amountDisplayMin:0,amountDisplayMax:255,amountUnit:'',defaultAmount:128,scaleLabel:'Size',scaleMin:1,scaleMax:64,scaleUnit:'px',defaultScale:2,...options};
 if(!options.amountFormat){item.amountDisplayMin=item.amountMin;item.amountDisplayMax=item.amountMax;}
 item.controls=[
  ...(item.hasAmount?[{key:'amount',label:item.amountLabel,min:item.amountMin,max:item.amountMax,step:1,unit:item.amountUnit,displayMin:item.amountDisplayMin,displayMax:item.amountDisplayMax,format:item.amountFormat}]:[]),
  ...(item.hasScale?[{key:'scale',label:item.scaleLabel,min:item.scaleMin,max:item.scaleMax,step:1,unit:item.scaleUnit,displayMin:item.scaleMin,displayMax:item.scaleMax}]:[])
 ];
 return Object.freeze(item);
};
export const FILTER_DEFINITIONS=Object.freeze([
 definition('brightness','Brightness','Tone & light',{...signed,amountLabel:'Brightness',description:'Lift or darken the painted colors without changing the strokes.'}),
 definition('contrast','Contrast','Tone & light',{...signed,amountLabel:'Contrast',description:'Adjust separation between light and dark paint.'}),
 definition('exposure','Exposure','Tone & light',{...signed,amountLabel:'Exposure',description:'Multiply light intensity while preserving the original gestures.'}),
 definition('saturation','Saturation','Color',{...signed,amountLabel:'Saturation',description:'Soften or intensify color in the paint below.'}),
 definition('grayscale','Grayscale','Color',{hasAmount:false,description:'Remove color while retaining luminance and transparency.'}),
 definition('invert','Invert','Image effects',{hasAmount:false,description:'Invert the color of the paint below.'}),
 definition('posterize','Posterize','Image effects',{amountLabel:'Levels',amountMin:2,amountMax:32,defaultAmount:6,description:'Reduce each color channel to a deliberate set of tones.'}),
 definition('threshold','Threshold','Image effects',{amountLabel:'Threshold',description:'Turn painted tones into black and white.'}),
 definition('dither','Dither','Image effects',{amountLabel:'Threshold',hasScale:true,scaleLabel:'Pattern size',description:'Convert tones to a black and white pattern anchored to the artboard.'}),
 definition('colored-dither','Color Dither','Paint',{amountLabel:'Levels',amountMin:2,amountMax:16,defaultAmount:4,hasScale:true,scaleLabel:'Pattern size',description:'Keep color while reducing tones with an ordered pigment pattern.'}),
 definition('pigment-grain','Pigment Grain','Paint',{...strength,amountLabel:'Strength',defaultAmount:28,hasScale:true,scaleLabel:'Grain size',description:'Add stable pigment variation to painted surfaces without erasing their edges.'}),
 definition('paper-texture','Paper Texture','Paint',{...strength,amountLabel:'Strength',defaultAmount:18,hasScale:true,scaleLabel:'Weave size',defaultScale:5,description:'Imprint a woven surface into the painted colors.'}),
 definition('crosshatch','Crosshatch','Paint',{...strength,amountLabel:'Strength',defaultAmount:50,hasScale:true,scaleLabel:'Spacing',defaultScale:8,description:'Build dark painted tones with diagonal ink hatching.'}),
 definition('ink-wash','Ink Wash','Paint',{amountLabel:'Tones',amountMin:2,amountMax:16,defaultAmount:5,description:'Group painted shading into broad ink-like tonal bands while retaining color.'})
]);
const definitions=new Map(FILTER_DEFINITIONS.map(item=>[item.type,item]));
export function filterDefinition(type){return definitions.get(type);}
const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
export function filterDisplayValue(definition,key,value){
 const item=typeof definition==='string'?filterDefinition(definition):definition;
 if(key==='amount'&&item?.amountFormat==='signedPercent')return Math.round(value<128?(value-128)/128*100:(value-128)/127*100);
 return value;
}
export function filterStoredValue(definition,key,value){
 const item=typeof definition==='string'?filterDefinition(definition):definition;
 if(key==='amount'&&item?.amountFormat==='signedPercent')return Math.round(128+bounded(value,-100,100)*(value<0?128:127)/100);
 return value;
}
