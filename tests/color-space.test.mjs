import assert from 'node:assert/strict';
import {hsvToRgb,rgbToHsv,rgbToHex,hexToRgb} from '../dist/color-space.js';
for(const rgb of [[0,0,0],[255,255,255],[239,245,255],[135,149,168],[255,0,0],[0,255,0],[0,0,255],[34,78,129],[255,0,255]]){
 const hsv=rgbToHsv(rgb);assert.deepEqual(hsvToRgb(hsv.h,hsv.s,hsv.v),rgb);assert.deepEqual(hexToRgb(rgbToHex(rgb)),rgb);
}
assert.equal(rgbToHsv([0,0,0],123).h,123);assert.deepEqual(hsvToRgb(360,1,1),[255,0,0]);assert.deepEqual(hsvToRgb(-60,1,1),[255,0,255]);
console.log('PASS: RGB/HSV/hex roundtrips, grayscale hue retention and hue boundaries');
