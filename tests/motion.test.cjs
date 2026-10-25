'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {sample,clips,atlasNames,blinkFrame,blinkAt,recoveryClip,transition,turnFrames,requiredFrames,isNeutral,exitFrames}=require('../src/renderer/motion.js');
const {ACTIONS}=require('../src/main/behavior.cjs');
const originalActions=['meal-break','token-game','tail-sway','story-recover','stop-left','stop-right','wake','drag','fall','land','shift','settle','breathe','idle','think','proud','happy','hungry','eat','protest','sad','wave','sleep','left','right','surprise','jump','peek','dance','stretch','sneak','satisfied','review','shock','pout','sorry','hum','curl'];
const duration=c=>c.times.reduce((a,b)=>a+b,0);
const startOffset=action=>['left','right'].includes(action)?600:0;
const poseFields=['x','y','scaleX','scaleY','rotation','duration'];

test('all original actions have valid custom clips and deterministic finite samples',()=>{
 for(const name of new Set([...originalActions,...Object.keys(ACTIONS)])){
  const c=clips[name];assert.ok(c,`missing action: ${name}`);
  assert.match(c.atlas,/^custom-/);assert.ok(atlasNames.includes(c.atlas));
  assert.ok(c.frames.length>0);assert.equal(c.frames.length,c.times.length);
  assert.ok(c.frames.every(f=>Number.isInteger(f)&&f>=0),name);
  assert.ok(c.times.every(t=>Number.isFinite(t)&&t>0),name);
  for(const t of [0,37,duration(c)/2+startOffset(name),duration(c)+startOffset(name),100000]){
   const p=sample(name,t);assert.deepEqual(p,sample(name,t));
   assert.ok(atlasNames.includes(p.atlas));assert.equal(p.columns,4);
   assert.ok(Number.isInteger(p.frame)&&p.frame>=0);assert.equal(p.flip,false);
   for(const key of poseFields)assert.ok(Number.isFinite(p[key]),`${name}/${t}: ${key}`);
   assert.equal(p.scaleX,1);assert.equal(p.scaleY,1);
   for(const key of ['nextAtlas','nextFrame','frameMix','entryFlow'])assert.equal(key in p,false,`${name}/${t}: only authored frames may be sampled`);
  }
 }
 assert.deepEqual(sample('unknown-action',0),sample('idle',0));
});

test('finite actions return to idle while sleeping and other held actions retain their last frame',()=>{
 for(const [name,c]of Object.entries(clips)){
  const end=duration(c)+startOffset(name);
  if(!c.loop&&!c.hold){
   assert.deepEqual(sample(name,end),sample('idle',0),name);
   assert.deepEqual(sample(name,end+1500),sample('idle',1500),name);
  }else if(c.hold)for(const t of [end,end+1,100000]){
   const p=sample(name,t);assert.equal(p.atlas,c.atlas,name);assert.equal(p.frame,c.frames.at(-1),name);
  }
 }
 assert.equal(clips.sleep.hold,true);assert.equal(sample('sleep',100000).frame,7);
 for(const action of ['curl','meal-break']){assert.equal(clips[action].hold,false);assert.equal(clips[action].loop,false);assert.deepEqual(sample(action,100000),sample('idle',100000-duration(clips[action])));}
});

test('both walking directions turn for 600ms then use independent non-mirrored gait clips',()=>{
 assert.notEqual(clips.left.atlas,clips.right.atlas);
 assert.equal(clips.left.atlas,'custom-running-left');assert.equal(clips.right.atlas,'custom-running-right');
 for(const action of ['right','left']){
  const frames=turnFrames[action];assert.equal(frames.length,6);
  for(let i=0;i<frames.length;i++)for(const t of [i*100,i*100+99]){
   const p=sample(action,t);assert.equal(p.atlas,'custom-turn');assert.equal(p.frame,frames[i]);
   assert.equal(p.walking,false);assert.equal(p.flip,false);
  }
  const firstWalk=sample(action,600);assert.equal(firstWalk.atlas,clips[action].atlas);
  assert.equal(firstWalk.frame,clips[action].frames[0]);assert.equal(firstWalk.walking,true);assert.equal(firstWalk.flip,false);
  let at=600;
  for(const [index,ms]of clips[action].times.entries()){assert.equal(sample(action,at).frame,clips[action].frames[index]);at+=ms;}
  assert.equal(sample(action,at).frame,clips[action].frames[0]);
  const stop='stop-'+action,c=clips[stop];
  assert.deepEqual(c.frames,[...new Set(frames)].reverse());assert.equal(duration(c),400);
  assert.equal(sample(stop,0).frame,frames.at(-2));assert.equal(sample(stop,duration(c)-1).frame,frames[0]);
  assert.equal(sample(stop,duration(c)).atlas,'custom-idle');
 }
 assert.equal(requiredFrames('custom-turn').includes(9),false,'retired high-kick launch must not preload');
 assert.equal(requiredFrames('custom-turn').includes(8),false,'retired forward lean must not reappear at stop');
 assert.equal(requiredFrames('custom-turn').includes(10),false,'retired opposite forward lean must not reappear at stop');
 assert.equal(requiredFrames('custom-turn').includes(11),false,'retired opposite launch must not preload');
});

test('timeline stages are contiguous and coincide with real frame boundaries',()=>{
 for(const [action,c]of Object.entries(clips)){
  if(!c.stages)continue;
  let at=0;const boundaryFrame=new Map([[0,0]]);
  c.times.forEach((ms,index)=>{at+=ms;boundaryFrame.set(at,index+1);});
  assert.equal(c.stages[0].start,0,action);assert.equal(c.stages.at(-1).end,at,action);
  for(const [index,stage]of c.stages.entries()){
   assert.ok(stage.end>stage.start,`${action}/${stage.name}`);
   assert.ok(boundaryFrame.has(stage.start));assert.ok(boundaryFrame.has(stage.end));
   if(index)assert.equal(stage.start,c.stages[index-1].end);
   assert.equal(sample(action,stage.start).frame,c.frames[boundaryFrame.get(stage.start)]);
   assert.equal(sample(action,stage.end-1).frame,c.frames[boundaryFrame.get(stage.end)-1]);
  }
 }
 const closed=clips.sleep.stages.find(s=>s.name==='close-eyes').start;
 for(let t=closed;t<10000;t+=19)assert.ok([5,6,7].includes(sample('sleep',t).frame));
});

test('reduced motion remains still even long after a finite clip would normally finish',()=>{
 for(const action of Object.keys(clips)){
  const initial=sample(action,0,true);
  for(const t of [50,599,600,duration(clips[action])+1,100000])assert.deepEqual(sample(action,t,true),initial,`${action}/${t}`);
  for(const key of ['x','y','rotation','blink'])assert.equal(Math.abs(initial[key]),0,`${action}: ${key}`);
  assert.equal(initial.scaleX,1);assert.equal(initial.scaleY,1);assert.equal(initial.frameMix,undefined);
  for(const elapsed of [-1,NaN,Infinity]){
   const p=sample(action,elapsed);for(const key of poseFields)assert.ok(Number.isFinite(p[key]));
  }
 }
});

test('idle uses closed-eye frame 3 for brief irregular blinks in rendering and hit testing',()=>{
 assert.equal(blinkFrame,3);let active=0;
 for(let t=0;t<30000;t+=10){
  const p=sample('idle',t);assert.equal(p.frame,0);assert.equal(p.atlas,'custom-idle');
  assert.equal(p.scaleX,1);assert.equal(p.scaleY,1);assert.ok(p.blink>=0&&p.blink<=1);
  if(p.blink>0)active++;
 }
 assert.ok(active>40&&active<110);assert.equal(blinkAt(3000),0);assert.ok(blinkAt(5100)>.9);
 assert.equal(sample('idle',5100,true).blink,0);
 const source=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
 assert.match(source,/needed=PetMotion\.requiredFrames\(name\)/);assert.ok(requiredFrames('custom-idle').includes(blinkFrame));
 assert.match(source,/const frame=p\.blink>\.35\?PetMotion\.blinkFrame:p\.frame/);
 assert.match(source,/const hitFrame=p\.blink>\.35\?PetMotion\.blinkFrame:/);
});

test('story interruption starts recovery on the current frame and ends on idle',()=>{
 for(const action of ['hum','meal-break','token-game']){
  const end=duration(clips[action]);
  for(let t=0;t<end;t+=37){
   const before=sample(action,t),recovery=recoveryClip(action,t);
   assert.ok(recovery);assert.equal(recovery.frames[0],before.frame);assert.equal(recovery.atlas,before.atlas);
   assert.equal(recovery.frames.length,recovery.times.length);
   assert.ok(recovery.times.every(ms=>ms>0));assert.ok(duration(recovery)<=1800);
   const first=sample('story-recover',0,false,recovery);
   assert.equal(first.atlas,before.atlas);assert.equal(first.frame,before.frame);
   assert.equal('entryFlow' in recovery,false);
   for(let at=0;at<duration(recovery);at+=23){const p=sample('story-recover',at,false,recovery);assert.equal(p.scaleX,1);assert.equal(p.scaleY,1);assert.equal('frameMix' in p,false);}
   assert.deepEqual(sample('story-recover',duration(recovery),false,recovery),sample('idle',0));
  }
 }
 assert.equal(recoveryClip('idle',100),null);assert.equal(recoveryClip('missing',100),null);
});

test('authored sleep and hand-release routes include every new drawing and end at canonical neutral',()=>{
 assert.deepEqual(clips.sleep.frames,[0,1,8,9,3,10,11,12,4,5,6,7]);
 assert.deepEqual(clips.wake.frames,[...clips.sleep.frames].reverse());
 assert.ok(duration(clips.sleep)<2600);assert.ok(duration(clips.wake)<1600);
 for(const action of ['wave','hungry']){
  const c=clips[action];assert.deepEqual(c.frames.slice(-3),c.exitFrames);
 }
 assert.deepEqual(clips.think.exitFrames,[6,7,0]);assert.deepEqual(clips.surprise.exitFrames,[6,7,0]);
 for(const c of Object.values(clips))for(const frame of [...(c.exitFrames||[]),...Object.values(c.exitRoutes||{}).flat()])assert.ok(requiredFrames(c.atlas).includes(frame));
 assert.deepEqual(new Set(atlasNames),new Set([...Object.values(clips).map(c=>c.atlas),'custom-turn']));
});

test('the eighteen expression buttons resolve to their own semantic drawings',()=>{
 const {Companion}=require('../src/main/behavior.cjs');
 const source=fs.readFileSync(path.join(__dirname,'../src/renderer/companion.js'),'utf8');
 const items=require('node:vm').runInNewContext(source.match(/const expressions=(\[.*\]);/)[1]);
 const expected={pet:['happy','affection'],feed:['eat','eat'],dance:['dance','dance'],celebrate:['jump','jumping'],wave:['wave','waving'],peek:['peek','peek'],sneak:['sneak','sneak'],satisfied:['satisfied','satisfied'],review:['review','review'],shock:['shock','shock'],pout:['pout','pout'],sorry:['sorry','failed'],hum:['hum','hum'],'meal-break':['meal-break','rest'],'token-game':['token-game','token-game'],'tail-sway':['tail-sway','tail'],curl:['curl','curl'],stretch:['stretch','stretch']};
 assert.equal(items.length,Object.keys(expected).length);
 const seen=new Set();
 for(const [label,event]of items){
  const b=new Companion({now:()=>1000,random:()=>0});assert.equal(b.interact(event),true,label);
  const [action,atlas]=expected[event];assert.equal(b.action,action,label);assert.equal(clips[action].atlas,'custom-'+atlas,label);seen.add(clips[action].atlas);
 }
 assert.equal(seen.size,items.length,'different expression labels must not alias the same atlas');
});

test('food release never replays a bite and early prop release does not start eating',()=>{
 for(const [action,early,mouth,lower]of [['eat',[1,2],[3,4],[5,6,7]],['sneak',[1,2],[3],[4,5,6]],['token-game',[1,2,3],[4],[5]]]){
  const c=clips[action];
  for(const frame of early)assert.ok(exitFrames(c,frame).every(f=>!mouth.includes(f)),`${action}/${frame}: no new bite`);
  for(const frame of lower)assert.ok(exitFrames(c,frame).every(f=>!mouth.includes(f)&&!early.includes(f)),`${action}/${frame}: no replay`);
  for(const frame of new Set(c.frames)){
   const route=exitFrames(c,frame);assert.equal(route[0],frame);assert.ok(isNeutral({atlas:c.atlas,frame:route.at(-1)}));
  }
 }
});

test('seated performances sit, rest, and fully stand without switching to the automatic sleep atlas',()=>{
 for(const action of ['meal-break','curl']){
  const c=clips[action];assert.notEqual(c.atlas,clips.sleep.atlas);
  assert.deepEqual(c.frames,[0,1,3,4,5,4,3,1,0]);
  assert.equal(duration(c),action==='meal-break'?3290:2980,'removing the deep squat must not change the performance duration');
  assert.equal(requiredFrames(c.atlas).includes(2),false,'the low inherited squat must never be preloaded or displayed');
  for(const frame of [1,3,4,5])assert.deepEqual(exitFrames(c,frame),[5,4,3,1,0].filter(f=>f<=frame));
 }
 for(const atlas of ['custom-rest','custom-curl','custom-stretch','custom-shock']){
  assert.equal(isNeutral({atlas,frame:0}),true);
  for(const frame of requiredFrames(atlas).filter(f=>f!==0))assert.equal(isNeutral({atlas,frame}),false);
 }
 assert.equal(isNeutral({atlas:'custom-jumping',frame:0}),false);assert.equal(isNeutral({atlas:'custom-jumping',frame:4}),true);
 assert.equal(isNeutral({atlas:'custom-token-game',frame:6}),true);
 assert.equal(isNeutral({atlas:'unregistered-atlas',frame:0}),false);
});

test('jump drawings supply the lift without an additional renderer y displacement',()=>{
 for(let t=0;t<=duration(clips.jump)+100;t+=7)assert.equal(sample('jump',t).y,0);
 assert.equal(sample('drag',1000).y,0);assert.equal(sample('fall',1000).y,0);
 assert.equal(sample('drag',1000).frame,2);assert.equal(sample('fall',1000).frame,3);
});

test('transitions interpolate only rigid movement while preserving the incoming drawing and proportions',()=>{
 const from={...sample('drag',0),x:12,y:-30,scaleX:.92,scaleY:1.08,rotation:.14},to=sample('idle',0);
 const start=transition(from,to,0),mid=transition(from,to,90),end=transition(from,to,180);
 for(const key of ['x','y','rotation']){
  assert.equal(start[key],from[key]);assert.equal(mid[key],(from[key]+to[key])/2);
 }
 assert.equal(start.atlas,to.atlas);assert.equal(start.frame,to.frame);assert.deepEqual(end,to);
 for(const p of [start,mid,end]){assert.equal(p.scaleX,1);assert.equal(p.scaleY,1);}
 for(const action of Object.keys(clips))for(const t of [0,16,90,179,180]){
  const p=transition(from,sample(action,500),t);assert.ok(Number.isFinite(p.y));assert.equal(p.scaleX,1);assert.equal(p.scaleY,1);assert.equal('frameMix' in p,false);
 }
});

test('runtime retains pointer-independent animation behavior',()=>{
 for(const file of ['src/renderer/app.js','src/preload.cjs','src/main/main.cjs']){
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');assert.doesNotMatch(source,/lookIndex|pointerVector|onPointer|gaze\.png/);
 }
});
