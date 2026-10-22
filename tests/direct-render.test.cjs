'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Motion=require('../src/renderer/motion.js'),{sample,clips,recoveryClip,atlasNames,requiredFrames}=Motion;
const Controller=require('../src/renderer/transition-controller.js');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/renderer/app.js'),'utf8');
const duration=c=>c.times.reduce((a,b)=>a+b,0);

test('production renderer has no optical-flow resource or image-warp dependency',()=>{
 const html=fs.readFileSync(path.join(root,'src/renderer/index.html'),'utf8');
 assert.doesNotMatch(html,/motion-flow|flow\.js/);
 assert.doesNotMatch(source,/\b(?:PetFlow|flowRenderer|frameMix|nextAtlas|nextFrame|entryFlow)\b/);
});

test('every action, turn and interrupted story paints exactly one complete authored bitmap',()=>{
 const paintSource=source.slice(source.indexOf('function paint('),source.indexOf('function draw('));
 assert.ok(paintSource.length>0);
 const spriteFrames={},calls=[];
 for(const atlas of atlasNames){
  spriteFrames[atlas]={};for(const frame of requiredFrames(atlas))spriteFrames[atlas][frame]={atlas,frame};
 }
 const ctx={save(){},restore(){},translate(){},rotate(){},scale(x,y){assert.equal(Math.abs(x),1);assert.equal(y,1);},drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};
 const sandbox={ctx,spriteFrames,PetMotion:require('../src/renderer/motion.js')};
 vm.runInNewContext(paintSource+';globalThis.paintAuthored=paint;',sandbox);
 const check=p=>{
  calls.length=0;sandbox.paintAuthored(p);assert.equal(calls.length,1);
  const expected=p.blink>.35?3:p.frame;
  assert.equal(calls[0].args[0],spriteFrames[p.atlas][expected]);assert.equal(calls[0].alpha,1);
  assert.equal(calls[0].args.length,5,'draw the whole image, never crop parts to reconstruct a pose');
 };
 for(const [action,c]of Object.entries(clips))for(let t=0;t<=duration(c)+700;t+=23)check(sample(action,t));
 check(sample('idle',5100));
 for(const action of Object.keys(clips)){
  const controller=new Controller(Motion),state={action,started:0};controller.sample(state,400);
  controller.sample({action:'idle',started:400},400);
  for(const step of controller.bridge?.route||[])check(step.pose);
 }
 for(const action of ['hum','meal-break','token-game'])for(let at=0;at<duration(clips[action]);at+=79){
  const recovery=recoveryClip(action,at);for(let t=0;t<=duration(recovery)+1;t+=47)check(sample('story-recover',t,false,recovery));
 }
});
