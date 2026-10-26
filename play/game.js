(function(){
'use strict';
const $=s=>document.querySelector(s),P=window.MachPhysics,canvas=$('#game'),ctx=canvas.getContext('2d'),portals=window.MACH_PORTALS;
const embedded=new URLSearchParams(location.search).get('embed')==='1'&&window.parent!==window;
const notifyParent=(type,extra={})=>{if(embedded)window.parent.postMessage({type,...extra},location.origin);};
let frameId=null,frameCount=0;
function stopLoop(){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;}
function scheduleFrame(){if(active&&!document.hidden&&frameId===null)frameId=requestAnimationFrame(tick);}
const zones=[{floor:0,name:'디자인 · 제작',en:'DESIGN WALK'},{floor:1,name:'행사 · 면접',en:'EVENT AVENUE'},{floor:2,name:'캠퍼스 · 업무',en:'CAMPUS TERRACE'}];
const world=window.MachWorldArt.create(ctx);
for(const portal of portals)portal.hitBounds=world.hitBounds(portal);
const platforms=[{x:1090,y:300,w:80},{x:2260,y:300,w:80}];
const elevators=[0,1,2].flatMap(floor=>[270,2850].map(x=>({id:'lift-'+floor+'-'+x,name:'캠퍼스 엘리베이터',x,floor})));
const npcs=[0,1,2].flatMap(floor=>[150,1850,3250].map((x,i)=>({id:'npc-'+floor+'-'+i,name:'하이비비',x,floor})));
const npcLines=['회의는 짧게, 퇴근은 제때.','오늘의 오류는 내일의 패치노트.','완벽한 보고서보다, 끝낸 보고서가 먼저.','일에도 저장 버튼이 필요해. 잠깐 쉬어 가자.','우선순위의 마지막 칸에도 나를 넣어 줘.','오늘 할 일은 오늘의 나만큼만.'];
const slimes=[0,1,2].flatMap(floor=>[720,1130,1520,2300].map((x,i)=>({id:'enemy-'+floor+'-'+i,type:['slime','report','meeting','overtime'][i],x,spawnX:x,y:420,floor,minX:x-55,maxX:x+55,vx:i%2?25:-25,alive:true})));
const allies=[0,1,2].map(floor=>({id:'early-'+floor,type:'earlyLeave',ally:true,x:950,spawnX:950,y:420,floor,minX:850,maxX:1150,vx:26,alive:false,respawnAt:25+floor*7}));
const combat={score:0,lastAttack:-Infinity};
const attackAnimation=window.MachAttackAnimation.create(window.MACH_ATTACK_ASSETS||{});
let attackVisual=null,metalImpact=null;
let player=P.createPlayer(410),keys={left:false,right:false},active=false,started=false,locked=false,near=null,interaction=null,camera=0,cameraY=1040,last=0,time=0,lastPortal='',talkCount=0,attackUntil=0,hitUntil=0,hitNotice='';
let lastInput=0,sleeping=false,wakeAt=-100,character='default',lastNpcAt=-30,npcLineIndex=0,npcBubble=null,celebrateUntil=0,currentNotice=null,noticeCount=0;
const noticeQueue=[];
function wake(){if(sleeping)wakeAt=time;sleeping=false;lastInput=time;}
function announce(message,kind='info'){noticeQueue.push({text:message,kind});showNextNotice();}
function showNextNotice(){if(currentNotice||!noticeQueue.length)return;currentNotice={...noticeQueue.shift(),until:time+6};noticeCount++;$('#gameNotice').textContent=currentNotice.text;$('#gameNotice').hidden=false;$('#status').textContent=currentNotice.text;}
function updateNotices(){if(currentNotice&&time>=currentNotice.until){currentNotice=null;$('#gameNotice').hidden=true;showNextNotice();}}
const characters=[{id:'default',label:'활동 하냥이 · 달리기 할퀴기',file:null},{id:'original',label:'기본 하냥이 · AI 원본',file:'assets/hanyang-original-source.png',anchor:256,base:448},{id:'varsity',label:'과잠 하냥이 · AI 원본',file:'assets/hanyang-varsity-source.png',anchor:256,base:450},{id:'graduate',label:'졸업 하냥이 · AI 원본',file:'assets/hanyang-graduate-source.png',anchor:256,base:479},{id:'explorer',label:'탐험 하냥이 · AI 원본',file:'assets/hanyang-explorer-source.png',anchor:256,base:458},{id:'safety',label:'안전 하냥이 · AI 원본',file:'assets/hanyang-safety-source.png',anchor:294,base:480}];
for(const q of characters){const option=document.createElement('option');option.value=q.id;option.textContent=q.label;$('#characterSelect').append(option);if(q.file&&typeof Image==='function'){q.image=new Image();q.image.onload=()=>{q.ready=q.image.naturalWidth===512;};q.image.onerror=()=>{q.ready=false;};q.image.src=q.file;}}
$('#characterSelect').value=character;
$('#characterSelect').addEventListener('change',()=>{const q=characters.find(q=>q.id===$('#characterSelect').value);if(q){cancelSwing();character=q.id;wake();$('#status').textContent=q.label+' 선택. 충돌 크기는 동일합니다.';}});
function syncSpeed(){ $('#speedControl').value=String(player.speed);$('#speedValue').textContent=player.speed+' px/s';}
$('#speedControl').addEventListener('input',()=>{P.setSpeed(player,Number($('#speedControl').value));wake();syncSpeed();});
$('#speedReset').addEventListener('click',()=>{P.setSpeed(player,P.SPEED);wake();syncSpeed();});
syncSpeed();
// Keep one world pixel close to one CSS pixel so Korean signs stay readable on
// narrow screens. Show less world, not a shrunken or object-fit-cropped world.
let viewWidth;
function resizeCanvas(){viewWidth=P.clamp(Math.round(canvas.clientWidth||window.innerWidth-(window.innerWidth<=760?30:80)),280,1120);canvas.width=viewWidth;camera=P.clamp(player.x-viewWidth*.375,0,P.WIDTH-viewWidth);}
resizeCanvas();window.addEventListener('resize',()=>{resizeCanvas();draw();});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// AI-generated revision from the user's supplied character manual; no runtime network dependency.
const SPRITE_URL='assets/hanyangi-actions.png';
// x,y,width,height,cell-local left. Bounds inspected from source alpha; source stays unchanged.
const SPRITE_FRAMES=[[72,14,307,409,72],[515,14,309,409,71],[957,14,314,409,70],[1405,14,308,409,75],[65,457,313,404,65],[515,457,312,404,71],[961,443,312,391,74],[1385,460,334,394,55]];
let spriteReady=false,spriteCache=[];
const spriteImage=typeof Image==='function'?new Image():null;
function cacheSpriteFrames(){
 try{
 if(spriteImage.naturalWidth!==1774||spriteImage.naturalHeight!==887)return;
 spriteCache=SPRITE_FRAMES.map(([sx,sy,sw,sh,left])=>{const tile=document.createElement('canvas');tile.width=64;tile.height=80;const c=tile.getContext('2d');c.imageSmoothingEnabled=false;
 // One shared 0.19 scale preserves head size across all poses, rather than fitting each silhouette.
 const w=Math.round(sw*.19),h=Math.round(sh*.19);c.drawImage(spriteImage,sx,sy,sw,sh,Math.round(32+(left-225)*.19),78-h,w,h);return tile;});
 spriteReady=spriteCache.length===8;
 }catch{spriteReady=false;spriteCache=[];}
}
if(spriteImage){spriteImage.onload=cacheSpriteFrames;spriteImage.onerror=()=>{spriteReady=false;};spriteImage.src=SPRITE_URL;}

const palette={ink:'#0e4a84'};
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function polygon(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.fill();}
function text(s,x,y,size=12,color=palette.ink,align='center'){ctx.font=`600 ${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,Math.round(x),Math.round(y));}
function cloud(x,y,s){ctx.save();ctx.translate(Math.floor(x),y);ctx.scale(s,s);rect(0,8,76,14,'#f5fae9');rect(13,0,22,29,'#f5fae9');rect(34,-7,24,32,'#f5fae9');rect(-10,16,98,8,'#eff7e8');ctx.restore();}
function smallBush(x,y,col='#739857'){rect(x-18,y-13,36,13,col);rect(x-12,y-21,21,10,col);rect(x-22,y-8,46,8,col);rect(x-9,y-17,7,3,'#acc681');}
function hills(offset,y,color){for(let i=-1;i<9;i++){const x=i*250-((camera*offset)%250);polygon([[x,y+100],[x,y+15],[x+28,y+15],[x+28,y-7],[x+63,y-7],[x+63,y-25],[x+111,y-25],[x+111,y-8],[x+148,y-8],[x+148,y+14],[x+186,y+14],[x+186,y+48],[x+250,y+48],[x+250,y+130]],color);}}
function drawMascot(){
const x=Math.round(player.x-camera+14),y=Math.round(player.y+P.PLAYER_H);
const swinging=combat.swing&&time<combat.swing.endsAt;
const visualActive=swinging&&combat.swing.visualActive;
if((!swinging||attackVisual?.sheet)&&attackAnimation.kind(character)==='layered-v1'&&attackAnimation.renderCharacter(ctx,{...characterDrawOptions(x,y),includeClaws:false})){drawNameplate(x,y-91);drawFacing(x,y);drawSleepMark(x,y);return;}
if(visualActive&&attackVisual?.sheet&&attackAnimation.renderBody(ctx,{attack:attackVisual.capture,x,y,elapsedSeconds:time-combat.swing.startedAt})){drawNameplate(x,y-91);return;}
// The approved neutral and attack must enter together. Until locomotion/sleep
// sheets exist, retain this exact appearance in every state, without morphing.
if((!swinging||attackVisual?.sheet)&&attackAnimation.renderNeutral(ctx,{appearanceId:character,x,y,facing:player.facing})){drawNameplate(x,y-91);drawFacing(x,y);drawSleepMark(x,y);return;}
const chosen=characters.find(q=>q.id===character);
if(chosen&&chosen.ready&&character!=='default'){ctx.save();ctx.translate(x,y);ctx.scale(player.facing,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(chosen.image,-chosen.anchor*.18,-chosen.base*.18,512*.18,512*.18);ctx.restore();drawNameplate(x,y-91);drawFacing(x,y);drawSleepMark(x,y);return;}
if(!spriteReady||!spriteImage){drawFallbackMascot();return;}
const frame=P.animationFrame(player,time,reduced);
ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(x,y);ctx.scale(player.facing,1);
rect(-19,0,38,2,'#66854e55');
// Crop transparent margins at draw time only. Source PNG remains unchanged.
ctx.drawImage(spriteCache[frame],-32,-80);
ctx.restore();drawNameplate(x,y-87);drawFacing(x,y);drawSleepMark(x,y);
}
function characterDrawOptions(x,y){const swing=combat.swing;return {appearanceId:character,x,y,facing:player.facing,runPhase:player.runPhase||0,moving:player.grounded&&Math.abs(player.vx)>.5&&player.locomotionDirection!==0,recoiling:player.recoilRemaining>1e-9&&player.locomotionDirection===0,grounded:player.grounded,vy:player.vy,attackElapsed:swing?time-swing.startedAt:undefined,attackVisualActive:Boolean(swing&&time<swing.endsAt&&swing.visualActive&&attackVisual?.sheet)};}
function drawAttackClaws(){const swing=combat.swing;if(!swing||time>=swing.endsAt||!swing.visualActive||!attackVisual?.sheet)return;const x=player.x-camera+14,y=player.y+P.PLAYER_H;if(attackAnimation.kind(character)==='layered-v1')attackAnimation.renderCharacterClaws(ctx,characterDrawOptions(x,y));else attackAnimation.renderClaws(ctx,{attack:attackVisual.capture,x,y,elapsedSeconds:time-swing.startedAt});}
function drawSleepMark(x,y){if(sleeping)text('z Z',x+38,y-65,12,'#587d9f');}
function drawMetalImpact(){if(!metalImpact||time>=metalImpact.until||metalImpact.floor!==player.floor)return;const age=time-metalImpact.at,x=metalImpact.x-camera,y=metalImpact.y;const travel=reduced?8:6+age*52;ctx.save();ctx.globalAlpha=reduced?1:P.clamp(1-age/.32,0,1);for(let i=0;i<5;i++){const a=-1.4+i*.7,dx=Math.cos(a)*travel*-metalImpact.facing,dy=Math.sin(a)*travel;rect(x+dx,y+dy,3,3,i%2?'#d9f6ff':'#ffd06b');}const labelX=x-metalImpact.facing*18;rect(labelX-24,y-49,48,25,'#fff8e5');text('깡!',labelX,y-30,18,'#23496b');ctx.restore();}
function drawNameplate(x,y){rect(x-31,y-15,62,20,'#f5fbffed');text('하냥이',x,y,14,'#0e4a84');}
function drawFacing(x,y){const d=player.facing;polygon([[x+d*36,y-17],[x+d*43,y-12],[x+d*36,y-7]],'#0e4a84');}
function drawFallbackMascot(){
const x=Math.round(player.x-camera+14),y=Math.round(player.y+P.PLAYER_H),walking=active&&Math.abs(player.vx)>0,frame=walking?Math.floor(time*10)%4:0,bob=walking?frame%2:0;
const ink='#184266',blue='#2462a2',white='#fffefb';
// Code-native 64 × 73 pixel-grid portrait. Rounded masks are sampled at integer
// pixels, never antialiased or derived by editing the reference raster.
ctx.save();ctx.translate(x-32,y-73-bob);if(player.facing<0){ctx.translate(64,0);ctx.scale(-1,1);}
const ellipse=(cx,cy,rx,ry)=>(px,py)=>((px-cx)/rx)**2+((py-cy)/ry)**2<=1;
function shape(parts,color,border=ink){const mask=(px,py)=>parts.some(f=>f(px,py));for(let py=0;py<76;py++)for(let px=0;px<65;px++)if(mask(px+.5,py+.5)){const edge=!mask(px-0.5,py+.5)||!mask(px+1.5,py+.5)||!mask(px+.5,py-.5)||!mask(px+.5,py+1.5);rect(px,py,1,1,edge?border:color);}}
function pixels(points,color){let minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));for(let py=minY;py<=maxY;py++)for(let px=minX;px<=maxX;px++){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if(((yi>py+.5)!=(yj>py+.5))&&(px+.5<(xj-xi)*(py+.5-yi)/(yj-yi)+xi))inside=!inside;}if(inside)rect(px,py,1,1,color);}}
// Petite body, soft paws and the characteristic curved tail with a blue tuft.
shape([ellipse(45,59,8,7)],blue);shape([ellipse(42,64,9,5)],white);shape([ellipse(42,61,6,3)],'#b7d0b1','#b7d0b1');
shape([ellipse(32,56,11,11)],white);shape([ellipse(22,56+(frame%2),4,6),ellipse(22,60,4,3)],white);shape([ellipse(42,56-(frame%2),4,6),ellipse(42,60,4,3)],white);
const left=walking&&frame<2?-2:0,right=walking&&frame>=2?-2:0;
shape([ellipse(27,66+left,3,4),ellipse(25,69+left,6,2)],white);shape([ellipse(38,66+right,3,4),ellipse(40,69+right,6,2)],white);
rect(30,57,2,5,ink);rect(34,57,2,5,ink);rect(32,59,2,1,ink);
// Unioned round lobes form a blue lion mane, not a square cap or cat ears.
shape([ellipse(32,27,26,26),ellipse(32,9,13,9),ellipse(14,17,12,12),ellipse(50,17,12,12),ellipse(9,32,9,11),ellipse(55,32,9,11),ellipse(18,45,12,10),ellipse(46,45,12,10)],blue);
// One broad rounded white face plus rounded white ears, outlined as one shape.
shape([ellipse(32,31,21,20),ellipse(17,19,10,11),ellipse(47,19,10,11)],white);
shape([ellipse(17,18,7,7)],'#ffdaa2','#ffdaa2');shape([ellipse(47,18,7,7)],'#ffdaa2','#ffdaa2');
// White cheeks overlap the ear centres just as in the original portrait.
shape([ellipse(32,32,20,18)],white,white);
// Curving blue centre forelock: narrow at the top, curling down to the right.
pixels([[25,9],[40,9],[40,14],[37,18],[36,23],[37,27],[39,30],[34,29],[29,27],[26,23],[25,18]],ink);
pixels([[26,9],[40,9],[39,14],[36,19],[35,23],[36,27],[38,29],[33,28],[29,25],[27,21],[26,16]],blue);
// Small, gentle face: oval eyes, blush, compact W mouth and one tiny fang.
shape([ellipse(23,34,1.2,3)],ink,ink);shape([ellipse(43,34,1.2,3)],ink,ink);
shape([ellipse(19,39,3,1.4)],'#f8b5b2','#f8b5b2');shape([ellipse(47,39,3,1.4)],'#f8b5b2','#f8b5b2');
rect(31,35,3,1,ink);rect(32,36,1,3,ink);rect(28,38,1,2,ink);rect(29,40,3,1,ink);rect(31,39,1,1,ink);rect(33,39,1,1,ink);rect(34,40,3,1,ink);rect(37,38,1,2,ink);
rect(34,41,4,1,ink);rect(35,41,2,1,white);rect(35,42,2,1,ink);rect(36,42,1,1,white);rect(36,43,1,1,ink);
ctx.restore();drawNameplate(x,y-82);drawFacing(x,y);
}
function drawElevator(e){const x=e.x-camera;rect(x-44,236,88,184,'#8ba6bf');rect(x-36,243,72,177,'#eaf4fa');rect(x-28,275,56,145,'#416e96');rect(x-2,277,4,143,'#b9d4e4');rect(x+30,314,10,31,'#0e4a84');text('층 이동',x,264,16,'#0e4a84');text('↑ 층 선택',x,452,14,'#d7e8f4');}
function drawSlime(s){if(!s.alive)return;if(s.type!=='slime'){drawOfficeEnemy(s);return;}const x=s.x-camera,y=s.y??420,b=(!reduced?Math.floor(time*5+s.id.length)%2:0);rect(x-19,y-18,38,18,'#397480');rect(x-14,y-27-b,28,22,'#397480');rect(x-16,y-17,32,14,'#8ed5cf');rect(x-11,y-24-b,22,20,'#8ed5cf');rect(x-9,y-18-b,3,5,'#173e69');rect(x+7,y-18-b,3,5,'#173e69');rect(x-2,y-10-b,5,2,'#447f86');rect(x-8,y-21-b,5,2,'#cff4e9');}
function drawOfficeEnemy(s){const x=s.x-camera,y=s.y??420;let label='';
if(s.type==='report'){label='보고서 더미';for(let i=0;i<4;i++){const dx=(i%2)*5;rect(x-20+dx,y-15-i*10,36,13,'#244f74');rect(x-18+dx,y-14-i*10,32,10,'#fff9e8');rect(x-12+dx,y-10-i*10,21,2,'#a3b4bf');}rect(x-7,y-31,3,4,'#173e69');rect(x+6,y-31,3,4,'#173e69');}
else if(s.type==='meeting'){label='끝없는 회의';rect(x-29,y-30,58,9,'#775b8c');rect(x-24,y-21,5,21,'#513f67');rect(x+19,y-21,5,21,'#513f67');for(let i=-1;i<=1;i++){rect(x+i*19-6,y-44,12,13,'#c7a9db');rect(x+i*19-3,y-40,2,3,'#173e69');}text('…',x,y-45,16,'#684b7e');}
else {label='야근의 요정';const b=reduced?0:Math.sin(time*5)*3;polygon([[x-10,y-32+b],[x-34,y-49+b],[x-29,y-14+b],[x-5,y-18+b]],'#8e9bc4');polygon([[x+10,y-32+b],[x+34,y-49+b],[x+29,y-14+b],[x+5,y-18+b]],'#8e9bc4');rect(x-14,y-40+b,28,30,'#59628d');rect(x-9,y-34+b,18,15,'#e4e8f1');rect(x-7,y-31+b,4,2,'#33364d');rect(x+3,y-31+b,4,2,'#33364d');text('Z',x+20,y-52+b,13,'#59628d');}text(label,x,y-63,12,'#4a5873');}
function drawAlly(s){if(!s.alive)return;const x=s.x-camera,y=s.y??420,b=reduced?0:Math.sin(time*4)*4;polygon([[x-6,y-30+b],[x-29,y-48+b],[x-34,y-23+b],[x-9,y-20+b]],'#e8f8d3');polygon([[x+6,y-30+b],[x+29,y-48+b],[x+34,y-23+b],[x+9,y-20+b]],'#e8f8d3');rect(x-12,y-42+b,24,30,'#8cbd73');rect(x-8,y-37+b,16,13,'#fff8df');text('칼퇴의 요정',x,y-62+b,13,'#437338');text('접촉하면 축하!',x,y-77+b,11,'#437338');}
function drawCelebration(){if(time>=celebrateUntil)return;for(let i=0;i<22;i++){const x=(i*53+(reduced?0:time*20))%viewWidth,y=60+((i*37+(reduced?0:time*65))%300);rect(x,y,4,7,['#ffbf58','#6fb9e5','#91c878','#edb6cd'][i%4]);}}
function draw(){ctx.imageSmoothingEnabled=false;rect(0,0,viewWidth,520,'#e6f1f8');
for(let floor=0;floor<3;floor++){const offset=(2-floor)*520-cameraY;if(offset>520||offset< -520)continue;ctx.save();ctx.translate(0,Math.round(offset));
const sky=ctx.createLinearGradient(0,0,0,420);sky.addColorStop(0,['#cee3f2','#d9e5f3','#dde7f0'][floor]);sky.addColorStop(1,'#f4f7f3');ctx.fillStyle=sky;ctx.fillRect(0,0,viewWidth,520);
for(let i=-1;i<8;i++)cloud(i*250+40-camera*.1,60+(i%3)*24,.9);const types=floor===0?['erica','agora']:floor===1?['history','baeknam']:['library','erica'];for(let i=0;i<7;i++)world.building(types[i%2],i*540+480-camera*.3,420,.85);hills(.14,362,'#b5ccd7');
rect(0,384,viewWidth,36,'#c2d4cc');for(let i=0;i<40;i++){const x=i*190-camera*.85;if(x>-70&&x<viewWidth+70)smallBush(x,420,'#8baea4');}
for(const q of portals)if(q.floor===floor&&q.x-camera>-220&&q.x-camera<viewWidth+220)world.portal(q,q.x-camera,420,near&&near.id===q.id,time);
for(const e of elevators)if(e.floor===floor&&e.x-camera>-60&&e.x-camera<viewWidth+60)drawElevator(e);
for(const n of npcs)if(n.floor===floor&&n.x-camera>-80&&n.x-camera<viewWidth+80){smallBush(n.x-camera,420);world.npc(n.x-camera,420,time);}
if(npcBubble&&npcBubble.floor===floor&&time<npcBubble.until){const bx=P.clamp(npcBubble.x-camera,150,viewWidth-150);rect(bx-145,190,290,51,'#f9fcffec');text('하이비비 · 창작 한마디',bx,207,11,'#5a7e99');text(npcBubble.text,bx,229,13,'#0e4a84');}
rect(0,420,viewWidth,10,'#0e4a84');rect(0,430,viewWidth,7,'#a8bccd');rect(0,437,viewWidth,83,'#274e74');for(let i=0;i<80;i++){const x=i*85-camera%85;rect(x,459+(i%3)*18,40,2,'#3b6183');}text((floor+1)+'F · '+zones[floor].name,viewWidth/2,486,16,'#c9ddeb');
for(const q of platforms){const x=q.x-camera;if(q.floor!==undefined&&q.floor!==floor)continue;rect(x,q.y,q.w,7,'#0e4a84');rect(x+4,q.y+7,q.w-8,15,'#8ba6b9');rect(x+8,q.y+23,q.w-16,5,'#d4e1e9');}
for(const s of slimes)if(s.floor===floor&&s.x-camera>-40&&s.x-camera<viewWidth+40)drawSlime(s);
for(const a of allies)if(a.floor===floor)drawAlly(a);
if(player.floor===floor){drawMascot();const x=player.x-camera+14+player.facing*55,y=player.y+15;drawAttackClaws();drawMetalImpact();if(hitNotice&&time<hitUntil)text(hitNotice,x,y-40-(.7-(hitUntil-time))*20,20,'#0e4a84');}
ctx.restore();}
drawCelebration();
rect(viewWidth-118,17,99,34,'#f8fcffe8');text((player.floor+1)+'F / 3F',viewWidth-68,40,18,'#0e4a84');
}
function clearKeys(){keys.left=false;keys.right=false;}
function showOverlay(message){active=false;stopLoop();clearKeys();$('#overlay').hidden=false;$('#overlayText').textContent=message||'하냥이와 세 개 층을 오가며 도구를 탐험해 보세요.';$('#startButton').firstChild.textContent=started?'이어서 탐험하기 ':'마하 플레이하기 ';$('#nearby').hidden=true;}
function resume(){if(document.hidden)return;wake();started=true;active=true;locked=false;clearKeys();$('#overlay').hidden=true;canvas.focus({preventScroll:true});last=performance.now();scheduleFrame();}
function pause(message){active=false;stopLoop();clearKeys();cancelSwing();if(started)showOverlay(message||'잠시 쉬어가는 중이에요. 같은 자리에서 다시 시작할 수 있어요.');}
function updateNearby(){near=P.nearby(player,portals);interaction=P.interaction(player,portals,elevators,npcs);const item=interaction&&interaction.target;$('#nearby').hidden=!item||!active;if(item){$('#nearbyName').textContent=item.name;$('#nearbyDescription').textContent=item.description||(interaction.type==='elevator'?'디자인·제작, 행사·면접, 캠퍼스·업무 층을 오갑니다.':interaction.type==='npc'?'잠깐 쉬어가는 하이비비의 한마디.':'비공개 구역입니다. 공개된 연결은 없습니다.');const direct=interaction.type==='portal'&&!item.locked;$('#portalLink').hidden=!direct;$('#interactButton').hidden=direct;if(direct)$('#portalLink').href=item.url;else{$('#portalLink').removeAttribute('href');$('#interactButton').textContent=interaction.type==='elevator'?'↑ 층 선택':interaction.type==='npc'?'↑ 대화하기':'↑ 잠금 확인';}if(lastPortal!==item.id){$('#status').textContent=item.name+' 앞입니다. '+(item.description||'')+' 위 방향키로 상호작용하세요.';lastPortal=item.id;}}else lastPortal='';$('#zoneLabel').textContent=zones[player.floor].name;$('#score').textContent=String(combat.score).padStart(5,'0');$('#jumpState').textContent='점프 '+(2-player.jumps)+'/2';$('#restoreButton').hidden=!(active&&near&&!P.isIndestructible(near)&&near.destroyed);for(const b of document.querySelectorAll('[data-floor]'))b.classList.toggle('current',Number(b.dataset.floor)===player.floor);}
function changeFloor(floor,x=410){cancelSwing();wake();P.changeFloor(player,floor,x);camera=P.clamp(player.x-viewWidth*.375,0,P.WIDTH-viewWidth);clearKeys();updateNearby();}
function openPortal(repeat=false){near=P.nearby(player,portals);if(!P.canOpen({active,repeat,locked,portal:near}))return;locked=true;window.open(near.url,'_blank','noopener,noreferrer');pause('도구를 새 탭에서 열었어요. 준비되면 같은 자리에서 이어갈 수 있어요.');}
function dialogBase(title,message){pause('잠시 안내를 보고 있어요. 닫은 뒤 탐험을 이어가세요.');$('#interactionTitle').textContent=title;$('#interactionText').textContent=message;$('#floorChoices').hidden=true;}
function interact(repeat=false){if(!active||repeat||locked)return;interaction=P.interaction(player,portals,elevators,npcs);if(!interaction)return;const q=interaction.target;if(interaction.type==='portal'&&!q.locked){openPortal(false);return;}
if(interaction.type==='elevator'){dialogBase('캠퍼스 엘리베이터','원하는 층을 선택하세요. 점프나 점수 없이도 모든 공개 도구에 갈 수 있어요.');$('#floorChoices').hidden=false;}
else if(interaction.type==='npc'){lastNpcAt=time;dialogBase('하이비비의 한마디',npcLines[npcLineIndex++%npcLines.length]+' · 하이비비의 창작 한마디');}
else{dialogBase(q.name+' · 비공개 구역',q.castle?'개인마하의 철옹성입니다. 아무리 할퀴어도 부서지지 않아요. 이곳에는 실제 서비스로 가는 연결이나 인증 기능이 없습니다.':'비공개 구역 표식입니다. 공개된 연결이나 인증 기능이 없습니다.');}
$('#interactionDialog').showModal();const focusTarget=interaction.type==='elevator'?$('#floorChoices').children[0]:$('#continueButton');focusTarget.focus();
}
function cancelSwing(){P.cancelAttack(player,combat);attackUntil=0;attackVisual=null;metalImpact=null;}
function doAttack(repeat=false){
 if(!active||repeat)return;
 if(!P.launchAttack(player,time,combat,repeat))return;
 wake();attackUntil=combat.swing.endsAt;
 attackVisual={capture:attackAnimation.capture(character,combat.swing.facing),sheet:attackAnimation.ready(character)};
 updateNearby();
}
function advanceCombat(){
 const upperOffsetY=attackVisual?.sheet?attackAnimation.upperOffsetY(characterDrawOptions(player.x+P.PLAYER_W/2,player.y+P.PLAYER_H)):0;
 const geometry={upperOffsetY,reducedMotion:reduced};
 if(attackVisual?.sheet&&attackAnimation.kind(character)==='layered-v1')geometry.actualHitBounds=attackAnimation.hitBounds({appearanceId:character,facing:player.facing});
 const strike=P.advanceAttack(player,slimes,portals,time,combat,geometry);
 if(attackVisual?.sheet&&combat.swing?.visualActive&&attackVisual.capture?.facing!==combat.swing.facing)attackVisual.capture=attackAnimation.capture(character,combat.swing.facing);
 if(!strike.struck)return;
 if(strike.impact){metalImpact={x:player.x+P.PLAYER_W/2+strike.facing*38,y:strike.hitOriginY-30,floor:player.floor,facing:strike.facing,at:time,until:time+.32,swingId:combat.swing.id};$('#status').textContent='깡! 개인마하는 부서지지 않는 강철 철옹성이에요.';}
 if(strike.hits){hitNotice='+ '+strike.points;hitUntil=time+.7;$('#status').textContent=strike.points+'점을 얻었어요.';}
 else if(strike.destroyed.length){hitNotice='와르르! 8초 뒤 복구';hitUntil=time+1;}
 for(const mark of P.scoreMilestones(combat))announce(mark.toLocaleString()+'점! 심심하시면 마하 만든 이에게 아이디어 추천 좀!','idea');
 updateNearby();
}
canvas.addEventListener('keydown',e=>{if(e.target&&e.target!==canvas||document.activeElement!==canvas)return;if(e.key==='Tab'){pause();return;}const code=e.code||e.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyX','KeyE','Escape'].includes(code)||e.key===' ')e.preventDefault();if(!active){if(code==='Escape'){notifyParent('mach-play:escape');}return;}wake();if(code==='ArrowLeft'&&!e.repeat)keys.left=true;if(code==='ArrowRight'&&!e.repeat)keys.right=true;if(code==='Space'||e.key===' ')P.jump(player,e.repeat);if(code==='ArrowUp'||code==='KeyE')interact(e.repeat);if(e.code==='KeyX')doAttack(e.repeat);if(code==='Escape'){pause();$('#startButton').focus({preventScroll:true});notifyParent('mach-play:escape');}});
window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft')keys.left=false;if(e.key==='ArrowRight')keys.right=false;});
canvas.addEventListener('blur',e=>{clearKeys();if(e.relatedTarget===$('#portalLink')||e.relatedTarget===$('#interactButton')||e.relatedTarget===$('#restoreButton')){active=false;stopLoop();return;}if(active)pause();});
for(const selector of ['#portalLink','#interactButton','#restoreButton'])$(selector).addEventListener('blur',()=>{if(started&&!active&&$('#overlay').hidden)pause();});window.addEventListener('blur',()=>pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>pause());
window.addEventListener('message',event=>{if(embedded&&event.source===window.parent&&event.origin===location.origin&&event.data?.type==='mach-play:pause')pause();});
$('#startButton').addEventListener('click',resume);$('#portalLink').addEventListener('click',()=>{locked=true;pause('도구는 새 탭에서 열립니다. 준비되면 같은 자리에서 이어가세요.');});$('#interactButton').addEventListener('click',()=>{if(!started||locked||!$('#overlay').hidden||$('#interactionDialog').open||$('#catalog').open)return;active=true;interact();});
$('#restoreButton').addEventListener('click',()=>{if(!started||!$('#overlay').hidden||$('#catalog').open||$('#interactionDialog').open)return;near=P.nearby(player,portals);if(near&&!P.isIndestructible(near)&&near.destroyed){P.restoreBuilding(near);resume();updateNearby();}});
$('#resetButton').addEventListener('click',()=>{changeFloor(0,410);cameraY=1040;if(started)resume();});
for(const z of zones){const b=document.createElement('button');b.dataset.floor=z.floor;b.innerHTML=`<b>${z.floor+1}F</b> ${z.name}<small>${z.en} →</small>`;b.addEventListener('click',()=>{changeFloor(z.floor);resume();});$('#travelButtons').append(b);const f=document.createElement('button');f.textContent=(z.floor+1)+'층 · '+z.name;f.addEventListener('click',()=>{changeFloor(z.floor);$('#interactionDialog').close();resume();});$('#floorChoices').append(f);}
$('#continueButton').addEventListener('click',()=>{$('#interactionDialog').close();resume();});$('#interactionDialog').addEventListener('close',()=>{if(!active)$('#startButton').focus({preventScroll:true});});
function renderCatalog(){const query=$('#search').value.trim().toLocaleLowerCase();const list=$('#catalogList');list.replaceChildren();const filtered=portals.filter(p=>(p.name+' '+p.category+' '+(p.description||'')+' '+(p.floor+1)+'층').toLocaleLowerCase().includes(query));for(const p of filtered){const a=document.createElement(p.locked?'div':'a');if(!p.locked){a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';}else{a.className='locked-card';a.setAttribute('aria-disabled','true');}const wrap=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=p.name;small.textContent=(p.floor+1)+'층 · '+p.category+(p.locked?' · 잠금 유지':' · 새 탭');const description=document.createElement('p');description.className='catalog-description';description.textContent=p.description||'비공개 구역 표식 · 공개된 연결 없음';wrap.append(strong,description,small);const arrow=document.createElement('span');arrow.textContent=p.locked?'잠금':'↗';a.append(wrap,arrow);list.append(a);}$('#emptyResult').hidden=filtered.length>0;}
$('#catalogButton').addEventListener('click',()=>{if($('#catalog').open)return;pause('도구 목록을 둘러보는 중이에요. 닫은 뒤 탐험을 이어갈 수 있어요.');renderCatalog();$('#catalog').showModal();$('#search').focus();});$('#closeCatalog').addEventListener('click',()=>$('#catalog').close());$('#catalog').addEventListener('close',()=>{$('#catalogButton').focus();});$('#search').addEventListener('input',renderCatalog);
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(!active)return;wake();b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{keys[b.dataset.key]=false;});}
$('#touchJump').addEventListener('pointerdown',e=>{e.preventDefault();if(active){wake();P.jump(player);}});$('#touchOpen').addEventListener('pointerdown',e=>{e.preventDefault();interact();});$('#touchAttack').addEventListener('pointerdown',e=>{e.preventDefault();doAttack();});
$('#portalCount').textContent=portals.filter(p=>!p.locked).length+'개 공개 도구 · 3개 층';renderCatalog();
function tick(now){frameId=null;if(!active||document.hidden)return;frameCount++;let dt=Math.min((now-last)/1000,1/30);last=now;if(active){time+=dt;if(keys.left||keys.right)wake();P.step(player,keys,dt,platforms);P.updateSlimes(slimes,dt,time);P.updateSlimes(allies,dt,time);advanceCombat();P.updateBuildings(portals,time);for(const ally of P.collectAllies(player,allies,time)){celebrateUntil=time+3;announce('축하합니다! 오늘의 칼퇴를 기원합니다 ✨','celebrate');}sleeping=player.grounded&&!keys.left&&!keys.right&&time-lastInput>=12&&time>=attackUntil;const npc=P.nearby(player,npcs);if(npc&&time-lastNpcAt>=28&&!sleeping){npcBubble={x:npc.x,floor:npc.floor,text:npcLines[npcLineIndex++%npcLines.length],until:time+5};lastNpcAt=time;}updateNotices();const target=P.clamp(player.x-viewWidth*.375,0,P.WIDTH-viewWidth);camera=reduced||player.wrapped?target:camera+(target-camera)*Math.min(1,dt*8);const targetY=(2-player.floor)*520;cameraY=reduced?targetY:cameraY+(targetY-cameraY)*Math.min(1,dt*10);updateNearby();}draw();scheduleFrame();}draw();
if(embedded&&typeof ResizeObserver==='function'){const observer=new ResizeObserver(()=>notifyParent('mach-play:height',{height:Math.ceil(document.body.getBoundingClientRect().height)}));observer.observe(document.body);window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});}
notifyParent('mach-play:ready');
// Expose read-only snapshot for lightweight local browser QA, never persisted.
window.MACH_PLAY={snapshot:()=>({active,started,framePending:frameId!==null,frameCount,player:{...player},camera,cameraY,near:near?near.name:null,interaction:interaction?interaction.type:null,portals:portals.length,score:combat.score,slimes:slimes.map(s=>({id:s.id,type:s.type,x:s.x,alive:s.alive,floor:s.floor})),allies:allies.map(s=>({id:s.id,x:s.x,alive:s.alive,floor:s.floor})),buildings:portals.map(q=>({id:q.id,indestructible:P.isIndestructible(q),destroyed:!P.isIndestructible(q)&&!!q.destroyed,restoreAt:P.isIndestructible(q)?null:q.restoreAt})),sleeping,character,speed:player.speed,notice:currentNotice?.text||'',noticeCount,attackUntil,swing:combat.swing?{...combat.swing}:null,attackFacing:combat.swing?.facing??player.facing,attackVisualSheet:!!attackVisual?.sheet,attackAssetStatus:attackAnimation.status(character),metalImpact:metalImpact&&time<metalImpact.until?{...metalImpact}:null,npcBubble:npcBubble?{...npcBubble}:null,sprite:spriteReady?'animated-sheet':'code-fallback'})};
})();
