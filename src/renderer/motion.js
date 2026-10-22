/* One approved character model, complete generated drawings, shared registration. */
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.PetMotion=value;})(globalThis,function(){
 'use strict';
 const seq=(n)=>Array.from({length:n},(_,i)=>i);
 const clip=(name,frames,ms,loop=false,hold=false)=>({atlas:'custom-'+name,frames,times:Array.isArray(ms)?ms:frames.map(()=>ms),loop,hold});
 function timeline(name,stages,hold=false){
  const c=clip(name,[],[],false,hold);c.stages=[];let at=0;
  for(const [name,frames,ms]of stages){const times=Array.isArray(ms)?ms:frames.map(()=>ms);if(times.length!==frames.length)throw Error('动作阶段时长不匹配');
   const end=at+times.reduce((a,b)=>a+b,0);c.stages.push({name,start:at,end});at=end;c.frames.push(...frames);c.times.push(...times);
  }return c;
 }
 const clips={
  idle:clip('idle',[0],1000,true),breathe:clip('idle',[0],1400),
  shift:clip('idle',[0,1,0],[300,600,400]),settle:clip('idle',[0,1,0],[300,500,400]),
  stretch:timeline('stretch',[['raise',[0,1],[180,260]],['stretch',[2],700],['lower',[3,0],[260,160]]]),
  right:clip('running-right',seq(8),110,true),left:clip('running-left',seq(8),110,true),
  'stop-right':clip('turn',[8,3,2,1,0],80),'stop-left':clip('turn',[10,7,6,5,4],80),
  wave:timeline('waving',[['raise',[0],180],['greet',[1,2,1,2],180],['lower',[4,5,0],[100,100,120]]]),
  happy:timeline('affection',[['notice',[0],180],['enjoy',[1,2,1],[320,600,320]],['relax',[0],180]]),
  eat:timeline('eat',[['reach',[0,1],180],['lift',[2],220],['taste',[3,4],[260,360]],['put-away',[5,6,7,0],[180,160,160,140]]]),
  sneak:timeline('sneak',[['reach',[0,1],[180,420]],['hide-token',[2],360],['taste',[3],420],['recover',[4,5,6,0],[180,160,160,140]]]),
  jump:timeline('jumping',[['prepare',[0],180],['airborne',[1,2,3],[120,220,120]],['land',[4],180],['recover',[4],180]]),
  drag:clip('jumping',[2],100,false,true),fall:clip('jumping',[3],100,false,true),
  land:timeline('jumping',[['compress',[3],120],['recover',[4],420]]),
  sleep:timeline('sleep',[['yawn',[0,1],[200,450]],['sit',[8,9,3],105],['lie-down',[10,11,12,4],110],['close-eyes',[5,6],260],['settle',[7],300]],true),
  wake:timeline('sleep',[['open-eyes',[7,6,5],140],['rise',[4,12,11,10,3,9,8,1,0],100]]),
  dance:timeline('dance',[['prepare',[0,1],180],['sway',[2,3,4,3,2,3,4,5],170],['recover',[6,7],200]]),
  hum:timeline('hum',[['prepare',[0],180],['hum',[1,2,1,2,1],[360,360,360,360,360]],['recover',[0],180]]),
  'meal-break':timeline('rest',[['sit',[0,1,3],[180,210,350]],['nap',[4,5],[450,1100]],['wake',[4,3],[300,240]],['rise',[1,0],[280,180]]]),
  curl:timeline('curl',[['sit',[0,1,3],[180,210,330]],['curl',[4,5],[360,900]],['uncurl',[4,3],[300,240]],['rise',[1,0],[280,180]]]),
  'token-game':timeline('token-game',[['puzzle',[0,1],[180,800]],['sneak-token',[2,3],[400,320]],['taste',[4],420],['put-away',[5,6],[260,180]]]),
  'tail-sway':timeline('tail',[['prepare',[0],180],['sway',[1,0,2,0,1,0,2],[240,160,240,160,240,160,240]],['settle',[0],180]]),'story-recover':clip('idle',[0],100),
  think:clip('running',[0,1,2,3],200,false,true),review:clip('review',[0,1,2],[180,340,700],false,true),
  satisfied:timeline('satisfied',[['settle',[0],180],['content',[1,2],[700,450]],['relax',[0],180]]),hungry:clip('waiting',[0,1,2,3,4,5,6,7,0],[240,240,240,240,240,240,100,100,120]),
  proud:clip('affection',[0,1,2,1,0],[180,280,450,280,180]),protest:clip('failed',[0,1,2,1,0],180),
  sad:clip('failed',[0,2,3,4,5,6,7],250),surprise:clip('waiting',[0,1,2],220,false,true),
  peek:timeline('peek',[['look-left',[0,1],[180,600]],['look-right',[0,2],[180,600]],['return',[0],180]]),
  shock:timeline('shock',[['notice',[0,1],[140,220]],['startle',[2],650],['recover',[1,0],[240,180]]]),
  pout:timeline('pout',[['fold-arms',[0,1],[180,450]],['side-eye',[2],650],['relax',[1,0],[300,180]]]),sorry:clip('failed',[0,3,4,5,6,7],220),
 };
 // Authored release drawings are explicit: a held face/hand pose must not
 // disappear merely because its main-process deadline expired.
 const exits={waving:[4,5,0],running:[6,7,0],waiting:[6,7,0],dance:[6,7,0],jumping:[4],review:[3,0],failed:[4,5,6,7,0]};
 // Release from the visible pose. Early interruptions put props back; late
 // interruptions lower empty hands and never replay a bite or another bow.
 const exitRoutes={
  affection:{1:[1,0],2:[2,1,0]},stretch:{1:[1,3,0],2:[2,3,0],3:[3,0]},
  eat:{1:[1,0],2:[2,1,0],3:[3,5,6,7,0],4:[4,5,6,7,0],5:[5,6,7,0],6:[6,7,0],7:[7,0]},
  sneak:{1:[1,0],2:[2,1,0],3:[3,4,5,6,0],4:[4,5,6,0],5:[5,6,0],6:[6,0]},
  hum:{1:[1,0],2:[2,0]},peek:{1:[1,0],2:[2,0]},shock:{1:[1,0],2:[2,1,0]},
  pout:{1:[1,0],2:[2,1,0]},satisfied:{1:[1,2,0],2:[2,0]},tail:{1:[1,0],2:[2,0]},
  rest:{1:[1,0],3:[3,1,0],4:[4,3,1,0],5:[5,4,3,1,0]},
  curl:{1:[1,0],3:[3,1,0],4:[4,3,1,0],5:[5,4,3,1,0]},
  'token-game':{1:[1,5,6],2:[2,5,6],3:[3,2,5,6],4:[4,5,6],5:[5,6]},
 };
 for(const c of Object.values(clips))if(exits[c.atlas.slice(7)])c.exitFrames=exits[c.atlas.slice(7)];
 for(const c of Object.values(clips))if(exitRoutes[c.atlas.slice(7)])c.exitRoutes=exitRoutes[c.atlas.slice(7)];
 clips['meal-break'].recoveryStepMs=clips.curl.recoveryStepMs=100;
 for(const [action,c]of Object.entries(clips)){
  if(c.loop||c.hold||c.frames.at(-1)===0||action==='stop-left'||c.atlas==='custom-jumping')continue;
  const tail=[0];
  const start=c.times.reduce((a,b)=>a+b,0);c.frames.push(...tail);c.times.push(...tail.map(()=>100));
  if(c.stages)c.stages.push({name:'neutral',start,end:start+tail.length*100});
 }
 const blinkFrame=3;
 const atlasNames=[...new Set([...Object.values(clips).map(c=>c.atlas),'custom-turn'])];
 const turnFrames={right:[0,1,2,3,8,8],left:[4,5,6,7,10,10]};
 // Distance is measured in native screen pixels. The authored cells are 512px
 // and the displayed canvas is 300px at scale 1; one gait cycle covers a stride.
 const gait=Object.freeze({cellSize:512,canvasSize:300,speed:150,turnMs:600,accelerationMs:300,
  strideSourcePx:Object.freeze({left:252,right:255}),
  settleFrames:Object.freeze({left:Object.freeze([2,6]),right:Object.freeze([1,5])})});
 function gaitElapsed(distance,scale,direction){
  const c=clips[direction],stride=gait.strideSourcePx[direction];
  if(!stride||!Number.isFinite(distance)||distance<=0)return 0;
  return distance/(stride*gait.canvasSize/gait.cellSize*Math.max(.01,scale))*c.times.reduce((a,b)=>a+b,0);
 }
 // Main-process packets can precede their state notification. Keep a small
 // generation-keyed buffer; an ended run retains its last finite distance clock
 // until the matching state leaves walking, never reverting to the wall clock.
 class WalkClock{
  constructor(){this.runs=new Map();}
  update(value){
   if(!['left','right'].includes(value?.action)||!Number.isFinite(value.started))return false;
   const key=`${value.action}:${value.started}`,previous=this.runs.get(key);
   if(previous?.ended)return false;
   const elapsed=Number.isFinite(value.elapsed)?Math.max(0,value.elapsed):previous?.elapsed??0;
   if(previous&&elapsed<previous.elapsed)return false;
   this.runs.set(key,{elapsed,offset:Number.isFinite(value.offset)?value.offset:0,ended:Boolean(value.ended)});
   if(this.runs.size>4)this.runs.delete(this.runs.keys().next().value);
   return true;
  }
  forState(state){return this.runs.get(`${state.action}:${state.started}`)||{elapsed:0,offset:0};}
 }
 function requiredFrames(atlas){
  const frames=new Set();
  for(const c of Object.values(clips))if(c.atlas===atlas)for(const f of [...c.frames,...(c.exitFrames||[]),...Object.values(c.exitRoutes||{}).flat()])frames.add(f);
  if(atlas==='custom-turn')for(const f of Object.values(turnFrames).flat())frames.add(f);
  if(atlas===clips.idle.atlas)frames.add(blinkFrame);
  return [...frames].sort((a,b)=>a-b);
 }
 function isNeutral(p){
  if(!p)return false;if(p.atlas==='custom-jumping')return p.frame===4;
  return p.frame===0&&atlasNames.includes(p.atlas)&&!['custom-running-left','custom-running-right'].includes(p.atlas)||p.atlas==='custom-turn'&&p.frame===4||p.atlas==='custom-token-game'&&p.frame===6;
 }
 function exitFrames(c,frame,index=0){
  if(isNeutral({atlas:c.atlas,frame}))return [frame];
  if(c.exitRoutes?.[frame])return c.exitRoutes[frame].slice();
  if(c.exitFrames){const at=c.exitFrames.indexOf(frame);return at<0?[frame,...c.exitFrames]:c.exitFrames.slice(at);}
  if(c.frames[index]!==frame)index=c.frames.indexOf(frame);
  return index>=0?c.frames.slice(0,index+1).reverse().filter((f,i,a)=>!i||f!==a[i-1]):[frame,0];
 }
 function recoveryDelay(action,elapsed){
  if(action==='sleep')return clips.wake.times.reduce((a,b)=>a+b,0);
  const c=clips[action];if(!c?.recoveryStepMs)return 0;
  const p=sample(action,elapsed);if(isNeutral(p))return 0;
  return exitFrames(c,p.frame,p.index).length*c.recoveryStepMs+50;
 }
 function nextPose(c,index){
  if(index+1<c.frames.length)return {atlas:c.atlas,frame:c.frames[index+1]};
  if(c.loop)return {atlas:c.atlas,frame:c.frames[0]};
  return c.hold?{atlas:c.atlas,frame:c.frames[index]}:{atlas:clips.idle.atlas,frame:0};
 }
 // Legacy offline field-analysis manifest; the live renderer never uses these fields.
 function flowPairs(){
  const pairs=new Map();
  const add=(atlas,frame,nextAtlas,nextFrame)=>{
   if(atlas===nextAtlas&&frame===nextFrame)return;
   const pair={atlas,frame,nextAtlas,nextFrame};pairs.set([atlas,frame,nextAtlas,nextFrame].join(':'),pair);
  };
  for(const c of Object.values(clips))for(let i=0;i<c.frames.length;i++){
   const n=nextPose(c,i);add(c.atlas,c.frames[i],n.atlas,n.frame);
   if(n.atlas===c.atlas)add(n.atlas,n.frame,c.atlas,c.frames[i]);
  }
  for(const name of ['hum','meal-break','token-game'])add(clips[name].atlas,clips[name].frames[0],clips.idle.atlas,0);
  for(const [name,frames]of Object.entries(turnFrames))for(let i=0;i<frames.length;i++){
   add('custom-turn',frames[i],i<frames.length-1?'custom-turn':clips[name].atlas,i<frames.length-1?frames[i+1]:clips[name].frames[0]);
  }
  return [...pairs.values()];
 }
 function blinkAt(elapsed){
  const intervals=[5200,7100,4300,8600,6100],period=intervals.reduce((a,b)=>a+b,0);let t=Math.max(0,elapsed)%period;
  for(const span of intervals){if(t<span){const b=t-(span-200);return b<0?0:b<65?b/65:b<105?1:Math.max(0,1-(b-105)/95);}t-=span;}return 0;
 }
 function recoveryClip(action,elapsed){
  const c=clips[action];if(!c||!['hum','meal-break','token-game'].includes(action))return null;
  let index=0,t=Math.max(0,elapsed);while(index<c.times.length-1&&t>=c.times[index]){t-=c.times[index];index++;}
  const frames=exitFrames(c,c.frames[index],index);
  return {...c,frames,times:frames.map(()=>Math.min(c.recoveryStepMs||120,1800/frames.length)),loop:false,hold:false};
 }
 function sample(action,elapsed,reduced=false,recovery=null){
  elapsed=Math.max(0,Number.isFinite(elapsed)?elapsed:0);const walking=['left','right'].includes(action);
  if(walking&&!reduced&&elapsed<600){
   const frames=turnFrames[action],index=Math.min(frames.length-1,Math.floor(elapsed/(600/frames.length)));
   return {...sample('idle',0,true),atlas:'custom-turn',frame:frames[index],walking:false,blink:0};
  }
  if(walking&&!reduced)elapsed-=600;
  const c=(action==='story-recover'&&recovery)||clips[action]||clips.idle,duration=c.times.reduce((a,b)=>a+b,0);
  if(!reduced&&!c.loop&&!c.hold&&elapsed>=duration)return sample('idle',elapsed-duration,false);
  let t=reduced?0:c.loop?elapsed%duration:Math.min(elapsed,duration),index=0;
  while(index<c.times.length-1&&t>=c.times[index]){t-=c.times[index];index++;}
  const frame=c.frames[index],phase=reduced?0:elapsed/1000;
  const micro=reduced?0:Math.sin(Math.PI*Math.min(1,elapsed/duration))**2;
  return {atlas:c.atlas,frame,columns:4,flip:false,walking,blink:!reduced&&action==='idle'?blinkAt(elapsed):0,
   // Authored running and jumping drawings already contain their foot lift.
   x:0,y:action==='breathe'?-1.5*micro:0,
   scaleX:1,scaleY:1,
   rotation:action==='shift'?Math.sin(phase*Math.PI*2/3.2)*micro*.018:0,index,duration};
 }
 function transition(from,to,elapsed,duration=180){
  if(!from||elapsed>=duration)return to;const t=Math.max(0,elapsed/duration),weight=t*t*(3-2*t),result={...to};
  for(const key of ['x','y','rotation'])result[key]=from[key]+(to[key]-from[key])*weight;
  result.scaleX=result.scaleY=1;return result;
 }
 return {clips,atlasNames,blinkFrame,turnFrames,gait,gaitElapsed,WalkClock,requiredFrames,isNeutral,exitFrames,recoveryDelay,sample,blinkAt,transition,recoveryClip,flowPairs};
});
