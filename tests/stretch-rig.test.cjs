'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Rig=require('../src/renderer/stretch-rig.js'),Motion=require('../src/renderer/motion.js'),Controller=require('../src/renderer/transition-controller.js');
test('waist motion moves both ways smoothly and preserves every vertical coordinate',()=>{
 assert.equal(Motion.clips.stretch.times.reduce((a,b)=>a+b,0),Rig.duration);
 assert.equal(Rig.amount(0),0);assert.equal(Rig.amount(Rig.duration),0);
 let previous=0,min=0,max=0,moving=0;
 for(let t=0;t<=Rig.duration;t+=1000/60){
  const pose={stretchTime:t},shift=Rig.offset(pose,305);min=Math.min(min,shift);max=Math.max(max,shift);
  if(Math.abs(shift-previous)>.001)moving++;
  assert.ok(Math.abs(shift-previous)<.9,'no horizontal pose jump');previous=shift;
  for(const y of [120,230,280,305,330,340,380,476]){
   const p=Rig.mapPoint(pose,242,y),inverse=Rig.inversePoint(pose,p.x,p.y);
   assert.equal(p.y,y);assert.ok(Math.abs(inverse.x-242)<1e-10);assert.equal(inverse.y,y);
   if(y>=Rig.waistY)assert.deepEqual(p,{x:242,y});
  }
 }
 assert.ok(min<-11.9&&max>11.9);assert.ok(moving>100);
});
test('an interruption returns from the visible waist position without a snap',()=>{
 const controller=new Controller(Motion),state={action:'stretch',started:0,until:Rig.duration,mode:'company'};
 const visible=controller.sample(state,800).pose;
 const interrupted={action:'eat',started:800,until:4000,mode:'company'};
 const start=controller.sample(interrupted,800).pose,mid=controller.sample(interrupted,940).pose,end=controller.sample(interrupted,1079).pose;
 assert.equal(Rig.poseAmount(start),Rig.poseAmount(visible));
 assert.ok(Math.abs(Rig.poseAmount(mid))<Math.abs(Rig.poseAmount(start)));
 assert.ok(Math.abs(Rig.poseAmount(end))<.00001);
});
test('reduced motion keeps the original resting pose',()=>{
 for(const t of [0,400,1000,2400]){const pose=Motion.sample('stretch',t,true);assert.equal(pose.stretchTime,undefined);assert.equal(pose.frame,0);}
});
