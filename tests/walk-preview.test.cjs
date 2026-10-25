'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Companion}=require('../src/main/behavior.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/main/main.cjs'),'utf8');
// Run the production preview lifecycle against an injected clock and desktop.
const start=source.indexOf('// 用户主动调用的有限往返演示'),end=source.indexOf('if (!app.requestSingleInstanceLock())',start);
assert.ok(start>=0&&end>start);
function fixture(mode='company',sleeping=false){
 let now=100000,id=0,persisted=[],bounds={x:500,y:400,width:240,height:288};
 const timers=new Map(),brain=new Companion({now:()=>now,random:()=>0});brain.setMode(mode);brain.focusUntil=mode==='focus'?200000:0;
 if(sleeping){brain.until=0;brain.play('sleep','',60000,20);brain.away=true;}
 const settings={autoWander:false,scale:.8},before={...brain},context={brain,settings,locked:false,drag:null,flight:null,target:null,nextWalk:110000,
  Date:{now:()=>now},Math,
  pet:{isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({...bounds}),setBounds:value=>{bounds={...value};},showInactive:()=>{}},screen:{getDisplayMatching:()=>({workArea:{x:0,y:0,width:1920,height:1080}}),getCursorScreenPoint:()=>({x:0,y:0})},
  stopWalk:()=>{context.target=null;if(['left','right'].includes(brain.action)){brain.until=0;brain.play('stop-'+brain.action);}},
  rebuildMenu:()=>{},persist:()=>persisted.push({...settings}),
  previousTick:now,lastEnvironment:0,context:{},lastState:'',lastPoll:now,lastPointer:'',panel:null,support:null,lastWalkDirection:null,walkRun:null,walkRemainder:0,walkTravel:0,walkPhase:0,
  send:()=>{},physicalTick:()=>{},powerMonitor:{getSystemIdleTime:()=>300,isOnBatteryPower:()=>false},fixedSizeBounds:value=>({...bounds,...value}),size:()=>({width:240,height:288}),savePosition:()=>context.persist(),
  ...require('../src/main/walk.cjs'),
  setTimeout:(callback,delay)=>{const key=++id;timers.set(key,{callback,at:now+delay});return key;},clearTimeout:key=>timers.delete(key)};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function stopWalk('),source.indexOf('function physicalTick('))+source.slice(source.indexOf('function tick()'),start)+source.slice(start,end)+'\nthis.preview={start:previewWalking,finish:finishWalkPreview,active:()=>walkPreviewTimers.length>0,advance:advanceWalkPreview,pending:()=>walkPreviewState?.pendingTarget};',context);
 return {context,brain,settings,before,timers,persisted,advance(to){
  for(;;){const next=[...timers].filter(([,t])=>t.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].callback();}now=to;
 }};
}

test('bounded walk demo restores company, quiet and focus state without saving a temporary preference',()=>{
 for(const mode of ['company','quiet','focus']){
  const f=fixture(mode);f.context.preview.start();
  assert.equal(f.context.preview.active(),true);assert.equal(f.context.target,null);assert.equal(f.context.preview.pending(),360);assert.equal(f.brain.mode,'company');
  f.advance(100100);f.context.preview.advance(100100);assert.equal(f.context.target,360);
  assert.equal(f.settings.autoWander,false);f.context.persist();
  f.advance(106600);f.context.preview.advance(106600);assert.equal(f.context.target,500);f.context.persist();
  f.advance(113000);assert.equal(f.context.preview.active(),false);assert.equal(f.brain.mode,mode);assert.equal(f.brain.focusUntil,f.before.focusUntil);
  assert.equal(f.settings.autoWander,false);assert.ok(f.persisted.every(s=>s.autoWander===false));assert.equal(f.timers.size,0);
  for(const field of ['nextIdle','nextExpressive','nextStory','contextAfter'])assert.equal(f.brain[field],f.before[field]+13000,field);
 }
});

test('cancelling a demo clears its return trip and never overwrites a later user mode or setting',()=>{
 const f=fixture('quiet');f.context.preview.start();f.advance(102000);f.context.preview.finish();
 f.brain.setMode('focus',10);f.settings.autoWander=true;const deadline=f.brain.focusUntil;
 f.advance(130000);assert.equal(f.brain.mode,'focus');assert.equal(f.brain.focusUntil,deadline);assert.equal(f.settings.autoWander,true);assert.equal(f.timers.size,0);
});

test('preview is idempotent and unavailable during drag, lock or chat',()=>{
 const f=fixture();f.context.preview.start();f.context.preview.start();assert.equal(f.timers.size,2);f.context.preview.finish();
 for(const field of ['drag','locked']){f.context[field]=true;f.context.preview.start();assert.equal(f.timers.size,0);f.context[field]=false;}
 f.brain.chatBusy=true;f.context.preview.start();assert.equal(f.timers.size,0);
});

test('tray exposes a bounded walk demonstration and temporary wandering does not mutate settings',()=>{
 assert.match(source,/label: walkPreviewTimers\.length \? '停止走动演示' : '演示左右走动'/);
 assert.match(source,/!\(settings\.autoWander \|\| walkPreviewTimers\.length\)/);
 assert.doesNotMatch(source.slice(start,end),/settings\.autoWander\s*=/);
});

test('a sleeping pet fully rises before the requested route begins despite system idle staying over three minutes',()=>{
 const f=fixture('company',true);f.context.preview.start();
 const wakeDeadline=f.brain.wanderAfter;assert.ok(wakeDeadline>100000);
 assert.equal(f.context.preview.pending(),360);assert.equal(f.context.target,null);
 let minX=500,sawWalk=false,sawReturn=false;
 for(let at=100000;at<113000;at+=50){
  f.advance(at);f.context.tick();
  const x=f.context.pet.getBounds().x;minX=Math.min(minX,x);
  if(at<wakeDeadline){assert.equal(x,500);assert.equal(f.context.target,null);assert.equal(f.context.preview.pending(),360);}
  assert.notEqual(f.brain.action,'sleep');assert.equal(f.brain.away,false);
  if(f.brain.action==='left')sawWalk=true;
  if(f.brain.action==='right')sawReturn=true;
 }
 assert.equal(sawWalk,true);assert.equal(sawReturn,true);assert.equal(minX,360);assert.equal(f.context.pet.getBounds().x,500);
 f.advance(113000);assert.equal(f.context.preview.active(),false);assert.equal(f.timers.size,0);assert.equal(f.brain.away,true);
});

test('cancelling during wake preparation cannot later start the stored destination',()=>{
 const f=fixture('quiet',true);f.context.preview.start();f.advance(100050);f.context.tick();
 assert.equal(f.context.preview.pending(),360);f.context.preview.finish();
 f.advance(110000);f.context.tick();assert.equal(f.context.preview.pending(),undefined);assert.equal(f.context.target,null);
 assert.equal(f.context.pet.getBounds().x,500);assert.equal(f.brain.mode,'quiet');assert.equal(f.timers.size,0);
});

test('wake preparation honors a renderer reservation that finishes after the native wake deadline',()=>{
 const f=fixture('company',true);f.context.preview.start();const visualEnd=f.brain.wanderAfter+150;
 assert.equal(f.brain.reserveVisual({action:f.brain.action,started:f.brain.started,until:visualEnd}),true);
 for(let at=100000;at<visualEnd;at+=50){f.advance(at);f.context.tick();assert.equal(f.context.target,null);assert.equal(f.context.preview.pending(),360);}
 f.advance(visualEnd);f.context.tick();assert.equal(f.context.target,360);assert.equal(f.context.preview.pending(),null);
});
