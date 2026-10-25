/* Horizontal waist motion: original rows keep their y coordinate and width. */
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.PetStretchRig=value;})(globalThis,function(){
 'use strict';
 const size=512,waistY=340,duration=2480,amplitude=12;
 const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
 const profile=y=>y<=230?.45:y<=305?.45+.55*ease((y-230)/75):y<waistY?1-ease((y-305)/(waistY-305)):0;
 const boundaries=[0,230,238,246,254,262,270,278,286,294,302,305,313,321,329,337,340,size];
 const bands=boundaries.slice(0,-1).map((y,i)=>({y,end:boundaries[i+1],from:profile(y),to:profile(boundaries[i+1])}));
 function gain(y){
  if(y>=waistY)return 0;
  const band=bands.find(b=>y<b.end)||bands[0];
  return band.from+(band.to-band.from)*(y-band.y)/(band.end-band.y);
 }
 function amount(time){
  const u=Math.max(0,Math.min(1,(time-120)/2160));
  if(u===0||u===1)return 0;
  return -8/(3*Math.sqrt(3))*Math.sin(2*Math.PI*u)*Math.sin(Math.PI*u)**2;
 }
 function poseAmount(pose){
  const value=amount(pose.stretchReleaseFrom??pose.stretchTime??0);
  return value*(pose.stretchReleaseFrom===undefined?1:1-ease(pose.stretchRecovery??0));
 }
 const offset=(pose,y)=>amplitude*poseAmount(pose)*gain(y);
 const mapPoint=(pose,x,y)=>({x:x+offset(pose,y),y});
 const inversePoint=(pose,x,y)=>({x:x-offset(pose,y),y});
 function create(source,makeCanvas=()=>document.createElement('canvas')){
  const surface=makeCanvas();surface.width=surface.height=size;
  const context=surface.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);
  const pixels=context.getImageData(0,0,size,size).data,mask=new Uint8Array(size*size);
  for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4+3]>40?1:0;
  let previous=NaN;
  return {
   render(pose){
    const value=amplitude*poseAmount(pose);
    if(value===previous)return surface;previous=value;
    context.clearRect(0,0,size,size);
    if(value===0){context.drawImage(source,0,0);return surface;}
    // Adjacent bands meet at the same horizontal offset; there is no y transform.
    for(const band of bands){
     const shear=value*(band.to-band.from)/(band.end-band.y),x=value*band.from-shear*band.y;
     context.save();context.setTransform(1,0,shear,1,x,0);
     context.drawImage(source,0,band.y,size,band.end-band.y,0,band.y,size,band.end-band.y);context.restore();
    }
    return surface;
   },
   hit(pose,x,y){
    const p=inversePoint(pose,x,y),sx=Math.floor(p.x),sy=Math.floor(p.y);
    if(sx<0||sx>=size||sy<0||sy>=size)return false;
    // One source pixel covers the filtered horizontal edge during subpixel motion.
    return [-1,0,1].some(dx=>sx+dx>=0&&sx+dx<size&&Boolean(mask[sy*size+sx+dx]));
   },
  };
 }
 return {create,amount,poseAmount,ease,offset,mapPoint,inversePoint,waistY,duration};
});
