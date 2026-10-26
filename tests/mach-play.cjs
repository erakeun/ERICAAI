// Deterministic integration checks; browser layout and keyboard delivery need live QA.
// Run: node --test tests/mach-play.cjs
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const P = require('../play/physics.js');
const scope = {window: {}};
vm.runInNewContext(read('play/manifest.js'), scope);
const portals = scope.window.MACH_PORTALS;

class Element {
  constructor(id) { this.id=id; this.listeners={}; this.children=[]; this.style={}; this.attributes={}; this.open=false; this.textContent=''; this.messages=[]; this.contentWindow={postMessage:(...args)=>this.messages.push(args)}; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  emit(type, event={}) { for (const callback of this.listeners[type] || []) callback(event); }
  append(child) { this.children.push(child); child.parent=this; }
  remove() { this.removed=true; this.parent.children=this.parent.children.filter(c=>c!==this); }
  setAttribute(key, value) { this.attributes[key]=value; }
  focus(options) { this.focused=true; this.focusOptions=options; }
  scrollIntoView(options) { this.scrollOptions=options; }
}
function bootParent() {
  const ids=['mach-play','mach-play-toggle','mach-play-mount','mach-play-status','mach-play-close'];
  const nodes=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  const created=[], window=new Element('window'), origin='https://erakeun.github.io';
  const document={getElementById:id=>nodes[id],createElement:tag=>{const e=new Element(tag); created.push(e); return e;}};
  vm.runInNewContext(read('play-embed.js'),{document,window,location:{origin}});
  const open=()=>{nodes['mach-play'].open=true;nodes['mach-play'].emit('toggle');return nodes['mach-play-mount'].children[0];};
  const close=()=>{nodes['mach-play'].open=false;nodes['mach-play'].emit('toggle');};
  const message=(frame,data,patch={})=>window.emit('message',{source:frame.contentWindow,origin,data,...patch});
  return {nodes,created,window,origin,open,close,message};
}

test('main starts collapsed immediately after NOW with no eager game resource',()=>{
  const html=read('index.html');
  const details=html.match(/<details\b[^>]*id="mach-play"[^>]*>/)[0];
  assert.doesNotMatch(details,/\bopen(?:\s|=|>)/);
  assert.match(html,/<\/a>\s*<details class="play-disclosure" id="mach-play">/);
  assert.ok(html.indexOf('id="now-title"') < html.indexOf('id="mach-play"'));
  assert.doesNotMatch(html,/<(?:iframe|script|link|img)[^>]*(?:src|href)=["'][^"']*\.\/play\//);
  const h=bootParent();assert.equal(h.created.length,0);
});

test('open creates one titled same-site iframe; repeated toggles never duplicate it',()=>{
  const h=bootParent(),frame=h.open();
  assert.equal(frame.src,'./play/?embed=1');
  assert.match(frame.title,/하냥이의 마하탐험/);
  assert.equal(frame.attributes['aria-describedby'],'mach-play-help');
  h.nodes['mach-play'].emit('toggle');h.window.emit('pageshow');
  assert.equal(h.created.length,1);assert.equal(h.nodes['mach-play-mount'].children.length,1);
  frame.emit('load');assert.equal(h.nodes['mach-play-status'].textContent,'');
});

test('collapse pauses then destroys each context; repeat opens start fresh',()=>{
  const h=bootParent();
  for(let i=0;i<5;i++){
    const frame=h.open();h.close();
    assert.equal(frame.messages[0][0].type,'mach-play:pause');
    assert.equal(frame.messages[0][1],h.origin);assert.equal(frame.removed,true);
    assert.equal(h.nodes['mach-play-mount'].children.length,0);
    assert.equal(h.nodes['mach-play-status'].textContent,'');
  }
  assert.equal(h.created.length,5);
});

test('footer close restores focus and removes game synchronously',()=>{
  const h=bootParent(),frame=h.open();h.nodes['mach-play-close'].emit('click');
  assert.equal(h.nodes['mach-play'].open,false);assert.equal(frame.removed,true);
  assert.equal(h.nodes['mach-play-toggle'].focused,true);
  assert.equal(h.nodes['mach-play-toggle'].focusOptions.preventScroll,true);
});

test('height and escape messages require both matching origin and current frame',()=>{
  const h=bootParent(),frame=h.open();
  for(const patch of [{origin:'https://example.org'},{source:{}}]){
    h.message(frame,{type:'mach-play:height',height:999},patch);
    h.message(frame,{type:'mach-play:escape'},patch);
  }
  assert.equal(frame.style.height,undefined);assert.equal(h.nodes['mach-play-toggle'].focused,undefined);
  for(const height of [NaN,Infinity,'900',undefined])h.message(frame,{type:'mach-play:height',height});
  assert.equal(frame.style.height,undefined);
  h.message(frame,{type:'mach-play:height',height:701.2});assert.equal(frame.style.height,'702px');
  h.message(frame,{type:'mach-play:height',height:999999});assert.equal(frame.style.height,'4000px');
  h.message(frame,{type:'mach-play:height',height:-5});assert.equal(frame.style.height,'400px');
  h.message(frame,{type:'mach-play:escape'});assert.equal(h.nodes['mach-play-toggle'].focused,true);
});

test('stale load and frame messages cannot affect a new game; page lifecycle disposes/restores',()=>{
  const h=bootParent(),old=h.open();h.close();const current=h.open();
  old.emit('load');assert.notEqual(h.nodes['mach-play-status'].textContent,'');
  h.message(old,{type:'mach-play:height',height:777});assert.equal(current.style.height,undefined);
  h.window.emit('pagehide');assert.equal(current.removed,true);
  h.window.emit('pageshow');assert.equal(h.created.length,3);
  h.close();h.window.emit('pageshow');assert.equal(h.created.length,3);
});

test('default, reset, bounds and floor travel agree at 440px/s',()=>{
  const player=P.createPlayer(100);assert.equal(P.SPEED,440);assert.equal(player.speed,440);
  P.step(player,{right:true},1/30);assert.ok(Math.abs(player.x-(100+440/30))<1e-8);
  assert.equal(P.setSpeed(player,220),220);P.changeFloor(player,1,100);assert.equal(player.speed,220);
  assert.equal(P.setSpeed(player),440);assert.equal(P.setSpeed(player,Infinity),440);
  assert.equal(P.setSpeed(player,9999),P.MAX_SPEED);
  const html=read('play/index.html');assert.match(html,/id="speedControl"[^>]*value="440"/);
  assert.match(html,/id="speedValue">440 px\/s/);
  assert.match(read('play/game.js'),/P\.setSpeed\(player,P\.SPEED\)/);
});

test('all public portals have short descriptions and exact existing main URLs, badges once',()=>{
  const main=read('index.html');const seen=new Set();
  const publicPortals=portals.filter(p=>!p.locked);assert.equal(publicPortals.length,18);
  for(const p of portals){assert.ok(!seen.has(p.id));seen.add(p.id);assert.ok(p.description.length>8&&p.description.length<80);}
  for(const p of publicPortals){const url=new URL(p.url);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'erakeun.github.io');assert.equal(url.search,'');assert.ok(main.includes(p.url));}
  for(const id of ['30','31'])assert.equal(publicPortals.filter(p=>p.id===id).length,1);
  assert.match(publicPortals.find(p=>p.id==='30').url,/\/lanyard-badge\/$/);
  assert.match(publicPortals.find(p=>p.id==='31').url,/\/clip-badge\/$/);
});

test('private markers contain no destination or private project detail; fortress stays indestructible',()=>{
  for(const p of portals.filter(p=>p.locked)){assert.ok(p.name.startsWith('비공개 구역'));assert.equal(p.url,undefined);assert.equal(p.sign.startsWith('PRIVATE'),true);}
  const castle=portals.find(p=>p.id==='castle');assert.equal(castle.indestructible,true);assert.equal(P.isIndestructible(castle),true);
  const html=read('play/index.html'),game=read('play/game.js');
  assert.doesNotMatch(html+game,/ownerLink|keypad|personal-mach\.|mach-play\.[^\s]*chatgpt\.site/);
  const files=fs.readdirSync(path.join(root,'play')).filter(f=>/\.(?:html|js|json|md)$/.test(f));
  for(const file of files)assert.doesNotMatch(read('play/'+file),/https?:\/\/[^\s'"<>]*\.chatgpt\.site|Bearer\s+[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]{20,}|\/Users\/[^/]+\//,file);
});

test('all portals stay reachable at new default speed without jumping',()=>{
  const seen=new Set();
  for(let floor=0;floor<3;floor++){
    const player=P.createPlayer(0,floor);
    for(let i=0;i<1200;i++){P.step(player,{right:true},1/60);for(const portal of portals)if(P.nearby(player,[portal]))seen.add(portal.id);}
  }
  assert.equal(seen.size,portals.length);
});

test('approved sprite PNGs and animation modules remain byte-identical to V4',()=>{
  function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.join(dir,e.name)]);}
  const play=path.join(root,'play');
  const pngs=list(path.join(play,'assets')).filter(f=>f.endsWith('.png')).map(f=>path.relative(play,f)).sort();
  const hash=crypto.createHash('sha256');for(const file of pngs)hash.update(file+'\0').update(fs.readFileSync(path.join(play,file)));
  assert.equal(pngs.length,24);assert.equal(hash.digest('hex'),'c53c103be74f27fdc878b74a1bef11a18dbc9b449344fd8d442c0704c7c43723');
  const modules={'actors.js':'f058aa67ea29e38055df58874aa330b7673f8edd3cf6f3c9c4c2df93f40ef06e','attack-assets.js':'b58bef22bf4a0fce83a6166de7b1ac1b1c021a33143dc5cd609128ba32639697','attack-animation.js':'7e1a32edc331d9ae6d5e211cf2ecac3e31ca127c4c8564a17b8371b2e44f0d85'};
  for(const [file,expected] of Object.entries(modules))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(play,file))).digest('hex'),expected,file);
});
