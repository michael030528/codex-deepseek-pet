'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Motion=require('../src/renderer/motion.js'),Controller=require('../src/renderer/transition-controller.js');
const duration=c=>c.times.reduce((n,t)=>n+t,0);
const state=(action,started=0)=>({action,started,until:started+(Motion.clips[action]?.hold?60000:duration(Motion.clips[action])),mode:'company'});
const drawing=p=>`${p.atlas}:${p.frame}`;

test('expressive interruption starts on the visible drawing, settles through neutral, then starts the requested action',()=>{
 const c=new Controller(Motion),wave=state('wave'),when=Motion.clips.wave.times[0]+40;
 const before=c.sample(wave,when).pose,target=state('think',when);
 assert.equal(drawing(c.sample(target,when).pose),drawing(before));
 const route=c.bridge;assert.ok(route.duration<=370);
 assert.equal(drawing(route.route.at(-1).pose),drawing(Motion.sample('idle',0)));
 for(let t=when;t<when+route.duration;t+=13){const p=c.sample(target,t).pose;assert.equal(p.scaleX,1);assert.equal(p.scaleY,1);assert.equal(p.frameMix,undefined);}
 const start=c.sample(target,when+route.duration);
 assert.equal(start.action,'think');assert.equal(drawing(start.pose),drawing(Motion.sample('think',0)));
});

test('sleep exit uses the wake drawings from the visible sleeping pose before eating',()=>{
 const c=new Controller(Motion),sleep=state('sleep'),at=duration(Motion.clips.sleep)+100;
 const before=c.sample(sleep,at).pose,target=state('eat',at);
 assert.equal(drawing(c.sample(target,at).pose),drawing(before));
 const route=c.bridge;assert.ok(route.duration<=duration(Motion.clips.wake));
 const wake=Motion.clips.wake.frames.slice(Motion.clips.wake.frames.indexOf(before.frame)).filter((f,i,a)=>!i||f!==a[i-1]);
 assert.deepEqual(route.route.slice(0,-1).map(v=>v.pose.frame),wake);
 assert.equal(drawing(c.sample(target,at+route.duration).pose),drawing(Motion.sample('eat',0)));
});

test('a wake event received during a partial sleep starts from that exact sleep frame',()=>{
 const c=new Controller(Motion),sleep=state('sleep');
 for(let at=0;at<duration(Motion.clips.sleep);at+=173){
  c.active=null;c.source=null;c.lastPose=null;
  const before=c.sample(sleep,at).pose,wake=state('wake',at);
  const after=c.sample(wake,at).pose;
  if(Motion.isNeutral(before))assert.ok(Motion.isNeutral(after));else assert.equal(drawing(after),drawing(before));
 }
});

test('drag, fall and land immediately preempt pending recovery and never replay the queued expression',()=>{
 for(const action of ['drag','fall','land']){
  const c=new Controller(Motion);c.sample(state('wave'),300);c.sample(state('eat',300),300);assert.ok(c.bridge);
  const current=state(action,310),p=c.sample(current,310);
  assert.equal(p.action,action);assert.equal(drawing(p.pose),drawing(Motion.sample(action,0)));
  assert.equal(c.bridge,null);assert.equal(c.pending,null);
 }
});

test('walking keeps the native startup and distance clock without adding another turn delay',()=>{
 const c=new Controller(Motion);const before=c.sample(state('think'),350).pose;
 const right=state('right',400);
 assert.equal(drawing(c.sample(right,400).pose),drawing(before));assert.equal(c.bridge.duration,600);
 assert.deepEqual(c.bridge.route.slice(-6).map(s=>s.pose.frame),Motion.turnFrames.right);
 assert.equal(drawing(c.sample(right,1050,{walkElapsed:230}).pose),drawing(Motion.sample('right',830)));
 assert.equal(c.active.started,400);assert.equal(c.bridge,null);
 const stop=state('stop-right',1100);
 const visible=drawing(c.lastPose);
 assert.equal(drawing(c.sample(stop,1100).pose),visible);
 assert.equal(c.bridge.route.find(s=>s.pose.atlas==='custom-turn').pose.frame,Motion.clips['stop-right'].frames[0]);
});

test('repeat state notifications do not restart recovery and the newest expression replaces the pending one',()=>{
 const c=new Controller(Motion);c.sample(state('wave'),300);
 const eat=state('eat',300);c.sample(eat,300);const start=c.bridge.started;
 c.sample({...eat,message:'changed',revision:20},320);assert.equal(c.bridge.started,start);
 const think=state('think',330);c.sample(think,330);assert.equal(c.bridge.started,start);
 const end=start+c.bridge.duration;assert.equal(c.sample(think,end).action,'think');
});

test('interrupting walking uses the authored stop sequence instead of cutting a profile pose to front-facing idle',()=>{
 for(const direction of ['left','right']){
  const c=new Controller(Motion);const before=c.sample(state(direction),900,{walkElapsed:300}).pose;
  const target=state('think',900);assert.equal(drawing(c.sample(target,900).pose),drawing(before));
  const stop=Motion.clips['stop-'+direction];
  assert.deepEqual(c.bridge.route.filter(v=>v.pose.atlas===stop.atlas).map(v=>drawing(v.pose)),stop.frames.map(f=>`${stop.atlas}:${f}`));
  assert.ok(c.bridge.duration<=900);
 }
});

test('the main-process idle deadline does not truncate an action delayed by a short recovery',()=>{
 const c=new Controller(Motion);c.sample(state('sleep'),5000);
 const wave=state('wave',5000);c.sample(wave,5000);
 const delayedStart=5000+c.bridge.duration;c.sample(wave,delayedStart);
 const idle=state('idle',wave.until),at=wave.until;
 const result=c.sample(idle,at);
 assert.equal(result.action,'wave');assert.equal(drawing(result.pose),drawing(Motion.sample('wave',at-delayedStart)));
 assert.equal(drawing(c.sample(idle,delayedStart+duration(Motion.clips.wave)).pose),drawing(Motion.sample('idle',0)));
});

test('reduced motion bypasses recoveries and remains on the requested still frame',()=>{
 const c=new Controller(Motion);c.sample(state('sleep'),5000);
 const eat=state('eat',5000);const p=c.sample(eat,5000,{reduced:true});
 assert.equal(c.bridge,null);assert.deepEqual(p.pose,Motion.sample('eat',0,true));
});

test('a held thinking pose still returns to idle when the native deadline expires',()=>{
 const c=new Controller(Motion),thinking={...state('think'),until:1500};c.sample(thinking,1400);
 const idle=state('idle',1500);c.sample(idle,1500);assert.ok(c.bridge);
 assert.deepEqual(c.bridge.route.slice(0,-1).map(s=>s.pose.frame),[3,6,7,0]);
 assert.equal(drawing(c.sample(idle,1500+c.bridge.duration).pose),drawing(Motion.sample('idle',0)));
});

test('held and interrupted hand poses release along explicit exit drawings without replaying the expression',()=>{
 for(const action of ['think','surprise','wave','hungry','peek']){
  const c=new Controller(Motion),at=action==='think'||action==='surprise'?10000:300;
  const before=c.sample(state(action),at).pose;c.sample(state('eat',at),at);
  const expected=Motion.exitFrames(Motion.clips[action],before.frame,before.index);
  assert.deepEqual(c.bridge.route.slice(0,-1).map(s=>s.pose.frame),expected);
  assert.equal(expected.at(-1),0);
 }
});

test('interrupting an unfinished turn retraces only the already visible direction poses',()=>{
 for(const direction of ['left','right']){
  const c=new Controller(Motion),before=c.sample(state(direction),250).pose;c.sample(state('think',250),250);
  const frames=c.bridge.route.slice(0,-1).map(s=>s.pose.frame);
  assert.equal(frames[0],before.frame);assert.deepEqual(frames,Motion.turnFrames[direction].slice(0,3).reverse());
 }
});

test('a story recovery starts at the visible delayed story pose without first returning to idle',()=>{
 const c=new Controller(Motion),story=state('token-game');c.sample(story,1000);
 const before=c.lastPose,recovery=Motion.recoveryClip('token-game',1000);
 const result=c.sample({...state('story-recover',1000),recovery},1000);
 assert.equal(c.bridge,null);assert.equal(drawing(result.pose),drawing(before));
 assert.deepEqual(c.active.recovery.frames,Motion.exitFrames(Motion.clips['token-game'],before.frame,before.index));
});

test('late bows, review and landing settle without replaying earlier expressions or a jump preparation',()=>{
 for(const [action,at,frame,route]of [['sad',1600,7,[7,0]],['review',10000,2,[2,3,0]]]){
  const c=new Controller(Motion);assert.equal(c.sample(state(action),at).pose.frame,frame);
  c.sample(state('idle',at),at);
  assert.deepEqual(c.bridge.route.slice(0,-1).map(s=>s.pose.frame),route);
 }
 const c=new Controller(Motion);assert.equal(c.sample(state('jump'),900).pose.frame,4);
 const settled=c.sample(state('idle',900),900);
 assert.equal(c.bridge,null);assert.equal(drawing(settled.pose),drawing(Motion.sample('idle',0)));
 assert.deepEqual(Motion.exitFrames(Motion.clips.jump,0),[0,4]);
});

test('interrupting a seated expression preserves every rise pose at its authored recovery cadence',()=>{
 for(const action of ['meal-break','curl'])for(const frame of [1,3,4,5]){
  const clip=Motion.clips[action],index=clip.frames.indexOf(frame),at=clip.times.slice(0,index).reduce((a,b)=>a+b,0)+1;
  const c=new Controller(Motion),before=c.sample(state(action),at).pose;
  const target=state('wave',at);assert.equal(drawing(c.sample(target,at).pose),drawing(before));
  assert.deepEqual(c.bridge.route.slice(0,-1).map(s=>s.pose.frame),Motion.exitFrames(clip,frame));
  assert.ok(c.bridge.route.slice(0,-1).every(s=>s.ms===100));
  assert.equal(c.sample(target,at+c.bridge.duration).action,'wave');
 }
});

test('a pet interruption of a resting story stands up without introducing a bite',()=>{
 const c=new Controller(Motion),at=1800,story=state('meal-break');
 const before=c.sample(story,at).pose,recovery=Motion.recoveryClip('meal-break',at);
 c.sample({...state('story-recover',at),recovery},at);
 assert.equal(c.bridge,null);assert.equal(c.active.recovery.atlas,'custom-rest');
 assert.deepEqual(c.active.recovery.frames,Motion.exitFrames(Motion.clips['meal-break'],before.frame));
 assert.ok(c.active.recovery.times.every(ms=>ms===100));
});

test('sleep-delayed finite performances reserve their actual visual end before native wandering can begin',()=>{
 const {Companion}=require('../src/main/behavior.cjs');
 for(const action of ['meal-break','curl','eat','wave']){
  let now=100000;const brain=new Companion({now:()=>now,random:()=>0}),c=new Controller(Motion);
  const render=()=>{const s=brain.snapshot(),p=c.sample(s,now);brain.reserveVisual({action:s.action,started:s.started,until:c.completion(s)});return p;};
  brain.play('sleep','',60000,20);now+=3000;render();
  brain.play(action,'',5000,80);const nativeEnd=brain.until;render();
  const visualEnd=c.bridge.started+c.bridge.duration+duration(Motion.clips[action]);
  assert.ok(visualEnd>nativeEnd);assert.equal(brain.until,visualEnd,action);
  now=nativeEnd;brain.tick();const beforeEnd=render();
  assert.equal(brain.action,action);assert.ok([action,'transition-recover'].includes(beforeEnd.action));assert.equal(brain.canWander(),false);
  if(['meal-break','curl'].includes(action))assert.equal(Motion.isNeutral(beforeEnd.pose),false,'this is still a seated pose at the old deadline');
  now=visualEnd;brain.tick();const completed=render();
  assert.equal(brain.action,'idle');assert.ok(Motion.isNeutral(completed.pose));assert.equal(brain.canWander(),true);
  brain.play('right','',30000,1);render();assert.equal(c.bridge,null,'walking starts from the already standing pose');
  now+=600;assert.equal(render().pose.walking,true,'the native 600 ms turn and rendered gait remain synchronized');
 }
});

test('replacing a queued performance reports the newest visual schedule without replaying the discarded one',()=>{
 const c=new Controller(Motion);c.sample(state('sleep'),3000);
 const rest=state('meal-break',3000);c.sample(rest,3000);
 const wave=state('wave',3100);c.sample(wave,3100);
 const end=c.bridge.started+c.bridge.duration+duration(Motion.clips.wave);
 assert.equal(c.completion(wave),end);
 assert.equal(c.sample(wave,end).action,'wave');assert.ok(Motion.isNeutral(c.lastPose));
});
