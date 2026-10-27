// Frame-by-frame GIF encoding: adaptive palette and dictionary LZW.
export function createGifEncoder(width,height,firstPixels,delay){
 const histogram=new Uint32Array(32768);
 for(let i=0;i<firstPixels.length;i+=4)if(firstPixels[i+3]>=128)histogram[(firstPixels[i]>>3)<<10|(firstPixels[i+1]>>3)<<5|firstPixels[i+2]>>3]++;
 const colors=[];for(let key=0;key<32768;key++)if(histogram[key])colors.push({r:((key>>10)&31)*8+4,g:((key>>5)&31)*8+4,b:(key&31)*8+4,n:histogram[key]});
 function box(items){let weight=0;const min=[255,255,255],max=[0,0,0];for(const c of items){weight+=c.n;[c.r,c.g,c.b].forEach((v,i)=>{min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v)})}const ranges=max.map((v,i)=>v-min[i]);return {items,weight,range:Math.max(...ranges),axis:ranges.indexOf(Math.max(...ranges))}}
 const boxes=colors.length?[box(colors)]:[box([{r:0,g:0,b:0,n:1}])];
 while(boxes.length<255){let index=-1,score=-1;boxes.forEach((b,i)=>{const s=b.range*Math.sqrt(b.weight);if(b.items.length>1&&s>score){index=i;score=s}});if(index<0)break;const current=boxes.splice(index,1)[0],key=['r','g','b'][current.axis];current.items.sort((a,b)=>a[key]-b[key]);let sum=0,cut=1;for(;cut<current.items.length;cut++){sum+=current.items[cut-1].n;if(sum>=current.weight/2)break}boxes.push(box(current.items.slice(0,cut)),box(current.items.slice(cut)));}
 const palette=[[0,0,0],...boxes.map(b=>['r','g','b'].map(k=>Math.round(b.items.reduce((s,c)=>s+c[k]*c.n,0)/b.weight)))];
 const lookup=new Int16Array(32768);lookup.fill(-1);
 const parts=[];
 function header(){const out=[];const word=n=>out.push(n&255,n>>8&255);out.push(...new TextEncoder().encode('GIF89a'));word(width);word(height);out.push(247,0,0);for(let i=0;i<256;i++)out.push(...(palette[i]||[0,0,0]));out.push(33,255,11,...new TextEncoder().encode('NETSCAPE2.0'),3,1,0,0,0);parts.push(new Uint8Array(out));}header();
 return {
 add(rgba){
  const indices=new Uint8Array(width*height);
  for(let i=0,j=0;i<rgba.length;i+=4,j++){if(rgba[i+3]<128)continue;const key=(rgba[i]>>3)<<10|(rgba[i+1]>>3)<<5|rgba[i+2]>>3;
   let selected=lookup[key];if(selected<0){const r=((key>>10)&31)*8+4,g=((key>>5)&31)*8+4,b=(key&31)*8+4;let best=Infinity;for(let p=1;p<palette.length;p++){const c=palette[p],d=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;if(d<best){best=d;selected=p}}lookup[key]=selected}indices[j]=selected;
  }
  const bytes=[];let value=0,bits=0,size=9,next=258;const dict=new Map();
  const code=n=>{value|=n<<bits;bits+=size;while(bits>=8){bytes.push(value&255);value>>>=8;bits-=8}};
  code(256);let prefix=indices[0];
  for(let i=1;i<indices.length;i++){const k=indices[i],key=prefix*256+k,found=dict.get(key);if(found!==undefined){prefix=found;continue}code(prefix);if(next>=(1<<size)&&size<12)size++;if(next<4096)dict.set(key,next++);else{code(256);dict.clear();size=9;next=258}prefix=k;}
  code(prefix);if(next>=(1<<size)&&size<12)size++;code(257);if(bits)bytes.push(value&255);
  const out=[33,249,4,9,delay&255,delay>>8&255,0,0,44,0,0,0,0,width&255,width>>8&255,height&255,height>>8&255,0,8];
  for(let i=0;i<bytes.length;i+=255){const n=Math.min(255,bytes.length-i);out.push(n);for(let j=0;j<n;j++)out.push(bytes[i+j]);}out.push(0);parts.push(new Uint8Array(out));
 },finish(){return new Blob([...parts,new Uint8Array([59])],{type:'image/gif'})}
 };
}
