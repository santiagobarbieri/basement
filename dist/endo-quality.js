export const QUALITY_PRESETS=Object.freeze({
 draft:{label:'Draft',pixelRatio:1,density:.55,pixelBudget:1_200_000},
 standard:{label:'Standard',pixelRatio:1.5,density:1,pixelBudget:3_000_000},
 high:{label:'High',pixelRatio:2,density:1,pixelBudget:6_000_000}
});
export const qualityMode=value=>Object.hasOwn(QUALITY_PRESETS,value)?value:'high';
export function readQuality(){try{return qualityMode(localStorage.getItem('basement-endo-quality'));}catch{return 'high';}}
export function displayPixelRatio(mode,deviceRatio=1){return Math.max(1,Math.min(Number(deviceRatio)||1,QUALITY_PRESETS[qualityMode(mode)].pixelRatio));}
