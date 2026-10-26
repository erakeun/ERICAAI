(function(root){
'use strict';
// Original code-native animation prototype, informed by the user's AI character
// references. These articulated poses are not extracted official animation frames
// and do not transform the existing eight-pose raster sheet. Collision is owned
// by physics and never follows this drawing's changing silhouette.
const INK='#173e69',BLUE='#2c65a2',WHITE='#fffefb',PINK='#f5b3b5';
const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const mix=(a,b,t)=>a+(b-a)*t;
function ellipse(cx,cy,rx,ry){const f=(x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;f.bounds=[cx-rx,cy-ry,cx+rx,cy+ry];return f;}
function capsule(ax,ay,bx,by,r){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;const f=(x,y)=>{const t=l?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l)):0;return (x-ax-t*dx)**2+(y-ay-t*dy)**2<=r*r;};f.bounds=[Math.min(ax,bx)-r,Math.min(ay,by)-r,Math.max(ax,bx)+r,Math.max(ay,by)+r];return f;}
function painter(ctx){
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 function shape(parts,color,border=INK){
  const bounds=[Math.floor(Math.min(...parts.map(f=>f.bounds[0]))),Math.floor(Math.min(...parts.map(f=>f.bounds[1]))),Math.ceil(Math.max(...parts.map(f=>f.bounds[2]))),Math.ceil(Math.max(...parts.map(f=>f.bounds[3])))];
  const mask=(x,y)=>parts.some(fn=>fn(x,y));
  // Consecutive pixel spans keep the deliberately pixelated silhouette cheap.
  for(let y=bounds[1];y<bounds[3];y++){
   let run=-1,lastColor='';
   for(let x=bounds[0];x<=bounds[2];x++){
    let c='';
    if(x<bounds[2]&&mask(x+.5,y+.5))c=!mask(x-.5,y+.5)||!mask(x+1.5,y+.5)||!mask(x+.5,y-.5)||!mask(x+.5,y+1.5)?border:color;
    if(c!==lastColor){if(lastColor)box(run,y,x-run,1,lastColor);run=x;lastColor=c;}
   }
  }
 }
 const line=(ax,ay,bx,by,width,color)=>shape([capsule(ax,ay,bx,by,width/2)],color,color);
 return{box,shape,line};
}
function head(p,x,y,closed,blink,tilt=0){
 const{shape,box,line}=p;
 shape([ellipse(x,y,25,24),ellipse(x,y-20,11,8),ellipse(x-18,y-13,10,11),ellipse(x+18,y-13,10,11),ellipse(x-24,y+1,8,11),ellipse(x+24,y+1,8,11),ellipse(x-15,y+18,11,9),ellipse(x+15,y+18,11,9)],BLUE);
 shape([ellipse(x,y+4,20,19),ellipse(x-14,y-12,9,10),ellipse(x+14,y-12,9,10)],WHITE);
 shape([ellipse(x-14,y-13,6,6),ellipse(x+14,y-13,6,6)],'#ffdaa2','#ffdaa2');
 shape([ellipse(x,y+5,19,17)],WHITE,WHITE);
 // Broad curled forelock, rounded mane and warm ear centres follow the source.
 shape([ellipse(x-1,y-16,8,12),ellipse(x+2,y-7,6,7)],BLUE,BLUE);
 line(x+5,y-18,x+5,y-7,2,INK);line(x+5,y-7,x+9,y-3,2,INK);
 if(closed){line(x-12,y+7,x-7,y+8,2,INK);line(x+7,y+8,x+12,y+7,2,INK);}
 else if(blink){box(x-12,y+7,5,2,INK);box(x+7,y+7,5,2,INK);}
 else{shape([ellipse(x-10,y+6+tilt,1.2,2.8),ellipse(x+10,y+6-tilt,1.2,2.8)],INK,INK);}
 box(x-16,y+11,5,2,PINK);box(x+11,y+11,5,2,PINK);
 box(x-1,y+8,3,1,INK);box(x,y+9,1,4,INK);
 line(x-4,y+12,x-2,y+14,1.5,INK);line(x-2,y+14,x,y+12,1.5,INK);
 line(x,y+12,x+2,y+14,1.5,INK);line(x+2,y+14,x+4,y+12,1.5,INK);
 if(!closed){box(x+2,y+15,2,2,INK);box(x+2,y+15,1,1,WHITE);}
}
function wardrobe(p,variant,x,y,crouch){
 const key=typeof variant==='string'?variant:variant?.id;
 const color=variant?.coat||({jacket:'#285c98',varsity:'#285c98',explorer:'#f0b343',adventure:'#f0b343',graduate:'#173e69',graduation:'#173e69'}[key]);
 if(color&&crouch<.9){p.shape([ellipse(x,y,10,10-3*crouch)],color);p.line(x,y-7,x,y+7,2,'#e9f5ff');p.box(x-7,y-2,3,4,'#d6eafa');}
 else if(crouch<.9){p.box(x-3,y-2,1,4,INK);p.box(x+1,y-2,1,4,INK);p.box(x-2,y,3,1,INK);}
}
function pose(phase,progress,time,reduced){
 const t=clamp(progress);
 if(phase==='attack'){
  // Wind-up, lifted elbow, full reach, downward scratch, recoil, rest.
  const frames=[[-3,-17,16,-41,-2,-53],[-5,-19,22,-51,-1,-54],[6,-17,42,-37,3,-52],[7,-15,44,-15,4,-50],[2,-16,24,-20,2,-52],[0,-16,15,-15,0,-53]];
  const i=Math.min(5,Math.floor(t*6)),f=frames[i];
  return {crouch:0,bodyX:f[0],bodyY:f[1],pawX:f[2],pawY:f[3],headX:f[4],headY:f[5],attack:true,closed:false};
 }
 let c=phase==='wake'?1-t:t;c=c*c*(3-2*c);
 const breathe=phase==='sleep'&&c>.95&&!reduced?Math.sin((Number(time)||0)*2)*.65:0;
 return {crouch:c,bodyX:mix(0,-6,c),bodyY:mix(-16,-10,c)-breathe,pawX:mix(14,22,c),pawY:mix(-14,-5,c),headX:mix(0,9,c),headY:mix(-53,-29,c)-breathe,attack:false,closed:phase==='sleep'&&c>.45};
}
function drawPose(ctx,options={}){
 const{x=0,y=0,facing=1,phase='sleep',progress=1,time=0,reduced=false,variant='default'}=options;
 const f=pose(phase,progress,time,reduced),c=f.crouch;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(facing<0?-1:1,1);
 const p=painter(ctx),{shape,line,box}=p;
 box(-24,0,48,2,'#23496b22');
 // Curved white tail plus blue tuft. It curls around the sleeping haunch.
 line(-5,-14,-20,-12,7,INK);line(-5,-14,-20,-12,5,WHITE);
 line(-20,-12,-25,-22+7*c,7,INK);line(-20,-12,-25,-22+7*c,5,WHITE);
 shape([ellipse(-24,-26+9*c,7,7)],BLUE);
 // Back arm and the haunch are separate from the torso and remain articulated.
 line(f.bodyX-8,f.bodyY-2,-15+3*c,-7,8,INK);line(f.bodyX-8,f.bodyY-2,-15+3*c,-7,6,WHITE);
 shape([ellipse(f.bodyX,f.bodyY,mix(12,22,c),mix(15,10,c))],WHITE);
 wardrobe(p,variant,f.bodyX,f.bodyY,c);
 shape([ellipse(-8-4*c,-4,7+3*c,4),ellipse(9+5*c,-4,7,4)],WHITE);
 // A bent elbow and a changing endpoint make the attack a real limb action.
 const elbowX=mix(f.bodyX+9,f.pawX,.5),elbowY=Math.min(f.bodyY+1,f.pawY)+3;
 line(f.bodyX+9,f.bodyY+1,elbowX,elbowY,8,INK);line(f.bodyX+9,f.bodyY+1,elbowX,elbowY,6,WHITE);
 line(elbowX,elbowY,f.pawX,f.pawY,8,INK);line(elbowX,elbowY,f.pawX,f.pawY,6,WHITE);
 head(p,f.headX,f.headY,f.closed,false,f.attack?-.3:0);
 // Front paws rest underneath the cheek in the fully curled pose.
 if(c>.3){shape([ellipse(13+7*c,-4-2*(1-c),6,4),ellipse(24,-5,5,4)],WHITE);line(20,-6,20,-3,1,INK);line(24,-7,24,-4,1,INK);}
 else if(f.attack){shape([ellipse(f.pawX,f.pawY,6,5)],WHITE);for(let k=-1;k<=1;k++)line(f.pawX+3,f.pawY+k*2,f.pawX+7,f.pawY+k*2,1,'#91a8ba');}
 if(phase==='sleep'&&c>.9){const shift=reduced?0:Math.floor(time)%2;ctx.font='700 10px system-ui,sans-serif';ctx.fillStyle='#587d9f';ctx.textAlign='center';ctx.fillText('z',34,-39-shift);ctx.font='700 12px system-ui,sans-serif';ctx.fillText('Z',43,-48-shift);}
 ctx.restore();
}
const poseCache=new Map();
function draw(ctx,options={}){
 const doc=typeof document!=='undefined'?document:root.document;
 if(!doc?.createElement){drawPose(ctx,options);return;}
 const phase=options.phase||'sleep',t=clamp(options.progress??1),steps=phase==='attack'?6:5;
 const frame=Math.min(steps-1,Math.floor(t*steps));
 const progress=phase==='attack'?(frame+.1)/6:frame/(steps-1);
 const breath=phase==='sleep'&&frame===steps-1&&!options.reduced?Math.floor((Number(options.time)||0)*2)%8:0;
 const variant=options.variant||'default',appearance=typeof variant==='string'?variant:[variant.id||'',variant.coat||''].join(':');
 const key=[phase,frame,breath,Boolean(options.reduced),appearance].join('|');
 let tile=poseCache.get(key);
 if(!tile){
  try{
   tile=doc.createElement('canvas');tile.width=128;tile.height=96;
   const off=tile.getContext('2d');
   if(!off)throw new Error('No drawing context');
   drawPose(off,{...options,x:40,y:88,facing:1,progress,time:breath*.5});
   if(poseCache.size>=64)poseCache.delete(poseCache.keys().next().value);
   poseCache.set(key,tile);
  }catch{drawPose(ctx,options);return;}
 }
 ctx.save();ctx.translate(Math.round(options.x||0),Math.round(options.y||0));ctx.scale(options.facing<0?-1:1,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(tile,-40,-88);ctx.restore();
}
function claws(ctx,options={}){
 const{x=0,y=0,facing=1,progress=0,reduced=false}=options,t=clamp(progress);
 if(t<.24||t>.9)return;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(facing<0?-1:1,1);
 const p=painter(ctx),s=clamp((t-.24)/.44),fade=clamp((.9-t)/.2);ctx.globalAlpha=Math.min(1,fade);
 // Three separate curved claw trails; intentionally independent of the body.
 for(let k=0;k<3;k++){
  const points=[[24+k*7,-61+k*2],[36+k*7,-49+k*2],[44+k*7,-34+k*2],[49+k*7,-19+k*2],[47+k*7,-10+k*2]];
  const count=reduced?4:Math.max(1,Math.ceil(s*4));
  for(let i=0;i<count;i++){const a=points[i],b=points[i+1];p.line(...a,...b,4,'#73bde9');p.line(a[0]+1,a[1],b[0]+1,b[1],2,'#f4fdff');}
 }
 ctx.restore();
}
root.MachActors={draw,claws};
})(typeof window!=='undefined'?window:globalThis);
