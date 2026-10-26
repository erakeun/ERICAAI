(function(root){
'use strict';
// A single sign follows the most recently revealed nearby public building.
// It reads existing world state: restoring a facade immediately removes its
// sign, and repeated attacks never create DOM nodes, timers or extra panels.
const MARGIN=8,MAX_WIDTH=312,NEAR_DISTANCE=260;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const cache=new Map();
const publicBuilding=q=>Boolean(q&&!q.locked&&!q.castle&&!q.indestructible&&q.id!=='castle'&&typeof q.url==='string'&&/^https:\/\//.test(q.url)&&typeof q.description==='string'&&q.description.trim());
function select(buildings,options={}){
 const p=options.player;if(!p)return null;
 const floor=options.floor??p.floor,camera=Number(options.camera)||0,width=Number(options.viewWidth)||280;
 if(p.floor!==floor)return null;
 let chosen=null;
 for(const q of buildings||[]){
  if(!publicBuilding(q)||!q.destroyed||q.floor!==floor||!Number.isFinite(q.x)||Math.abs(q.x-(p.x+14))>NEAR_DISTANCE||q.x<camera-MARGIN||q.x>camera+width+MARGIN)continue;
  if(!chosen||(Number(q.destroyedAt)||0)>(Number(chosen.destroyedAt)||0)||((Number(q.destroyedAt)||0)===(Number(chosen.destroyedAt)||0)&&Math.abs(q.x-p.x)<Math.abs(chosen.x-p.x)))chosen=q;
 }
 return chosen;
}
// Break Korean as well as unspaced names at measured glyph boundaries. Keep
// exact source text; rendering never invents summaries or loads remote data.
function wrap(ctx,value,width){
 const result=[];let line='';
 for(const character of String(value||'').trim()){
  if(character==='\n'){if(line)result.push(line.trimEnd());line='';continue;}
  if(line&&ctx.measureText(line+character).width>width){result.push(line.trimEnd());line='';}
  if(line||character!==' ')line+=character;
 }
 if(line)result.push(line.trimEnd());return result;
}
function content(ctx,q,width){
 const key=[q.name,q.description,width].join('\u0000');
 if(cache.has(key))return cache.get(key);
 ctx.font='700 15px system-ui,sans-serif';const title=wrap(ctx,q.name,width-24);
 ctx.font='500 14px system-ui,sans-serif';const description=wrap(ctx,q.description,width-24);
 const text={title,description,height:24+title.length*20+8+description.length*20+26};
 // The manifest is small, but cap the cache if a future caller changes copy.
 if(cache.size>=64)cache.clear();cache.set(key,text);return text;
}
function layout(ctx,q,options={}){
 if(!publicBuilding(q)||!q.destroyed)return null;
 const viewport=Math.max(120,Number(options.viewWidth)||280),width=Math.min(MAX_WIDTH,viewport-MARGIN*2);
 const anchor=q.x-(Number(options.camera)||0),text=content(ctx,q,width);
 const roof=420+(Number.isFinite(q.hitBounds?.top)?q.hitBounds.top:-150);
 // The surviving sign starts at y=215. Place this readable explanation above
// that sign and the intact roof silhouette, leaving the entrance unobscured.
 const bottom=Math.min(203,roof-12),y=Math.max(8,bottom-text.height);
 return {...text,id:q.id,x:clamp(anchor-width/2,MARGIN,viewport-MARGIN-width),y,width,anchor,bottom:y+text.height};
}
function draw(ctx,buildings,options={}){
 const q=select(buildings,options);if(!q)return null;
 ctx.save();
 try{
  const panel=layout(ctx,q,options);if(!panel)return null;
  const x=Math.round(panel.x),y=Math.round(panel.y),w=Math.round(panel.width),h=panel.height;
  // Opaque backing and a strong border stay legible over every floor's art.
  ctx.fillStyle='#173f60';ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#fffdf3';ctx.fillRect(x+2,y+2,w-4,h-4);
  const pointer=clamp(Math.round(panel.anchor),x+12,x+w-12);
  ctx.fillStyle='#173f60';ctx.beginPath();ctx.moveTo(pointer-6,y+h);ctx.lineTo(pointer,y+h+7);ctx.lineTo(pointer+6,y+h);ctx.closePath();ctx.fill();
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.font='700 15px system-ui,sans-serif';ctx.fillStyle='#173f60';
  let baseline=y+23;
  for(const line of panel.title){ctx.fillText(line,x+12,baseline);baseline+=20;}
  baseline+=8;ctx.font='500 14px system-ui,sans-serif';ctx.fillStyle='#263e50';
  for(const line of panel.description){ctx.fillText(line,x+12,baseline);baseline+=20;}
  ctx.font='600 12px system-ui,sans-serif';ctx.fillStyle='#45657a';
  ctx.fillText('입구에서 ↑ 도구 열기 · R 건물 복구',x+12,y+h-12);
  return panel;
 }finally{ctx.restore();}
}
const api={select,wrap,layout,draw,NEAR_DISTANCE};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MachBuildingInfo=api;
})(typeof window!=='undefined'?window:globalThis);
