(function(){'use strict';window.MachWorldArt={create(ctx){
// Bounds are measured from the same body primitives used to render, so facade
// changes cannot silently leave behind an unrelated collision rectangle.
let measuring=null;
function measurePoint(x,y){measuring.left=Math.min(measuring.left,x);measuring.top=Math.min(measuring.top,y);measuring.right=Math.max(measuring.right,x);measuring.bottom=Math.max(measuring.bottom,y);}
const r=(x,y,w,h,c)=>{const rx=Math.round(x),ry=Math.round(y),rw=Math.round(w),rh=Math.round(h);if(measuring){measurePoint(rx,ry);measurePoint(rx+rw,ry+rh);return;}ctx.fillStyle=c;ctx.fillRect(rx,ry,rw,rh);};
const poly=(p,c)=>{if(measuring){for(const [x,y] of p)measurePoint(x,y);return;}ctx.fillStyle=c;ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.fill();};
const txt=(s,x,y,size=14,c='#0e4a84')=>{if(measuring)return;ctx.font=`700 ${size}px system-ui,sans-serif`;ctx.fillStyle=c;ctx.textAlign='center';ctx.fillText(s,Math.round(x),Math.round(y));};
function building(type,x,y,scale=1){ctx.save();ctx.translate(Math.round(x),y);ctx.scale(scale,scale);const stone='#c4d2da',shade='#a6bdcc',glass='#98b1c1',roof='#9eb6b8';
if(type==='history'){r(-150,-105,300,105,stone);poly([[-157,-105],[-100,-145],[-45,-105]],roof);poly([[45,-105],[100,-145],[157,-105]],roof);r(-70,-121,140,17,roof);poly([[-55,-111],[0,-143],[55,-111]],shade);for(let k=-120;k<150;k+=25)for(let j=-90;j<-5;j+=26)r(k,j,10,16,glass);for(let k=-44;k<=44;k+=22)r(k,-107,8,107,'#d8e1e3');r(-60,0,120,8,shade);}
if(type==='baeknam'){r(-155,-117,310,117,stone);r(-29,-151,60,151,stone);r(-23,-158,48,8,stone);for(let k=-140;k<150;k+=24)for(let j=-101;j<-10;j+=23)r(k,j,7,16,glass);r(-50,-30,100,30,'#dbe2e4');r(-20,-22,40,22,shade);}
if(type==='erica'){r(-170,-105,340,105,stone);r(-180,-115,360,25,'#d7e0df');r(-68,-131,136,41,'#d9e2e0');for(let k=-165;k<170;k+=19)r(k,-108,13,12,glass);for(let k=-135;k<=135;k+=27)for(let j=-73;j<-5;j+=29)r(k,j,18,16,glass);for(let k=-58;k<=58;k+=23)r(k,-85,9,85,'#dde5e1');r(-20,-9,40,16,shade);r(-13,-22,26,10,shade);r(-15,-27,10,11,shade);}
if(type==='library'){r(-160,-140,95,140,'#d4dfe1');r(-65,-130,225,130,stone);r(-78,-153,247,58,'#c8b999');r(-68,-138,228,23,glass);for(let k=-140;k<-70;k+=23)for(let j=-117;j<-5;j+=28)r(k,j,13,17,glass);for(let k=-45;k<160;k+=33)r(k,-95,7,95,'#90aab6');r(-20,-24,52,24,glass);}
if(type==='agora'){poly([[-85,0],[-67,-164],[-49,-170],[-34,0]],shade);poly([[-74,-165],[45,-196],[72,-136],[-50,-108]],'#a5afb5');poly([[-62,-160],[36,-184],[52,-145],[-47,-121]],'#93abb8');poly([[70,0],[102,-103],[127,-116],[113,0]],'#c1cdd3');for(let k=0;k<8;k++)poly([[80,k*-12],[116,-7-k*12],[114,-10-k*12],[80,-3-k*12]],'#a4b9c7');}
ctx.restore();}
// Actual vector renders of the user's white baby pigeon. A missing original
// displays an NPC marker; it is never replaced with an invented bee or ghost.
const npcImages=[];
if(typeof Image==='function')for(const src of ['assets/hibibi-original-source.png','assets/hibibi-wave-source.png']){const image=new Image();image.src=src;npcImages.push(image);}
function npc(x,y,time){
 ctx.save();ctx.translate(Math.round(x),y);
 r(-37,-13,74,13,'#6f9a75');r(-31,-23,28,13,'#88b98b');r(5,-25,29,16,'#82ad82');
 const chosen=npcImages[Math.floor((Number(time)||0)/7)%2];
 const image=chosen&&chosen.complete&&chosen.naturalWidth?chosen:npcImages.find(i=>i.complete&&i.naturalWidth),scale=.20;
 if(image&&image.complete&&image.naturalWidth){ctx.imageSmoothingEnabled=true;ctx.drawImage(image,-256*scale,-392*scale,512*scale,512*scale);}
 else{r(-19,-45,38,29,'#f4fafc');txt('NPC',0,-25,12,'#0e4a84');}
 r(-42,-9,25,9,'#638e69');r(19,-10,24,10,'#638e69');r(-50,-4,100,4,'#7aa17a');
 txt('하이비비',0,-76,16);ctx.restore();
}
const C={blue:'#0e4a84',ink:'#163e63',cream:'#fbf7e9',glass:'#a8d6e8',stone:'#dbe5e7',coral:'#de8c7d',yellow:'#e9bf61',green:'#6d9c8b'};
function door(locked,selected){
 // The threshold ends exactly at the shared floor baseline (local y=0).
 r(-28,-67,56,67,C.ink);r(-22,-61,44,61,locked?'#5a6c7b':selected?'#99dfec':'#7bb3ce');
 if(locked){for(let k=-20;k<24;k+=10)r(k,-60,3,60,'#b2bdc5');r(-9,-33,18,17,'#dfbd66');r(-6,-40,12,8,'#dfbd66');}
 else{r(-2,-60,3,60,'#e0f5fa');r(10,-31,4,7,C.cream);}
 r(-35,-3,70,3,selected?C.yellow:'#90a8b7');
}
function windows(xs,y,w=25,h=35){for(const x of xs){r(x,y,w,h,C.blue);r(x+3,y+3,w-6,h-6,C.glass);}}
function paper(x,y,w=35,h=28){r(x,y,w,h,C.cream);r(x+6,y+6,w-12,3,C.blue);r(x+6,y+13,w-15,2,'#92a9b7');}
function chairs(x,y,rows=2,cols=3,color=C.coral){for(let a=0;a<rows;a++)for(let b=0;b<cols;b++){r(x+b*15,y+a*16,11,8,color);r(x+b*15,y+9+a*16,11,3,C.blue);}}
function officeBody(width=190,height=132,color=C.stone){r(-width/2,-height,width,height,color);r(-width/2-4,-height-7,width+8,9,C.blue);}
function clock(x,y){r(x-17,y-17,34,34,C.blue);r(x-13,y-13,26,26,C.cream);r(x-1,y-10,3,12,C.blue);r(x,y,10,3,C.blue);}
function facade(q){
 switch(q.style){
 case 'mailshop':
  officeBody(196,128,'#e7e0ce');r(-103,-143,206,20,C.coral);r(-91,-123,57,57,C.cream);r(36,-123,54,57,C.cream);
  poly([[-85,-111],[-62,-92],[-39,-111]],C.blue);r(-85,-111,46,3,C.blue);r(-85,-111,3,30,C.blue);r(-42,-111,3,30,C.blue);r(-85,-83,46,3,C.blue);paper(43,-114,39,24);r(43,-84,29,4,C.coral);break;
 case 'nameplate':
  officeBody(184,122,'#d5daca');poly([[-106,-123],[-64,-155],[62,-155],[106,-123]],C.green);r(-88,-114,55,37,'#ead8ac');poly([[-83,-81],[-68,-109],[-43,-109],[-34,-81]],C.cream);txt('NAME',-59,-88,10,C.blue);r(39,-105,41,9,C.blue);r(53,-97,13,29,C.blue);break;
 case 'printshop':
  officeBody(194,135,'#eee7d7');r(-101,-147,202,17,C.yellow);paper(-83,-116,44,38);r(38,-109,48,35,C.blue);r(45,-118,34,14,C.cream);r(45,-88,34,22,C.cream);r(48,-81,28,3,'#809bad');r(-94,-27,49,27,'#bac8cb');break;
 case 'welcome':
  r(-101,-126,202,126,'#eee9df');poly([[-117,-127],[0,-172],[117,-127]],C.coral);r(-92,-120,14,120,C.cream);r(78,-120,14,120,C.cream);r(-77,-114,154,21,'#f3d798');txt('WELCOME',0,-99,14,C.blue);r(-71,-77,28,44,C.green);r(44,-77,28,44,C.green);poly([[-102,-171],[-91,-157],[-112,-157]],C.yellow);poly([[102,-171],[91,-157],[112,-157]],C.yellow);break;
 case 'signage':
  r(-78,-174,156,174,'#3c6179');r(-66,-161,132,81,'#d4e9ec');r(-57,-150,72,17,C.blue);r(-57,-126,115,9,C.coral);r(-57,-109,92,9,C.yellow);r(23,-152,35,19,C.green);r(-91,-13,182,13,'#b7cbd4');break;
 case 'ledstage':
  r(-115,-134,230,134,'#2b4364');r(-119,-153,238,25,C.blue);r(-105,-129,210,43,'#162d47');for(let k=-96;k<102;k+=12)for(let z=-121;z<-90;z+=10)r(k,z,5,4,(k+z)%3?C.yellow:'#88cbe2');r(-106,-78,48,78,C.coral);r(58,-78,48,78,C.coral);for(let k=-107;k<=107;k+=18)r(k,-147,6,5,C.yellow);break;
 case 'ericaseats':
  officeBody(214,144,'#dce5ea');r(-112,-156,224,15,C.blue);r(-98,-133,67,59,'#eef7fa');r(33,-133,67,59,'#eef7fa');chairs(-91,-123,3,4,C.coral);chairs(40,-123,3,4,C.coral);r(-106,-35,58,35,'#a6bbc6');r(49,-35,58,35,'#a6bbc6');break;
 case 'seoulseats':
  officeBody(204,132,'#d9dacd');r(-108,-150,216,18,'#91a59b');windows([-92,45],-119,46,48);r(-83,-96,29,7,C.blue);r(53,-96,30,7,C.blue);for(const x of [-96,84])r(x,-133,12,133,'#f1eee2');break;
 case 'auditorium':
  r(-112,-112,224,112,'#b4c5cf');r(-98,-140,196,28,'#a7bbc8');r(-82,-165,164,25,'#93aebf');chairs(-72,-155,1,10,C.blue);chairs(-88,-128,1,12,C.coral);chairs(-103,-101,1,14,C.green);r(-113,-47,65,47,'#dfe8e8');r(49,-47,64,47,'#dfe8e8');break;
 case 'eventhub':
  r(-99,-123,198,123,'#e4e6d1');poly([[-119,-124],[-60,-165],[0,-124]],C.coral);poly([[0,-124],[60,-165],[119,-124]],C.green);r(-104,-127,208,9,C.yellow);for(let k=-90;k<91;k+=30)poly([[k,-114],[k+20,-114],[k+10,-98]],k%60?C.coral:C.blue);paper(-82,-79,43,43);txt('✓',-59,-49,23,C.green);r(43,-77,40,48,C.yellow);r(49,-68,28,5,C.cream);break;
 case 'interview':
  officeBody(184,143,'#d7e2e7');r(-98,-153,196,13,C.green);r(-82,-131,164,52,'#f3f7f5');r(-51,-107,103,7,'#95b5c0');chairs(-68,-117,1,2,C.blue);chairs(40,-117,1,2,C.coral);r(-73,-59,25,27,C.blue);r(50,-59,24,27,C.coral);break;
 case 'timetable':
  officeBody(204,127,'#e2e5da');r(-51,-175,102,48,'#d1ddd8');clock(0,-151);for(const x of [-91,42]){paper(x,-112,49,62);for(let z=0;z<4;z++){r(x+7,-101+z*12,8,6,C.coral);r(x+19,-101+z*12,23,5,C.green);}}break;
 case 'mapkiosk':
  r(-96,-112,192,112,'#dce6d6');poly([[-109,-115],[-37,-151],[26,-133],[94,-157],[109,-115]],C.green);r(-88,-104,53,63,'#f7f1da');r(37,-104,51,63,'#f7f1da');for(const x of [-79,46]){r(x,-92,32,9,'#9cc2a0');r(x+8,-97,7,47,'#d7b987');r(x,-67,33,7,'#91bdcc');r(x+20,-88,7,7,C.coral);}break;
 case 'canteen':
  officeBody(202,118,'#ead9bd');r(-109,-133,218,22,C.coral);for(let k=-104;k<104;k+=26)r(k,-132,13,21,C.cream);r(-87,-104,48,39,'#d5edf0');r(42,-104,47,39,'#d5edf0');r(-83,-56,32,48,C.blue);txt('MENU',-67,-43,8,C.cream);r(-77,-36,21,3,C.cream);r(-77,-28,17,3,C.cream);r(43,-44,41,19,C.green);r(47,-50,33,7,C.yellow);r(61,-60,4,10,C.coral);break;
 case 'roleoffice':
  officeBody(198,153,'#e1e6e8');r(-88,-141,176,64,'#f3fafb');r(-15,-131,30,13,C.blue);r(-2,-118,4,15,C.blue);r(-62,-105,125,3,C.blue);for(const x of [-67,-14,39]){r(x,-102,27,15,C.green);r(x+12,-106,3,5,C.blue);}windows([-82,48],-60,32,40);break;
 case 'archive':
  officeBody(202,140,'#e5dccb');r(-107,-151,214,15,C.coral);for(const x of [-91,44]){r(x,-126,47,52,'#a8b5b8');for(let a=0;a<2;a++)for(let b=0;b<5;b++)r(x+4+b*8,-121+a*24,6,19,[C.blue,C.coral,C.green,C.yellow][b%4]);}txt('A → Z',0,-103,22,C.blue);break;
 case 'studentoffice':
  officeBody(188,130,'#d9e1dc');r(-98,-142,196,17,'#829c90');windows([-81,43],-113,38,37);paper(-80,-63,34,31);txt('H',61,-45,21,C.blue);break;
 case 'warehouse':
  r(-104,-126,208,126,'#c5cdd0');poly([[-115,-127],[0,-163],[115,-127]],'#728a97');for(const x of [-91,46])for(let a=0;a<2;a++){r(x,-91+a*43,41,38,'#b49c76');r(x+18,-89+a*43,5,33,'#d4c09d');}break;
 case 'givingbank':
  officeBody(190,127,'#d8e0dc');r(-98,-141,196,18,'#80a699');r(-82,-116,164,38,'#f1f3e5');poly([[-8,-106],[-20,-115],[-31,-108],[-31,-98],[0,-82],[31,-98],[31,-108],[20,-115],[8,-106],[0,-100]],C.coral);windows([-80,46],-60,34,35);break;
 case 'garage':
  r(-112,-115,224,115,'#ced7d9');r(-119,-132,238,19,'#8199a7');r(-101,-103,64,67,'#a1b4bc');r(38,-103,63,67,'#a1b4bc');for(let z=-94;z<-36;z+=13){r(-98,z,58,3,'#839aa6');r(41,z,57,3,'#839aa6');}r(-95,-30,50,17,C.blue);r(-90,-37,34,12,C.blue);r(-88,-16,10,9,C.ink);r(-60,-16,10,9,C.ink);break;
 default:officeBody();windows([-76,43],-112,34,35);
 }
}
function wrapLabel(name,width){const lines=[];let line='';for(const word of name.trim().split(/\s+/)){if(ctx.measureText(word).width>width){if(line){lines.push(line);line='';}for(const ch of word){if(ctx.measureText(line+ch).width>width){lines.push(line);line='';}line+=ch;}}else{const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width>width){lines.push(line);line=word;}else line=candidate;}}if(line)lines.push(line);return lines;}
function sign(q,selected,top=-239){
 ctx.font='700 16px system-ui,sans-serif';const lines=wrapLabel(q.name,224),h=lines.length*22+34;
 // Supports physically join each sign to its facade.
 const supportBottom=q.destroyed?0:-115;
 r(-92,top+h-5,5,Math.max(6,supportBottom-(top+h-5)),'#809aa9');r(87,top+h-5,5,Math.max(6,supportBottom-(top+h-5)),'#809aa9');
 r(-124,top,248,h,'#193f60');r(-120,top+4,240,h-8,'#fbfaf1');lines.forEach((line,i)=>txt(line,0,top+23+i*22,16,C.ink));txt(q.sign||q.id,0,top+h-11,10,q.locked?'#60798a':'#537f93');
 if(selected){r(-13,top-29,26,23,C.blue);txt('↑',0,top-11,18,'#fff');}
}
function debris(q,time,selected){
 const spread=q.castle?171:105;
 for(let i=0;i<9;i++){const x=-spread+i*spread/4,w=14+(i%3)*5,h=9+(i%4)*7;poly([[x,-3],[x+4,-h],[x+w,-h+6],[x+w+4,-3]],i%2?'#8ca6b5':'#bbcbd1');}
 // Brief bounded debris. The entrance and original sign remain usable.
 const age=(Number(time)||0)-(Number(q.destroyedAt)||0);
 if(age>=0&&age<.65)for(let i=0;i<7;i++){const d=(i-3)*25,a=age/.65;r(d*(1+a),-18-Math.sin(a*Math.PI)*38-(i%3)*7,6,6,'#b6c5c0');}
 door(q.locked,selected);r(-47,-86,94,17,C.cream);txt('입구 유지',0,-73,12,C.blue);
 const left=Math.max(0,Math.ceil((Number(q.restoreAt)||0)-(Number(time)||0)));txt(left?left+'초 후 복구':'복구 중',0,-99,12,'#527183');
}
function fortressBody(selected){
 const steel='#9eafbf',silver='#d3dce4',navy='#142b43',plate='#29445f',edge='#647d94';
 const bolt=(bx,by)=>{r(bx-3,by-3,6,6,silver);r(bx-1,by-1,2,2,edge);};
 const panel=(px,py,pw,ph)=>{r(px,py,pw,ph,steel);r(px+4,py+4,pw-8,ph-8,plate);r(px+4,py+4,pw-8,2,silver);for(const bx of [px+9,px+pw-9])for(const by of [py+10,py+ph-10])bolt(bx,by);};
 // A steel-plated game fortress, separate from the real owner's authentication.
 r(-180,-257,360,257,navy);r(-187,-11,374,11,steel);
 for(const tx of [-180,118]){
  panel(tx,-257,62,246);r(tx-4,-268,70,14,silver);
  for(let bx=tx;bx<tx+62;bx+=23)r(bx,-283,16,18,steel);
  for(const top of [-231,-157,-83]){
   r(tx+9,top,44,63,navy);
   poly([[tx+9,top+4],[tx+15,top],[tx+53,top+55],[tx+47,top+61]],steel);
   poly([[tx+47,top],[tx+53,top+4],[tx+15,top+61],[tx+9,top+55]],edge);
   r(tx+5,top+28,52,7,silver);bolt(tx+31,top+31);
  }
 }
 panel(-118,-215,236,204);
 for(const px of [-108,57])for(const py of [-132,-75]){panel(px,py,51,46);r(px+12,py+13,27,7,navy);r(px+12,py+25,27,6,navy);}
 panel(-73,-302,146,92);r(-80,-313,160,13,silver);
 for(let bx=-73;bx<74;bx+=31)r(bx,-327,19,17,steel);
 panel(-29,-289,58,49);txt('M',0,-255,27,silver);
 panel(-125,-248,250,57);txt('PERSONAL MACH',0,-224,21,'#f4f7fa');txt('OWNER ONLY',0,-205,13,'#d3dce4');
 // Steel gate frame preserves the original center entrance and floor baseline.
 r(-43,-122,86,122,steel);r(-36,-115,72,115,navy);r(-31,-105,62,34,plate);
 r(-31,-105,62,6,silver);r(-31,-78,62,6,silver);for(const bx of [-23,23]){bolt(bx,-102);bolt(bx,-75);}
 door(true,selected);r(-187,-4,374,4,silver);
 if(selected){r(-13,-180,26,23,'#f4faff');txt('↑',0,-162,18,C.blue);}
}
function castle(x,y,selected){ctx.save();ctx.translate(Math.round(x),y);fortressBody(selected);ctx.restore();}
function hitBounds(q={}){
 q=q||{};
 const previous=measuring;
 measuring={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
 try{
  // Intact body geometry only: no floating sign, labels, interaction arrow,
  // destruction particles, or countdown. Records and the canvas stay untouched.
  if(q.castle===true||q.id==='castle')fortressBody(false);
  else{facade(q);door(q.locked,false);r(-110,-4,220,4,'#7f9baa');}
  return {...measuring};
 }finally{measuring=previous;}
}
function portal(q,x,y,selected,time){
 // Ignore stale destruction timestamps/flags for PERSONAL MACH. This is visual
 // Public scenery only: the locked facade has no destination or authentication.
 if(q.castle===true||q.id==='castle'){castle(x,y,selected);return;}
 if(q.indestructible===true&&q.destroyed)q={...q,destroyed:false};
 ctx.save();ctx.translate(Math.round(x),y);
 if(q.destroyed&&q.indestructible!==true){debris(q,time,selected);sign(q,selected,-205);}
 else{facade(q);door(q.locked,selected);r(-110,-4,220,4,'#7f9baa');sign(q,selected);}
 ctx.restore();
}
return {building,npc,castle,portal,hitBounds};}};})();
