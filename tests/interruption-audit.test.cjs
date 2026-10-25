const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../src/renderer/motion.js'),C=require('../src/renderer/transition-controller.js'),R=require('../src/renderer/stretch-rig.js');
const s=(action,started)=>({action,started,until:started+60000,mode:'company'});
test('jump interrupted at its peak descends before landing',()=>{
 const c=new C(M);const p=c.sample(s('jump',0),400).pose;assert.equal(p.frame,2);
 c.sample(s('wave',400),400);
 assert.deepEqual(c.bridge.route.filter(v=>v.pose.atlas==='custom-jumping').map(v=>v.pose.frame),[2,3,4]);
});
test('walking requested during waist recovery preserves the visible bend',()=>{
 const c=new C(M);c.sample(s('stretch',0),800);c.sample(s('eat',800),800);
 const before=c.sample(s('eat',800),940).pose;
 const after=c.sample(s('right',940),940).pose;
 assert.ok(Math.abs(R.poseAmount(before)-R.poseAmount(after))<1e-9,'the partly released bend must not reset to its original peak');
});
test('walking during seated recovery keeps every remaining standing-up frame',()=>{
 const c=new C(M);c.sample(s('meal-break',0),1800);c.sample(s('wave',1800),1800);
 c.sample(s('wave',1800),1950);
 const oldRoute=c.bridge.route.slice(1).filter(v=>v.pose.atlas==='custom-rest').map(v=>v.pose.frame);
 c.sample(s('right',1950),1950);
 const recovery=c.bridge.route.filter(v=>v.pose.atlas==='custom-rest').map(v=>v.pose.frame);
 assert.deepEqual(recovery,oldRoute);
});
