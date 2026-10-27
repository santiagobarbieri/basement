export function dimensions(state){return state.source?{width:state.source.width,height:state.source.height}:{width:960,height:850}}
export function pngDimensions(state){const {width,height}=dimensions(state),scale=Math.min(6000/Math.max(width,height),Math.sqrt(32e6/(width*height)));return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))}}
