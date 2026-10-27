export const MATERIALS={
 ceramic:{name:'Ceramic Tiles',texture:'Texture',finish:'Glaze',colors:{primary:'#244b73',contrast:'#bf8553',shadow:'#eadfbd'}},
 glass:{name:'Glass Tiles',texture:'Ripples',finish:'Reflection',colors:{primary:'#195467',contrast:'#67c8bf',shadow:'#d7eff0'}},
 wood:{name:'Wood Plates',texture:'Grain',finish:'Varnish',colors:{primary:'#50301d',contrast:'#b2743f',shadow:'#ead0a1'}},
 metal:{name:'Metal Plates',texture:'Brushing',finish:'Polish',colors:{primary:'#303b48',contrast:'#91a4b7',shadow:'#e3e8ed'}},
 woven:{name:'Woven Plates · Lana',texture:'Fibers',finish:'Relief',colors:{primary:'#573d43',contrast:'#bc8170',shadow:'#ecddc2'}},
 stone:{name:'Stone Tiles',texture:'Minerals',finish:'Polish',colors:{primary:'#343b39',contrast:'#8c9588',shadow:'#e3e1d4'}}
};
const mix=(a,b,t)=>{const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const x=rgb(a),y=rgb(b);return '#'+x.map((c,i)=>Math.round(c+(y[i]-c)*t).toString(16).padStart(2,'0')).join('')};
const noise=i=>{const x=Math.sin(i*127.1+17.7)*43758.5453;return x-Math.floor(x)};
export function paintMaterial(ctx,index,colors,settings){
 const material=settings.material,t=index/7,texture=(settings.texture??20)/100,finish=(settings.glaze??35)/100;
 const base=mix(colors.shadow,colors.primary,t);ctx.fillStyle=base;ctx.fillRect(0,0,100,100);
 if(material==='glass'){
  for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(-20,i*16-25);ctx.bezierCurveTo(20,i*16+30*texture,60,i*16-30*texture,120,i*16+10);ctx.lineWidth=3+texture*10;ctx.strokeStyle=`rgba(255,255,255,${.04+finish*.1})`;ctx.stroke()}
  const g=ctx.createLinearGradient(0,0,100,100);g.addColorStop(0,'#ffffff00');g.addColorStop(.3,`rgba(255,255,255,${.1+finish*.5})`);g.addColorStop(.42,'#ffffff00');g.addColorStop(1,'#00000022');ctx.fillStyle=g;ctx.fillRect(0,0,100,100);
  ctx.fillStyle=`rgba(255,255,255,${.15+finish*.3})`;ctx.beginPath();ctx.moveTo(3,3);ctx.lineTo(97,3);ctx.lineTo(88,11);ctx.lineTo(11,11);ctx.lineTo(11,88);ctx.lineTo(3,97);ctx.fill();
 }else if(material==='wood'){
  for(let i=0;i<55;i++){ctx.beginPath();const y=i*2;ctx.moveTo(-5,y);for(let x=0;x<=105;x+=3)ctx.lineTo(x,y+Math.sin(x*.055+i*.37)*(1+texture*5)+Math.sin(x*.13+i)*texture);ctx.strokeStyle=i%3?`rgba(28,12,3,${.06+texture*.26})`:`rgba(255,234,179,${.08+texture*.2})`;ctx.lineWidth=.4+noise(i)*1.1;ctx.stroke()}
  if(texture>.35){ctx.save();ctx.translate(30+index*4,48);ctx.scale(1,.36);for(let r=4;r<18;r+=3){ctx.beginPath();ctx.ellipse(0,0,r,r*.8,0,0,Math.PI*2);ctx.strokeStyle=`rgba(30,13,4,${texture*.35})`;ctx.lineWidth=1;ctx.stroke()}ctx.restore()}
 }else if(material==='metal'){
  const g=ctx.createLinearGradient(0,0,100,80);for(const [p,c]of [[0,'#00000055'],[.25,'#ffffff11'],[.45,`rgba(255,255,255,${.15+finish*.65})`],[.55,'#ffffff22'],[1,'#00000066']])g.addColorStop(p,c);ctx.fillStyle=g;ctx.fillRect(0,0,100,100);
  for(let i=0;i<130;i++){ctx.fillStyle=i%2?`rgba(255,255,255,${texture*.28*noise(i)})`:`rgba(0,0,0,${texture*.22*noise(i)})`;ctx.fillRect(noise(i+2)*12,i*100/130,88,.35)}
 }else if(material==='woven'){
  ctx.fillStyle=mix(base,colors.primary,.3);ctx.fillRect(0,0,100,100);
  for(let y=0;y<10;y++)for(let x=0;x<10;x++){ctx.save();ctx.translate(x*10+5,y*10+5);if((x+y)%2)ctx.rotate(Math.PI/2);const g=ctx.createLinearGradient(0,-4,0,4);g.addColorStop(0,mix(base,colors.primary,.3+finish*.2));g.addColorStop(.5,mix(base,colors.shadow,.12+finish*.25));g.addColorStop(1,mix(base,colors.primary,.4));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,6,4.5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=`rgba(255,255,255,${texture*.3})`;ctx.lineWidth=.35;for(let f=-3;f<=3;f+=1.5){ctx.beginPath();ctx.moveTo(-5,f);ctx.quadraticCurveTo(0,f-1,5,f);ctx.stroke()}ctx.restore()}
 }else if(material==='stone'){
  for(let i=0;i<400;i++){ctx.fillStyle=i%3?`rgba(0,0,0,${texture*.25*noise(i+1)})`:`rgba(255,255,255,${texture*.6})`;ctx.beginPath();ctx.ellipse(noise(i)*100,noise(i+400)*100,.3+noise(i+800)*2.2,.3+noise(i+1200)*1.4,i,0,Math.PI*2);ctx.fill()}
  for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-10,i*43);for(let x=0;x<=110;x+=4)ctx.lineTo(x,i*43+x*.28+Math.sin(x*.08+i+index)*7);ctx.strokeStyle=`rgba(255,255,255,${.08+texture*.28})`;ctx.lineWidth=.7+texture;ctx.stroke()}
 }
 if(material==='wood'||material==='stone'){const g=ctx.createLinearGradient(0,0,0,100);g.addColorStop(0,`rgba(255,255,255,${finish*.25})`);g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,100,100)}
}
