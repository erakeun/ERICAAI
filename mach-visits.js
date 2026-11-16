/* MACH optional aggregate tool visits v1. No form, generated text, document, query, referrer or visitor ID is transmitted. */
(() => {
 'use strict';
 const registry={
 '/nameplate-maker/':'nameplate','/erica-event-oneq/':'event-oneq','/ERICAAI/interview-oneq/':'interview-oneq',
 '/event-timetable-maker/':'timetable','/ERICAAI/rolemap/':'rolemap','/handover-a-to-z/':'handover',
 '/ERICAAI/lanyard-badge/':'lanyard-badge','/ERICAAI/clip-badge/':'clip-badge',
 '/erica-seat-planner/':'erica-seat','/seoul-seat-planner/':'seoul-seat','/erica-auditorium-seat-maker/':'auditorium-seat'};
 const path=location.pathname.replace(/index\.html$/,'');const tool=registry[path];
 if(location.origin!=='https://erakeun.github.io'||!tool||document.getElementById('mach-visit-preference'))return;
 const consentKey='mach_aggregate_consent_v1_'+tool, excludeKey='mach_aggregate_exclude_v1';
 const read=(s,k)=>{try{return s.getItem(k)}catch{return null}};
 const save=(s,k,v)=>{try{s.setItem(k,v)}catch{}};
 if(new URLSearchParams(location.search).get('analytics')==='off')save(localStorage,excludeKey,'1');
 const excluded=()=>read(localStorage,excludeKey)==='1'||navigator.webdriver;
 let sent=false;
 async function count(){
  if(sent||excluded()||read(localStorage,consentKey)!=='yes'||document.visibilityState!=='visible')return;
  const key='mach_aggregate_session_v1_'+tool;if(Date.now()-Number(read(sessionStorage,key)||0)<1800000)return;
  sent=true;
  try{const r=await fetch('https://mach-ai-tools.hyungkeun.chatgpt.site/api/tool-visit',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,consent:true})});if(r.ok)save(sessionStorage,key,String(Date.now()))}catch{}
 }
 const box=document.createElement('details');box.id='mach-visit-preference';box.setAttribute('data-html2canvas-ignore','true');
 const summary=document.createElement('summary');summary.textContent='선택: 방문 통계 설정';box.append(summary);
 const p=document.createElement('p');p.textContent='동의하면 이 도구의 방문을 날짜별 합계로만 집계합니다. 입력·생성문·문서·검색어·방문자 식별자는 보내지 않습니다. 통계는 MACH 운영자의 서버에 저장되며 고유 인원 수가 아닙니다. 거부해도 모든 기능을 사용할 수 있습니다.';box.append(p);
 const state=document.createElement('span');state.setAttribute('role','status');
 function update(){state.textContent=excluded()?' 이 브라우저 통계 제외 중':read(localStorage,consentKey)==='yes'?' 이 도구 방문 통계 동의 중':' 수집 안 함'}
 for(const [label,value] of [['동의','yes'],['거부 / 동의 철회','no']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{save(localStorage,consentKey,value);update();if(value==='yes')count()});box.append(b)}
 const b=document.createElement('button');b.type='button';b.textContent='내 브라우저 전체 통계 제외';b.addEventListener('click',()=>{save(localStorage,excludeKey,'1');update()});box.append(b,state);
 document.body.append(box);update();document.addEventListener('visibilitychange',count);count();
})();
