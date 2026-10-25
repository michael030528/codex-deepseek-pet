/* Sequence complete authored poses when an expressive action is interrupted. */
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.PetTransitionController=value;})(globalThis,function(){
 'use strict';
 const moving=new Set(['left','right']),stopping=new Set(['stop-left','stop-right']);
 const urgent=new Set(['drag','fall','land']);
 const key=s=>`${s.action}:${s.started}`;
 const dedupe=frames=>frames.filter((frame,i)=>!i||frame!==frames[i-1]);
 // The rig uses 1-smoothstep(recovery). Its inverse keeps a partly opened
 // starting pose unchanged when it becomes a release pose.
 const walkReleaseStart=p=>p.walkRecovery??(.5-Math.sin(Math.asin(2*Math.max(0,Math.min(1,p.walkBlend??1))-1)/3));
 class Controller{
  constructor(motion){this.motion=motion;this.source=null;this.active=null;this.bridge=null;this.pending=null;this.lastPose=null;}
  activate(state,now,native=false){this.active={...state,sourceStarted:state.started,requestedDuration:Math.max(0,state.until-state.started),started:native?state.started:now};this.bridge=null;this.pending=null;}
  completion(state){
   if(!this.active||moving.has(state.action)||urgent.has(state.action))return null;
   const m=this.motion,ends=(s,start,requestedDuration)=>{
    const c=s.action==='story-recover'&&s.recovery||m.clips[s.action];
    if(!c||c.loop)return start;
    return start+(c.hold?requestedDuration:c.times.reduce((n,t)=>n+t,0));
   };
   if(this.bridge){
    const start=this.bridge.started+this.bridge.duration;
    if(this.pending&&key(this.pending)===key(state))return ends(this.pending,start,Math.max(0,this.pending.until-this.pending.started));
    // Wake is routed into idle; the outgoing posture still owns this interval.
    return start;
   }
   if(this.active.action===state.action&&this.active.sourceStarted===state.started)return ends(this.active,this.active.started,this.active.requestedDuration);
   // A natural idle message may arrive while a delayed finite performance is
   // still finishing. Keep the native movement clock behind that visible end.
   if(state.action==='idle')return ends(this.active,this.active.started,0);
   return null;
  }
  route(p,active){
   const m=this.motion,idle=m.sample('idle',0,true),c=active.action==='story-recover'&&active.recovery||m.clips[active.action];
   // 再次打断恢复时继承已释放比例，避免腰部突然弹回最初弯曲量。
   if(p?.stretchTime!==undefined&&!m.isNeutral(p))return [{pose:{...p,stretchReleaseFrom:p.stretchReleaseFrom??p.stretchTime,stretchRecoveryStart:p.stretchRecovery??0,stretchRecovery:p.stretchRecovery??0},ms:280*(1-(p.stretchRecovery??0))},{pose:idle,ms:40}];
   if(!p||m.isNeutral(p))return [];
   // A stop bridge can still display a gait or turn from the outgoing side.
   // Route from that visible drawing even when the new logical action has changed.
   const visibleDirection=['left','right'].find(direction=>p.atlas===m.clips[direction].atlas||p.atlas==='custom-turn'&&m.turnFrames[direction].includes(p.frame));
   if(visibleDirection||moving.has(active.action)){
    const direction=visibleDirection||active.action,gaitClip=m.clips[direction];
    const stop=m.clips['stop-'+direction],turn=m.turnFrames[direction],result=[];
    let frames=stop.frames;
    if(p.atlas===stop.atlas){
     // A cancelled startup only reverses the turn already shown.
     const at=turn.indexOf(p.frame);frames=at>=0?turn.slice(0,at+1).reverse():stop.frames;
    }else if(p.atlas===gaitClip.atlas){
     // Finish the visible leg's support phase before gathering both feet.
     // Each direction has its own compact support poses in the approved art.
     // Advancing in cycle order avoids a cut to the unrelated launch pose (turn 9/11).
     if(p.walkRecovery===undefined){
      let at=gaitClip.frames.indexOf(p.frame),count=0;
      if(at<0)at=0;
      do{
       const frame=gaitClip.frames[at];
       result.push({pose:{...idle,atlas:gaitClip.atlas,frame,blink:0,...(p.walkBlend!==undefined?{walkBlend:p.walkBlend}:{})},ms:55+count*10});count++;
       if(m.gait.settleFrames[direction].includes(frame))break;
       at=(at+1)%gaitClip.frames.length;
      }while(count<gaitClip.frames.length);
     }
     // A second interruption continues the visible release instead of opening
     // the feet again or replaying support steps that already finished.
     const releaseStart=walkReleaseStart(p),releasePose=result.at(-1)?.pose||p;
     result.push({pose:{...releasePose,walking:false,blink:0,walkRecoveryStart:releaseStart,walkRecovery:releaseStart},ms:160*(1-releaseStart)});
    }else result.push({pose:{...p,walking:false,blink:0},ms:40});
    result.push(...dedupe(frames).map(frame=>({pose:{...idle,atlas:stop.atlas,frame,blink:0},ms:stop.times[stop.frames.indexOf(frame)]??80})),{pose:idle,ms:50});
    return result;
   }
   let frames,atlas=p.atlas,sleeping=atlas===m.clips.sleep?.atlas;
   if(sleeping){
    const wake=m.clips.wake,at=wake.frames.indexOf(p.frame);
    if(at>=0)frames=wake.frames.slice(at);
    else{const sleep=m.clips.sleep,at=sleep.frames.indexOf(p.frame);frames=at>=0?sleep.frames.slice(0,at+1).reverse():[p.frame];}
   }else if(c&&c.atlas===atlas){
    let at=Math.min(p.index??0,c.frames.length-1);
    if(c.frames[at]!==p.frame)at=Math.max(0,c.frames.indexOf(p.frame));
    frames=stopping.has(active.action)||active.action==='story-recover'?c.frames.slice(at):m.exitFrames(c,p.frame,at);
   }else frames=[p.frame];
   frames=dedupe(frames);
   const ms=sleeping?100:c?.recoveryStepMs||Math.min(100,320/Math.max(1,frames.length));
   const result=frames.map(frame=>({pose:{...idle,atlas,frame,blink:0},ms}));
   // A shared neutral drawing separates distinct atlases without blending them.
   if(atlas!==idle.atlas||frames.at(-1)!==idle.frame)result.push({pose:idle,ms:50});
   return result;
  }
  startWalking(state,now){
   const m=this.motion,route=this.route(this.lastPose,this.active),activeClip=this.active.action==='story-recover'&&this.active.recovery||m.clips[this.active.action];
   const postureRecovery=this.lastPose?.atlas===m.clips.sleep.atlas||activeClip?.recoveryStepMs;
   this.activate(state,now,true);
   if(!route.length)return;
   const outgoing=route.reduce((n,s)=>n+s.ms,0),remaining=Math.max(0,state.started+600-now);
   if(!postureRecovery&&remaining<100)return;
   // A normal expression releases inside the existing native stationary turn
   // window. Seated/sleeping actions keep every rise pose; the main arbiter prevents wandering
   // until its wake/recovery reservation has ended.
   const exitMs=postureRecovery?outgoing:Math.min(240,remaining*.4),turnMs=postureRecovery?600:remaining-exitMs;
   for(const step of route)step.ms*=exitMs/outgoing;
   const idle=m.sample('idle',0,true),frames=m.turnFrames[state.action];
   route.push(...frames.map(frame=>({pose:{...idle,atlas:'custom-turn',frame,blink:0},ms:turnMs/frames.length})));
   this.bridge={route,started:now,duration:exitMs+turnMs,resumeNative:true};this.pending={...state};
  }
  startStopping(state,now){
   const route=this.route(this.lastPose,this.active);
   this.activate(route.length?state:{...state,action:'idle'},now,true);
   if(!route.length)return;
   this.bridge={route,started:now,duration:route.reduce((n,s)=>n+s.ms,0)};
   this.pending={...state,action:'idle'};
  }
  sample(state,now,{reduced=false,walkElapsed=null}={}){
   const m=this.motion,changed=!this.source||key(this.source)!==key(state);
   if(!this.active){this.activate(state,now,true);this.source={...state};}
   else if(changed){
    const previous=this.source;this.source={...state};
    const activeClip=this.active.action==='story-recover'&&this.active.recovery||m.clips[this.active.action];
    const naturalIdle=state.action==='idle'&&previous?.until>0&&now>=previous.until&&state.mode===previous.mode;
    if(reduced||urgent.has(state.action))this.activate(state,now,true);
    else if(stopping.has(state.action))this.startStopping(state,now);
    else if(moving.has(state.action))this.startWalking(state,now);
    else if(naturalIdle&&(this.bridge||this.active.action===previous.action&&activeClip&&!activeClip.loop&&!activeClip.hold)){
     // A delayed finite visual finishes its recovery/start instead of being cut
     // off by the main process's original completion deadline.
    }else if(this.bridge)this.pending={...state};
    else if(state.action==='story-recover'&&state.recovery?.atlas===this.lastPose?.atlas){
     const frames=m.exitFrames(activeClip,this.lastPose.frame,this.lastPose.index);
     this.activate({...state,recovery:{...state.recovery,frames,times:frames.map(()=>activeClip.recoveryStepMs||120)}},now);
    }
    else if(state.action==='wake'){
     const route=this.route(this.lastPose,this.active),idle={...state,action:'idle'};
     if(route.length){this.bridge={route,started:now,duration:route.reduce((n,s)=>n+s.ms,0)};this.pending=idle;}
     else this.activate(idle,now);
    }else{
     const route=this.route(this.lastPose,this.active);
     if(route.length){this.bridge={route,started:now,duration:route.reduce((n,s)=>n+s.ms,0)};this.pending={...state};}
     else this.activate(state,now,true);
    }
   }
   if(reduced&&this.bridge){this.activate(state,now,true);}
   let pose,action=this.active.action;
   if(this.bridge){
    let elapsed=Math.max(0,now-this.bridge.started);
    if(elapsed<this.bridge.duration){
     for(const step of this.bridge.route){if(elapsed<step.ms){pose={...step.pose};if(pose.walkRecovery!==undefined){const start=pose.walkRecoveryStart??0;pose.walkRecovery=start+(1-start)*elapsed/step.ms;}if(pose.stretchReleaseFrom!==undefined){const start=pose.stretchRecoveryStart??0;pose.stretchRecovery=start+(1-start)*elapsed/step.ms;}break;}elapsed-=step.ms;}
     action='transition-recover';
    }else{
     const at=this.bridge.started+this.bridge.duration,pending=this.pending,native=this.bridge.resumeNative&&moving.has(pending.action);
     this.activate(pending,at,native);
     action=this.active.action;
    }
   }
   if(!pose){
    let elapsed=Math.max(0,now-this.active.started);
    if(['left','right'].includes(action)&&elapsed>=600&&walkElapsed!==null)elapsed=600+walkElapsed;
    pose=m.sample(action,elapsed,reduced,this.active.recovery);
   }
   this.lastPose=pose;return {pose,action};
  }
 }
 return Controller;
});
