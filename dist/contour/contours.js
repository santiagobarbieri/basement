export function traceMask(mask,width,height){
 const stride=width+1,edges=new Map();
 const add=(a,b)=>{if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b)};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(!mask[y*width+x])continue;const a=y*stride+x;
 if(!y||!mask[(y-1)*width+x])add(a,a+1);
 if(x===width-1||!mask[y*width+x+1])add(a+1,a+1+stride);
 if(y===height-1||!mask[(y+1)*width+x])add(a+stride+1,a+stride);
 if(!x||!mask[y*width+x-1])add(a+stride,a);
 }
 const paths=[];while(edges.size){const start=edges.keys().next().value;let key=start;const points=[];
 do{points.push({x:key%stride,y:Math.floor(key/stride)});const list=edges.get(key);if(!list)break;const next=list.pop();if(!list.length)edges.delete(key);key=next;}while(key!==start);
 if(points.length>=4)paths.push(points);
 }return paths;
}
export function simplify(points,tolerance){
 if(points.length<4||tolerance<=0)return points;
 const input=[...points,points[0]],keep=new Uint8Array(input.length);keep[0]=keep[input.length-1]=1;const stack=[[0,input.length-1]],limit=tolerance*tolerance;
 while(stack.length){const [start,end]=stack.pop(),a=input[start],b=input[end],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;let best=limit,index=-1;
 for(let i=start+1;i<end;i++){const p=input[i],t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0,d=(p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;if(d>best){best=d;index=i}}
 if(index>=0){keep[index]=1;stack.push([start,index],[index,end])}
 }const result=input.filter((_,i)=>keep[i]);result.pop();return result.length>=3?result:points;
}
export function area(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a.x*b.y-b.x*a.y}return sum/2}
export function jitterPoint(p,index,frame,seed,amount){
 function value(x,y,axis){let n=(Math.imul(x+1,374761393)^Math.imul(y+1,1442695041)^Math.imul(frame+1,668265263)^Math.imul(seed|0,1274126177)^axis)>>>0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296*2-1;}
 const x=p.x/16,y=p.y/16,ix=Math.floor(x),iy=Math.floor(y),ease=t=>t*t*(3-2*t),tx=ease(x-ix),ty=ease(y-iy);
 function noise(axis){const a=value(ix,iy,axis)*(1-tx)+value(ix+1,iy,axis)*tx,b=value(ix,iy+1,axis)*(1-tx)+value(ix+1,iy+1,axis)*tx;return a*(1-ty)+b*ty;}
 return {x:p.x+noise(13)*amount,y:p.y+noise(97)*amount};
}

export function cleanMask(mask,width,height,mainOnly=false){
 const labels=new Int32Array(mask.length),queue=new Int32Array(mask.length),components=[];let id=0;
 for(let start=0;start<mask.length;start++){if(!mask[start]||labels[start])continue;id++;let read=0,end=1;queue[0]=start;labels[start]=id;
 while(read<end){const i=queue[read++],x=i%width;for(const next of [x?i-1:-1,x<width-1?i+1:-1,i-width,i+width])if(next>=0&&next<mask.length&&mask[next]&&!labels[next]){labels[next]=id;queue[end++]=next}}
 components.push({id,size:end});}
 const largest=components.reduce((best,c)=>c.size>best.size?c:best,{id:0,size:0}),minimum=Math.max(8,largest.size*.005),keep=new Set(components.filter(c=>mainOnly?c.id===largest.id:c.size>=minimum).map(c=>c.id));
 return Uint8Array.from(labels,id=>Number(keep.has(id)));
}

export function fillSmallHoles(mask,width,height){
 const result=mask.slice(),seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),limit=mask.reduce((sum,v)=>sum+v,0)*.02;
 for(let start=0;start<mask.length;start++){if(mask[start]||seen[start])continue;let read=0,end=1,border=false;queue[0]=start;seen[start]=1;
 while(read<end){const i=queue[read++],x=i%width,y=Math.floor(i/width);if(!x||!y||x===width-1||y===height-1)border=true;for(const next of [x?i-1:-1,x<width-1?i+1:-1,i-width,i+width])if(next>=0&&next<mask.length&&!mask[next]&&!seen[next]){seen[next]=1;queue[end++]=next}}
 if(!border&&end<=limit)for(let j=0;j<end;j++)result[queue[j]]=1;
 }return result;
}
