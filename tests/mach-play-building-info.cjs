'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const info=require('../play/building-info.js');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../play/manifest.js'),'utf8'),scope);
const projects=scope.window.MACH_PORTALS;
const clone=()=>projects.map(q=>({...q}));
function context(){
 const drawn=[],ctx={font:'',drawn,save(){drawn.push(['save']);},restore(){drawn.push(['restore']);},fillRect(...args){drawn.push(['rect',...args]);},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},fillText(...args){drawn.push(['text',...args]);},measureText(value){const size=Number(this.font.match(/(\d+)px/)?.[1])||14;return {width:[...value].reduce((n,c)=>n+size*(/[^\u0000-\u007f]/.test(c)?1:.56),0)};}};
 return ctx;
}
const options={player:{x:410,floor:0},floor:0,camera:300,viewWidth:320,time:1};

test('only public destroyed buildings can reveal descriptions',()=>{
 const buildings=clone();
 assert.equal(info.select(buildings,options),null);
 buildings[0].destroyed=true;buildings[0].destroyedAt=1;
 assert.equal(info.select(buildings,options).id,'01');
 for(const q of buildings.filter(q=>q.locked)){
  q.destroyed=true;
  assert.equal(info.select([q],{...options,player:{x:q.x-14,floor:q.floor},floor:q.floor,camera:q.x-100}),null);
  assert.equal(info.layout(context(),q,options),null);
 }
 buildings[0].destroyed=false;assert.equal(info.select(buildings,options),null);
});

test('one latest nearby panel remains after repeated attacks, and recovery removes it',()=>{
 const first={...projects[0],x:500,destroyed:true,destroyedAt:1};
 const second={...projects[1],x:540,destroyed:true,destroyedAt:2};
 const ctx=context();
 assert.equal(info.select([first,second],options),second);
 for(let i=0;i<4;i++)assert.equal(info.draw(ctx,[first,second],options).id,second.id);
 assert.equal(ctx.drawn.filter(d=>d[0]==='save').length,4);
 assert.equal(ctx.drawn.filter(d=>d[0]==='restore').length,4);
 second.destroyed=false;assert.equal(info.select([first,second],options),first);
 first.destroyed=false;assert.equal(info.draw(ctx,[first,second],options),null);
});

test('panels follow player floor and disappear after leaving or going offscreen',()=>{
 const building={...projects[0],destroyed:true,destroyedAt:1};
 assert.equal(info.select([building],{...options,player:{x:1000,floor:0}}),null);
 assert.equal(info.select([building],{...options,player:{x:410,floor:1},floor:1}),null);
 assert.equal(info.select([building],{...options,camera:700}),null);
});

test('every public description fits above the surviving sign at supported narrow widths',()=>{
 const ctx=context();
 for(const viewport of [280,320,390,1120])for(const source of projects.filter(q=>!q.locked)){
  const q={...source,destroyed:true,hitBounds:{top:-175}},panel=info.layout(ctx,q,{viewWidth:viewport,camera:q.x-20});
  assert.ok(panel.x>=8,source.id);assert.ok(panel.x+panel.width<=viewport-8,source.id);
  assert.ok(panel.y>=8,source.id);assert.ok(panel.bottom<=203,`${source.id} at ${viewport}: ${panel.bottom}`);
  assert.equal(panel.title.join('').replace(/\s/g,''),q.name.replace(/\s/g,''));
  assert.equal(panel.description.join('').replace(/\s/g,''),q.description.replace(/\s/g,''));
  ctx.font='700 15px system-ui,sans-serif';for(const line of panel.title)assert.ok(ctx.measureText(line).width<=panel.width-24);
  ctx.font='500 14px system-ui,sans-serif';for(const line of panel.description)assert.ok(ctx.measureText(line).width<=panel.width-24);
 }
});

test('drawing preserves canvas state and leaves world records unchanged',()=>{
 const q={...projects[0],destroyed:true,destroyedAt:1},before=JSON.stringify(q),ctx=context();
 const panel=info.draw(ctx,[q],options);
 assert.equal(JSON.stringify(q),before);assert.equal(ctx.drawn[0][0],'save');assert.equal(ctx.drawn.at(-1)[0],'restore');
 assert.ok(panel.bottom<215);assert.ok(ctx.drawn.some(d=>d[0]==='text'&&d[1].includes('R 건물 복구')));
 assert.ok(ctx.drawn.filter(d=>d[0]==='text').length>=4);
});
