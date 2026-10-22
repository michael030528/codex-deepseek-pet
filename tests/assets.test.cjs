'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),crypto=require('node:crypto');
const {PNG}=require('pngjs'),sharp=require('sharp');
const {clips,atlasNames,blinkFrame,sample,requiredFrames,isNeutral}=require('../src/renderer/motion.js');
const root=path.join(__dirname,'..'),columns=4,cache=new Map();
function atlas(name){
 if(!cache.has(name))cache.set(name,PNG.sync.read(fs.readFileSync(path.join(root,'assets/whale',name+'.png'))));
 return cache.get(name);
}
function framePixels(name,frame){
 const png=atlas(name),cell=png.width/columns,pixels=Buffer.alloc(cell*cell*4);
 for(let y=0;y<cell;y++){
  const from=((Math.floor(frame/columns)*cell+y)*png.width+frame%columns*cell)*4;
  png.data.copy(pixels,y*cell*4,from,from+cell*4);
 }
 return {pixels,cell};
}
function visibleBounds(name,frame){
 const {pixels,cell}=framePixels(name,frame);let left=cell,top=cell,right=-1,bottom=-1;
 for(let y=0;y<cell;y++)for(let x=0;x<cell;x++)if(pixels[(y*cell+x)*4+3]>200){
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 return {left,top,right,bottom};
}
const used=new Map(atlasNames.map(name=>[name,new Set(requiredFrames(name))]));

test('all runtime atlases and sampled frames fit the four-column custom layout',()=>{
 for(const name of atlasNames){
  assert.match(name,/^custom-/);const png=atlas(name),cell=png.width/columns;
  assert.equal(Number.isInteger(cell),true);assert.ok(cell>=256);
  assert.equal(png.height%cell,0);assert.ok(png.height>=cell);
  for(const frame of used.get(name))assert.ok((Math.floor(frame/columns)+1)*cell<=png.height,`${name}:${frame}`);
 }
 for(const [action,c]of Object.entries(clips)){
  const end=c.times.reduce((a,b)=>a+b,0)+(['left','right'].includes(action)?600:0);
  for(let t=0;t<=end+650;t+=37){
   const p=sample(action,t),png=atlas(p.atlas),cell=png.width/p.columns,f=p.blink>.35?blinkFrame:p.frame;
   assert.ok((Math.floor(f/p.columns)+1)*cell<=png.height,`${action}/${t}: ${p.atlas}/${f}`);
   if(p.nextFrame!==undefined)assert.ok((Math.floor(p.nextFrame/p.columns)+1)*cell<=png.height);
  }
 }
});

for(const [name,frames]of used)test(`${name}: all used whole-character poses have alpha and unclipped safe margins`,()=>{
 const png=atlas(name),cell=png.width/columns,margin=Math.max(6,Math.round(cell*.02));
 for(const frame of frames){
  const {pixels}=framePixels(name,frame);let visible=0,transparent=0,borderNonzero=0;
  for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
   const alpha=pixels[(y*cell+x)*4+3];
   if(alpha>200)visible++;if(alpha===0)transparent++;
   if((x<margin||y<margin||x>=cell-margin||y>=cell-margin)&&alpha!==0)borderNonzero++;
  }
  assert.ok(visible>cell*cell*.01,`${name}:${frame} is empty or excessively translucent`);
  assert.ok(transparent>cell*cell*.2,`${name}:${frame} lacks true transparency`);
  assert.equal(borderNonzero,0,`${name}:${frame} touches the ${margin}px safe border`);
 }
});

test('left and right walking use independent drawings, not copied or mirrored cells',()=>{
 const left=framePixels(clips.left.atlas,clips.left.frames[0]),right=framePixels(clips.right.atlas,clips.right.frames[0]);
 assert.equal(left.cell,right.cell);const cell=left.cell,mirrored=Buffer.alloc(right.pixels.length);
 for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
  const src=(y*cell+x)*4,dst=(y*cell+cell-1-x)*4;right.pixels.copy(mirrored,dst,src,src+4);
 }
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 assert.notEqual(hash(left.pixels),hash(right.pixels));assert.notEqual(hash(left.pixels),hash(mirrored));
});

test('blink frame 3 is a distinct populated pose',()=>{
 assert.equal(blinkFrame,3);
 const open=framePixels('custom-idle',0).pixels,closed=framePixels('custom-idle',blinkFrame).pixels;
 assert.notEqual(crypto.createHash('sha256').update(open).digest('hex'),crypto.createHash('sha256').update(closed).digest('hex'));
});

test('new expression neutral cells exactly match the approved idle drawing',()=>{
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const neutral=hash(framePixels('custom-idle',0).pixels);
 const actions=['happy','eat','sneak','hum','meal-break','curl','token-game','tail-sway','review','satisfied','peek','shock','pout','stretch'];
 for(const action of actions){
  const name=clips[action].atlas;
  assert.equal(hash(framePixels(name,0).pixels),neutral,`${action}: frame 0 changes the character on entry`);
  for(const frame of requiredFrames(name))if(isNeutral({atlas:name,frame}))assert.equal(hash(framePixels(name,frame).pixels),neutral,`${name}:${frame}: declared neutral must really be the same drawing`);
 }
});

test('jump atlas contains its own airborne lift and recovers to the standing baseline',()=>{
 const name=clips.jump.atlas,ground=visibleBounds(name,clips.jump.frames[0]),apex=visibleBounds(name,2),recovered=visibleBounds(name,clips.jump.frames.at(-1));
 assert.ok(apex.bottom<ground.bottom-20,'the source apex must already be raised');
 assert.ok(Math.abs(recovered.bottom-ground.bottom)<=4,'recovery must return to the shared floor');
});

test('Codex desktop and web exports preserve their manifests and distinct dimensions',async()=>{
 const dir=path.join(root,'codex-deepseek-pet'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'pet.json')));
 assert.equal(manifest.spriteVersionNumber,2);assert.equal(manifest.spritesheetPath,'spritesheet.webp');
 const desktop=await sharp(path.join(dir,'spritesheet.webp')).metadata(),web=await sharp(path.join(dir,'spritesheet-web.webp')).metadata();
 assert.equal(desktop.width,1536);assert.equal(desktop.height,2288);assert.equal(desktop.hasAlpha,true);assert.equal(web.height,1872);
});

test('the independently drawn icon retains required Windows sizes',async()=>{
 const icon=await sharp(path.join(root,'build/icon.png')).metadata();
 assert.equal(icon.width,512);assert.equal(icon.height,512);assert.equal(icon.hasAlpha,true);
 const ico=fs.readFileSync(path.join(root,'build/icon.ico')),sizes=[];
 for(let i=0;i<ico.readUInt16LE(4);i++)sizes.push(ico[6+i*16]||256);
 for(const size of [16,32,48,256])assert.ok(sizes.includes(size));
});
