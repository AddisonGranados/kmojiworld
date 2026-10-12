import {APPLE_ATLAS, EMOJIS, type Emoji} from './emoji-data';
export type RGB = [number, number, number];
export type Metric = Emoji & {rgb:RGB; lab:RGB; hex:string; solidity:number};
export type Point = {x:number; y:number};
export type Stamp = Point & {glyph:string; size:number};
export type Layer = {id:string; name:string; visible:boolean; opacity:number; stamps:Stamp[]};
export type Photo = {src:string; name:string; width:number; height:number; opacity:number; visible:boolean};
export type InkDoc = {name:string; width:number; height:number; background:string; transparent:boolean; layers:Layer[]; photo:Photo|null};
export const blankLayer=(id:string,name:string):Layer=>({id,name,visible:true,opacity:1,stamps:[]});
export const newDocument=():InkDoc=>({name:'My emoji art',width:1000,height:1000,background:'#fffefb',transparent:false,layers:[blankLayer('layer-1','Layer 1')],photo:null});
export function hexRgb(hex:string):RGB {return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as RGB;}
export function rgbHex(rgb:RGB) {return '#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
export function oklab(rgb:RGB):RGB {
 const [r,g,b]=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
export const distance=(a:RGB,b:RGB)=>a.reduce((sum,v,i)=>sum+(v-b[i])**2,0);
export function nearest(rgb:RGB,palette:Metric[]):Metric|undefined {const lab=oklab(rgb);return palette.reduce<Metric|undefined>((best,p)=>!best||distance(lab,p.lab)<distance(lab,best.lab)?p:best,undefined);}
let appleImage:HTMLImageElement|null=null;
let appleLoading:Promise<HTMLImageElement>|null=null;
export function loadAppleArtwork():Promise<HTMLImageElement>{
 if(appleImage)return Promise.resolve(appleImage);
 if(!appleLoading)appleLoading=new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>{appleImage=img;resolve(img);};img.onerror=()=>{appleLoading=null;reject(Error('The emoji pack could not load. Please refresh to try again.'));};img.src=APPLE_ATLAS.src;});
 return appleLoading;
}
export function drawAppleEmoji(ctx:CanvasRenderingContext2D,glyph:string,x:number,y:number,size:number){
 const c=APPLE_ATLAS.coordinates[glyph as keyof typeof APPLE_ATLAS.coordinates];
 if(!appleImage||!c)return;
 const tile=APPLE_ATLAS.tile;ctx.drawImage(appleImage,c[0]*tile,c[1]*tile,tile,tile,x-size/2,y-size/2,size,size);
}
export async function measureEmojis(onProgress:(n:number)=>void):Promise<Metric[]> {
 await loadAppleArtwork();
 const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 const result:Metric[]=[];
 for(let n=0;n<EMOJIS.length;n++) {
  ctx.clearRect(0,0,48,48);drawAppleEmoji(ctx,EMOJIS[n].glyph,24,24,40);
  const pixels=ctx.getImageData(0,0,48,48).data;let alpha=0,r=0,g=0,b=0;
  for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3]/255;alpha+=a;r+=pixels[i]*a;g+=pixels[i+1]*a;b+=pixels[i+2]*a;}
  if(alpha>1){const rgb:RGB=[r/alpha,g/alpha,b/alpha];result.push({...EMOJIS[n],rgb,hex:rgbHex(rgb),lab:oklab(rgb),solidity:alpha/(40*40)});}
  if(n%32===0){onProgress(Math.round(n/EMOJIS.length*100));await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
 }
 const max=Math.max(...result.map(e=>e.solidity),.01);result.forEach(e=>e.solidity=Math.min(100,Math.round(e.solidity/max*100)));onProgress(100);return result;
}

// Distances are carried across events, so a slow drag and a fast drag produce
// the same spacing. Coordinates remain fractional; there is no snapping.
export function advanceStroke(from:Point,to:Point,spacing:number,untilNext:number):{points:Point[];untilNext:number} {
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),points:Point[]=[];
 if(!length)return {points,untilNext};
 let distance=untilNext;
 while(distance<=length){points.push({x:from.x+dx*distance/length,y:from.y+dy*distance/length});distance+=spacing;}
 return {points,untilNext:distance-length};
}
export function segmentDistance(p:Point,a:Point,b:Point):number {const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function eraseStamps(stamps:Stamp[],from:Point,to:Point,radius:number):Stamp[] {const remaining=stamps.filter(s=>segmentDistance(s,from,to)>radius+s.size*.36);return remaining.length===stamps.length?stamps:remaining;}
export function resizePaper(doc:InkDoc,width:number,height:number):InkDoc {const scale=Math.min(width/doc.width,height/doc.height),ox=(width-doc.width*scale)/2,oy=(height-doc.height*scale)/2;return {...doc,width,height,layers:doc.layers.map(l=>({...l,stamps:l.stamps.map(s=>({...s,x:s.x*scale+ox,y:s.y*scale+oy,size:s.size*scale}))}))};}
export function drawPhoto(ctx:CanvasRenderingContext2D,img:HTMLImageElement,w:number,h:number){const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);}
export function drawLayer(ctx:CanvasRenderingContext2D,layer:Layer,docWidth:number,docHeight:number,w:number,h:number,_highQuality=false){if(!layer.visible||layer.opacity<=0)return;ctx.save();ctx.globalAlpha=layer.opacity;ctx.scale(w/docWidth,h/docHeight);for(const stamp of layer.stamps)drawAppleEmoji(ctx,stamp.glyph,stamp.x,stamp.y,stamp.size);ctx.restore();}
export function renderDocument(canvas:HTMLCanvasElement,doc:InkDoc,img:HTMLImageElement|null,highQuality=false){const ctx=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);if(!doc.transparent){ctx.fillStyle=doc.background;ctx.fillRect(0,0,w,h);}if(img&&doc.photo?.visible){ctx.save();ctx.globalAlpha=doc.photo.opacity;drawPhoto(ctx,img,w,h);ctx.restore();}for(const l of doc.layers)drawLayer(ctx,l,doc.width,doc.height,w,h,highQuality);}
export const PROJECT_FORMAT='emoji-ink-v2';
export function parseProject(raw:string):InkDoc {
 const data=JSON.parse(raw),d=data?.document;
 if(!['emoji-ink-v1',PROJECT_FORMAT].includes(data?.format)||!d)throw Error('Choose a kmoji project file (older Emoji Ink files work too).');
 const finite=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const text=(v:unknown,max=120)=>typeof v==='string'&&v.length<=max;
 if(!text(d.name)||typeof d.background!=='string'||!/^#[0-9a-f]{6}$/i.test(d.background)||typeof d.transparent!=='boolean'||!Array.isArray(d.layers)||!d.layers.length||d.layers.length>30)throw Error('This project has invalid settings.');
 const legacy=data.format==='emoji-ink-v1';
 if(legacy&&(!Number.isInteger(d.cols)||!finite(d.cols,16,48)||!Number.isInteger(d.rows)||!finite(d.rows,4,144)))throw Error('This older project has invalid dimensions.');
 if(!legacy&&(!finite(d.width,1,10000)||!finite(d.height,1,10000)))throw Error('This project has invalid dimensions.');
 const ids=new Set(),glyphs=new Set(EMOJIS.map(e=>e.glyph));let count=0;
 const width=legacy?1000:d.width,height=legacy?d.rows/d.cols*1000:d.height;
 const layers:Layer[]=d.layers.map((l:Record<string,unknown>)=>{
  if(!text(l.id)||ids.has(l.id)||!text(l.name)||typeof l.visible!=='boolean'||!finite(l.opacity,0,1))throw Error('This project has invalid layers.');ids.add(l.id);
  let stamps:Stamp[];
  if(legacy){if(!Array.isArray(l.cells)||l.cells.length!==d.cols*d.rows||!l.cells.every(g=>g===null||glyphs.has(g)))throw Error('This older project has invalid artwork.');stamps=l.cells.flatMap((glyph,i)=>glyph?[{glyph,x:(i%d.cols+.5)*1000/d.cols,y:(Math.floor(i/d.cols)+.5)*1000/d.cols,size:1000/d.cols}]:[]);}
  else{if(!Array.isArray(l.stamps)||!l.stamps.every(s=>s&&glyphs.has(s.glyph)&&finite(s.size,.1,6000)&&finite(s.x,-6000,12000)&&finite(s.y,-6000,12000)))throw Error('This project has invalid artwork.');stamps=l.stamps.map(s=>({glyph:s.glyph,x:s.x,y:s.y,size:s.size}));}
  count+=stamps.length;if(count>250000)throw Error('This project has too many emoji marks.');
  return {id:l.id as string,name:l.name as string,visible:l.visible as boolean,opacity:l.opacity as number,stamps};
 });
 let photo:Photo|null=null;
 if(d.photo!==null){const p=d.photo;if(!p||!text(p.name)||!finite(p.opacity,0,1)||typeof p.visible!=='boolean'||!finite(p.width,1,1800)||!finite(p.height,1,1800)||!text(p.src,15000000)||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.src))throw Error('This project has an invalid photo.');photo={src:p.src,name:p.name,width:p.width,height:p.height,opacity:p.opacity,visible:p.visible};}
 return {name:d.name,width,height,background:d.background,transparent:d.transparent,layers,photo};
}
