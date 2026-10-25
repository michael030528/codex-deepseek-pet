/* Keep the canonical side drawing; articulate only the feet below its hem. */
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.PetWalkRig=value;})(globalThis,function(){
 'use strict';
 const size=512,cutY=426;
 const sideFrame={left:7,right:3};
 const direction=pose=>pose?.atlas==='custom-running-left'?'left':pose?.atlas==='custom-running-right'?'right':null;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const amount=pose=>pose.walkRecovery!==undefined?1-ease(pose.walkRecovery):pose.walkBlend??1;
 function create(frames,makeCanvas=()=>document.createElement('canvas')){
  const canvas=()=>{const c=makeCanvas();c.width=c.height=size;return c;};
  const surfaces={},masks={},neutral={},neutralMasks={},body={};
  for(const d of ['left','right']){
   neutral[d]=frames['custom-turn'][sideFrame[d]];
   body[d]=canvas();const b=body[d].getContext('2d',{willReadFrequently:true});b.drawImage(neutral[d],0,0);
   const rgba=b.getImageData(0,0,size,size).data;neutralMasks[d]=new Uint8Array(size*size);
   for(let i=0;i<neutralMasks[d].length;i++)neutralMasks[d][i]=rgba[i*4+3];
   // The rectangle encloses only the original legs, retaining the tail and hem.
   b.clearRect(195,cutY,85,size-cutY);
   surfaces[d]=[];masks[d]=[];
   for(let f=0;f<8;f++){
    const leg=canvas(),c=leg.getContext('2d');
    c.save();c.translate(241,418);c.scale(.72,56/50);c.translate(d==='left'?-233:-252,-426);
    c.beginPath();
    if(d==='left'){c.moveTo(130,426);c.lineTo(290,426);c.lineTo(330,442);c.lineTo(330,480);c.lineTo(130,480);}
    else{c.moveTo(195,426);c.lineTo(340,426);c.lineTo(340,480);c.lineTo(150,480);c.lineTo(150,442);}
    c.closePath();c.clip();c.drawImage(frames['custom-running-'+d][f],0,0);c.restore();
    const surface=canvas(),ctx=surface.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(leg,0,0);ctx.drawImage(body[d],0,0);
    ctx.clearRect(0,0,size,cutY);ctx.drawImage(neutral[d],0,0,size,cutY,0,0,size,cutY);
    surfaces[d][f]=surface;
    const rgba=ctx.getImageData(0,0,size,size).data,mask=new Uint8Array(size*size);
    for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4+3];
    masks[d][f]=mask;
   }
  }
  const blended=canvas(),context=blended.getContext('2d');
  return {
   render(pose){
    const d=direction(pose);if(!d)return null;
    const blend=amount(pose);
    if(blend>=1)return surfaces[d][pose.frame];
    if(blend<=0)return neutral[d];
    context.clearRect(0,0,size,size);
    // Only the small foot region changes at entry/release; the model above it is identical.
    context.globalAlpha=1;context.drawImage(neutral[d],0,0);
    context.clearRect(150,cutY,200,size-cutY);
    context.save();context.beginPath();context.rect(150,cutY,200,size-cutY);context.clip();
    context.globalAlpha=1-blend;context.drawImage(neutral[d],0,0);
    context.globalCompositeOperation='lighter';context.globalAlpha=blend;context.drawImage(surfaces[d][pose.frame],0,0);
    context.restore();context.globalAlpha=1;
    return blended;
   },
   hit(pose,x,y){
    const d=direction(pose),sx=Math.floor(x),sy=Math.floor(y);
    if(!d||sx<0||sx>=size||sy<0||sy>=size)return false;
    const i=sy*size+sx,blend=amount(pose);
    return masks[d][pose.frame][i]*blend+neutralMasks[d][i]*(1-blend)>40;
   },
  };
 }
 return {create,direction,sideFrame,cutY,ease,amount};
});
