const viewport=document.querySelector('#canvas-viewport'),canvas=document.querySelector('#artboard');
const minus=document.querySelector('#zoom-out'),plus=document.querySelector('#zoom-in'),fit=document.querySelector('#zoom-fit');
export const camera={scale:1,x:0,y:0};
let drawing=false,pan=null,space=false,previousWidth=0,previousHeight=0;
const minimum=.1,maximum=16;
export function toWorld(clientX,clientY){const r=viewport.getBoundingClientRect();return {x:(clientX-r.left-camera.x)/camera.scale,y:(clientY-r.top-camera.y)/camera.scale}}
function render(){
 fit.textContent=Math.round(camera.scale*100)+' %';fit.setAttribute('aria-label','Zoom '+Math.round(camera.scale*100)+' percent. Fit canvas');
 minus.disabled=drawing||!!pan||camera.scale<=minimum;plus.disabled=drawing||!!pan||camera.scale>=maximum;fit.disabled=drawing||!!pan;
 viewport.classList.remove('pan-locked');document.dispatchEvent(new Event('endo-camera-change'));
}
function home(){if(drawing||pan)return;const frame=window.basementFrameBounds?.()||{x:0,y:0,width:960,height:850};camera.scale=Math.max(minimum,Math.min(1,(viewport.clientWidth-100)/frame.width,(viewport.clientHeight-100)/frame.height));camera.x=(viewport.clientWidth-frame.width*camera.scale)/2-frame.x*camera.scale;camera.y=(viewport.clientHeight-frame.height*camera.scale)/2-frame.y*camera.scale;render()}
function zoom(factor,ax=viewport.clientWidth/2,ay=viewport.clientHeight/2){if(drawing||pan)return;const next=Math.max(minimum,Math.min(maximum,camera.scale*factor)),ratio=next/camera.scale;camera.x=ax-(ax-camera.x)*ratio;camera.y=ay-(ay-camera.y)*ratio;camera.scale=next;render()}
minus.addEventListener('click',()=>zoom(1/1.2));plus.addEventListener('click',()=>zoom(1.2));fit.addEventListener('click',home);
viewport.addEventListener('wheel',e=>{e.preventDefault();if(drawing||pan)return;const unit=e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1;const rect=viewport.getBoundingClientRect();if(e.ctrlKey||e.metaKey){zoom(Math.exp(-Math.max(-200,Math.min(200,e.deltaY*unit))*.01),e.clientX-rect.left,e.clientY-rect.top)}else{camera.x-=e.deltaX*unit;camera.y-=e.deltaY*unit;render()}},{passive:false});
let gestureScale=1;viewport.addEventListener('gesturestart',e=>{e.preventDefault();gestureScale=1},{passive:false});viewport.addEventListener('gesturechange',e=>{e.preventDefault();if(!(e.scale>0))return;const r=viewport.getBoundingClientRect();zoom(e.scale/gestureScale,e.clientX-r.left,e.clientY-r.top);gestureScale=e.scale},{passive:false});viewport.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.closest('input,select,textarea,button,[contenteditable=true]')){e.preventDefault();space=true;viewport.classList.add('space-pan')}});document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;viewport.classList.remove('space-pan')}});window.addEventListener('blur',()=>{space=false;viewport.classList.remove('space-pan')});
// Capture pan first so middle-button or Space drag cannot create a paint gesture.
viewport.addEventListener('pointerdown',e=>{
 if(pan||drawing||!(e.button===1||(e.button===0&&(space||viewport.dataset.mode==='pan'))))return;
 e.preventDefault();e.stopPropagation();pan={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:camera.x,y:camera.y};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');render();
},true);
viewport.addEventListener('pointermove',e=>{if(pan?.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();camera.x=pan.x+e.clientX-pan.startX;camera.y=pan.y+e.clientY-pan.startY;render()},true);
function endPan(e){if(pan?.id!==e.pointerId)return;const id=pan.id;pan=null;if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);viewport.classList.remove('dragging');render()}
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,endPan);
canvas.addEventListener('pointerdown',e=>{if(e.button===0&&['draw','erase','frame','select','marquee'].includes(viewport.dataset.mode)){drawing=true;render()}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drawing=false;render()});
new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;if(!previousWidth){home()}else{camera.x+=(w-previousWidth)/2;camera.y+=(h-previousHeight)/2;render()}previousWidth=w;previousHeight=h}).observe(viewport);
home();

export function restoreCamera(view){
 if(!view||![view.scale,view.x,view.y].every(Number.isFinite))return;
 camera.scale=Math.max(minimum,Math.min(maximum,view.scale));camera.x=view.x;camera.y=view.y;render();
}
