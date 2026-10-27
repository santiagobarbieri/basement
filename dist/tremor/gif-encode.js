// GIF89a: fixed web-safe palette, transparent index 0, bounded 9-bit LZW runs.
export function encodeGif(frames,width,height,delay=8) {
  const bytes=[]; const byte=n=>bytes.push(n&255), word=n=>{byte(n);byte(n>>8)}, text=s=>{for(const c of s)byte(c.charCodeAt(0))};
  text('GIF89a');word(width);word(height);byte(0xf7);byte(0);byte(0);
  for(let i=0;i<256;i++){const n=Math.max(0,i-1);byte(i&&i<=216?Math.floor(n/36)*51:0);byte(i&&i<=216?Math.floor(n/6)%6*51:0);byte(i&&i<=216?n%6*51:0)}
  byte(0x21);byte(0xff);byte(11);text('NETSCAPE2.0');byte(3);byte(1);word(0);byte(0);
  for(const rgba of frames){
    byte(0x21);byte(0xf9);byte(4);byte(9);word(delay);byte(0);byte(0);
    byte(0x2c);word(0);word(0);word(width);word(height);byte(0);byte(8);
    const packed=[];let bits=0,value=0,count=0;
    const code=n=>{value|=n<<bits;bits+=9;while(bits>=8){packed.push(value&255);value>>>=8;bits-=8}};
    code(256);
    for(let i=0;i<rgba.length;i+=4){
      if(count===200){code(256);count=0}
      const index=rgba[i+3]<128?0:1+Math.round(rgba[i]/51)*36+Math.round(rgba[i+1]/51)*6+Math.round(rgba[i+2]/51);
      code(index);count++;
    }
    code(257);if(bits)packed.push(value&255);
    for(let i=0;i<packed.length;i+=255){byte(Math.min(255,packed.length-i));for(let j=i;j<Math.min(i+255,packed.length);j++)byte(packed[j])}byte(0);
  }
  byte(0x3b);return new Uint8Array(bytes);
}
