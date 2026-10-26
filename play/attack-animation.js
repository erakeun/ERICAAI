(function(root){
'use strict';
const DURATIONS_MS=Object.freeze([50,50,40,45,45,50,60,60]);
const APPEARANCES=Object.freeze(['default','original','varsity','graduate','explorer','safety']);
const PIVOT=Object.freeze({x:40,y:88});
const LEFT_PIVOT=Object.freeze({x:88,y:88});
const TOTAL_MS=400,HIT_MS=140,FRAME_WIDTH=128,FRAME_HEIGHT=96,FRAME_COUNT=8;
const RUN_STRIDE_PX=132;
const FIELDS=new Set(['appearanceId','approvalReference','frameWidth','frameHeight','pivot','durationsMs','facing','frameCount','attackSheet','neutralImage','clawSheet','leftSheet','leftNeutralImage','leftPivot','mirror']);
const LAYERED_FIELDS=new Set(['schema','appearanceId','approvalReference','frameWidth','frameHeight','frameCount','durationsMs','runStridePx','directions','mirrorLeft']);
const DIRECTION_FIELDS=new Set(['pivot','waistAnchor','upperNeutral','upperAttack','lowerIdle','lowerRun','lowerAir','lowerAirFrames','clawSheet','fullNeutral','upper_offset_y','air_upper_offset_y','hitBounds']);
const LAYER_NAMES=Object.freeze(['upperNeutral','upperAttack','lowerIdle','lowerRun','lowerAir','clawSheet']);
const ZERO_UPPER_OFFSETS=Object.freeze([0,0,0,0,0,0,0,0]);
// Configuration is optional and supplied by attack-assets.js. No guessed asset
// paths are requested. Only the six selectable appearances and the metadata keys
// above are accepted. Example AFTER artwork approval and file delivery:
// MACH_ATTACK_ASSETS.original = {
//   appearanceId:'original', approvalReference:'reviewed-original-artwork-v1',
//   frameWidth:128, frameHeight:96, frameCount:8, pivot:{x:40,y:88},
//   durationsMs:[50,50,40,45,45,50,60,60], facing:'right',
//   attackSheet: APPROVED_ATTACK_PNG,
//   neutralImage: APPROVED_NEUTRAL_PNG,
//   clawSheet: APPROVED_CLAW_PNG
// };
// For asymmetric lettering, set mirror:false and supply BOTH leftSheet and
// leftNeutralImage, plus leftPivot:{x:88,y:88}. Explicit left artwork is drawn
// around that left pivot without mirroring. The original right artwork uses
// pivot:{x:40,y:88}; its automatic left version mirrors about the world anchor.
// The non-lettered right claw effect is mirrored using the right pivot.
// approvalReference records provenance; this loader does not itself certify
// visual approval, RGBA transparency, arm continuity or first/last pixel equality.
// New layered-v1 entries use this schema instead of the legacy fields above:
// {schema:'layered-v1', appearanceId:'original', approvalReference:REVIEW_ID,
//  frameWidth:128, frameHeight:96, frameCount:8,
//  durationsMs:[50,50,40,45,45,50,60,60], runStridePx:132,
//  directions:{right:{pivot:{x:40,y:88}, waistAnchor:APPROVED_RIGHT_WAIST,
//   upper_offset_y:APPROVED_EIGHT_RUN_FRAME_OFFSETS,
//   upperNeutral:PNG, upperAttack:PNG, lowerIdle:PNG, lowerRun:PNG,
//   lowerAir:PNG, lowerAirFrames:1, clawSheet:PNG, fullNeutral:OPTIONAL_PNG},
//   left:{pivot:{x:88,y:88}, waistAnchor:APPROVED_LEFT_WAIST,
//   upper_offset_y:APPROVED_EIGHT_RUN_FRAME_OFFSETS,
//   upperNeutral:PNG, upperAttack:PNG, lowerIdle:PNG, lowerRun:PNG,
//   lowerAir:PNG, lowerAirFrames:2, clawSheet:PNG, fullNeutral:OPTIONAL_PNG}}}
// Both complete directions are required unless mirrorLeft:true explicitly
// approves mirroring right artwork. Waist anchors are REQUIRED; left.x must
// equal 128-right.x and left.y must equal right.y. Every layer/frame must share
// that direction's anchor in the artwork. Optional upper_offset_y contains
// exactly eight finite values in [-2,0] pixels (decimals permitted), indexed by
// lower run frame. Omission means eight zeros for that direction. Explicit
// directions may differ; automatic mirroring inherits right. Only upper and claws
// move by the offset while grounded/moving/not recoiling; feet stay anchored.
// lowerAir may instead be an array of 1/2 original 128x96 PNGs; its length must
// equal lowerAirFrames. No packing/cropping edits are required. Optional
// air_upper_offset_y supplies 1/2 finite [-2,0] values, indexed by rising/falling
// air pose (omission means zeros). Recoil suppresses both run and air offsets.
// Optional hitBounds:{left,top,right,bottom} is the approved frame-3 effect's
// pivot-relative [left,top,right,bottom) rectangle at source scale. hitBounds()
// returns a clone WITHOUT upperOffsetY. Physics applies that same rendered
// offset once at impact; no guessed reach is substituted by this loader.
// fullNeutral is an optional 128x96 review reference, never a fallback layer.
// Anchor metadata/dimensions do not prove actual pixel joins or visual approval.
const INLINE_PNG_PREFIX='data:image/png;base64,';
const MAX_INLINE_BASE64=8*1024*1024;
function inlinePng(value){
 if(typeof value!=='string'||!value.startsWith(INLINE_PNG_PREFIX))return false;
 const data=value.slice(INLINE_PNG_PREFIX.length);
 // Bound the encoded payload at 8 MiB. No SVG, other media type, charset,
 // external URL, whitespace or percent-encoded content is accepted.
 if(data.length<60||data.length>MAX_INLINE_BASE64||data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))return false;
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 if(data.endsWith('==')&&(alphabet.indexOf(data[data.length-3])&15)!==0)return false;
 if(!data.endsWith('==')&&data.endsWith('=')&&(alphabet.indexOf(data[data.length-2])&3)!==0)return false;
 const bytes=[];
 for(let i=0;i<24;i+=4){const n=(alphabet.indexOf(data[i])<<18)|(alphabet.indexOf(data[i+1])<<12)|(alphabet.indexOf(data[i+2])<<6)|alphabet.indexOf(data[i+3]);bytes.push((n>>>16)&255,(n>>>8)&255,n&255);}
 // PNG signature and mandatory 13-byte IHDR header. Full decoding and expected
 // sheet/neutral dimensions still gate readiness in the image loader below.
 return [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82].every((n,i)=>bytes[i]===n);
}
function localPng(value){
 if(typeof value!=='string'||!value.startsWith('assets/')||/[\\:%#?\u0000-\u0020]/.test(value)||!value.endsWith('.png'))return false;
 return value.split('/').every(part=>part&&part!=='.'&&part!=='..');
}
const pngSource=value=>localPng(value)||inlinePng(value);
function point(value,expected){return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&Object.keys(value).every(k=>k==='x'||k==='y')&&value.x===expected.x&&value.y===expected.y);}
function appearanceValid(id,value){return APPEARANCES.includes(id)&&value&&typeof value==='object'&&!Array.isArray(value)&&value.appearanceId===id&&typeof value.approvalReference==='string'&&Boolean(value.approvalReference.trim())&&value.approvalReference.length<=500;}
function timingValid(value){return value.frameWidth===FRAME_WIDTH&&value.frameHeight===FRAME_HEIGHT&&value.frameCount===FRAME_COUNT&&Array.isArray(value.durationsMs)&&value.durationsMs.length===DURATIONS_MS.length&&Array.from(value.durationsMs).every((n,i)=>n===DURATIONS_MS[i]);}
function validOffsets(value,count){return Array.isArray(value)&&value.length===count&&Array.from(value).every(n=>Number.isFinite(n)&&n>= -2&&n<=0);}
function validateHitBounds(value,pivot){
 const keys=['left','top','right','bottom'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==4||Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>!Number.isFinite(value[key])))return null;
 const{left,top,right,bottom}=value;
 if(left>=right||top>=bottom||left< -pivot.x||right>FRAME_WIDTH-pivot.x||top< -pivot.y||bottom>FRAME_HEIGHT-pivot.y)return null;
 return Object.freeze({left,top,right,bottom});
}
function validateDirection(value,pivot){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!DIRECTION_FIELDS.has(key)))return null;
 if(!point(value.pivot,pivot)||(value.lowerAirFrames!==1&&value.lowerAirFrames!==2))return null;
 const air=value.lowerAir,airArray=Array.isArray(air);
 if(airArray&&(air.length!==value.lowerAirFrames||!Array.from(air).every(pngSource)))return null;
 if(!LAYER_NAMES.every(key=>key==='lowerAir'&&airArray||pngSource(value[key])))return null;
 const waist=value.waistAnchor;
 if(!waist||!Number.isInteger(waist.x)||!Number.isInteger(waist.y)||waist.x<0||waist.x>FRAME_WIDTH||waist.y<=0||waist.y>=PIVOT.y||!point(waist,waist))return null;
 const offsets=value.upper_offset_y===undefined?ZERO_UPPER_OFFSETS:value.upper_offset_y;
 if(!validOffsets(offsets,FRAME_COUNT))return null;
 const airOffsets=value.air_upper_offset_y===undefined?Array(value.lowerAirFrames).fill(0):value.air_upper_offset_y;
 if(!validOffsets(airOffsets,value.lowerAirFrames))return null;
 const hitBounds=value.hitBounds===undefined?null:validateHitBounds(value.hitBounds,pivot);
 if(value.hitBounds!==undefined&&!hitBounds)return null;
 if(value.fullNeutral!==undefined&&!pngSource(value.fullNeutral))return null;
 return Object.freeze({...Object.fromEntries(LAYER_NAMES.map(key=>[key,value[key]])),lowerAir:airArray?Object.freeze([...air]):air,pivot,waistAnchor:Object.freeze({x:waist.x,y:waist.y}),upper_offset_y:Object.freeze([...offsets]),air_upper_offset_y:Object.freeze([...airOffsets]),hitBounds,lowerAirFrames:value.lowerAirFrames,fullNeutral:value.fullNeutral||null});
}
function validateLayered(id,value){
 if(!appearanceValid(id,value)||Object.keys(value).some(key=>!LAYERED_FIELDS.has(key))||value.schema!=='layered-v1'||!timingValid(value)||value.runStridePx!==RUN_STRIDE_PX)return null;
 if(value.mirrorLeft!==undefined&&typeof value.mirrorLeft!=='boolean')return null;
 const directions=value.directions;
 if(!directions||typeof directions!=='object'||Array.isArray(directions)||Object.keys(directions).some(key=>key!=='right'&&key!=='left'))return null;
 const right=validateDirection(directions.right,PIVOT),hasLeft=Object.prototype.hasOwnProperty.call(directions,'left'),left=hasLeft?validateDirection(directions.left,LEFT_PIVOT):null;
 if(!right||(hasLeft&&!left)||(!left&&value.mirrorLeft!==true))return null;
 if(left&&(left.waistAnchor.x!==FRAME_WIDTH-right.waistAnchor.x||left.waistAnchor.y!==right.waistAnchor.y))return null;
 return Object.freeze({kind:'layered-v1',appearanceId:id,approvalReference:value.approvalReference.trim(),runStridePx:RUN_STRIDE_PX,mirrorLeft:value.mirrorLeft===true,directions:Object.freeze({right,left})});
}
function validate(id,value){
 if(value?.schema==='layered-v1')return validateLayered(id,value);
 if(!APPEARANCES.includes(id)||!value||typeof value!=='object'||Array.isArray(value))return null;
 if(Object.keys(value).some(key=>!FIELDS.has(key)))return null;
 if(value.appearanceId!==id||typeof value.approvalReference!=='string'||!value.approvalReference.trim()||value.approvalReference.length>500)return null;
 if(value.frameWidth!==FRAME_WIDTH||value.frameHeight!==FRAME_HEIGHT||value.frameCount!==FRAME_COUNT||value.facing!=='right')return null;
 if(!value.pivot||value.pivot.x!==PIVOT.x||value.pivot.y!==PIVOT.y||Object.keys(value.pivot).some(k=>k!=='x'&&k!=='y'))return null;
 if(!Array.isArray(value.durationsMs)||value.durationsMs.length!==DURATIONS_MS.length||Array.from(value.durationsMs).some((n,i)=>n!==DURATIONS_MS[i]))return null;
 if(!['attackSheet','neutralImage','clawSheet'].every(key=>pngSource(value[key])))return null;
 if(value.mirror!==undefined&&typeof value.mirror!=='boolean')return null;
 const left=Boolean(value.leftSheet||value.leftNeutralImage);
 if(left&&(!pngSource(value.leftSheet)||!pngSource(value.leftNeutralImage)))return null;
 const leftPivot=value.leftPivot;
 if((left||leftPivot!==undefined)&&(!leftPivot||leftPivot.x!==LEFT_PIVOT.x||leftPivot.y!==LEFT_PIVOT.y||Object.keys(leftPivot).some(k=>k!=='x'&&k!=='y')))return null;
 if(value.mirror===false&&!left)return null;
 return Object.freeze({kind:'legacy',appearanceId:id,approvalReference:value.approvalReference.trim(),attackSheet:value.attackSheet,neutralImage:value.neutralImage,clawSheet:value.clawSheet,leftSheet:left?value.leftSheet:null,leftNeutralImage:left?value.leftNeutralImage:null,mirror:value.mirror!==false});
}
function frameAt(elapsedSeconds){
 if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||elapsedSeconds>=TOTAL_MS/1000)return null;
 const ms=elapsedSeconds*1000;let end=0;
 for(let i=0;i<DURATIONS_MS.length;i++){end+=DURATIONS_MS[i];if(ms<end)return i;}
 return null;
}
const runFrameAt=phase=>Math.min(7,Math.floor(((phase%1+1)%1)*FRAME_COUNT));
function loadImage(src){
 return new Promise((resolve,reject)=>{
  const ImageCtor=root.Image||(typeof Image==='function'?Image:null);
  if(!ImageCtor){reject(new Error('Image loading is unavailable'));return;}
  const image=new ImageCtor();image.decoding='async';
  image.onload=()=>{image.onload=null;image.onerror=null;resolve(image);};
  image.onerror=()=>{image.onload=null;image.onerror=null;reject(new Error('Configured animation asset failed to load'));};
  image.src=src;
 });
}
function dimensions(image,w,h){return Boolean(image&&image.naturalWidth===w&&image.naturalHeight===h);}
function create(registry=root.MACH_ATTACK_ASSETS||{},options={}){
 const entries=new Map(),captures=new WeakSet(),imageLoader=options.imageLoader||loadImage;
 if(typeof imageLoader!=='function')throw new TypeError('imageLoader must be a function');
 if(registry&&typeof registry==='object'&&!Array.isArray(registry)){
  for(const id of Object.keys(registry)){
   const metadata=validate(id,registry[id]);
   const entry={status:metadata?'loading':'invalid',metadata,images:null,promise:Promise.resolve(false)};entries.set(id,entry);
   if(!metadata)continue;
   const requested=[];
   if(metadata.kind==='layered-v1'){
    for(const direction of ['right','left']){
     const sheets=metadata.directions[direction];if(!sheets)continue;
     for(const layer of LAYER_NAMES){
      if(layer==='lowerAir'&&Array.isArray(sheets.lowerAir)){sheets.lowerAir.forEach((src,index)=>requested.push([direction+'.lowerAir.'+index,src,FRAME_WIDTH,FRAME_HEIGHT]));continue;}
      const count=layer==='lowerAir'?sheets.lowerAirFrames:['upperAttack','lowerRun','clawSheet'].includes(layer)?FRAME_COUNT:1;requested.push([direction+'.'+layer,sheets[layer],FRAME_WIDTH*count,FRAME_HEIGHT]);
     }
     if(sheets.fullNeutral)requested.push([direction+'.fullNeutral',sheets.fullNeutral,FRAME_WIDTH,FRAME_HEIGHT]);
    }
   }else{
    requested.push(['body',metadata.attackSheet,1024,96],['neutral',metadata.neutralImage,128,96],['claws',metadata.clawSheet,1024,96]);
    if(metadata.leftSheet)requested.push(['leftBody',metadata.leftSheet,1024,96],['leftNeutral',metadata.leftNeutralImage,128,96]);
   }
   entry.promise=Promise.all(requested.map(async([name,src,w,h])=>{
    const image=await imageLoader(src);if(!dimensions(image,w,h))throw new Error('Configured animation dimensions do not match');return[name,image];
   })).then(pairs=>{entry.images=Object.fromEntries(pairs);entry.status='ready';return true;},()=>{entry.images=null;entry.status='failed';return false;});
  }
 }
 const status=id=>entries.get(id)?.status||'unavailable';
 const kind=id=>entries.get(id)?.metadata?.kind||null;
 const ready=id=>status(id)==='ready';
 const whenReady=id=>entries.get(id)?.promise||Promise.resolve(false);
 function capture(appearanceId,facing=1){
  if(typeof appearanceId!=='string'||(facing!==1&&facing!==-1))return null;
  // Availability is frozen too, preventing a late image load from changing the
  // character partway through an already-started fallback attack.
  const snapshot=Object.freeze({appearanceId,facing,available:ready(appearanceId)});captures.add(snapshot);return snapshot;
 }
 function attackState(args){
  const attack=args?.attack,frame=frameAt(args?.elapsedSeconds);
  if(!attack||!captures.has(attack)||!attack.available||!ready(attack.appearanceId)||kind(attack.appearanceId)!=='legacy'||frame===null||!Number.isFinite(args.x)||!Number.isFinite(args.y))return null;
  return{entry:entries.get(attack.appearanceId),frame,x:args.x,y:args.y,facing:attack.facing};
 }
 function drawLayer(ctx,state,layer){
  const{entry,frame,x,y,facing}=state;
  if(layer==='claws'&&(frame<3||frame>5))return true;
  const isLeft=facing===-1,explicitLeft=isLeft&&entry.images.leftBody;
  const image=layer==='body'?(explicitLeft?entry.images.leftBody:entry.images.body):entry.images.claws;
  const pivot=layer==='body'&&explicitLeft?LEFT_PIVOT:PIVOT;
  ctx.save();
  try{ctx.translate(x,y);ctx.scale(layer==='body'&&explicitLeft?1:facing,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,frame*FRAME_WIDTH,0,FRAME_WIDTH,FRAME_HEIGHT,-pivot.x,-pivot.y,FRAME_WIDTH,FRAME_HEIGHT);}
  finally{ctx.restore();}
  return true;
 }
 function renderLayer(ctx,args,layer){const state=attackState(args);if(!state)return false;return drawLayer(ctx,state,layer);}
 function render(ctx,args){const state=attackState(args);if(!state)return false;drawLayer(ctx,state,'body');drawLayer(ctx,state,'claws');return true;}
 function upperOffsetY({appearanceId,facing=1,runPhase=0,moving=false,grounded=true,recoiling=false,vy=0}={}){
  if(!ready(appearanceId)||kind(appearanceId)!=='layered-v1'||(facing!==1&&facing!==-1)||!Number.isFinite(runPhase)||!Number.isFinite(vy)||typeof moving!=='boolean'||typeof grounded!=='boolean'||typeof recoiling!=='boolean'||recoiling)return 0;
  const directions=entries.get(appearanceId).metadata.directions,sheets=facing===-1&&directions.left?directions.left:directions.right;
  if(!grounded)return sheets.air_upper_offset_y[sheets.lowerAirFrames===2&&vy>=0?1:0];
  if(!moving)return 0;
  return sheets.upper_offset_y[runFrameAt(runPhase)];
 }
 function hitBounds({appearanceId,facing=1}={}){
  if(!ready(appearanceId)||kind(appearanceId)!=='layered-v1'||(facing!==1&&facing!==-1))return null;
  const directions=entries.get(appearanceId).metadata.directions,explicitLeft=facing===-1&&directions.left,bounds=(explicitLeft||directions.right).hitBounds;
  if(!bounds)return null;
  return Object.freeze(facing===-1&&!explicitLeft?{left:-bounds.right,top:bounds.top,right:-bounds.left,bottom:bounds.bottom}:{...bounds});
 }
 function characterState(args={}){
  const{appearanceId,x,y,facing=1,runPhase=0,moving=false,grounded=true,recoiling=false,vy=0,attackElapsed,attackVisualActive=false,includeClaws=true}=args;
  if(!ready(appearanceId)||kind(appearanceId)!=='layered-v1'||!Number.isFinite(x)||!Number.isFinite(y)||(facing!==1&&facing!==-1)||!Number.isFinite(runPhase)||!Number.isFinite(vy)||typeof moving!=='boolean'||typeof grounded!=='boolean'||typeof recoiling!=='boolean'||typeof attackVisualActive!=='boolean'||typeof includeClaws!=='boolean')return null;
  if(attackVisualActive&&(!Number.isFinite(attackElapsed)||attackElapsed<0))return null;
  const entry=entries.get(appearanceId),direction=facing===-1&&entry.metadata.directions.left?'left':'right',sheets=entry.metadata.directions[direction];
  const upperFrame=attackVisualActive?frameAt(attackElapsed):null;
  const lowerLayer=!grounded?'lowerAir':moving?'lowerRun':'lowerIdle';
  const lowerFrame=!grounded?(sheets.lowerAirFrames===2&&vy>=0?1:0):moving?runFrameAt(runPhase):0;
  const upperY=upperOffsetY({appearanceId,facing,runPhase,moving,grounded,recoiling,vy});
  return{entry,direction,pivot:sheets.pivot,scale:direction==='right'?facing:1,x,y,upperY,upperFrame,lowerLayer,lowerFrame,includeClaws};
 }
 function characterLayer(ctx,state,layer,frame){
  const{x,y,scale,pivot,entry,direction}=state;
  const airArray=layer==='lowerAir'&&Array.isArray(entry.metadata.directions[direction].lowerAir);
  const image=entry.images[direction+'.'+layer+(airArray?'.'+frame:'')],sourceFrame=airArray?0:frame;
  ctx.save();
  try{ctx.translate(x,y+(layer.startsWith('lower')?0:state.upperY));ctx.scale(scale,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,sourceFrame*FRAME_WIDTH,0,FRAME_WIDTH,FRAME_HEIGHT,-pivot.x,-pivot.y,FRAME_WIDTH,FRAME_HEIGHT);}
  finally{ctx.restore();}
 }
 function characterBody(ctx,state){characterLayer(ctx,state,state.lowerLayer,state.lowerFrame);characterLayer(ctx,state,state.upperFrame===null?'upperNeutral':'upperAttack',state.upperFrame??0);}
 function characterClaws(ctx,state){if(state.upperFrame!==null&&state.upperFrame>=3&&state.upperFrame<=5)characterLayer(ctx,state,'clawSheet',state.upperFrame);}
 // These calls intentionally use the engine's current visual direction, never a
 // legacy capture's frozen facing. The engine follows locomotion before impact,
 // records the hit once, then cancels attackVisualActive on a post-hit reversal.
 // runPhase is already distance-derived and must not reset at attack boundaries.
 function renderCharacter(ctx,args){const state=characterState(args);if(!state)return false;characterBody(ctx,state);if(state.includeClaws)characterClaws(ctx,state);return true;}
 function renderCharacterBody(ctx,args){const state=characterState(args);if(!state)return false;characterBody(ctx,state);return true;}
 function renderCharacterClaws(ctx,args){const state=characterState(args);if(!state)return false;characterClaws(ctx,state);return true;}
 function renderNeutral(ctx,{appearanceId,x,y,facing=1}={}){
  if(kind(appearanceId)==='layered-v1')return renderCharacter(ctx,{appearanceId,x,y,facing,runPhase:0,moving:false,grounded:true,vy:0,attackVisualActive:false});
  if(!ready(appearanceId)||!Number.isFinite(x)||!Number.isFinite(y)||(facing!==1&&facing!==-1))return false;
  const entry=entries.get(appearanceId),left=facing===-1&&entry.images.leftNeutral,pivot=left?LEFT_PIVOT:PIVOT;
  ctx.save();
  try{ctx.translate(x,y);ctx.scale(left?1:facing,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(left||entry.images.neutral,-pivot.x,-pivot.y,FRAME_WIDTH,FRAME_HEIGHT);}
  finally{ctx.restore();}
  return true;
 }
 return Object.freeze({status,kind,ready,whenReady,capture,render,renderBody:(ctx,args)=>renderLayer(ctx,args,'body'),renderClaws:(ctx,args)=>renderLayer(ctx,args,'claws'),renderNeutral,renderCharacter,renderCharacterBody,renderCharacterClaws,upperOffsetY,hitBounds});
}
const api=Object.freeze({create,frameAt,DURATIONS_MS,TOTAL_MS,HIT_MS,FRAME_WIDTH,FRAME_HEIGHT,FRAME_COUNT,RUN_STRIDE_PX,PIVOT,LEFT_PIVOT,APPEARANCES});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.MachAttackAnimation=api;
})(typeof window!=='undefined'?window:globalThis);
