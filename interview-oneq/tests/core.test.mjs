import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,newSession,newApplicant,createDemo,generateSlots,autoAssign,simulate,
  validateMove,moveApplicant,sessionConflicts,scoreWarnings,evaluationSummary,
  captureSchedule,trackChanges,confirmSchedule,recordPrint,stalePrints,cloneProject,
  validateBackup,exportBackup,toMinutes,toTime,validDate,getApplicantTiming,purgeApplicantData,sessionErrors,
} from '../core.js';

function setup(count=6,overrides={}) {
  const p=createProject();p.sessions=[newSession({date:'2026-10-01',start:'17:00',end:'18:00',...overrides})];
  for(let i=0;i<count;i++)p.applicants.push(newApplicant(p,{name:`지원자 ${i+1}`}));
  return p;
}
test('single-date six applicants use 8-minute interview plus 2-minute turnover',()=>{
  const p=setup();const result=autoAssign(p);
  assert.equal(result.assigned,6);assert.equal(result.unassigned,0);
  assert.deepEqual(p.applicants.map(a=>a.assignment.start),['17:00','17:10','17:20','17:30','17:40','17:50']);
  assert.deepEqual(generateSlots(p.sessions[0]).map(s=>[s.end,s.blockEnd])[0],['17:08','17:10']);
});
test('10 plus 2 yields five slots, and never silently shortens interviews',()=>{
  const p=setup(6,{interviewMinutes:10});const r=autoAssign(p);
  assert.equal(r.assigned,5);assert.equal(r.unassigned,1);assert.equal(simulate(p).shortage,1);
  assert.equal(generateSlots(p.sessions[0]).at(-1).start,'17:48');
});
test('multiple dates and sessions are all used in chronological order',()=>{
  const p=setup(8);const first=p.sessions[0];const second=newSession({date:'2026-10-02',start:'09:00',end:'10:00'});p.sessions=[second,first];
  assert.equal(autoAssign(p).assigned,8);assert.equal(p.applicants[0].assignment.sessionId,first.id);assert.equal(p.applicants[7].assignment.sessionId,second.id);
});
test('date-specific unavailable interval is enforced; adjacent boundary is allowed',()=>{
  const p=setup(1);p.applicants[0].unavailable=[{date:'2026-10-01',start:'17:00',end:'17:20'}];autoAssign(p);
  assert.equal(p.applicants[0].assignment.start,'17:20');
});
test('available date and full interview interval must fit',()=>{
  const p=setup(1);p.applicants[0].available=[{date:'2026-10-01',start:'17:05',end:'17:18'}];autoAssign(p);
  assert.equal(p.applicants[0].assignment.start,'17:10');
  p.applicants[0].available[0].end='17:17';autoAssign(p);assert.equal(p.applicants[0].assignment,null);
});
test('date-only condition and recurring time condition work',()=>{
  const p=setup(1);p.sessions.push(newSession({date:'2026-10-02',start:'09:00',end:'10:00'}));p.applicants[0].available=[{date:'2026-10-02',start:'',end:''}];autoAssign(p);assert.equal(p.applicants[0].assignment.sessionId,p.sessions[1].id);
  p.applicants[0].available=[{date:'',start:'17:20',end:'17:40'}];autoAssign(p);assert.equal(p.applicants[0].assignment.start,'17:20');
});
test('fixed and locked applicant assignments are preserved across reallocation',()=>{
  const p=setup();autoAssign(p);const fixed=p.applicants[2],locked=p.applicants[4];fixed.fixed=true;locked.locked=true;
  const snapshot=[{...fixed.assignment},{...locked.assignment}];p.applicants.reverse();autoAssign(p);
  assert.deepEqual([fixed.assignment,locked.assignment],snapshot);assert.equal(new Set(p.applicants.map(a=>a.assignment.start)).size,6);
});
test('invalid preserved assignment stays visible with actionable issue',()=>{
  const p=setup(2);autoAssign(p);p.applicants[0].locked=true;p.sessions[0].start='17:20';const r=autoAssign(p);
  assert.equal(p.applicants[0].assignment.start,'17:00');assert.ok(r.issues.some(i=>i.applicantId===p.applicants[0].id));assert.equal(confirmSchedule(p).valid,false);
});
test('unassigned locked applicant is not silently assigned',()=>{
  const p=setup(1);p.applicants[0].locked=true;assert.equal(autoAssign(p).unassigned,1);
});
test('group of three per 20 minute slot is 9 applicants per hour',()=>{
  const p=setup(10,{interviewMinutes:18,turnoverMinutes:2,mode:'group',groupSize:3});const r=autoAssign(p);
  assert.equal(r.assigned,9);assert.equal(r.unassigned,1);assert.equal(generateSlots(p.sessions[0]).length,3);
  const counts={};for(const a of p.applicants)if(a.assignment)counts[a.assignment.start]=(counts[a.assignment.start]||0)+1;
  assert.deepEqual(counts,{'17:00':3,'17:20':3,'17:40':3});
});
test('break crossing a block skips full block; resumes at break end',()=>{
  const p=setup(6,{breaks:[{start:'17:15',end:'17:25'}]});
  assert.deepEqual(generateSlots(p.sessions[0]).map(s=>s.start),['17:00','17:25','17:35','17:45']);
  assert.equal(autoAssign(p).unassigned,2);
});
test('overlapping breaks are treated as union without infinite loop',()=>{
  const p=setup(1,{breaks:[{start:'17:10',end:'17:30'},{start:'17:20',end:'17:40'}]});
  assert.deepEqual(generateSlots(p.sessions[0]).map(s=>s.start),['17:00','17:40','17:50']);
});
test('augmenting matching fills schedule that greedy first fit would leave short',()=>{
  const p=setup(3,{start:'09:00',end:'09:30'});
  p.applicants[0].available=[{date:'',start:'09:00',end:'09:20'}];
  for(const a of p.applicants.slice(1))a.unavailable=[{date:'',start:'09:10',end:'09:20'}];
  assert.equal(autoAssign(p).assigned,3);assert.equal(p.applicants[0].assignment.start,'09:10');
});
test('fields restrict allocation and canceled candidates consume no capacity',()=>{
  const p=setup(3,{end:'17:20',field:'행정'});p.applicants[0].field='행정';p.applicants[1].field='디자인';p.applicants[2].field='행정';p.applicants[2].status='참여취소';
  const r=autoAssign(p);assert.equal(r.assigned,1);assert.equal(r.unassigned,1);assert.equal(p.applicants[1].assignment,null);
});
test('manual move validates capacity, lock, unknown slots and constraints',()=>{
  const p=setup(2);autoAssign(p);const [a,b]=p.applicants;
  assert.equal(validateMove(p,a.id,b.assignment).valid,false);a.locked=true;assert.equal(moveApplicant(p,a.id,null).valid,false);a.locked=false;
  assert.equal(moveApplicant(p,a.id,{sessionId:p.sessions[0].id,start:'17:21'}).valid,false);
  const next=newSession({date:'2026-10-02',start:'14:00',end:'15:00'});p.sessions.push(next);assert.equal(moveApplicant(p,a.id,{sessionId:next.id,start:'14:00'}).valid,true);
});
test('different panelists across sessions; overlapping same panelist causes conflict',()=>{
  const p=setup(1);p.panelists=[{id:'a',name:'위원 A'},{id:'b',name:'위원 B'}];p.sessions[0].panelistIds=['a'];
  p.sessions.push(newSession({date:'2026-10-01',start:'17:30',end:'18:30',panelistIds:['b']}));assert.equal(sessionConflicts(p).length,0);
  p.sessions[1].panelistIds.push('a');assert.equal(sessionConflicts(p)[0].type,'panelist');p.sessions[1].date='2026-10-02';assert.equal(sessionConflicts(p).length,0);
});
test('room use time is checked separately from interview time',()=>{
  const p=setup(1,{venue:{building:'본관',room:'101',useStart:'16:00',useEnd:'18:30'}});
  p.sessions.push(newSession({date:'2026-10-01',start:'18:30',end:'19:00',venue:{building:'본관',room:'101',useStart:'18:00',useEnd:'19:30'}}));
  assert.equal(sessionConflicts(p)[0].type,'room');p.sessions[1].venue.room='102';assert.equal(sessionConflicts(p).length,0);
});
test('scoring target mismatch and invalid maximum produce warnings',()=>{
  const p=setup(1);assert.equal(scoreWarnings(p).length,0);p.criteria[0].max=10;assert.match(scoreWarnings(p)[0],/90/);p.criteria[0].max=-1;assert.equal(scoreWarnings(p).length,2);
});
test('missing scores are not zero; zero is a completed explicit score',()=>{
  const p=setup(1);p.panelists=[{id:'panel',name:'위원'}];p.sessions[0].panelistIds=['panel'];autoAssign(p);const a=p.applicants[0];
  a.evaluations.panel={scores:{},comment:''};assert.equal(evaluationSummary(p,a).complete,false);assert.equal(evaluationSummary(p,a).average,null);
  for(const c of p.criteria)a.evaluations.panel.scores[c.id]=0;
  assert.equal(evaluationSummary(p,a).complete,true);assert.equal(evaluationSummary(p,a).average,0);
  a.evaluations.panel.scores[p.criteria[0].id]='';assert.equal(evaluationSummary(p,a).complete,false);
  a.evaluations.panel.scores[p.criteria[0].id]=999;assert.equal(evaluationSummary(p,a).evaluations[0].invalid.length,1);
});
test('missing panelist is reported per actual session participation',()=>{
  const p=setup(1);p.panelists=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];p.sessions[0].panelistIds=['a','b'];autoAssign(p);
  p.applicants[0].evaluations.a={scores:Object.fromEntries(p.criteria.map(c=>[c.id,10]))};const summary=evaluationSummary(p,p.applicants[0]);
  assert.equal(summary.expected,2);assert.equal(summary.countComplete,1);assert.deepEqual(summary.missingPanelists.map(p=>p.name),['B']);assert.equal(summary.average,null);
});
test('confirmation refuses unassigned applicants and accepts valid schedule',()=>{
  const p=setup(1);assert.equal(confirmSchedule(p).valid,false);autoAssign(p);assert.equal(confirmSchedule(p).valid,true);assert.equal(p.confirmed,true);
});
test('confirmed date/time/venue/material changes create reannouncement and stale print',()=>{
  const p=setup(2);autoAssign(p);confirmSchedule(p);p.applicants[0].message.sent=true;p.applicants[0].resultConfirmed=true;
  recordPrint(p,'committee');const before=captureSchedule(p);p.applicants[0].assignment.start='17:20';const changes=trackChanges(p,before,'시간 이동');
  assert.equal(changes.length,1);assert.equal(changes[0].before.start,'17:00');assert.equal(changes[0].after.start,'17:20');assert.equal(p.applicants[0].message.needsUpdate,true);assert.equal(p.applicants[0].resultConfirmed,false);assert.equal(p.applicants[1].message.needsUpdate,false);assert.equal(stalePrints(p).length,1);
  const second=captureSchedule(p);p.materials='신분증';trackChanges(p,second);assert.equal(p.history.length,3);
});
test('generation does not equal sending; noop changes do not stale prints',()=>{
  const p=setup(1);autoAssign(p);p.applicants[0].message.generated=true;assert.equal(p.applicants[0].message.sent,false);recordPrint(p,'evaluation');const before=captureSchedule(p);trackChanges(p,before);assert.equal(stalePrints(p).length,0);
});
test('releasing confirmation does not disable change history for previously sent applicants',()=>{
  const p=setup(1);autoAssign(p);confirmSchedule(p);p.applicants[0].message.sent=true;
  const release=captureSchedule(p);p.confirmed=false;trackChanges(p,release,'확정 해제');
  const before=captureSchedule(p);p.sessions[0].venue.waitingRoom='변경 대기실';trackChanges(p,before,'장소 변경');
  assert.equal(p.applicants[0].message.needsUpdate,true);assert.equal(p.history.at(-1).after.waitingRoom,'변경 대기실');
});
test('privacy purge removes confirmed applicant data and audit snapshots permanently',()=>{
  const p=setup(1);autoAssign(p);confirmSchedule(p);p.applicants[0].name='삭제대상고유이름';p.applicants[0].contact='삭제대상연락처';p.resultsConfirmedAt=new Date().toISOString();
  const before=captureSchedule(p);p.materials='준비물 변경';trackChanges(p,before);recordPrint(p,'operator');const version=p.revision;
  purgeApplicantData(p);assert.equal(p.applicants.length,0);assert.equal(p.history.length,0);assert.equal(p.prints.length,0);assert.equal(p.confirmed,false);assert.equal(p.confirmedAt,null);assert.equal(p.resultsConfirmedAt,null);assert.equal(p.revision,version+1);assert.equal(p.sessions.length,1);assert.equal(p.criteria.length,5);
  const backup=exportBackup([p]);assert.equal(backup.includes('삭제대상'),false);assert.equal(validateBackup(backup).valid,true);
});
test('changes to score or evaluation criteria invalidate confirmed results',()=>{
  const p=setup(1);autoAssign(p);p.applicants[0].result='합격';p.applicants[0].resultConfirmed=true;
  const before=captureSchedule(p);p.criteria[0].description='수정한 판단 기준';trackChanges(p,before);assert.equal(p.applicants[0].resultConfirmed,false);
  p.applicants[0].resultConfirmed=true;const second=captureSchedule(p);p.applicants[0].evaluations.a={scores:{motivation:10}};trackChanges(p,second);assert.equal(p.applicants[0].resultConfirmed,false);
});
test('only confirmed reprinting clears stale warning for the corresponding packet scope',()=>{
  const p=setup(1);recordPrint(p,'panel',{sessionId:p.sessions[0].id});recordPrint(p,'operator');const before=captureSchedule(p);p.name='수정';trackChanges(p,before);
  const newer=recordPrint(p,'panel',{sessionId:p.sessions[0].id});assert.equal(stalePrints(p).length,2);newer.confirmed=true;assert.equal(stalePrints(p).length,1);assert.equal(stalePrints(p)[0].kind,'operator');
});
test('group simulation reports extra slots in group units',()=>{
  const p=setup(13,{interviewMinutes:18,turnoverMinutes:2,mode:'group',groupSize:3});const summary=simulate(p);assert.equal(summary.shortage,4);assert.equal(summary.neededSlots,2);assert.equal(summary.neededSlotsBasis,3);
});
test('arrival recommendation does not alter confirmed interview time',()=>{
  const p=setup(1,{arrivalMinutes:15});autoAssign(p);assert.equal(getApplicantTiming(p,p.applicants[0]).arrival,'16:45');p.applicants[0].status='지각';assert.equal(p.applicants[0].assignment.start,'17:00');assert.equal(p.applicants[0].result,'미정');
});
test('past project cloning excludes applicants, scores, contacts and results',()=>{
  const p=createDemo();p.panelists[0].contact='010-private';p.applicants[0].contact='private-candidate';p.applicants[0].result='합격';p.applicants[0].evaluations={private:'score'};p.inquiry='010-inquiry';p.protocol='공통 진행 순서';p.operatingNotes='과거 면접의 운영자 내부 메모';
  const copied=cloneProject(p,{panelists:true,venue:true});assert.equal(copied.applicants.length,0);assert.equal(copied.panelists[0].contact,'');assert.equal(copied.confirmed,false);assert.equal(copied.inquiry,'');assert.equal(copied.sessions[0].date,'');assert.notEqual(copied.panelists[0].id,p.panelists[0].id);assert.equal(copied.sessions[0].panelistIds[0],copied.panelists[0].id);assert.equal(copied.history.length,0);assert.equal(copied.prints.length,0);
  copied.criteria[0].max=5;assert.equal(p.criteria[0].max,20);assert.equal(cloneProject(p).panelists.length,0);assert.equal(cloneProject(p).sessions[0].venue.building,'');assert.equal(copied.protocol,p.protocol);assert.equal(copied.operatingNotes,'');
});
test('backup roundtrip and internal duplicate IDs rejection',()=>{
  const p=createDemo(),backup=exportBackup([p]),result=validateBackup(backup);assert.deepEqual(result.errors,[]);assert.equal(result.valid,true);assert.deepEqual(result.projects,[p]);result.projects[0].name='changed';assert.notEqual(p.name,'changed');
  const altered=JSON.parse(backup);altered.projects[0].applicants[1].id=altered.projects[0].applicants[0].id;assert.equal(validateBackup(altered).valid,false);
});
test('backup rejects malformed structures, dangling references and prototype keys',()=>{
  assert.equal(validateBackup('{}').valid,false);assert.equal(validateBackup('oops').valid,false);
  const bad=JSON.parse(exportBackup([createDemo()]));bad.projects[0].applicants[0].assignment.sessionId='missing';assert.equal(validateBackup(bad).valid,false);
  const poison=exportBackup([createDemo()]).replace('"version": 1','"version": 1, "__proto__": {"polluted": true}');assert.equal(validateBackup(poison).valid,false);assert.equal({}.polluted,undefined);
});
test('editing criterion max preserves old score through backup but marks evaluation incomplete',()=>{
  const p=createDemo(),a=p.applicants[0],panel=p.sessions.find(s=>s.id===a.assignment.sessionId).panelistIds[0],criterion=p.criteria[0];a.evaluations[panel]={scores:{[criterion.id]:20}};criterion.max=10;
  const restored=validateBackup(exportBackup([p]));assert.equal(restored.valid,true);assert.equal(restored.projects[0].applicants[0].evaluations[panel].scores[criterion.id],20);assert.equal(evaluationSummary(p,a).complete,false);
});
test('backup criteria limits match the editable A4 form: ten items and eighty-character labels',()=>{
  const p=createProject();p.criteria=Array.from({length:10},(_,i)=>({id:`c-${i}`,label:'가'.repeat(80),max:10,description:'',rubric:''}));
  assert.equal(validateBackup(exportBackup([p])).valid,true);
  p.criteria.push({id:'c-10',label:'추가 항목',max:10,description:'',rubric:''});assert.equal(validateBackup(exportBackup([p])).valid,false);
  p.criteria.pop();p.criteria[0].label='가'.repeat(81);assert.equal(validateBackup(exportBackup([p])).valid,false);
});
test('backup refuses blank applicant names',()=>{
  const p=setup(1);p.applicants[0].name='   ';const result=validateBackup(exportBackup([p]));assert.equal(result.valid,false);assert.ok(result.errors.some(error=>error.includes('이름이 비어')));
});
test('optional printable project text accepts strings only, bounded at ten thousand characters',()=>{
  for(const key of ['protocol','customDisplay','operatingNotes']) {
    const p=createProject();p[key]='가'.repeat(10000);assert.equal(validateBackup(exportBackup([p])).valid,true,key);
    p[key]='가'.repeat(10001);assert.equal(validateBackup(exportBackup([p])).valid,false,key);
    p[key]={text:'잘못된 객체'};assert.equal(validateBackup(exportBackup([p])).valid,false,key);
    delete p[key];assert.equal(validateBackup(exportBackup([p])).valid,true,key);
  }
});
test('same name candidates receive different internal IDs and numbers',()=>{
  const p=createProject();p.applicants.push(newApplicant(p,{name:'김하늘'}));p.applicants.push(newApplicant(p,{name:'김하늘'}));assert.notEqual(p.applicants[0].id,p.applicants[1].id);assert.notEqual(p.applicants[0].number,p.applicants[1].number);
});
test('invalid time/date values are refused, not clamped into a schedule',()=>{
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);assert.ok(Number.isNaN(toMinutes('24:00')));assert.equal(toTime(1440),'');assert.equal(generateSlots(newSession({date:'2026-10-01',interviewMinutes:0})).length,0);
});
test('individual sessions reject invalid inactive group size before it can corrupt a reload',()=>{
  const session=newSession({date:'2026-10-01',mode:'individual',groupSize:0});assert.ok(sessionErrors(session).some(message=>message.includes('조별 인원')));assert.equal(generateSlots(session).length,0);
  session.groupSize=3;assert.deepEqual(sessionErrors(session),[]);assert.equal(generateSlots(session)[0].capacity,1);
});

test('decimal score totals allow floating point rounding but still reject real mismatches',()=>{
  const p=setup(1);p.criteria=[{id:'a',label:'A',max:0.1},{id:'b',label:'B',max:0.2}];p.targetScore=0.3;
  assert.deepEqual(scoreWarnings(p),[]);p.criteria[1].max=0.21;assert.match(scoreWarnings(p).join(' '),/합계/);
  p.targetScore=NaN;assert.match(scoreWarnings(p).join(' '),/목표 총점/);
});
test('invalidating a confirmed session reopens confirmation while retaining assignments and sent history',()=>{
  const p=setup(2);autoAssign(p);confirmSchedule(p);const a=p.applicants[0];a.message.sent=true;a.locked=true;
  const assigned=structuredClone(a.assignment),confirmedAt=p.confirmedAt,before=captureSchedule(p);p.sessions[0].start='17:05';trackChanges(p,before,'회차 시작 변경');
  assert.equal(p.confirmed,false);assert.equal(p.confirmedAt,confirmedAt);assert.deepEqual(a.assignment,assigned);
  assert.equal(a.message.needsUpdate,true);assert.equal(a.locked,true);assert.equal(confirmSchedule(p).valid,false);
});
test('adding an unassigned applicant reopens confirmation without removing the prior schedule',()=>{
  const p=setup(1);autoAssign(p);confirmSchedule(p);const before=captureSchedule(p),assignment=structuredClone(p.applicants[0].assignment);
  p.applicants.push(newApplicant(p,{name:'추가 지원자'}));trackChanges(p,before,'지원자 추가');
  assert.equal(p.confirmed,false);assert.deepEqual(p.applicants[0].assignment,assignment);autoAssign(p);assert.equal(confirmSchedule(p).valid,true);
});
test('valid venue change keeps a confirmed timetable and flags previously sent notices',()=>{
  const p=setup(1);autoAssign(p);confirmSchedule(p);p.applicants[0].message.sent=true;const before=captureSchedule(p);
  p.sessions[0].venue.room='305호';trackChanges(p,before,'장소 변경');assert.equal(p.confirmed,true);assert.equal(p.applicants[0].message.needsUpdate,true);
});
test('interview-room and waiting-room conflicts are detected, while a shared waiting room is allowed',()=>{
  const p=setup(0,{venue:{building:'학생회관',buildingId:'student',room:'201호',waitingRoom:'202호'}});
  p.sessions.push(newSession({date:'2026-10-01',start:'17:00',end:'18:00',venue:{building:'학생회관',room:'202호',waitingRoom:'203호'}}));
  assert.equal(sessionConflicts(p).length,1);assert.match(sessionConflicts(p)[0].message,/대기실/);assert.equal(confirmSchedule(p).valid,false);
  p.sessions[1].venue.room='204호';p.sessions[1].venue.waitingRoom='202호';assert.equal(sessionConflicts(p).length,0);
});
test('a selected building and its directly entered name still share the same room',()=>{
  const p=setup(0,{venue:{building:'학생회관',buildingId:'student',room:'201호'}});
  p.sessions.push(newSession({date:'2026-10-01',start:'17:00',end:'18:00',venue:{building:'학생회관',room:'201호'}}));
  assert.equal(sessionConflicts(p).length,1);p.sessions[1].venue.campus='서울';assert.equal(sessionConflicts(p).length,0);
});
test('session validation rejects malformed venue windows, arrival offsets and interview modes',()=>{
  for(const venue of [{useStart:'19:00',useEnd:'18:00'},{useStart:'17:10',useEnd:'18:00'},{useStart:'16:00',useEnd:''},{useStart:'oops',useEnd:'19:00'}]) {
    const s=newSession({date:'2026-10-01',start:'17:00',end:'18:00',venue});assert.match(sessionErrors(s).join(' '),/장소 사용시간/);assert.equal(generateSlots(s).length,0);
  }
  assert.match(sessionErrors(newSession({date:'2026-10-01',arrivalMinutes:-1})).join(' '),/도착 권장/);
  assert.match(sessionErrors(newSession({date:'2026-10-01',mode:'unexpected'})).join(' '),/방식/);
});
test('backup rejects venue windows that do not cover the interview but accepts undated copied settings',()=>{
  const p=createDemo();p.sessions[0].venue.useStart='20:00';p.sessions[0].venue.useEnd='10:00';assert.equal(validateBackup(exportBackup([p])).valid,false);
  const copied=cloneProject(createDemo(),{venue:true,panelists:true});assert.equal(validateBackup(exportBackup([copied])).valid,true);
});
test('backup validates optional result-message, exemption, reserve-rank and attendance data',()=>{
  for(const mutate of [
    p=>p.applicants[0].resultMessage='sent',p=>p.applicants[0].resultMessage.sent='true',
    p=>p.applicants[0].evaluationExemptReason={allowed:true},p=>p.applicants[0].changeRequest=[],
    p=>p.applicants[0].reserveRank=0,p=>p.applicants[0].reserveRank=1.5,p=>p.panelists[0].attendance='confirmed',
  ]) {const p=createDemo();mutate(p);assert.equal(validateBackup(exportBackup([p])).valid,false);}
  const p=createDemo();p.applicants[0].reserveRank=1;p.applicants[0].evaluationExemptReason='지원자 참여 취소';p.panelists[0].attendance[p.sessions[0].id]='참석 확정';assert.equal(validateBackup(exportBackup([p])).valid,true);
});
test('twenty-four applicants preserve constraints through mixed individual/group sessions, backup and cloning',()=>{
  const p=setup(24,{start:'09:00',end:'10:00'}),first=p.sessions[0];
  p.sessions.push(newSession({label:'오후',date:'2026-10-01',start:'14:00',end:'15:00'}),newSession({label:'다음 날 조별',date:'2026-10-02',start:'09:00',end:'10:00',mode:'group',groupSize:3,interviewMinutes:13,turnoverMinutes:2}));
  p.applicants[0].unavailable=[{date:first.date,start:'09:00',end:'10:00'}];
  p.applicants[1].assignment={sessionId:first.id,start:'09:30'};p.applicants[1].fixed=true;
  const r=autoAssign(p);assert.equal(r.assigned,24);assert.equal(r.unassigned,0);assert.equal(r.issues.length,0);assert.equal(p.applicants[1].assignment.start,'09:30');assert.notEqual(p.applicants[0].assignment.sessionId,first.id);
  assert.equal(confirmSchedule(p).valid,true);const restored=validateBackup(exportBackup([p]));assert.equal(restored.valid,true);assert.deepEqual(restored.projects[0].applicants,p.applicants);
  const extra=newApplicant(p,{name:'정원 초과 가상지원자'});p.applicants.push(extra);const shortage=autoAssign(p);assert.equal(shortage.unassigned,1);assert.equal(simulate(p).shortage,1);assert.equal(confirmSchedule(p).valid,false);
  const copied=cloneProject(p);assert.equal(copied.applicants.length,0);assert.equal(copied.sessions.length,3);assert.ok(copied.sessions.every(s=>s.date===''));
});
