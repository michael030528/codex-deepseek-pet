'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFrameLoop}=require('../src/main/frame-loop.cjs');

function fixture() {
  let at=0,active=true,locked=false,nextId=0,calls=[];
  const timers=new Map();
  const loop=createFrameLoop({tick:()=>calls.push(at),now:()=>at,isActive:()=>active,idleDelay:()=>locked?1000:500,
    setTimer:(callback,delay)=>{const id=++nextId;timers.set(id,{callback,at:at+delay});return id;},clearTimer:id=>timers.delete(id)});
  return {loop,calls,timers,setActive:value=>{active=value;},setLocked:value=>{locked=value;},advance(to){
    for(;;){const pending=[...timers].filter(([,t])=>t.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;at=pending[1].at;timers.delete(pending[0]);pending[1].callback();}at=to;
  }};
}

test('60 display frames produce 60 movement updates without duplicate watchdog ticks',()=>{
  const f=fixture();f.loop.start();
  for(let frame=1;frame<=60;frame++){f.advance(frame*1000/60);f.loop.frame();}
  assert.equal(f.calls.length,61);
  const intervals=f.calls.slice(2).map((at,i)=>at-f.calls[i+1]);
  assert.ok(intervals.every(dt=>Math.abs(dt-1000/60)<.001));
  f.loop.stop();assert.equal(f.timers.size,0);
});

test('a paused renderer keeps a bounded recovery heartbeat and resumes immediately',()=>{
  const f=fixture();f.loop.start();f.advance(16);f.loop.frame();f.advance(500);
  assert.deepEqual(f.calls,[0,16,200,300,400,500]);
  f.advance(510);f.loop.frame();assert.equal(f.calls.at(-1),510);
  const count=f.calls.length;f.loop.frame();assert.equal(f.calls.length,count);
});

test('hidden and locked pets ignore display ticks and use slower timers',()=>{
  const f=fixture();f.setActive(false);f.loop.start();
  for(let at=16;at<500;at+=16){f.advance(at);f.loop.frame();}
  assert.deepEqual(f.calls,[0]);f.advance(500);assert.deepEqual(f.calls,[0,500]);
  f.setLocked(true);f.advance(1000);f.advance(1999);assert.equal(f.calls.at(-1),1000);
  f.advance(2000);assert.equal(f.calls.at(-1),2000);
  f.loop.stop();f.advance(4000);f.loop.frame();assert.equal(f.calls.at(-1),2000);
});

test('high refresh displays retain their own cadence and start is idempotent',()=>{
  const f=fixture();f.loop.start();f.loop.start();
  for(let frame=1;frame<=144;frame++){f.advance(frame*1000/144);f.loop.frame();}
  assert.equal(f.calls.length,145);assert.equal(f.timers.size,1);
});
