import assert from 'node:assert/strict';
import {traceMask,simplify,area,jitterPoint} from '../dist/contour/contours.js';
import {initialState,ment} from '../dist/contour/model.js';
import {importMent,projectUrl} from '../dist/project-store.js';
const mask=new Uint8Array(49);for(let y=1;y<6;y++)for(let x=1;x<6;x++)mask[y*7+x]=1;mask[3*7+3]=0;
const paths=traceMask(mask,7,7);assert.equal(paths.length,2);assert.equal(paths.reduce((sum,p)=>sum+area(p),0),24);assert.ok(paths.some(p=>area(p)<0));assert.equal(simplify(paths.find(p=>area(p)>0),.5).length,4);
const point={x:10,y:20};assert.deepEqual(jitterPoint(point,1,2,3,0),point);assert.deepEqual(jitterPoint(point,1,2,3,4),jitterPoint(point,1,2,3,4));assert.notDeepEqual(jitterPoint(point,1,2,3,4),jitterPoint(point,1,3,3,4));assert.deepEqual(point,{x:10,y:20});
const state=initialState();state.source={id:'test',width:7,height:7,data:'data:image/png;base64,AAAA',name:'test.png'};
const parsed=importMent(ment(state,{id:'id',name:'Contour QA'}));assert.equal(parsed.studio,'contour');assert.deepEqual(parsed.state.contour,state.contour);assert.ok(projectUrl(parsed).startsWith('/contour/'));
console.log('PASS: Contour holes, simplification, deterministic jitter and .ment roundtrip');

const {cleanMask,fillSmallHoles}=await import('../dist/contour/contours.js');
const fixture=new Uint8Array(1600);for(let y=5;y<35;y++)for(let x=5;x<35;x++)fixture[y*40+x]=1;fixture[20*40+20]=0;fixture[0]=1;
const cleaned=cleanMask(fixture,40,40);assert.equal(cleaned[0],0);const filled=fillSmallHoles(cleaned,40,40);assert.equal(filled[20*40+20],1);assert.equal(filled[0],0);
