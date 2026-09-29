import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { BUILDINGS, TOOL_URLS, nameplatePayload, nameplateProjectPayload, noticePayload, signagePayload, mapLink, locationInfo, filenameSafe } from '../integrations.js';

const project = { id:'p-integration', name:'면접 & <검증>', revision:3, panelists:[
  { id:'committee-a', name:'동명이인', organization:'가상 대학', position:'주임', role:'위원장', contact:'PRIVATE_CONTACT', note:'PRIVATE_NOTE' },
  { id:'committee-b', name:'동명이인', organization:'가상 대학', position:'직원', role:'면접위원' }
], applicants:[{name:'PRIVATE_APPLICANT'}] };
const session = { id:'s1', date:'2026-10-12', start:'17:00', end:'18:00', venue:{campus:'ERICA',buildingId:'101',building:'본관',room:'가상 201호',waitingRoom:'가상 202호',reception:'가상 로비'} };

test('명패 roster은 안정 ID를 사용하고 위원 연락처/메모 및 지원자를 제외한다', () => {
  const packet = nameplatePayload(project);
  assert.equal(packet.schemaVersion,1); assert.equal(packet.kind,'roster');
  assert.equal(packet.participants.length,2); assert.notEqual(packet.participants[0].participantId,packet.participants[1].participantId);
  assert.equal(packet.participants[0].position,'주임 · 위원장');
  assert.equal(packet.eventId,'interview-p-integration');
  assert.equal(packet.revision,3); assert.equal(packet.baseRevision,0);
  assert.doesNotMatch(JSON.stringify(packet),/PRIVATE_/);
  assert.deepEqual(JSON.parse(JSON.stringify(packet)),packet);
  assert.notEqual(nameplatePayload(project).transferId,packet.transferId);
});
test('명패 일부 선택 및 ID/빈 이름/분량 오류를 검증한다', () => {
  assert.deepEqual(nameplatePayload(project,['committee-b']).participants.map(p=>p.participantId),['committee-b']);
  assert.throws(()=>nameplatePayload(project,[]),/선택/);
  assert.throws(()=>nameplatePayload({...project,panelists:[{id:'__proto__',name:'test'}]}),/ID/);
  assert.throws(()=>nameplatePayload({...project,panelists:[{id:'valid',name:''}]}),/이름/);
  assert.throws(()=>nameplatePayload({...project,panelists:[{id:'valid',name:'a'.repeat(501)}]}),/500/);
});
test('실제 명패 수신 계약으로 JSON 왕복 검증 (배포 사본에서도 실행)', () => {
  const contract = new URL('./fixtures/nameplate-mach-contract.cjs',import.meta.url);
  const Mach = createRequire(import.meta.url)(contract.pathname);
  const packet=JSON.parse(JSON.stringify(nameplatePayload(project)));
  assert.equal(Mach.validateTransfer(packet),packet);
  assert.throws(()=>Mach.validateTransfer({...packet,participants:packet.participants.map(p=>({...p,contact:'forbidden'}))}));
});
test('새 명패 작업은 실제 maker validator를 통과하고 이후 같은 행사 변경분을 반영한다', () => {
  const maker = createRequire(import.meta.url)(new URL('./fixtures/nameplate-changes.cjs',import.meta.url).pathname);
  const packet=JSON.parse(JSON.stringify(nameplateProjectPayload(project)));
  assert.equal(maker.validateProject(packet),true);
  assert.equal(packet.mach.eventId,'interview-p-integration');
  assert.equal(packet.people[0].position,'주임 · 위원장');
  assert.doesNotMatch(JSON.stringify(packet),/PRIVATE_/);
  const next=nameplatePayload({...project,revision:4,panelists:project.panelists.map((p,i)=>i? p:{...p,position:'팀장'})});
  const rows=maker.review(packet,next);
  assert.equal(rows.length,1);
  assert.equal(rows[0].conflicts.length,0);
  const applied=maker.apply(packet,next,{'committee-a':{selected:true,fields:{}}});
  assert.equal(applied.people[0].position,'팀장 · 위원장');
  assert.equal(applied.people.length,2);
  assert.deepEqual(applied.customLogos,[]);
});
test('안내문 native 작업 JSON은 기존 import 형태이며 사용자 문구를 안전한 rich HTML로 보낸다', () => {
  const packet=noticePayload(project,session,'대기실','← 왼쪽');
  assert.equal(packet.app,'notice-maker'); assert.equal(packet.version,'1.7.0');
  assert.equal(packet.state.orientation,'landscape');
  assert.match(packet.state.body,/가상 202호/); assert.doesNotMatch(packet.state.body,/가상 201호/);
  assert.equal(packet.state.subtitle,'면접 &amp; &lt;검증&gt;<strong></strong>');
  assert.match(packet.state.body,/← 왼쪽/); assert.doesNotMatch(JSON.stringify(packet),/PRIVATE_/);
  assert.deepEqual(JSON.parse(JSON.stringify(packet)),packet);
  assert.throws(()=>noticePayload(project,session,'unsupported'),/유형/);
});
test('20명 프로젝트의 선택 위원과 회차별 장소·일시는 지원자 개인정보 없이 전달된다', () => {
  const p={...project, applicants:Array.from({length:20},(_,i)=>({id:`private-${i}`,name:`PRIVATE_APPLICANT_${i}`,contact:`PRIVATE_CONTACT_${i}`}))};
  const sessions=[session,{...session,id:'s2',date:'2026-10-13',start:'09:00',end:'12:00',venue:{buildingId:'103',room:'301호',waitingRoom:'302호',reception:'3층 로비'}}];
  const names=nameplatePayload(p,['committee-b']);
  assert.deepEqual(names.participants,[{participantId:'committee-b',name:'동명이인',organization:'가상 대학',position:'직원 · 면접위원',status:'attending'}]);
  for(const s of sessions){
    for(const [type,expected] of [['면접실',s.venue.room],['대기실',s.venue.waitingRoom],['접수처',s.venue.reception]]){
      const notice=noticePayload(p,s,type,'→ 해당 층');
      assert.match(notice.state.body,new RegExp(expected));
      assert.ok(notice.state.body.includes(s.date));
      assert.ok(notice.state.body.includes(`${s.start} ~ ${s.end}`));
      assert.ok(notice.state.body.includes(locationInfo(s).building));
      assert.ok(notice.state.body.includes('→ 해당 층'));
      assert.doesNotMatch(JSON.stringify(notice),/PRIVATE_/);
    }
  }
});
test('사이니지 native 작업 JSON은 지원자와 위원 개인정보 없이 행사명/일시/장소만 포함한다', () => {
  const packet=signagePayload(project,session);
  assert.equal(packet.app,'digital-signage-maker'); assert.equal(packet.state.layout,'warm-welcome');
  assert.equal(packet.state.template,23); assert.deepEqual(packet.playlist,[]);
  assert.match(packet.state.body,/본관 가상 201호/); assert.doesNotMatch(JSON.stringify(packet),/PRIVATE_|동명이인/);
});
test('지도 데이터 52개는 실제 건물 ID를 유지하며 공개 수신기의 건물 링크를 만든다', () => {
  assert.equal(BUILDINGS.length,52); assert.equal(new Set(BUILDINGS.map(b=>b.id)).size,52);
  assert.equal(BUILDINGS.find(b=>b.id==='101').nameKo,'본관');
  assert.equal(mapLink(session),TOOL_URLS.map+'?building=101');
  assert.equal(mapLink({venue:{buildingId:'INVALID'}}),TOOL_URLS.map);
  assert.match(locationInfo(session).guidance,/101/);
  assert.match(locationInfo(session).structureUrl,/^https:\/\/blog\.naver\.com\//);
});
test('로컬 검증 주소는 localhost 지도만 허용하고 공개 건물 링크와 분리한다', () => {
  assert.equal(mapLink(session,{localBase:'http://127.0.0.1:8765/work/reference/erica-campus-map/'}),'http://127.0.0.1:8765/work/reference/erica-campus-map/?building=101');
  assert.throws(()=>mapLink(session,{localBase:TOOL_URLS.map}),/로컬 지도/);
  assert.throws(()=>mapLink(session,{localBase:'http://localhost:8765/not-a-map/'}),/로컬 지도/);
  assert.equal(mapLink({venue:{buildingId:'INVALID'}},{localBase:'http://localhost:8765/erica-campus-map/'}),TOOL_URLS.map);
});
test('로컬 QR 생성 라이브러리는 URL 문자열로 실제 matrix/SVG를 만든다', () => {
  const source=readFileSync(new URL('../vendor/qrcode.js',import.meta.url),'utf8');
  const context=vm.createContext({}); vm.runInContext(source,context);
  const qr=context.qrcode(0,'M'); qr.addData(TOOL_URLS.map); qr.make();
  assert.ok(qr.getModuleCount()>20); assert.match(qr.createSvgTag(),/^<svg/);
});
test('실제 지도 확장 코드가 등록된 ID만 검색하고 잘못된 ID는 무시한다', () => {
  const block=readFileSync(new URL('./fixtures/campus-map-building-link.js.txt',import.meta.url),'utf8');
  assert.match(block,/BUILDINGS\.find/);
  for(const id of ['101','__proto__','not-a-building']){
    const calls=[]; const context=vm.createContext({BUILDINGS,params:new URLSearchParams({building:id}),searchInput:{value:''},clearBtn:{style:{}},searchBuildings:scroll=>calls.push(scroll)});
    vm.runInContext(block,context);
    assert.equal(calls.length,id==='101'?1:0);
    assert.equal(context.searchInput.value,id==='101'?'101':'');
  }
});
test('파일명에 경로/제어문자와 예약명을 허용하지 않는다', () => {
  assert.equal(filenameSafe('CON'),'면접-자료');
  assert.equal(filenameSafe('면접/명단:name.json'),'면접-명단-name.json');
});
