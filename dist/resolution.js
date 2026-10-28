// FrameSurface owns bounded editing rasters and tiny inactive-frame previews.
// The old full-page refinement overlay stays off: only PNG export rebuilds
// the original gestures at full resolution.
const overlay=document.querySelector('#resolution-view');
const artboard=document.querySelector('#artboard');
if(overlay){overlay.style.opacity='0';overlay.dataset.resolution='frame-preview';}
document.addEventListener('endo-artboard-rendered',()=>{
 if(overlay)overlay.style.opacity='0';
 const label=document.querySelector('#render-quality-status');
 if(label)label.textContent='Draft preview · full quality on export';
 if(artboard)artboard.dataset.renderMode='frame-preview';
});
