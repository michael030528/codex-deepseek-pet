'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Motion=require('../src/renderer/motion.js'),Controller=require('../src/renderer/transition-controller.js');
const {advanceWalk,gait,gaitElapsed}=require('../src/main/walk.cjs');
const {Companion}=require('../src/main/behavior.cjs');
const duration=c=>c.times.reduce((a,b)=>a+b,0);
const drawing=p=>`${p.atlas}:${p.frame}`;
const state=(action,started=1000)=>({action,started,until:started+duration(Motion.clips[action]),mode:'company'});

test('a measured stride advances exactly one gait cycle at every display scale and direction',()=>{
 for(const direction of ['left','right'])for(const scale of [.01,.25,.5,1,1.8]){
  const stride=gait.strideSourcePx[direction]*gait.canvasSize/gait.cellSize*scale;
  assert.ok(Math.abs(gaitElapsed(stride,scale,direction)-duration(Motion.clips[direction]))<1e-8);
  assert.equal(gaitElapsed(0,scale,direction),0);
 }
});

test('accelerating, braking and changing scale accumulate phase from actual fractional travel',()=>{
 for(const direction of ['left','right']){
  const sign=direction==='left'?-1:1;let x=0,remainder=0,phase=0,expectedCycles=0;
  for(let tick=0;tick<600;tick++){
   const scale=tick<300?.25:1.6,dt=[.016,.017,.033][tick%3],rate=Math.min(1,tick/60,(600-tick)/90);
   const before=remainder,step=advanceWalk(sign*10000,gait.speed*scale*rate*dt,remainder);
   const distance=Math.abs(step.step)+step.remainder-before;
   x+=step.step;remainder=step.remainder;phase+=gaitElapsed(distance,scale,direction);
   expectedCycles+=distance/(gait.strideSourcePx[direction]*gait.canvasSize/gait.cellSize*scale);
   assert.ok(Math.abs(phase/duration(Motion.clips[direction])-expectedCycles)<1e-9);
  }
  assert.ok(sign*x>0);assert.ok(remainder>=0&&remainder<1);
 }
});

test('walk packets are paired with action and start generation, including packets arriving before state',()=>{
 const clock=new Motion.WalkClock(),old=state('right',1000),next=state('right',5000),left=state('left',5000);
 clock.update({...old,elapsed:760,offset:.4});clock.update({...next,elapsed:5,offset:.1});
 assert.equal(clock.forState(old).elapsed,760);assert.equal(clock.forState(next).elapsed,5);
 assert.equal(clock.forState(left).elapsed,0);
 clock.update({...old,elapsed:770,offset:.5});
 assert.equal(clock.forState(next).elapsed,5,'a late old-run packet must not replace the new run');
 assert.equal(clock.update({...next,elapsed:4,offset:.9}),false);
 assert.equal(clock.forState(next).offset,.1);
 assert.equal(clock.update({elapsed:12345,offset:10}),false,'unpaired packets are rejected');
});

test('terminal packets retain the final distance phase during the native state delivery gap',()=>{
 for(const direction of ['left','right']){
  const clock=new Motion.WalkClock(),c=new Controller(Motion),walk=state(direction),now=5100;
  clock.update({...walk,elapsed:410,offset:.6});
  const before=c.sample(walk,now,{walkElapsed:clock.forState(walk).elapsed}).pose;
  // The old stop protocol sent null; even such a terminal packet must retain
  // the last valid distance rather than switch the renderer back to wall time.
  clock.update({...walk,elapsed:direction==='left'?null:410,offset:0,ended:true});
  for(let delay=1;delay<33;delay++)assert.equal(drawing(c.sample(walk,now+delay,{walkElapsed:clock.forState(walk).elapsed}).pose),drawing(before));
  assert.equal(clock.forState(walk).offset,0);
  assert.equal(clock.update({...walk,elapsed:9999,offset:.9}),false,'an ended generation cannot resume');
  assert.equal(drawing(c.sample(state('stop-'+direction,now+33),now+33).pose),drawing(before));
 }
});

test('each left and right stop starts on the visible gait pose then finishes support before gathering feet',()=>{
 for(const direction of ['left','right'])for(let frame=0;frame<8;frame++){
  const c=new Controller(Motion),walk=state(direction),at=3000,elapsed=frame*110+20;
  const before=c.sample(walk,at,{walkElapsed:elapsed}).pose;
  const stop=state('stop-'+direction,at);assert.equal(drawing(c.sample(stop,at).pose),drawing(before));
  const steps=c.bridge.route,gaitSteps=steps.filter(s=>s.pose.atlas===Motion.clips[direction].atlas);
  assert.equal(gaitSteps[0].pose.frame,frame);
  for(let i=1;i<gaitSteps.length;i++)assert.equal(gaitSteps[i].pose.frame,(gaitSteps[i-1].pose.frame+1)%8);
  assert.ok(gait.settleFrames[direction].includes(gaitSteps.at(-1).pose.frame));
  assert.ok(gaitSteps.length<=4);
  assert.deepEqual(steps.filter(s=>s.pose.atlas==='custom-turn').map(s=>s.pose.frame),Motion.clips['stop-'+direction].frames);
  assert.ok(!steps.some(s=>s.pose.atlas==='custom-turn'&&[9,11].includes(s.pose.frame)));
  assert.equal(drawing(c.sample(stop,at+c.bridge.duration).pose),drawing(Motion.sample('idle',0)));
 }
});

test('stop recovery reserves the actual visual end so the native deadline cannot cut off the legs',()=>{
 for(const direction of ['left','right'])for(let frame=0;frame<8;frame++){
  let now=100000;const brain=new Companion({now:()=>now,random:()=>0}),c=new Controller(Motion);
  brain.play(direction,'',30000,1);now+=2000;c.sample(brain.snapshot(),now,{walkElapsed:frame*110+20});
  brain.until=0;brain.play('stop-'+direction,'',0,1);const nativeEnd=brain.until;
  const stop=brain.snapshot();c.sample(stop,now);const visualEnd=c.completion(stop);
  assert.ok(visualEnd>nativeEnd);assert.equal(brain.reserveVisual({action:stop.action,started:stop.started,until:visualEnd}),true);
  now=nativeEnd;brain.tick();assert.equal(brain.action,stop.action);
  assert.equal(c.sample(brain.snapshot(),now).action,'transition-recover');
  now=visualEnd;brain.tick();assert.equal(drawing(c.sample(brain.snapshot(),now).pose),drawing(Motion.sample('idle',0)));
 }
});

test('authored running feet stay on their drawn ground plane without procedural vertical lift',()=>{
 for(const direction of ['left','right'])for(let elapsed=0;elapsed<10000;elapsed+=7){
  const pose=Motion.sample(direction,elapsed);assert.equal(pose.y,0);assert.equal(pose.scaleX,1);assert.equal(pose.scaleY,1);
 }
});
