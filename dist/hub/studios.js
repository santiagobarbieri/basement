// Only Studios with working editors belong in the Beta 2.0 catalogue.
export const studios = [
  {id:'kiln',name:'Kiln',descriptor:'Image to Mosaic',accent:'#c76238',dark:'#c76238',light:'#bb552e',url:'/kiln/',requiredImage:true,description:'Kiln rebuilds your image as a mosaic of ornamental tiles. The light and dark areas of the original guide the arrangement, turning a photograph or illustration into a ceramic surface.\n\nChoose the tiles and palette, adjust the grid, joints, texture and glaze, and explore subtle motion. Your source image and every editable setting stay inside the Artboard; export the finished composition from the Studio.'},
  {id:'endo',name:'Endo',descriptor:'Material Brushes',accent:'#1241df',dark:'#1241df',light:'#164ce0',url:'/',requiredImage:false,description:'Endo is a drawing Studio for strokes with texture, material and relief. Draw with chrome, raised surfaces, magnetic particles, crayon, cement or powder, and shape the result with shared lighting and surface controls.\n\nEach stroke keeps its own editable settings. Use symmetry and repetition to build a composition, return to an individual mark, and define export areas on the open canvas. Save the editable Artboard or export a transparent PNG from the Studio.'},
  {id:'foundry',name:'Foundry',descriptor:'Font Creator',accent:'#d0b300',dark:'#d0b300',light:'#bda200',url:'/foundry/',requiredImage:false,description:'Foundry turns a grid of marks into a working typeface. Draw uppercase and lowercase letters, numbers and symbols, then choose the shapes, weight, spacing and details that give your alphabet its character.\n\nTest the letters together as you work, refine individual glyphs and adjust typography across the alphabet. The Artboard preserves your editable font; export installable or web font formats from the Studio when it is ready.'},
  {id:'tremor',name:'Tremor',descriptor:'Living Strokes',accent:'#8151c5',dark:'#8151c5',light:'#7740bb',url:'/tremor/',requiredImage:false,description:'Tremor is a drawing Studio for marks that keep moving. Its Antenna, Signal and Ghost animations give each stroke a different kind of instability, from a delicate tremble to a restless, broken signal.\n\nControl the amount, speed, roughness and grain of individual strokes, combine them with symmetry, and choose a transparent or colored background. The Artboard keeps the motion editable; export animated GIFs and selected areas from the Studio.'},
  {id:'contour',name:'Contour',descriptor:'Living Silhouettes',accent:'#ec1988',dark:'#ec1988',light:'#d80f79',url:'/contour/',requiredImage:true,description:'Contour turns a source image into a graphic silhouette. Isolate a figure using transparency, a light background or automatic detection, then build its appearance with color, outlines and an expressive edge.\n\nAdjust the mask, fill, stroke, roughness and jitter, and add labels when the composition needs them. The image and editable settings travel together in the Artboard; export a still PNG or animated GIF from the Studio.'},
  {id:'marble',name:'Marble',descriptor:'Color in Motion',accent:'#72a11a',dark:'#72a11a',light:'#638d14',url:'/marble/',requiredImage:false,description:'Marble brings the movement of a marbling bath to the screen. Drop colors onto the surface, pull them into flowing shapes and comb the mixture into ribbons, using a shared palette to hold the composition together.\n\nExplore layered ink and gentle motion without losing the editable shapes. Save the bath as an Artboard, or export still images, vector artwork, video and a standalone animated HTML composition from the Studio.'},
  {id:'distortion',name:'Distortion',descriptor:'Reality, Rearranged',accent:'#0aa3a0',dark:'#0aa3a0',light:'#098e8b',url:'/distortion/',requiredImage:true,description:'Distortion breaks an image into pieces that can be treated and rearranged independently. Combine the original photograph with Contour, ASCII, Pixel and Halftone treatments, using a shared palette or colors drawn from the image.\n\nMove, rotate, resize, subdivide or protect fragments, paint treatments onto selected areas, and introduce jitter into the composition. The original image remains embedded in the editable Artboard; export PNG or animated GIF from the Studio.'},
].map(studio => Object.freeze({...studio,logo:`assets/${studio.id}.svg`}));

export const studioById = id => studios.find(studio => studio.id === id);

// Hub creation uses the editor's own model, rather than inventing a second schema.
export async function createInitial(studioId, image = null) {
  const studio = studioById(studioId);
  if (!studio) throw Error('This Studio is not available.');
  const source = studio.requiredImage ? await imageSource(image) : null;
  if (studioId === 'endo' || studioId === 'tremor') {
    const tremor = studioId === 'tremor';
    return {infinite:true,frames:[],selected:null,selection:[],nextNumber:1,strokes:[],
      tool:{mode:'none',count:8,axes:'vertical',columns:3,rows:3},
      scene:tremor ? {background:'transparent',backgroundColor:'#102d40',merge:1,light:225,relief:.8,smooth:25,shine:0,grain:0} : {shine:75,relief:.8,smooth:45,grain:12,merge:2,light:225},
      defaults:tremor ? {brush:'tremor',animation:'antenna',variation:0,speed:0,primary:'#d9d2ed',shadow:'#382f4a',contrast:'#ffffff',width:14,inkOpacity:100,amount:3,rate:12,roughness:70,settle:0,noise:10}
        : {brush:'cromo',density:65,particleSize:1.5,ridge:55,roughness:40,primary:'#8795a8',shadow:'#10141b',contrast:'#eff5ff',width:28,variation:30,speed:35}};
  }
  const model = await import(studioId === 'marble' ? '../marble/engine.js' : `../${studioId}/model.js`);
  const state = model.initialState();
  if (source) {
    state.source = source;
    if (studioId === 'distortion') state.fragments = model.buildGrid(source,state.grid);
  }
  return state;
}

async function imageSource(input) {
  if (!input) throw Error('Choose an initial image for this Artboard.');
  // Already prepared images can be reused without another decode or canvas pass.
  if (typeof input === 'object' && typeof input.data === 'string' && Number.isInteger(input.width) && Number.isInteger(input.height)) {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(input.data) || input.width < 1 || input.height < 1 || input.width*input.height > 16_000_000 || Math.max(input.width,input.height)>8192) throw Error('The initial image is not valid.');
    return {...input,id:typeof input.id==='string'?input.id:crypto.randomUUID(),name:input.name||'Initial image'};
  }
  let blob = input;
  if (typeof input === 'string') {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(input)) throw Error('Choose a PNG, JPG or WebP image.');
    blob = await (await fetch(input)).blob();
  }
  if (!(blob instanceof Blob) || blob.size > 128*1024*1024) throw Error('Choose an image of up to 128 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { throw Error('The image could not be opened. Try PNG, JPG or WebP.'); }
  try {
    const factor = Math.min(1,Math.sqrt(16_000_000/(bitmap.width*bitmap.height)),8192/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.floor(bitmap.width*factor));canvas.height = Math.max(1,Math.floor(bitmap.height*factor));
    const context=canvas.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return {id:crypto.randomUUID(),name:input.name||'Initial image',width:canvas.width,height:canvas.height,originalWidth:bitmap.width,originalHeight:bitmap.height,data:canvas.toDataURL('image/png')};
  } finally { bitmap.close(); }
}
