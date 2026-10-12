import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const data=dataUrl(compile(await readFile(new URL('../lib/emoji-data.ts',import.meta.url),'utf8')));
const source=compile(await readFile(new URL('../lib/ink-engine.ts',import.meta.url),'utf8')).replace("'./emoji-data'",JSON.stringify(data));
const engine=await import(dataUrl(source));
const {EMOJIS}=await import(data);

test('free drawing preserves fractional coordinates and is independent of pointer event frequency',()=>{
 const start={x:10.35,y:20.72},end={x:210.35,y:120.72},spacing=29.5;
 const single=engine.advanceStroke(start,end,spacing,spacing);
 let from=start,remaining=spacing;const many=[];
 for(let i=1;i<=25;i++){const to={x:start.x+(end.x-start.x)*i/25,y:start.y+(end.y-start.y)*i/25};const next=engine.advanceStroke(from,to,spacing,remaining);many.push(...next.points);remaining=next.untilNext;from=to;}
 assert.equal(many.length,single.points.length);
 many.forEach((p,i)=>{assert.ok(Math.abs(p.x-single.points[i].x)<1e-8);assert.ok(Math.abs(p.y-single.points[i].y)<1e-8);});
 assert.ok(!Number.isInteger(single.points[0].x));
 assert.ok(Math.abs(remaining-single.untilNext)<1e-8);
});
test('fast eraser gestures remove crossed marks but preserve distant artwork and history',()=>{
 const stamps=[{glyph:'🌼',x:100,y:100,size:40},{glyph:'🌹',x:200,y:100,size:80},{glyph:'🦋',x:100,y:300,size:40}];
 const erased=engine.eraseStamps(stamps,{x:0,y:100},{x:300,y:100},20);
 assert.deepEqual(erased,[stamps[2]]);assert.equal(stamps.length,3);
 assert.equal(engine.eraseStamps(stamps,{x:900,y:900},{x:1000,y:1000},20),stamps);
});
test('paper resizing scales emojis uniformly and keeps all artwork in frame',()=>{
 const doc=engine.newDocument();doc.layers[0].stamps=[{glyph:'🌼',x:250.25,y:400.5,size:81.5},{glyph:'🦋',x:900,y:900,size:30}];
 const landscape=engine.resizePaper(doc,1000,750);
 assert.equal(landscape.layers[0].stamps[0].size,81.5*.75);
 assert.equal(landscape.layers[0].stamps[0].x,250.25*.75+125);
 assert.equal(landscape.layers[0].stamps[0].y,400.5*.75);
 assert.equal(doc.layers[0].stamps[0].size,81.5);
});
test('new projects round-trip with exact emoji sizes and positions',()=>{
 const doc=engine.newDocument();doc.layers[0].stamps=[{glyph:'🌼',x:103.427,y:29.91,size:83},{glyph:'🌹',x:103.9,y:29.91,size:147}];
 const saved=JSON.stringify({format:engine.PROJECT_FORMAT,document:doc});
 assert.deepEqual(engine.parseProject(saved),doc);
 const malformed=structuredClone(doc);malformed.layers[0].stamps[0].size=-1;
 assert.throws(()=>engine.parseProject(JSON.stringify({format:engine.PROJECT_FORMAT,document:malformed})),/artwork/);
});
test('older projects convert to free-positioned emojis without losing layers, visibility, or opacity',()=>{
 const cells=Array(16*24).fill(null);cells[0]='🌼';cells[17]='🌹';
 const legacy={name:'Older art',cols:16,rows:24,aspect:'portrait',background:'#fffefb',transparent:false,photo:null,layers:[{id:'old',name:'Flowers',visible:false,opacity:.4,cells}]};
 const doc=engine.parseProject(JSON.stringify({format:'emoji-ink-v1',document:legacy}));
 assert.equal(doc.width,1000);assert.equal(doc.height,1500);assert.equal(doc.layers[0].stamps.length,2);
 assert.deepEqual(doc.layers[0].stamps[1],{glyph:'🌹',x:93.75,y:93.75,size:62.5});
 assert.equal(doc.layers[0].visible,false);assert.equal(doc.layers[0].opacity,.4);
 assert.deepEqual(engine.parseProject(JSON.stringify({format:engine.PROJECT_FORMAT,document:doc})),doc);
});
test('color search still uses the closest measured sample',()=>{
 const palette=[{glyph:'red',rgb:[230,30,40]},{glyph:'blue',rgb:[30,90,220]},{glyph:'green',rgb:[50,170,60]}].map(p=>({...p,lab:engine.oklab(p.rgb)}));
 assert.equal(engine.nearest([240,40,50],palette).glyph,'red');assert.equal(engine.nearest([40,100,215],palette).glyph,'blue');
 assert.equal(EMOJIS.length,new Set(EMOJIS.map(e=>e.glyph)).size);
});

test('spacing produces exact small and large gaps for different emoji sizes',()=>{
 for(const size of [25,75,240])for(const percent of [10,48,100,250]){
  const step=size*percent/100;
  const result=engine.advanceStroke({x:0,y:0},{x:step*4+.1,y:0},step,step);
  assert.equal(result.points.length,4);
  result.points.forEach((p,i)=>assert.ok(Math.abs(p.x-step*(i+1))<1e-8));
 }
});
test('every palette emoji and category icon has Apple artwork',async()=>{
 const {APPLE_ATLAS,CATEGORIES}=await import(data);
 for(const e of EMOJIS)assert.ok(APPLE_ATLAS.coordinates[e.glyph],e.glyph);
 for(const c of CATEGORIES.filter(c=>c.name!=='All'))assert.ok(APPLE_ATLAS.coordinates[c.glyph],c.glyph);
 const {stat}=await import('node:fs/promises');
 assert.ok((await stat(new URL('../public'+APPLE_ATLAS.src,import.meta.url))).size>1000);
});
