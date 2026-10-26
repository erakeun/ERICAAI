'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const P=require('../play/physics.js');
const publicBuilding=(id='01',patch={})=>({id,x:150,floor:0,url:'https://erakeun.github.io/example/',...patch});
function strike(player,state,buildings=[],enemies=[],time=0){
 assert.equal(P.launchAttack(player,time,state),true);
 return P.advanceAttack(player,enemies,buildings,time+P.ATTACK_STRIKE_TIME,state);
}
function state(){return P.resetCombatRound({});}

test('first destruction awards 150 once per building ID despite manual or automatic recovery',()=>{
 const player=P.createPlayer(110),combat=state(),building=publicBuilding();
 const first=strike(player,combat,[building]);
 assert.equal(first.destroyed.length,1);assert.equal(first.points,150);assert.equal(combat.score,150);assert.equal(combat.lastPoints,150);
 assert.equal(P.restoreBuilding(building),true);
 const again=strike(player,combat,[building],[],1);
 assert.equal(again.destroyed.length,1);assert.equal(again.points,0);assert.equal(combat.score,150);
 P.updateBuildings([building],10);assert.equal(building.destroyed,false);
 assert.equal(strike(player,combat,[building],[],11).points,0);
 const rebuiltObject=publicBuilding('01');
 assert.equal(strike(player,combat,[rebuiltObject],[],12).points,0);
 assert.deepEqual([...combat.scoredBuildingIds],['01']);
});

test('all 18 public systems award 2700 total and retain their working portal destinations',()=>{
 const scope={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../play/manifest.js'),'utf8'),scope);
 const portals=JSON.parse(JSON.stringify(scope.window.MACH_PORTALS)),systems=portals.filter(q=>!q.locked),combat=state();
 assert.equal(systems.length,18);
 systems.forEach((building,index)=>{
  const player=P.createPlayer(building.x-40,building.floor),url=building.url;
  assert.equal(strike(player,combat,[building],[],index).points,150);
  assert.equal(building.url,url);assert.equal(P.canOpen({active:true,repeat:false,locked:false,portal:building}),true);
 });
 assert.equal(combat.score,2700);assert.equal(combat.scoredBuildingIds.size,18);
});

test('steel fortress cannot be destroyed or scored, still rebounds; private scenery earns zero',()=>{
 const player=P.createPlayer(110),combat=state(),castle=publicBuilding('castle',{locked:true,castle:true,indestructible:true});
 const hit=strike(player,combat,[castle]);
 assert.equal(hit.destroyed.length,0);assert.equal(hit.points,0);assert.equal(combat.score,0);
 assert.equal(castle.destroyed,undefined);assert.equal(P.restoreBuilding(castle),false);
 assert.equal(hit.impact.target,castle);assert.equal(player.recoilDirection,-1);assert.equal(player.recoilRemaining,P.RECOIL_DURATION);
 P.cancelAttack(player,combat);
 const privateBuilding=publicBuilding('private',{locked:true,url:undefined});
 const privateHit=strike(player,combat,[privateBuilding],[],1);
 assert.equal(privateHit.destroyed.length,1);assert.equal(privateHit.points,0);assert.equal(combat.scoredBuildingIds.size,0);
 const missingId=publicBuilding(undefined,{id:undefined});
 assert.equal(strike(player,combat,[missingId],[],2).points,0);
});

test('one strike combines enemy and building rewards; repeat and later frames cannot duplicate it',()=>{
 const player=P.createPlayer(110),combat=state(),building=publicBuilding(),enemy={id:'work',type:'report',x:150,floor:0,alive:true};
 assert.equal(P.launchAttack(player,0,combat,true),false);assert.equal(combat.score,0);
 const hit=strike(player,combat,[building],[enemy]);
 assert.equal(hit.hits,1);assert.equal(hit.points,250);assert.equal(combat.lastPoints,250);assert.equal(combat.score,250);
 assert.equal(P.launchAttack(player,.2,combat),false);
 const later=P.advanceAttack(player,[enemy],[building],.2,combat);
 assert.equal(later.struck,false);assert.equal(later.points,0);assert.equal(combat.score,250);
});

test('legacy enemy balance remains 100/100/150/200 and allies never award points',()=>{
 const player=P.createPlayer(110),combat=state();
 const enemies=['slime','report','meeting','overtime'].map((type,i)=>({id:String(i),type,x:150,floor:0,alive:true}));
 const ally={id:'fairy',type:'earlyLeave',ally:true,x:150,floor:0,alive:true};
 const hit=strike(player,combat,[],[...enemies,ally]);
 assert.equal(hit.hits,4);assert.equal(hit.points,550);assert.equal(ally.alive,true);assert.equal(combat.score,550);
});

test('score caps at 10000 and reports only actual credit when the last hit crosses the cap',()=>{
 const player=P.createPlayer(110),combat=state();combat.score=9950;
 const enemy={id:'overtime',type:'overtime',x:150,floor:0,alive:true},building=publicBuilding();
 const hit=strike(player,combat,[building],[enemy]);
 assert.equal(hit.points,50);assert.equal(combat.lastPoints,50);assert.equal(combat.score,10000);
 const next=strike(player,combat,[publicBuilding('02')],[],1);
 assert.equal(next.points,0);assert.equal(combat.score,10000);
});

test('ended or free exploration stops scoring while attacks, recovery and public portals remain usable',()=>{
 for(const frozen of ['ended','freeExplore']){
  const player=P.createPlayer(110),combat=state(),building=publicBuilding();combat.score=9500;combat[frozen]=true;
  const enemy={id:'slime',type:'slime',x:150,floor:0,alive:true},hit=strike(player,combat,[building],[enemy]);
  assert.equal(hit.hits,1);assert.equal(hit.destroyed.length,1);assert.equal(hit.points,0);assert.equal(combat.score,9500);
  assert.equal(P.restoreBuilding(building),true);
  assert.equal(P.canOpen({active:true,repeat:false,locked:false,portal:building}),true);
 }
});

test('cancelled menu attack never strikes or awards points after gameplay resumes',()=>{
 const player=P.createPlayer(110),combat=state(),building=publicBuilding();
 assert.equal(P.launchAttack(player,0,combat),true);P.cancelAttack(player,combat);
 const hit=P.advanceAttack(player,[],[building],1,combat);
 assert.equal(hit.struck,false);assert.equal(hit.points,0);assert.equal(building.destroyed,undefined);assert.equal(combat.score,0);
});

test('milestones are unique, ordered and capped even across many thresholds in one hit',()=>{
 const combat=state();combat.score=999;assert.deepEqual(P.scoreMilestones(combat),[]);
 combat.score=3150;assert.deepEqual(P.scoreMilestones(combat),[1000,2000,3000]);assert.deepEqual(P.scoreMilestones(combat),[]);
 combat.score=Number.MAX_VALUE;assert.deepEqual(P.scoreMilestones(combat),[4000,5000,6000,7000,8000,9000,10000]);
 assert.deepEqual(P.scoreMilestones(combat),[]);assert.equal(combat.notifiedMilestone,10);
 combat.score=1000;assert.deepEqual(P.scoreMilestones(combat),[]);
 for(const invalid of [NaN,Infinity,-Infinity])assert.deepEqual(P.scoreMilestones({score:invalid}),[]);
});

test('new round clears reward IDs, ending flags, milestones and attack state so buildings score anew',()=>{
 const player=P.createPlayer(110),combat=state(),building=publicBuilding();
 strike(player,combat,[building]);combat.score=10000;P.scoreMilestones(combat);combat.ended=true;combat.freeExplore=true;
 const previousRound=combat.round;P.cancelAttack(player,combat);P.resetCombatRound(combat);P.restoreBuilding(building);
 assert.equal(combat.round,previousRound+1);assert.equal(combat.score,0);assert.equal(combat.lastPoints,0);assert.equal(combat.scoredBuildingIds.size,0);
 assert.equal(combat.ended,false);assert.equal(combat.freeExplore,false);assert.equal(combat.notifiedMilestone,0);
 assert.equal(combat.swing,null);assert.equal(combat.attackSerial,0);assert.equal(combat.lastAttack,-Infinity);
 assert.equal(strike(player,combat,[building],[],1).points,150);assert.equal(combat.score,150);
 combat.score=1000;assert.deepEqual(P.scoreMilestones(combat),[1000]);
});
