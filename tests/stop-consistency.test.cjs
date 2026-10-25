const test=require('node:test'),assert=require('node:assert/strict');
const m=require('../src/renderer/motion.js'),Controller=require('../src/renderer/transition-controller.js');
test('every gait phase settles before an upright turn and finishes on the canonical front',()=>{
 for(const direction of ['left','right'])for(let phase=0;phase<8;phase++){
  const c=new Controller(m),walk={action:direction,started:0,until:30000,mode:'company'};
  const before=c.sample(walk,1000,{walkElapsed:phase*110}).pose;
  const stop={action:'stop-'+direction,started:1000,until:1420,mode:'company'};
  const first=c.sample(stop,1000).pose;
  assert.equal(first.atlas,before.atlas);assert.equal(first.frame,before.frame);
  const route=c.bridge.route,turn=route.filter(s=>s.pose.atlas==='custom-turn');
  assert.deepEqual(turn.map(s=>s.pose.frame),direction==='right'?[3,2,1,0]:[7,6,5,4]);
  assert.deepEqual(turn.map(s=>s.ms),[100,100,100,100]);
  const lastGait=route.filter(s=>s.pose.atlas===m.clips[direction].atlas).at(-1);
  assert.ok(m.gait.settleFrames[direction].includes(lastGait.pose.frame));
  const end=c.bridge.started+c.bridge.duration;
  assert.ok(c.completion(stop)>=end);
  c.sample({...stop,action:'idle',started:1420,until:1420},1420);
  const final=c.sample({...stop,action:'idle',started:1420,until:1420},end).pose;
  assert.equal(final.atlas,'custom-idle');assert.equal(final.frame,0);
 }
});

test('reversing during a stop bridge releases the visible outgoing side before turning',()=>{
 for(const direction of ['left','right'])for(let phase=0;phase<8;phase++){
  const other=direction==='left'?'right':'left';
  for(const during of [20,200,400]){
   const c=new Controller(m),walk={action:direction,started:0,until:30000,mode:'company'};
   c.sample(walk,1000,{walkElapsed:phase*110});
   const stop={action:'stop-'+direction,started:1000,until:1400,mode:'company'};
   c.sample(stop,1000);const before=c.sample(stop,1000+during).pose;
   const reversed={action:other,started:1000+during,until:31000+during,mode:'company'};
   const after=c.sample(reversed,1000+during).pose;
   if(m.isNeutral(before))continue;
   assert.equal(after.atlas,before.atlas);assert.equal(after.frame,before.frame);
   const route=c.bridge.route,front=route.findIndex(s=>m.isNeutral(s.pose));
   assert.ok(front>=0);
   const release=route.slice(0,front+1);
   const turns=release.filter(s=>s.pose.atlas==='custom-turn').map(s=>s.pose.frame);
   if(before.atlas===m.clips[direction].atlas){
    const gait=release.filter(s=>s.pose.atlas===m.clips[direction].atlas);
    assert.ok(m.gait.settleFrames[direction].includes(gait.at(-1).pose.frame));
    assert.deepEqual(turns,m.clips['stop-'+direction].frames);
   }else{
    const at=m.turnFrames[direction].indexOf(before.frame);
    assert.deepEqual(turns,m.turnFrames[direction].slice(0,at+1).reverse().filter((f,i,a)=>!i||f!==a[i-1]));
   }
   assert.deepEqual(route.slice(-m.turnFrames[other].length).map(s=>s.pose.frame),m.turnFrames[other]);
  }
 }
});

test('repeated direction changes retain the side of the drawing still on screen',()=>{
 const c=new Controller(m);
 c.sample({action:'right',started:0,until:30000,mode:'company'},1000,{walkElapsed:440});
 c.sample({action:'stop-right',started:1000,until:1400,mode:'company'},1000);
 c.sample({action:'left',started:1020,until:31020,mode:'company'},1020);
 const before=c.lastPose;
 c.sample({action:'right',started:1040,until:31040,mode:'company'},1040);
 assert.equal(c.lastPose.atlas,before.atlas);assert.equal(c.lastPose.frame,before.frame);
 const front=c.bridge.route.findIndex(s=>m.isNeutral(s.pose));
 assert.deepEqual(c.bridge.route.slice(0,front+1).filter(s=>s.pose.atlas==='custom-turn').map(s=>s.pose.frame),m.clips['stop-right'].frames);
});

const visibleLegBlend=p=>p.walkRecovery===undefined?p.walkBlend??1:1-p.walkRecovery*p.walkRecovery*(3-2*p.walkRecovery);
test('reversing or stopping again during foot release continues its visible blend and pose',()=>{
 for(const direction of ['left','right'])for(const replacement of ['left','right','stop-left','stop-right']){
  const c=new Controller(m),walk={action:direction,started:0,until:30000,mode:'company'};
  c.sample(walk,1000,{walkElapsed:440});
  const stop={action:'stop-'+direction,started:1000,until:1400,mode:'company'};c.sample(stop,1000);
  const route=c.bridge.route,releaseIndex=route.findIndex(s=>s.pose.walkRecovery!==undefined);
  const releaseAt=1000+route.slice(0,releaseIndex).reduce((sum,s)=>sum+s.ms,0);
  const at=releaseAt+route[releaseIndex].ms*.45,before=c.sample(stop,at).pose;
  assert.ok(before.walkRecovery>0&&before.walkRecovery<1);
  const state={action:replacement,started:at,until:at+30000,mode:'company'},after=c.sample(state,at).pose;
  assert.equal(after.atlas,before.atlas);assert.equal(after.frame,before.frame);
  assert.equal(after.walkRecovery,before.walkRecovery);assert.equal(visibleLegBlend(after),visibleLegBlend(before));
  assert.equal(c.bridge.route[0].pose.walkRecoveryStart,before.walkRecovery);
  const release=c.bridge.route[0];
  let previous=visibleLegBlend(after);
  for(let step=1;step<10;step++){
   const p=c.sample(state,at+release.ms*step/10).pose;
   assert.equal(p.frame,before.frame);assert.ok(visibleLegBlend(p)<previous);previous=visibleLegBlend(p);
  }
  const side=c.sample(state,at+release.ms+1e-5).pose;
  assert.equal(side.atlas,'custom-turn');assert.equal(side.frame,direction==='left'?7:3);
 }
});

test('stopping while feet are still opening never restores a full gait before their release',()=>{
 for(const direction of ['left','right'])for(const elapsed of [0,35,80,120]){
  const c=new Controller(m),walk={action:direction,started:0,until:30000,mode:'company'};
  const before=c.sample(walk,1000,{walkElapsed:elapsed}).pose,blend=visibleLegBlend(before);
  const stop={action:'stop-'+direction,started:1000,until:1400,mode:'company'};
  const after=c.sample(stop,1000).pose;assert.equal(visibleLegBlend(after),blend);
  let at=1000;
  for(const step of c.bridge.route){
   if(step.pose.atlas!=='custom-running-'+direction)break;
   if(step.ms>0){
    const start=c.sample(stop,at+1e-7).pose;
    assert.ok(Math.abs(visibleLegBlend(start)-blend)<1e-6);
    if(step.pose.walkRecovery!==undefined){
     const halfway=c.sample(stop,at+step.ms*.5).pose;
     assert.ok(visibleLegBlend(halfway)<=blend);
    }
   }
   at+=step.ms;
  }
 }
});
