'use strict';
// Actual game.js + physics in a deterministic DOM/clock harness. Browser QA
// separately checks native dialog layout, real focus delivery and screen size.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Physics=require('../play/physics.js');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function boot(){
 let now=0,rafSerial=0,doc,combat,player,targets;
 const frames=new Map(),tasks=[],messages=[],opened=[];
 const context=new Proxy({measureText:s=>({width:String(s).length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
 function matches(el,selector){
  selector=selector.trim();
  if(selector==='[contenteditable]:not([contenteditable="false"])')return el.attributes.contenteditable!==undefined&&el.attributes.contenteditable!=='false';
  if(selector.startsWith('#'))return el.id===selector.slice(1);
  if(selector.startsWith('.'))return el.className.split(/\s+/).includes(selector.slice(1));
  const m=selector.match(/^(\w+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);
  if(!m)return false;
  if(m[1]&&el.tagName!==m[1].toUpperCase())return false;
  if(m[2]){const value=m[2]==='hidden'?(el.hidden?'':undefined):m[2]==='href'?el.href:el.attributes[m[2]];
   if(value===undefined||m[3]!==undefined&&value!==m[3])return false;
  }
  return true;
 }
 function query(node,selector){
  const selectors=selector.split(',').map(s=>s.trim()),all=[];
  function walk(n){for(const child of n.children){all.push(child);walk(child);}}walk(node);
  return all.filter(el=>selectors.some(sel=>{const parts=sel.split(/\s+/);if(!matches(el,parts.pop()))return false;let parent=el.parentElement;while(parts.length){const part=parts.pop();while(parent&&!matches(parent,part))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;}));
 }
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.listeners={};this.attributes={};this.dataset={};this.style={};this.hidden=false;this.disabled=false;this.open=false;this.id='';this.className='';this.value='';this._text='';this.clientWidth=1120;this.width=1120;this.height=520;this.firstChild={textContent:''};this.classList={toggle:(name,on)=>{const names=new Set(this.className.split(/\s+/).filter(Boolean));if(on)names.add(name);else names.delete(name);this.className=[...names].join(' ');}};}
  set textContent(value){this._text=String(value);this.firstChild.textContent=this._text;this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set innerHTML(value){this.textContent=value;}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')this.id=String(v);if(k==='class')this.className=String(v);if(k==='value')this.value=String(v);if(k==='href')this.href=String(v);if(k==='hidden')this.hidden=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
  removeAttribute(k){delete this.attributes[k];if(k==='href')delete this.href;}
  getAttribute(k){return this.attributes[k]??null;}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const c of this.children)c.parentElement=null;this.children=[];this._text='';this.append(...nodes);}
  querySelectorAll(selector){return query(this,selector);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let e=this;e;e=e.parentElement)if(selector.split(',').some(s=>matches(e,s)))return e;return null;}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  dispatchEvent(event){event.target||=this;for(const fn of this.listeners[event.type]||[])fn(event);if(!event.stopped&&event.bubbles&&this.parentElement)this.parentElement.dispatchEvent(event);return !event.defaultPrevented;}
  focus(){if(doc.activeElement===this)return;const previous=doc.activeElement;doc.activeElement=this;if(previous)previous.dispatchEvent({type:'blur',target:previous,relatedTarget:this});}
  click(){this.dispatchEvent({type:'click',bubbles:true,preventDefault(){}});if(this.tagName==='A'&&this.href)opened.push(this.href);}
  showModal(){this.open=true;}
  close(){if(!this.open)return;this.open=false;tasks.push(()=>this.dispatchEvent({type:'close'}));}
  getContext(){return context;}
  getBoundingClientRect(){return {height:900,width:1120};}
  setPointerCapture(){}
 }
 doc=new Element('document');doc.hidden=false;doc.activeElement=null;doc.createElement=tag=>new Element(tag);
 const stack=[doc],voids=new Set(['META','LINK','INPUT','BR','IMG','HR']);
 for(const token of read('play/index.html').matchAll(/<\/?[a-zA-Z][^>]*>/g)){
  const raw=token[0];if(raw.startsWith('</')){const tag=raw.match(/^<\/(\w+)/)[1].toUpperCase();while(stack.length>1){if(stack.pop().tagName===tag)break;}continue;}
  const tag=raw.match(/^<(\w+)/)[1],el=new Element(tag);
  for(const m of raw.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(m.index===1)continue;el.setAttribute(m[1],m[2]??'');}
  stack.at(-1).append(el);if(!voids.has(el.tagName))stack.push(el);
 }
 doc.body=doc.querySelector('body');
 const win=new Element('window');win.parent={postMessage:(...args)=>messages.push(args)};win.innerWidth=1200;win.open=(url)=>opened.push(url);
 const P={...Physics,resetCombatRound:state=>{combat=Physics.resetCombatRound(state);return combat;},createPlayer:(...args)=>{player=Physics.createPlayer(...args);return player;},advanceAttack:(p,t,...args)=>{targets=t;return Physics.advanceAttack(p,t,...args);}};
 win.MachPhysics=P;win.MachWorldArt={create:()=>({hitBounds:()=>({left:-100,top:-150,right:100,bottom:0}),building(){},portal(){},npc(){}})};
 win.MachAttackAnimation={create:()=>({kind:()=>'',renderNeutral:()=>true,renderBody:()=>false,renderCharacter:()=>false,ready:()=>false,capture:()=>({}),status:()=>({})})};
 const scope={window:win,document:doc,location:{search:'?embed=1',origin:'http://localhost'},URLSearchParams,matchMedia:()=>({matches:true}),performance:{now:()=>now},requestAnimationFrame:fn=>{const id=++rafSerial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}};
 vm.createContext(scope);vm.runInContext(read('play/manifest.js'),scope);vm.runInContext(read('play/game.js'),scope);
 const $=s=>doc.querySelector(s);
 const flush=()=>{let limit=50;while(tasks.length){if(--limit<0)throw Error('unbounded DOM tasks');tasks.shift()();}};
 const key=(code,options={})=>{const target=options.target||doc.activeElement||doc.body,event={type:'keydown',bubbles:true,key:code,code,repeat:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...options,target};target.dispatchEvent(event);if(!event.defaultPrevented&&!event.repeat&&code==='Enter'&&['BUTTON','A'].includes(target.tagName))target.click();flush();return event;};
 const step=(count=1)=>{for(let n=0;n<count;n++){now+=1000/60;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));flush();}};
 const up=code=>win.dispatchEvent({type:'keyup',code});
 const start=()=>{$('#startButton').focus();key('Enter');step();};
 const snapshot=()=>win.MACH_PLAY.snapshot();
 const moveTo=x=>{player.x=x;player.y=Physics.GROUND-Physics.PLAYER_H;player.grounded=true;player.vx=player.vy=0;step();};
 const pressChoice=label=>{const item=[...$('#gameMenu').querySelectorAll('button,a[href]')].find(el=>el.textContent.includes(label));assert.ok(item,label);item.focus();key('Enter');};
 return {$,doc,win,key,up,step,start,snapshot,moveTo,pressChoice,messages,opened,flush,get combat(){return combat;},get player(){return player;},get targets(){return targets;},portals:win.MACH_PORTALS};
}

test('parent focus/start works, focus-out and foreign-origin messages cannot enable input',()=>{
 const h=boot();assert.equal(h.snapshot().active,false);assert.equal(h.snapshot().framePending,false);
 h.win.dispatchEvent({type:'message',source:h.win.parent,origin:'http://localhost',data:{type:'mach-play:focus'}});assert.equal(h.doc.activeElement,h.$('#startButton'));
 h.key('Enter');h.step();assert.equal(h.snapshot().active,true);assert.equal(h.doc.activeElement,h.$('#game'));
 h.doc.body.focus();assert.equal(h.snapshot().active,false);const x=h.snapshot().player.x;
 assert.equal(h.key('KeyM').defaultPrevented,false);h.key('ArrowRight');h.step(10);assert.equal(h.snapshot().player.x,x);assert.equal(h.snapshot().menu,null);
 h.win.dispatchEvent({type:'message',source:{},origin:'http://localhost',data:{type:'mach-play:focus'}});assert.equal(h.doc.activeElement,h.doc.body);
});

test('KeyX works with Korean key value; repeat and IME suppress attacks and menu cancels swing',()=>{
 const h=boot();h.start();h.moveTo(450);h.key('KeyX',{key:'ㅌ',repeat:true});assert.equal(h.snapshot().swing,null);
 h.key('KeyX',{key:'ㅌ',isComposing:true});h.key('KeyX',{key:'ㅌ',keyCode:229});assert.equal(h.snapshot().swing,null);
 h.key('KeyX',{key:'ㅌ'});assert.ok(h.snapshot().swing);h.key('KeyM');assert.equal(h.snapshot().active,false);assert.equal(h.snapshot().swing,null);assert.equal(h.snapshot().menu,'gameMenu');
 const score=h.snapshot().score;h.key('KeyX',{key:'ㅌ'});h.step(20);assert.equal(h.snapshot().score,score);assert.equal(h.snapshot().swing,null);
 h.key('Escape',{repeat:true});assert.equal(h.snapshot().menu,'gameMenu');h.key('Escape');assert.equal(h.snapshot().active,true);assert.equal(h.doc.activeElement,h.$('#game'));h.key('Escape',{repeat:true});assert.equal(h.snapshot().menu,null);assert.equal(h.snapshot().active,true);
});

test('nearby elevator uses Up, arrow floor selection, Enter and Escape with restored canvas focus',()=>{
 const h=boot();h.start();h.moveTo(250);h.key('ArrowUp');assert.equal(h.snapshot().menu,'interactionDialog');assert.equal(h.snapshot().active,false);assert.equal(h.doc.activeElement,h.$('#floorChoices').children[0]);
 h.key('ArrowDown');assert.equal(h.doc.activeElement,h.$('#floorChoices').children[1]);h.key('Enter');assert.equal(h.snapshot().player.floor,1);assert.equal(h.snapshot().active,true);assert.equal(h.doc.activeElement,h.$('#game'));
 h.moveTo(250);h.key('ArrowUp');h.key('ArrowDown');h.key('Escape');assert.equal(h.snapshot().player.floor,1);assert.equal(h.snapshot().active,true);
});

test('menus preserve typing, offer direct shortcuts, commit/cancel speed, and retain Tab',()=>{
 const h=boot();h.start();h.key('KeyC');assert.equal(h.doc.activeElement,h.$('#catalogAll'));h.key('Slash');assert.equal(h.doc.activeElement,h.$('#search'));
 for(const code of ['KeyM','KeyH','KeyX','ArrowRight'])assert.equal(h.key(code).defaultPrevented,false);
 h.key('Escape',{isComposing:true});assert.equal(h.snapshot().menu,'catalog');
 assert.equal(h.snapshot().menu,'catalog');h.$('#search').value='명찰';h.$('#search').dispatchEvent({type:'input'});h.key('Enter');assert.equal(h.doc.activeElement.tagName,'A');assert.ok(h.doc.activeElement.textContent.includes('명찰'));
 h.key('Escape');h.key('KeyV');let slider=h.doc.activeElement;assert.equal(slider.getAttribute('role'),'slider');h.key('ArrowLeft');assert.equal(slider.getAttribute('aria-valuenow'),'430');h.key('Escape');assert.equal(h.snapshot().speed,440);
 h.key('KeyV');h.key('ArrowLeft');h.key('Enter');assert.equal(h.snapshot().speed,430);assert.equal(h.snapshot().active,true);
 h.key('KeyG');h.key('ArrowDown');h.key('Enter');assert.equal(h.snapshot().character,'original');h.key('KeyH');assert.match(h.$('#gameMenuTitle').textContent,/조작 도움말/);h.key('Escape');assert.equal(h.key('Tab').defaultPrevented,false);assert.equal(h.snapshot().active,false);
});

test('feedback is opt-in only and held Enter never opens duplicate forms',()=>{
 const h=boot();h.start();h.key('KeyF');assert.equal(h.snapshot().active,false);assert.equal(h.opened.length,0);assert.equal(h.doc.activeElement.tagName,'A');h.key('Enter',{repeat:true});assert.equal(h.opened.length,0);h.key('Enter');assert.equal(h.opened.length,1);assert.match(h.opened[0],/^https:\/\/script\.google\.com\/macros\/s\/.*\?tool=main$/);h.key('Enter',{repeat:true});assert.equal(h.opened.length,1);h.key('Escape');assert.equal(h.snapshot().active,true);
});

test('first building destruction scores once, recovery preserves eligibility history, and frozen score is stable',()=>{
 const h=boot();h.start();h.moveTo(450);h.key('KeyX');h.step(10);assert.equal(h.snapshot().score,150);assert.equal(h.snapshot().buildings.find(q=>q.id==='01').destroyed,true);assert.equal(h.snapshot().scoredBuildingIds.length,1);
 h.key('KeyR');assert.equal(h.snapshot().buildings.find(q=>q.id==='01').destroyed,false);h.step(20);h.key('KeyX');h.step(10);assert.equal(h.snapshot().score,150);
 h.combat.freeExplore=true;h.moveTo(775);h.step(20);h.key('KeyX');h.step(10);assert.equal(h.snapshot().score,150);assert.equal(h.snapshot().buildings.find(q=>q.id==='02').destroyed,true);
});

test('1000 milestone remains nonblocking and provides updated positive wording',()=>{
 const h=boot();h.start();h.moveTo(450);h.combat.score=850;h.key('KeyX');h.step(10);
 assert.equal(h.snapshot().score,1000);assert.equal(h.snapshot().active,true);assert.equal(h.snapshot().menu,null);assert.match(h.snapshot().notice,/마하에 있으면 좋을 기능/);assert.equal(h.snapshot().noticeCount,1);h.step(20);h.key('KeyX');h.step(10);assert.equal(h.snapshot().noticeCount,1);
});

test('10000 ending caps once; free exploration resumes public portals while score remains frozen',()=>{
 const h=boot();h.start();h.moveTo(450);h.combat.score=9900;h.key('KeyX');h.step(10);
 assert.equal(h.snapshot().score,10000);assert.equal(h.snapshot().ended,true);assert.equal(h.snapshot().active,false);assert.equal(h.snapshot().menu,'gameMenu');assert.match(h.$('#gameMenuContent').textContent,/GAME END/);assert.equal(h.snapshot().framePending,false);assert.equal(h.snapshot().notice,'');
 h.key('KeyX');h.key('Enter',{repeat:true});assert.equal(h.snapshot().menu,'gameMenu');assert.equal(h.snapshot().swing,null);
 h.key('ArrowDown');assert.match(h.doc.activeElement.textContent,/자유 탐험/);h.key('Enter');assert.equal(h.snapshot().freeExplore,true);assert.equal(h.snapshot().active,true);assert.equal(h.snapshot().menu,null);
 h.key('KeyR');h.step(30);h.key('KeyX');h.step(10);assert.equal(h.snapshot().score,10000);assert.equal(h.snapshot().menu,null);
 h.key('ArrowUp');assert.equal(h.opened.length,1);assert.match(h.opened[0],/mail-card-maker/);
});

test('ending restart clears round score, destroyed IDs, enemies, and milestones before awarding anew',()=>{
 const h=boot();h.start();h.moveTo(450);h.combat.score=9900;h.key('KeyX');h.step(10);const round=h.snapshot().round;
 assert.match(h.doc.activeElement.textContent,/다시 시작/);h.key('Enter');assert.equal(h.snapshot().round,round+1);assert.equal(h.snapshot().score,0);assert.equal(h.snapshot().ended,false);assert.equal(h.snapshot().freeExplore,false);assert.equal(h.snapshot().scoredBuildingIds.length,0);assert.ok(h.snapshot().buildings.every(q=>!q.destroyed));assert.ok(h.snapshot().slimes.every(s=>s.alive));assert.equal(h.snapshot().player.x,410);assert.equal(h.snapshot().active,true);
 h.moveTo(450);h.key('KeyX');h.step(10);assert.equal(h.snapshot().score,150);assert.equal(h.combat.notifiedMilestone,0);
});

test('explicit keyboard close requests parent collapse; parent pause stops all queued frames',()=>{
 const h=boot();h.start();h.key('KeyM');h.pressChoice('탐험 접고');assert.ok(h.messages.some(([data])=>data.type==='mach-play:close'));assert.equal(h.snapshot().active,false);assert.equal(h.snapshot().framePending,false);
 h.key('Escape');h.key('ArrowRight');h.step(2);const x=h.snapshot().player.x;h.win.dispatchEvent({type:'message',source:h.win.parent,origin:'http://localhost',data:{type:'mach-play:pause'}});h.step(100);assert.equal(h.snapshot().player.x,x);assert.equal(h.snapshot().active,false);assert.equal(h.snapshot().framePending,false);
});

test('session discovery records active public proximity once and never leaks private markers',()=>{
 const h=boot();assert.equal(h.snapshot().discoveredIds.length,0);h.moveTo(450);assert.equal(h.snapshot().discoveredIds.length,0);h.start();assert.deepEqual(Array.from(h.snapshot().discoveredIds),['01']);h.step(20);assert.equal(h.snapshot().discoveredIds.length,1);
 h.player.floor=2;h.moveTo(1650);assert.equal(h.snapshot().discoveredIds.length,1);h.moveTo(3050);assert.equal(h.snapshot().discoveredIds.length,1);
 h.key('KeyC');h.$('#catalogDiscovered').focus();h.key('Enter');assert.equal(h.$('#catalogList').children.length,1);assert.match(h.$('#catalogList').textContent,/메일 명함 생성기/);assert.doesNotMatch(h.$('#catalogList').textContent,/비공개/);
 const fresh=boot();assert.equal(fresh.snapshot().discoveredIds.length,0);
});

test('fortress stays intact and scoreless with recoil; tab visibility and blur suspend loop and keys',()=>{
 const h=boot();h.start();h.player.floor=2;h.moveTo(3050);h.key('KeyX');h.step(9);const state=h.snapshot();assert.equal(state.score,0);assert.equal(state.buildings.find(q=>q.id==='castle').destroyed,false);assert.ok(state.metalImpact);assert.ok(state.player.recoilRemaining>0);
 h.key('ArrowRight');h.step(2);h.doc.hidden=true;h.doc.dispatchEvent({type:'visibilitychange'});const x=h.snapshot().player.x;h.step(30);assert.equal(h.snapshot().active,false);assert.equal(h.snapshot().framePending,false);assert.equal(h.snapshot().player.x,x);
 h.doc.hidden=false;h.$('#startButton').focus();h.key('Enter');h.step(2);assert.equal(h.snapshot().player.x,x);h.win.dispatchEvent({type:'blur'});assert.equal(h.snapshot().active,false);assert.equal(h.snapshot().swing,null);
});
