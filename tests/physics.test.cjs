'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {platforms,advance,footOffset}=require('../src/main/physics.cjs');const {sample}=require('../src/renderer/motion.js');
const area={x:0,y:0,width:1920,height:1080},size={width:300,height:360};
test('tiny pet uses body size for its foot inside the minimum host window',()=>{
 const tiny={width:32,height:32,bodyWidth:3};
 assert.ok(Math.abs(footOffset(tiny)-(32-3*(8/300+1-238/256)))<1e-9);
 const surfaces=platforms([],area,tiny);
 const landed=advance({x:500,y:1080-footOffset(tiny)-1,vx:0,vy:100},.04,surfaces,area,tiny);
 assert.equal(landed.y+footOffset(tiny),1080);
});
test('occluded portions of lower windows cannot support pet',()=>{
 const s=platforms([{handle:'front',x:400,y:200,width:300,height:500},{handle:'back',x:200,y:400,width:800,height:400}],area,size);
 assert.deepEqual(s.filter(x=>x.handle==='back').map(x=>[x.left,x.right]),[[200,400],[700,1000]]);
});
test('fall sweeps through top edge and lands without tunnelling',()=>{
 const surfaces=platforms([{handle:'window',x:300,y:500,width:600,height:300}],area,size);
 const result=advance({x:400,y:480-footOffset(size),vx:0,vy:1100},.05,surfaces,area,size);
 assert.equal(result.landed.handle,'window');assert.equal(result.y+footOffset(size),500);assert.equal(result.vy,0);
});
test('rising and sideways motion do not snap onto unrelated window',()=>{
 const surfaces=platforms([{handle:'window',x:300,y:500,width:600,height:300}],area,size);
 assert.equal(advance({x:400,y:510-footOffset(size),vx:0,vy:-400},.04,surfaces,area,size).landed,null);
 assert.equal(advance({x:1100,y:480-footOffset(size),vx:0,vy:1100},.04,surfaces,area,size).landed,null);
});
test('missing window falls to desktop floor with negative monitor coordinates',()=>{
 const a={x:-1920,y:0,width:1920,height:1080},s=platforms([],a,size);
 let b={x:-1200,y:300,vx:0,vy:0};for(let n=0;n<100&&!b.landed;n++)b=advance(b,.04,s,a,size);
 assert.equal(b.landed.handle,'floor');assert.equal(b.y+footOffset(size),1080);
});
test('landing uses the authored compression and recovery without stretching the face or moving its anchor',()=>{
 for(let t=0;t<=800;t+=13){const p=sample('land',t);assert.equal(p.scaleX,1);assert.equal(p.scaleY,1);assert.equal(p.y,0);}
 assert.equal(sample('land',0).frame,3);assert.equal(sample('land',150).frame,4);assert.equal(sample('land',800).atlas,'custom-idle');
});
