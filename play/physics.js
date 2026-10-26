(function(root){
'use strict';
const GROUND=420,WIDTH=3400,PLAYER_W=28,PLAYER_H=39,SPEED=440,MIN_SPEED=220,MAX_SPEED=440;
const DASH_SPEED=640,DASH_DURATION=.18,DASH_COOLDOWN=.55,ATTACK_COOLDOWN=.35,BUILDING_RECOVERY=8;
const ATTACK_DURATION=.4,ATTACK_STRIKE_TIME=.14,ATTACK_REACH=72,RECOIL_DURATION=.16,RECOIL_SPEED=360,TIME_EPS=1e-9;
const RUN_STRIDE_PX=132,RUN_FRAME_COUNT=8;
const BUILDING_POINTS=150,SCORE_LIMIT=10000;
const ENEMY_TYPES=Object.freeze({
 slime:Object.freeze({points:100,respawn:12,speed:35}),
 report:Object.freeze({points:100,respawn:14,speed:25}),
 meeting:Object.freeze({points:150,respawn:16,speed:46}),
 overtime:Object.freeze({points:200,respawn:18,speed:62})
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const frameDelta=dt=>Number.isFinite(dt)?clamp(dt,0,1/30):0;
const floorOf=o=>clamp(Math.trunc(Number(o.floor)||0),0,2);
const speedValue=value=>Number.isFinite(Number(value))?clamp(Number(value),MIN_SPEED,MAX_SPEED):SPEED;
const isAlly=s=>s.ally===true||s.type==='earlyLeave';
const isIndestructible=q=>Boolean(q&&(q.indestructible===true||q.castle===true||q.id==='castle'));
const enemySpec=s=>ENEMY_TYPES[s.type]||ENEMY_TYPES.slime;
const boundedScore=value=>Number.isFinite(Number(value))?clamp(Number(value),0,SCORE_LIMIT):0;
function awardPoints(state,points){
 const previous=boundedScore(state.score);state.score=previous;
 if(state.freeExplore===true||state.ended===true)return 0;
 const earned=Number.isFinite(points)?Math.max(0,points):0;
 state.score=Math.min(SCORE_LIMIT,previous+earned);return state.score-previous;
}
function resetCombatRound(state){
 const round=Number.isSafeInteger(state.round)&&state.round>=0?state.round+1:1;
 Object.assign(state,{score:0,lastPoints:0,lastAttack:-Infinity,attackSerial:0,swing:null,scoredBuildingIds:new Set(),notifiedMilestone:0,ended:false,freeExplore:false,round});
 return state;
}
function awardBuildingPoints(buildings,state){
 const awarded=state.scoredBuildingIds instanceof Set?state.scoredBuildingIds:(state.scoredBuildingIds=new Set());
 let points=0;
 for(const q of buildings){
  // Private scenery has no public system to discover and never earns points.
  if(!q||q.locked||isIndestructible(q)||!/^https:\/\//.test(q.url||'')||q.id===undefined||q.id===null)continue;
  const id=String(q.id);if(!id||awarded.has(id))continue;
  awarded.add(id);points+=BUILDING_POINTS;
 }
 return awardPoints(state,points);
}
function createPlayer(x=180,floor=0){return {x:clamp(Number(x)||0,0,WIDTH-PLAYER_W),y:GROUND-PLAYER_H,vx:0,vy:0,grounded:true,facing:1,floor:floorOf({floor}),jumps:0,speed:SPEED,dashRemaining:0,dashCooldown:0,dashDirection:1,attackRemaining:0,attackFacing:1,attackId:null,recoilRemaining:0,recoilDirection:0,locomotionDirection:0,intentionalDirection:0,groundDistance:0,runPhase:0,runFrame:0,wrapped:0,wrapCount:0};}
// Slider changes use setSpeed; passing SPEED restores the default. The selected
// speed survives floor travel, while every airborne/dash state is reset.
function setSpeed(p,value=SPEED){p.speed=speedValue(value);return p.speed;}
function changeFloor(p,floor,x=180){const speed=speedValue(p.speed);Object.assign(p,createPlayer(x,floor));p.speed=speed;return p;}
function step(p,input={},dt=0,platforms=[]){
 dt=frameDelta(dt);const direction=(input.right?1:0)-(input.left?1:0),speed=speedValue(p.speed);
 p.speed=speed;p.wrapped=0;p.dashCooldown=Math.max(0,(p.dashCooldown||0)-dt);
 const wasGrounded=p.grounded,recoilRemaining=(p.recoilRemaining||0)>TIME_EPS?p.recoilRemaining:0,recoilTime=Math.min(dt,recoilRemaining),normalTime=Math.max(0,dt-recoilTime);
 p.attackRemaining=Math.max(0,(p.attackRemaining||0)-dt);p.recoilRemaining=Math.max(0,recoilRemaining-dt);if(p.recoilRemaining<TIME_EPS)p.recoilRemaining=0;
 if(recoilTime>0)p.dashRemaining=0;
 const dashTime=Math.min(normalTime,Math.max(0,p.dashRemaining||0)),walkTime=Math.max(0,normalTime-dashTime);
 // Integrate only the remaining dash fraction: one burst is at most 115.2px.
 const dashDirection=p.dashDirection<0?-1:1;
 if(dashTime>TIME_EPS)p.facing=dashDirection;
 if(walkTime>TIME_EPS&&direction)p.facing=direction;
 // Only actual locomotion can steer/cancel an attack. Recoil velocity and
 // opposing held keys are never mistaken for an intentional direction turn.
 p.locomotionDirection=walkTime>TIME_EPS?direction:dashTime>TIME_EPS?dashDirection:0;
 p.intentionalDirection=input.left&&input.right?0:p.locomotionDirection;
 const recoilDirection=p.recoilDirection<0?-1:1;
 const dashMove=dashDirection*DASH_SPEED*dashTime,walkMove=direction*speed*walkTime;
 p.vx=walkTime>TIME_EPS?direction*speed:dashTime>TIME_EPS?dashDirection*DASH_SPEED:p.recoilRemaining>TIME_EPS?recoilDirection*RECOIL_SPEED:direction*speed;
 p.dashRemaining=Math.max(0,(p.dashRemaining||0)-normalTime);
 const previousBottom=p.y+PLAYER_H,span=WIDTH-PLAYER_W;
 // Clamp the recoil segment first. Any time left in this frame immediately
 // resumes normal controls and may wrap normally; recoil itself never wraps.
 if(recoilTime>0)p.x=clamp(p.x+recoilDirection*RECOIL_SPEED*recoilTime,0,span);
 for(const move of [dashMove,walkMove]){const nextX=p.x+move;
  if(nextX<0||nextX>span){p.wrapped=nextX<0?-1:1;p.wrapCount=(p.wrapCount||0)+1;p.x=((nextX%span)+span)%span;}else p.x=nextX;
 }
 p.vy+=1250*dt;p.y+=p.vy*dt;p.grounded=false;
 let floor=GROUND;
 // Buildings are scenery, never collision blockers; all doors stay reachable.
 for(const q of platforms)if((q.floor===undefined||floorOf(q)===floorOf(p))&&p.vy>=0&&previousBottom<=q.y+1&&p.y+PLAYER_H>=q.y&&p.x+PLAYER_W>q.x&&p.x<q.x+q.w)floor=Math.min(floor,q.y);
 if(p.y+PLAYER_H>=floor){p.y=floor-PLAYER_H;p.vy=0;p.grounded=true;p.jumps=0;p.dashRemaining=0;}
 // Count path length, not camera displacement or the large coordinate change
 // across a wrap. Airborne and recoil displacement do not drive the run cycle.
 if(wasGrounded&&p.grounded)p.groundDistance=(p.groundDistance||0)+Math.abs(dashMove)+Math.abs(walkMove);
 const phase=((p.groundDistance||0)/RUN_STRIDE_PX)%1;
 p.runPhase=phase<TIME_EPS||1-phase<TIME_EPS?0:phase;
 p.runFrame=Math.min(RUN_FRAME_COUNT-1,Math.floor(p.runPhase*RUN_FRAME_COUNT));
 return p;
}
function jump(p,repeat=false){
 if(repeat||(p.recoilRemaining||0)>TIME_EPS)return false;if(p.grounded)p.jumps=0;
 if((p.jumps||0)>=2)return false;
 const second=(p.jumps||0)===1;
 p.vy=second?-340:-485;p.grounded=false;p.jumps=(p.jumps||0)+1;
 if(second&&(p.dashCooldown||0)<=0){p.dashRemaining=DASH_DURATION;p.dashCooldown=DASH_COOLDOWN;p.dashDirection=p.facing<0?-1:1;}
 return true;
}
function nearby(p,objects=[]){return objects.find(q=>floorOf(q)===floorOf(p)&&Math.abs(p.x+PLAYER_W/2-q.x)<(q.range||60)&&Math.abs(p.y+PLAYER_H-(q.y??GROUND))<48)||null;}
function interaction(p,portals=[],elevators=[],npcs=[]){
 for(const [type,items] of [['portal',portals],['elevator',elevators],['npc',npcs]]){const target=nearby(p,items);if(target)return {type,target};}return null;
}
function animationFrame(p,time,reduced=false){
 if(!p.grounded)return p.vy<0?6:7;
 // The legacy whole-body sheet has only four walk images. Map the continuous
 // eight-frame distance phase to those four; never index its jump images.
 if(Math.abs(p.vx)>0.5&&p.locomotionDirection!==0&&!(p.recoilRemaining>TIME_EPS))return 2+(Number.isFinite(p.runPhase)?Math.min(3,Math.floor(p.runPhase*4)):Math.floor(time*10)%4);
 return reduced?0:(time%4>3.8?1:0);
}
function canOpen({active,repeat,locked,portal}){return Boolean(active&&!repeat&&!locked&&portal&&!portal.locked&&/^https:\/\//.test(portal.url));}
function inAttackRange(p,s){const forward=(s.x-(p.x+PLAYER_W/2))*(p.facing<0?-1:1);return floorOf(s)===floorOf(p)&&forward>=0&&forward<=ATTACK_REACH&&Math.abs((s.y??GROUND)-(p.y+PLAYER_H))<=60;}
function validHitBounds(b){return Boolean(b&&['left','top','right','bottom'].every(k=>Number.isFinite(b[k]))&&b.left<b.right&&b.top<b.bottom);}
function translateHitBounds(b,x,y){return validHitBounds(b)&&Number.isFinite(x)&&Number.isFinite(y)?{left:x+b.left,top:y+b.top,right:x+b.right,bottom:y+b.bottom}:null;}
function overlaps(a,b){return Boolean(a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);}
// Body bounds match game.js drawSlime/drawOfficeEnemy, excluding labels and Z.
// s.y already includes the actor's movement; only the drawing's extra bob is
// applied here. These are continuous half-open world bounds, independent of
// camera position or canvas rounding.
function enemyHitBounds(s,time,reducedMotion=false){
 let local;
 if(s.type==='report')local={left:-20,top:-45,right:21,bottom:-2};
 else if(s.type==='meeting')local={left:-29,top:-44,right:29,bottom:0};
 else if(s.type==='slime'||s.type===undefined){const b=reducedMotion?0:Math.floor(time*5+String(s.id??'').length)%2;local={left:-19,top:-27-b,right:19,bottom:0};}
 else{const b=reducedMotion?0:Math.sin(time*5)*3;local={left:-34,top:-49+b,right:34,bottom:-10+b};}
 return translateHitBounds(local,s.x,s.y??GROUND);
}
function inStrikeRange(p,s,contact,building=false){
 if(!contact?.actual)return inAttackRange(p,s);
 if(floorOf(s)!==floorOf(p))return false;
 const target=building?translateHitBounds(s.hitBounds,s.x,s.y??GROUND):enemyHitBounds(s,contact.time,contact.reducedMotion);
 return overlaps(contact.bounds,target);
}
function strikeTargets(p,slimes,time,state,contact){
 let hits=0,points=0;
 for(const s of slimes)if(!isAlly(s)&&!isIndestructible(s)&&s.alive!==false&&inStrikeRange(p,s,contact)){
  const spec=enemySpec(s);s.alive=false;s.respawnAt=time+spec.respawn;hits++;points+=spec.points;
 }
 points=awardPoints(state,points);state.lastPoints=points;return {hits,points};
}
// Compatibility helper for older callers/tests. The game uses launch/advance
// so input does not deal damage before the 140ms claw contact frame.
function attack(p,slimes,time,state,repeat=false){
 if(repeat||!Number.isFinite(time)||time-(state.lastAttack??-Infinity)<ATTACK_COOLDOWN)return 0;
 state.lastAttack=time;return strikeTargets(p,slimes,time,state).hits;
}
function cancelAttack(p,state){
 if((p.recoilRemaining||0)>TIME_EPS)p.vx=0;
 p.attackRemaining=0;p.attackId=null;p.recoilRemaining=0;p.recoilDirection=0;
 state.swing=null;return p;
}
function launchAttack(p,time,state,repeat=false){
 if(repeat||!Number.isFinite(time)||(p.recoilRemaining||0)>TIME_EPS||time+TIME_EPS-(state.lastAttack??-Infinity)<ATTACK_DURATION)return false;
 if(state.swing&&time+TIME_EPS<state.swing.endsAt)return false;
 const facing=(p.dashRemaining||0)>TIME_EPS?(p.dashDirection<0?-1:1):(p.facing<0?-1:1),id=(state.attackSerial||0)+1;
 state.attackSerial=id;state.lastAttack=time;state.lastPoints=0;
 state.swing={id,startedAt:time,strikeAt:time+ATTACK_STRIKE_TIME,endsAt:time+ATTACK_DURATION,facing,floor:floorOf(p),struck:false,active:true,visualActive:true,visualCancelled:false,hitFacing:null,hitX:null,hitY:null,hitOffsetY:null,hitOriginY:null,hitBounds:null,lastTime:time};
 p.attackId=id;p.attackRemaining=ATTACK_DURATION;p.attackFacing=facing;
 return true;
}
function advanceAttack(p,targets,buildings,time,state,geometry={}){
 const empty={active:false,visualActive:false,visualCancelled:false,struck:false,hits:0,points:0,destroyed:[],impact:null,facing:p.attackFacing<0?-1:1,hitFacing:null,hitX:null,hitY:null,hitOffsetY:null,hitOriginY:null,hitBounds:null,progress:0},swing=state.swing;
 if(!swing||!Number.isFinite(time))return empty;
 if(p.attackId!==swing.id||floorOf(p)!==swing.floor){cancelAttack(p,state);return empty;}
 if(time+TIME_EPS<swing.lastTime)return {...empty,active:swing.active,visualActive:swing.visualActive,visualCancelled:swing.visualCancelled,facing:swing.facing,hitFacing:swing.hitFacing,hitX:swing.hitX,hitY:swing.hitY,hitOffsetY:swing.hitOffsetY,hitOriginY:swing.hitOriginY,hitBounds:swing.hitBounds,progress:clamp((swing.lastTime-swing.startedAt)/ATTACK_DURATION,0,1)};
 swing.lastTime=time;swing.active=time+TIME_EPS<swing.endsAt;
 p.attackRemaining=Math.max(0,swing.endsAt-time);
 if(!swing.struck)swing.facing=p.locomotionDirection||(p.facing<0?-1:1);
 else if(swing.active&&p.intentionalDirection&&p.intentionalDirection!==swing.hitFacing)swing.visualCancelled=true;
 p.attackFacing=swing.facing;
 const result={...empty,active:swing.active,facing:swing.facing,progress:clamp((time-swing.startedAt)/ATTACK_DURATION,0,1)};
 if(!swing.struck&&time+TIME_EPS>=swing.strikeAt){
  swing.struck=true;result.struck=true;swing.hitFacing=swing.facing;swing.hitX=p.x+PLAYER_W/2;swing.hitY=p.y+PLAYER_H;
  // Renderer-validated per-leg-frame upper offset is sampled at contact, not
  // launch. Only hit geometry shifts; the player's foot and collisions do not.
  swing.hitOffsetY=Number.isFinite(geometry?.upperOffsetY)?clamp(geometry.upperOffsetY,-2,0):0;
  swing.hitOriginY=swing.hitY+swing.hitOffsetY;
  // The loader supplies the already selected facing's frame-3 outer edges.
  // Never mirror, add the upper offset twice, or intersect with legacy reach.
  // Omitted/undefined geometry keeps other outfits' legacy interaction; a
  // supplied malformed rectangle fails closed instead of widening the hit.
  const actual=geometry?.actualHitBounds!==undefined,bounds=actual?translateHitBounds(geometry.actualHitBounds,swing.hitX,swing.hitOriginY):null;
  swing.hitBounds=bounds?Object.freeze(bounds):null;
  const contact={actual,bounds:swing.hitBounds,time,reducedMotion:geometry?.reducedMotion===true};
  const strikePlayer={...p,y:p.y+swing.hitOffsetY,facing:swing.facing},hit=strikeTargets(strikePlayer,targets,time,state,contact);
  result.hits=hit.hits;result.points=hit.points;result.destroyed=damageBuildings(strikePlayer,buildings,time,contact);
  result.points+=awardBuildingPoints(result.destroyed,state);state.lastPoints=result.points;
  const fortress=buildings.find(q=>isIndestructible(q)&&inStrikeRange(strikePlayer,q,contact,true));
  if(fortress){
   result.impact={target:fortress,facing:swing.hitFacing,at:time,x:swing.hitX,y:swing.hitY,offsetY:swing.hitOffsetY,originY:swing.hitOriginY,attackId:swing.id};
   p.recoilDirection=-swing.facing;p.recoilRemaining=RECOIL_DURATION;p.dashRemaining=0;
  }
 }
 swing.visualActive=swing.active&&!swing.visualCancelled;
 return {...result,visualActive:swing.visualActive,visualCancelled:swing.visualCancelled,hitFacing:swing.hitFacing,hitX:swing.hitX,hitY:swing.hitY,hitOffsetY:swing.hitOffsetY,hitOriginY:swing.hitOriginY,hitBounds:swing.hitBounds};
}
// Backwards-compatible entry point for every V3 enemy and the friendly fairy.
function updateSlimes(slimes,dt,time){
 dt=frameDelta(dt);if(!Number.isFinite(time))return slimes;
 for(const s of slimes){if(!Number.isFinite(s.spawnX))s.spawnX=s.x;
  if(s.alive===false){if(Number.isFinite(s.respawnAt)&&time>=s.respawnAt){s.alive=true;s.x=s.spawnX;s.respawnAt=null;}else continue;}
  const spec=enemySpec(s),min=clamp(s.minX??s.spawnX-65,0,WIDTH),max=clamp(s.maxX??s.spawnX+65,min,WIDTH);
  if(!Number.isFinite(s.vx)||s.vx===0)s.vx=isAlly(s)?28:spec.speed;
  if(s.type==='meeting'){
   const radius=(max-min)/2;s.x=(min+max)/2+Math.sin(time*1.8+(s.phase||0))*radius;
   s.y=(s.baseY??GROUND)-5-Math.abs(Math.sin(time*3))*8;
  }else{
   const moving=s.type!=='report'||time%2.8<1.75;
   s.x=clamp(s.x+(moving?s.vx:0)*dt,min,max);
   if(s.x<=min)s.vx=Math.abs(s.vx);else if(s.x>=max)s.vx=-Math.abs(s.vx);
   if(s.type==='overtime')s.y=(s.baseY??GROUND)-16-Math.abs(Math.sin(time*2.5+(s.phase||0)))*25;
   else if(isAlly(s))s.y=(s.baseY??GROUND)-18-Math.sin(time*2)*8;
  }
 }
 return slimes;
}
function collectAllies(p,allies,time){
 if(!Number.isFinite(time))return [];const collected=[];
 for(const s of allies)if(isAlly(s)&&s.alive!==false&&floorOf(s)===floorOf(p)&&Math.abs(s.x-(p.x+PLAYER_W/2))<=34&&Math.abs((s.y??GROUND)-(p.y+PLAYER_H))<=58){s.alive=false;s.respawnAt=time+45;s.collectedAt=time;collected.push(s);}
 return collected;
}
// Only presentation changes: URLs, lock flags and permissions remain untouched.
// Scoring is separate from scenery recovery: a public ID earns once per round.
function damageBuildings(p,buildings,time,contact){
 if(!Number.isFinite(time))return [];const destroyed=[];
 for(const q of buildings)if(!isIndestructible(q)&&!q.destroyed&&time-(q.lastDamage??-Infinity)>=ATTACK_COOLDOWN&&inStrikeRange(p,q,contact,true)){q.destroyed=true;q.destroyedAt=time;q.lastDamage=time;q.restoreAt=time+BUILDING_RECOVERY;destroyed.push(q);}
 return destroyed;
}
function restoreBuilding(q){if(!q||isIndestructible(q)||!q.destroyed)return false;q.destroyed=false;q.restoreAt=null;return true;}
function updateBuildings(buildings,time){if(!Number.isFinite(time))return buildings;for(const q of buildings)if(!isIndestructible(q)&&q.destroyed&&Number.isFinite(q.restoreAt)&&time>=q.restoreAt)restoreBuilding(q);return buildings;}
function scoreMilestones(state){
 const score=Number(state.score),notified=Number(state.notifiedMilestone);
 const reached=Math.floor(boundedScore(score)/1000),previous=clamp(Math.floor(Number.isFinite(notified)?notified:0),0,SCORE_LIMIT/1000),milestones=[];
 for(let n=previous+1;n<=reached;n++)milestones.push(n*1000);
 state.notifiedMilestone=Math.max(previous,reached);return milestones;
}
const api={GROUND,WIDTH,PLAYER_W,PLAYER_H,SPEED,MIN_SPEED,MAX_SPEED,DASH_SPEED,DASH_DURATION,DASH_COOLDOWN,ATTACK_COOLDOWN,ATTACK_DURATION,ATTACK_STRIKE_TIME,ATTACK_REACH,RECOIL_DURATION,RECOIL_SPEED,RUN_STRIDE_PX,RUN_FRAME_COUNT,BUILDING_RECOVERY,BUILDING_POINTS,SCORE_LIMIT,ENEMY_TYPES,clamp,createPlayer,setSpeed,changeFloor,step,jump,nearby,interaction,canOpen,animationFrame,attack,launchAttack,advanceAttack,cancelAttack,isIndestructible,enemyHitBounds,updateSlimes,collectAllies,damageBuildings,restoreBuilding,updateBuildings,scoreMilestones,resetCombatRound};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MachPhysics=api;
})(typeof window!=='undefined'?window:globalThis);
