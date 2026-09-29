/** Development-only synthetic browser regression. No real local browser profile is used.
 * MACH_PLAYWRIGHT_MODULE may point at an installed Playwright index.mjs.
 * MACH_CHROME may point at an existing Chrome/Chromium executable.
 * node tests/browser-e2e.mjs [baseURL] [evidenceDirectory]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {createProject,newSession,newApplicant,autoAssign,confirmSchedule,validateBackup,exportBackup,captureSchedule,trackChanges} from '../core.js';

const {chromium}=process.env.MACH_PLAYWRIGHT_MODULE?await import(pathToFileURL(path.resolve(process.env.MACH_PLAYWRIGHT_MODULE))):await import('playwright');
const baseURL=process.argv[2]||'http://127.0.0.1:4183/';
const out=process.argv[3]?path.resolve(process.argv[3]):await fs.mkdtemp(path.join(tmpdir(),'interview-oneq-browser-qa-'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({...(process.env.MACH_CHROME?{executablePath:process.env.MACH_CHROME}:{}),headless:true});
const STORAGE_KEY='mach:interview-oneq:v1',results=[],contexts=[];
let backupFile;
function fixture({complete=false}={}) {
  const p=createProject();p.name='자동검증용 가상면접';p.field='검증분야';p.owner='가상담당자';p.protocol='위원용 공통 진행 순서';p.operatingNotes='운영자전용_내부메모';
  p.panelists=[{id:'panel-one',name:'가상위원A',organization:'가상부서',position:'담당자',role:'면접위원',contact:'위원비밀연락처',note:'위원내부메모',attendance:{}},{id:'panel-two',name:'가상위원B',organization:'가상부서',position:'담당자',role:'면접위원',contact:'',note:'',attendance:{}}];
  p.sessions=[newSession({id:'session-one',label:'첫째날 오전',date:'2026-10-12',start:'10:00',end:'10:20',panelistIds:['panel-one'],venue:{building:'가상건물',room:'101호',waitingRoom:'102호',reservation:'예약 확정'}}),newSession({id:'session-two',label:'둘째날 오전',date:'2026-10-13',start:'09:00',end:'10:00',panelistIds:['panel-two'],venue:{building:'가상건물',room:'201호',waitingRoom:'202호',reservation:'예약 확정'}})];
  for(let i=0;i<3;i++)p.applicants.push(newApplicant(p,{name:`가상지원자_${i+1}`,contact:`지원자비밀연락처_${i+1}`,note:`지원자내부메모_${i+1}`}));
  autoAssign(p);
  if(complete)for(const a of p.applicants){const panel=p.sessions.find(s=>s.id===a.assignment.sessionId).panelistIds[0];a.evaluations[panel]={scores:Object.fromEntries(p.criteria.map(c=>[c.id,20])),comment:'내부평가의견'};}
  return p;
}
async function launchPage(seed=null,raw=null) {
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});contexts.push(context);
  if(seed||raw!==null)await context.addInitScript(({key,content})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,content);},{key:STORAGE_KEY,content:raw??JSON.stringify({version:1,stamp:'synthetic-test-seed',projects:[seed],activeId:seed.id})});
  const page=await context.newPage();page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')page.errors.push(`console: ${message.text()}`);});
  page.on('response',response=>{if(response.status()>=400)page.errors.push(`HTTP ${response.status()}: ${response.url()}`);});
  page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')page.errors.push(`network: ${request.failure()?.errorText} ${request.url()}`);});
  page.setDefaultTimeout(10000);
  await page.goto(baseURL,{waitUntil:'networkidle'});await page.locator('#app').waitFor();return page;
}
const state=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
const current=async page=>{const s=await state(page);return s.projects.find(p=>p.id===s.activeId);};
const nav=(page,view)=>page.locator(`[data-action="nav"][data-view="${view}"]`).first().click();
const action=(page,name,id)=>page.locator(`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`).first().click();
const submit=async page=>{await page.locator('#dialog button[type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});};
const fill=(page,name,value)=>page.locator(`#dialog [name="${name}"]`).fill(value);
async function downloaded(page,click,fileName) {const event=page.waitForEvent('download');await click();const download=await event;const destination=path.join(out,fileName||download.suggestedFilename());await download.saveAs(destination);assert.equal(await download.failure(),null);return destination;}
async function test(name,callback) {
  const start=Date.now();let page;
  try {page=await callback();if(page)assert.deepEqual(page.errors,[],'Uncaught browser errors');results.push({name,status:'passed',milliseconds:Date.now()-start});console.log(`PASS ${name}`);}
  catch(error){results.push({name,status:'failed',milliseconds:Date.now()-start,error:error.stack});console.error(`FAIL ${name}\n${error.stack}`);}
}
try {
await test('UI creation, typed applicant, and reload preserve independent internal data',async()=>{
  const page=await launchPage();await action(page,'new');await fill(page,'name','UI 입력 보존 시험');await submit(page);await nav(page,'applicants');await action(page,'applicant-add');await fill(page,'name','동명이인테스트');await fill(page,'contact','가상 연락처');await submit(page);
  const first=await current(page);assert.equal(first.applicants.length,1);assert.equal(first.applicants[0].number,'STU-001');await page.reload({waitUntil:'networkidle'});assert.deepEqual((await current(page)).applicants,first.applicants);return page;
});
await test('unseeded panel and session forms create group slots with break, venue, participant and confirmed assignment',async()=>{
  const page=await launchPage();await action(page,'new');await fill(page,'name','처음부터 입력한 그룹면접');await submit(page);
  await nav(page,'panels');await action(page,'panel-add');await fill(page,'name','폼입력 가상위원');await fill(page,'organization','가상 학생지원팀');await fill(page,'position','가상 담당자');await fill(page,'role','위원장');await submit(page);
  const panelId=(await current(page)).panelists[0].id;await nav(page,'sessions');await action(page,'session-add');
  for(const [name,value] of Object.entries({label:'직접 입력한 첫 회차',date:'2026-10-15',start:'17:00',end:'18:00',interviewMinutes:'18',turnoverMinutes:'2',groupSize:'3',arrivalMinutes:'10',field:'검증분야',breaks:'17:20-17:30',room:'가상 101호',waitingRoom:'가상 102호',reception:'가상 1층 접수',useStart:'16:30',useEnd:'18:20'}))await fill(page,name,value);
  await page.locator('#dialog [name="mode"]').selectOption('group');await page.locator('#dialog [name="buildingId"]').selectOption('101');await page.locator('#dialog [name="reservation"]').selectOption('예약 확정');await page.locator(`#dialog [name="panel-${panelId}"]`).check();await submit(page);
  let p=await current(page);assert.equal(p.sessions.length,1);assert.equal(p.sessions[0].venue.building,'본관');assert.equal(p.sessions[0].venue.useStart,'16:30');assert.deepEqual(p.sessions[0].panelistIds,[panelId]);assert.deepEqual(p.sessions[0].breaks,[{start:'17:20',end:'17:30'}]);
  await nav(page,'applicants');for(let i=1;i<=4;i++){await action(page,'applicant-add');await fill(page,'name',`폼입력 가상지원자 ${i}`);await fill(page,'field','검증분야');await submit(page);}
  await nav(page,'schedule');await action(page,'auto-assign');await submit(page);p=await current(page);assert.deepEqual(p.applicants.map(a=>a.assignment.start),['17:00','17:00','17:00','17:30']);await action(page,'confirm-schedule');await submit(page);await page.reload({waitUntil:'networkidle'});p=await current(page);assert.equal(p.confirmed,true);assert.equal(p.applicants.length,4);assert.equal(p.sessions[0].mode,'group');assert.equal(p.sessions[0].interviewMinutes+p.sessions[0].turnoverMinutes,20);assert.equal(await page.locator('#storage-alert').isVisible(),false);return page;
});
await test('actual backup download contains a valid complete project and restores through the file UI',async()=>{
  const page=await launchPage(fixture());await nav(page,'archive');backupFile=await downloaded(page,()=>action(page,'export-project'),'roundtrip-backup.json');const raw=await fs.readFile(backupFile,'utf8'),backup=validateBackup(raw);assert.equal(backup.valid,true);assert.equal(backup.projects[0].applicants.length,3);
  const restored=await launchPage();await action(restored,'restore');await restored.locator('#file-input').setInputFiles(backupFile);await submit(restored);assert.deepEqual((await current(restored)).applicants,backup.projects[0].applicants);await restored.reload({waitUntil:'networkidle'});assert.equal((await current(restored)).applicants.length,3);return restored;
});
await test('clone UI copies settings, protocol and optional pool/venue but no applicant or contact data',async()=>{
  const source=fixture({complete:true}),page=await launchPage(source);await nav(page,'archive');await action(page,'clone',source.id);await fill(page,'name','개인정보 없는 설정 복사');await page.locator('#dialog [name="venue"]').check();await page.locator('#dialog [name="panelists"]').check();await submit(page);
  const p=await current(page);assert.equal(p.applicants.length,0);assert.equal(p.history.length,0);assert.equal(p.prints.length,0);assert.equal(p.panelists.length,2);assert.ok(p.panelists.every(x=>!x.contact&&!x.note));assert.equal(p.sessions[0].date,'');assert.equal(p.protocol,source.protocol);assert.equal(p.operatingNotes,'');return page;
});
await test('manual move across dates and locked applicant survive automatic reassignment',async()=>{
  const source=fixture(),page=await launchPage(source),id=source.applicants[0].id;await nav(page,'schedule');await action(page,'move',id);await page.locator('#dialog [name="slot"]').selectOption('session-two|09:20');await page.locator('#dialog [name="locked"]').check();await submit(page);
  await action(page,'auto-assign');await submit(page);const p=await current(page),a=p.applicants.find(a=>a.id===id);assert.deepEqual(a.assignment,{sessionId:'session-two',start:'09:20'});assert.equal(a.locked,true);assert.ok(p.applicants.every(a=>a.assignment));return page;
});
await test('confirmed send, released confirmation, changes, reannouncement, and printed-version refresh',async()=>{
  const source=fixture(),page=await launchPage(source),id=source.applicants[0].id;await nav(page,'schedule');await action(page,'confirm-schedule');await submit(page);await nav(page,'messages');await action(page,'message-sent',id);await submit(page);assert.equal((await current(page)).applicants[0].message.sent,true);
  await nav(page,'outputs');await action(page,'print-confirm');await submit(page);const oldRevision=(await current(page)).revision;
  await nav(page,'schedule');await action(page,'unconfirm-schedule');await submit(page);await nav(page,'settings');await page.locator('[name="materials"]').fill('변경한 가상 준비물');await page.locator('#settings-form button[type="submit"]').click();let p=await current(page);assert.ok(p.revision>oldRevision);assert.equal(p.applicants[0].message.needsUpdate,true);assert.ok(p.history.some(h=>h.fields.includes('materials')));
  await nav(page,'outputs');assert.ok((await page.locator('main').innerText()).includes('오래된 출력물'));await action(page,'print-confirm');await submit(page);assert.equal((await page.locator('main').innerText()).includes('오래된 출력물'),false);return page;
});
await test('empty evaluation differs from explicit zero and row Save survives reload',async()=>{
  const source=fixture(),page=await launchPage(source),id=source.applicants[0].id;await nav(page,'evaluation');assert.equal((await current(page)).applicants[0].evaluations['panel-one'],undefined);
  for(const c of source.criteria)await page.locator(`[data-score-applicant="${id}"][data-criterion="${c.id}"]`).fill('0');await action(page,'evaluation-save',id);
  let p=await current(page);assert.deepEqual(Object.values(p.applicants[0].evaluations['panel-one'].scores),[0,0,0,0,0]);assert.ok((await page.locator('main').innerText()).includes('평균 0점'));await page.reload({waitUntil:'networkidle'});p=await current(page);assert.equal(p.applicants[0].evaluations['panel-one'].scores[source.criteria[0].id],0);return page;
});
await test('final results require explicit results, reserve rank and two human review checks',async()=>{
  const source=fixture({complete:true}),page=await launchPage(source);await nav(page,'evaluation');await action(page,'finalize-results');assert.ok((await page.locator('#dialog').innerText()).includes('결과 미정'));await submit(page);
  const values=['합격','예비합격','불합격'];for(let i=0;i<3;i++)await page.locator(`[data-result="${source.applicants[i].id}"]`).selectOption(values[i]);await page.locator(`[data-rank="${source.applicants[1].id}"]`).fill('1');await page.locator(`[data-rank="${source.applicants[1].id}"]`).blur();
  await action(page,'finalize-results');await page.locator('#dialog [name="review1"]').check();await page.locator('#dialog button[type="submit"]').click();assert.equal(await page.locator('#dialog').isVisible(),true);assert.ok((await current(page)).applicants.every(a=>!a.resultConfirmed));await page.locator('#dialog [name="review2"]').check();await submit(page);assert.ok((await current(page)).applicants.every(a=>a.resultConfirmed));await nav(page,'messages');await page.locator('#message-template').selectOption('accepted');assert.equal(await page.locator('.message-card').count(),1);return page;
});
await test('actual downloaded public print and waiting screen omit names, contacts, notes and evaluation',async()=>{
  const source=fixture({complete:true}),page=await launchPage(source);await nav(page,'outputs');await page.locator('#print-kind').selectOption('public');const file=await downloaded(page,()=>action(page,'print-download'),'public-output.html');const html=await fs.readFile(file,'utf8');assert.ok(html.includes(source.applicants[0].number));for(const token of ['가상지원자_','지원자비밀연락처','지원자내부메모','위원비밀연락처','내부평가의견','운영자전용_내부메모'])assert.equal(html.includes(token),false,token);
  await nav(page,'operations');await action(page,'waiting-display');const text=await page.locator('#app').innerText();for(const token of ['가상지원자_','지원자비밀연락처','지원자내부메모','내부평가의견'])assert.equal(text.includes(token),false,token);assert.ok(text.indexOf(source.applicants[0].number)<text.indexOf(source.applicants[2].number));await page.screenshot({path:path.join(out,'public-waiting.png'),fullPage:true});return page;
});
await test('CSV and real XLSX imports pass through actual file controls with same-name identities',async()=>{
  const source=fixture(),page=await launchPage(source),csv=path.join(out,'synthetic-applicants.csv');await fs.writeFile(csv,'\uFEFF지원자번호,이름,연락처,지원분야\nCSV-001,가상동명이인,,검증분야\nCSV-002,가상동명이인,,검증분야');await nav(page,'applicants');await action(page,'import-applicants');await page.locator('#file-input').setInputFiles(csv);await submit(page);let p=await current(page);assert.equal(p.applicants.length,5);assert.notEqual(p.applicants[3].id,p.applicants[4].id);
  const context={console};vm.createContext(context);vm.runInContext(readFileSync(new URL('../vendor/xlsx.full.min.js',import.meta.url),'utf8'),context);const XLSX=context.XLSX,sheet=XLSX.utils.aoa_to_sheet([['지원자번호','이름'],[7,'가상엑셀지원자']]);sheet.A2.z='0000';const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'지원자');const xlsx=path.join(out,'synthetic-applicants.xlsx');await fs.writeFile(xlsx,Buffer.from(XLSX.write(wb,{bookType:'xlsx',type:'array'})));await action(page,'import-applicants');await page.locator('#file-input').setInputFiles(xlsx);await submit(page);p=await current(page);assert.equal(p.applicants.length,6);assert.equal(p.applicants[5].number,'0007');return page;
});
await test('deleting a scored criterion archives old score and remains reloadable',async()=>{
  const source=fixture({complete:true}),page=await launchPage(source),criterion=source.criteria[0];await nav(page,'questions');await action(page,'criterion-delete',criterion.id);await submit(page);await page.reload({waitUntil:'networkidle'});const p=await current(page);assert.equal(p.criteria.length,4);assert.equal(p.applicants[0].evaluations['panel-one'].scores[criterion.id],undefined);assert.equal(p.applicants[0].evaluations['panel-one'].archivedScores[0].score,20);assert.equal(await page.locator('#storage-alert').isVisible(),false);return page;
});
await test('corrupted saved JSON is preserved as download and recoverable using a validated backup',async()=>{
  assert.ok(backupFile);const page=await launchPage(null,'{synthetic-invalid-json');assert.equal(await page.locator('#storage-alert').isVisible(),true);await action(page,'restore');await page.locator('#file-input').setInputFiles(backupFile);const raw=await downloaded(page,()=>submit(page),'corrupted-original-preserved.json');assert.equal(await fs.readFile(raw,'utf8'),'{synthetic-invalid-json');assert.equal((await current(page)).applicants.length,3);assert.equal(await page.locator('#storage-alert').isVisible(),false);return page;
});
await test('confirmed-project privacy purge leaves no applicants, score archives, audit snapshots or output records',async()=>{
  const source=fixture({complete:true});confirmSchedule(source);const before=captureSchedule(source);source.materials='변경된 준비물';trackChanges(source,before);const page=await launchPage(source);await nav(page,'archive');await action(page,'purge-applicants');await submit(page);await page.reload({waitUntil:'networkidle'});const p=await current(page);assert.equal(p.applicants.length,0);assert.equal(p.history.length,0);assert.equal(p.prints.length,0);assert.equal(p.confirmedAt,null);assert.equal(JSON.stringify(p).includes('가상지원자_'),false);assert.equal(p.sessions.length,2);return page;
});
await test('actual tool handoff downloads respect original schemas and exclude applicant/contact data',async()=>{
  const page=await launchPage(fixture());await nav(page,'outputs');for(const [actionName,fileName,expected] of [['nameplates','nameplate-handoff.json','nameplate-maker'],['notice-tool','notice-handoff.json','notice-maker'],['signage-tool','signage-handoff.json','digital-signage-maker']]){await action(page,actionName);const file=await downloaded(page,()=>submit(page),fileName),text=await fs.readFile(file,'utf8'),data=JSON.parse(text);assert.equal(data.kind||data.app,expected);for(const token of ['가상지원자_','지원자비밀연락처','위원비밀연락처','운영자전용_내부메모'])assert.equal(text.includes(token),false,token);}return page;
});
await test('cancelled applicants disappear from interview notices without losing assignment or other applicants',async()=>{
  const source=fixture(),page=await launchPage(source),id=source.applicants[0].id,oldAssignment=source.applicants[0].assignment;
  await nav(page,'operations');await page.locator(`[data-status="${id}"]`).selectOption('참여취소');await nav(page,'messages');
  assert.equal(await page.locator('.message-card').count(),2);assert.equal(await page.locator(`[data-action="message-copy"][data-id="${id}"]`).count(),0);
  assert.equal((await page.locator('main').innerText()).includes(source.applicants[0].name),false);
  await action(page,'messages-copy');const copied=await page.evaluate(()=>navigator.clipboard.readText());
  assert.equal(copied.includes(source.applicants[0].name),false);assert.ok(copied.includes(source.applicants[1].name));
  const p=await current(page);assert.deepEqual(p.applicants[0].assignment,oldAssignment);assert.equal(p.applicants[0].message.generated,false);assert.ok(p.applicants.slice(1).every(a=>a.message.generated));return page;
});
await test('editing a confirmed session into invalid slots reopens confirmation and preserves sent locked assignments',async()=>{
  const source=fixture(),page=await launchPage(source),id=source.applicants[0].id,oldAssignment=source.applicants[0].assignment;
  await nav(page,'schedule');await action(page,'confirm-schedule');await submit(page);await nav(page,'messages');await action(page,'message-sent',id);await submit(page);
  await nav(page,'sessions');await action(page,'session-edit','session-one');await fill(page,'start','10:05');await submit(page);
  let p=await current(page);assert.equal(p.confirmed,false);assert.equal(p.applicants[0].message.needsUpdate,true);assert.equal(p.applicants[0].locked,true);assert.deepEqual(p.applicants[0].assignment,oldAssignment);
  await nav(page,'schedule');assert.equal(await page.locator('[data-action="confirm-schedule"]').count(),1);await action(page,'confirm-schedule');assert.ok((await page.locator('#dialog').innerText()).includes('사용할 수 없는 시간'));await submit(page);
  await nav(page,'messages');await action(page,'message-sent',id);assert.ok((await page.locator('#toast').innerText()).includes('시간표를 먼저 확정'));assert.equal(await page.locator('#dialog').isVisible(),false);
  await page.reload({waitUntil:'networkidle'});p=await current(page);assert.equal(p.confirmed,false);assert.deepEqual(p.applicants[0].assignment,oldAssignment);return page;
});
await test('nameplate UI defaults to a native new project with names, organization, position and role',async()=>{
  const source=fixture(),page=await launchPage(source);await nav(page,'panels');await action(page,'nameplates');assert.equal(await page.locator('#dialog [name="handoff"]').inputValue(),'project');
  const file=await downloaded(page,()=>submit(page),'native-nameplate-project.json'),data=JSON.parse(await fs.readFile(file,'utf8'));
  const maker=createRequire(import.meta.url)(new URL('./fixtures/nameplate-changes.cjs',import.meta.url).pathname);
  assert.equal(maker.validateProject(data),true);assert.equal(data.app,'nameplate-maker');assert.equal(data.mach.eventId,`interview-${source.id}`);assert.equal(data.people.length,2);
  assert.equal(data.people[0].name,source.panelists[0].name);assert.equal(data.people[0].organization,source.panelists[0].organization);assert.equal(data.people[0].position,`${source.panelists[0].position} · ${source.panelists[0].role}`);
  assert.doesNotMatch(JSON.stringify(data),/가상지원자_|지원자비밀연락처|위원비밀연락처/);return page;
});
await test('nameplate UI roster option produces a valid same-event incremental update',async()=>{
  const source=fixture(),page=await launchPage(source);await nav(page,'outputs');await action(page,'nameplates');await page.locator('#dialog [name="handoff"]').selectOption('roster');
  const file=await downloaded(page,()=>submit(page),'nameplate-roster-update.json'),data=JSON.parse(await fs.readFile(file,'utf8'));
  const contract=createRequire(import.meta.url)(new URL('./fixtures/nameplate-mach-contract.cjs',import.meta.url).pathname);assert.equal(contract.validateTransfer(data),data);
  assert.equal(data.kind,'roster');assert.equal(data.eventId,`interview-${source.id}`);assert.equal(data.participants.length,2);assert.deepEqual(data.participants.map(p=>p.participantId),source.panelists.map(p=>p.id));
  assert.doesNotMatch(JSON.stringify(data),/가상지원자_|지원자비밀연락처|위원비밀연락처/);return page;
});
await test('mobile operations expose full-width touch controls without overflow and preserve changed status on reload',async()=>{
  const source=fixture(),page=await launchPage(source),id=source.applicants[0].id,assignment=source.applicants[0].assignment;
  await page.setViewportSize({width:390,height:844});await nav(page,'operations');
  for(const width of [390,360]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`page overflow at ${width}px`);
    for(const control of await page.locator('.operations-list select[data-status]').all()){
      const box=await control.boundingBox();assert.ok(box&&box.width>=200,`mobile status width ${box?.width}`);assert.ok(box.height>=44,`mobile status height ${box.height}`);
    }
  }
  await page.setViewportSize({width:390,height:844});
  for(const status of ['도착·대기','면접 중','완료','지각','결시']){
    await page.locator(`[data-status="${id}"]`).selectOption(status);assert.equal((await current(page)).applicants[0].status,status);
  }
  await page.reload({waitUntil:'networkidle'});await nav(page,'operations');assert.equal(await page.locator(`[data-status="${id}"]`).inputValue(),'결시');assert.deepEqual((await current(page)).applicants[0].assignment,assignment);assert.equal((await current(page)).applicants[0].result,'미정');
  await page.screenshot({path:path.join(out,'mobile-operations-final.png'),fullPage:true});return page;
});
} finally {
  for(const context of contexts)await context.close();await browser.close();
  const report={baseURL,executedAt:new Date().toISOString(),browser:'Headless Chrome via Playwright, isolated synthetic contexts',total:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,results};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,evidence:out}));if(report.failed)process.exitCode=1;
}
