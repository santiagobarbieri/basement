import {exportGeometry,exportState} from './document-bounds.js';
export function gifGeometry(state){
 const region=exportGeometry(state),logicalWidth=region.width/2,logicalHeight=region.height/2;
 const resolution=Math.min(.5,640/logicalWidth,640/logicalHeight,Math.sqrt(320000/(logicalWidth*logicalHeight)));
 return {x:region.x,y:region.y,width:Math.max(1,Math.floor(logicalWidth*resolution)),height:Math.max(1,Math.floor(logicalHeight*resolution)),resolution,...(region.name?{name:region.name}:{})};
}
export {exportState};
