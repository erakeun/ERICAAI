import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createProject,newApplicant} from '../core.js';
import {parseDelimited,parseTimeRanges,normalizeApplicantRows,importRows,importFile} from '../import.js';

test('CSV supports quoted commas, embedded newline, escaped quotes and BOM',()=>{
  assert.deepEqual(parseDelimited('\uFEFF이름,비고\r\n김하늘,"쉼표, 포함\n둘째 줄 ""확인"""'),[['이름','비고'],['김하늘','쉼표, 포함\n둘째 줄 "확인"']]);
  assert.throws(()=>parseDelimited('이름\n"김하늘'),/따옴표/);
});
test('TSV paste and no-header columns produce pure import preview',()=>{
  const p=createProject(),raw=parseDelimited('김하늘\t010-0000\t홍보\t메모\n김하늘\t\t행정\t');const result=importRows(p,raw);
  assert.equal(result.errors.length,0);assert.equal(result.applicants.length,2);assert.equal(result.applicants[0].name,'김하늘');assert.equal(result.applicants[0].contact,'010-0000');assert.equal(p.applicants.length,0);assert.notEqual(result.applicants[0].id,result.applicants[1].id);assert.match(result.warnings.join(' '),/동명이인/);
});
test('provided numbers are reserved before automatically assigning missing numbers',()=>{
  const result=importRows(createProject(),[['지원자번호','이름'],['','자동'],['STU-001','기존']]);assert.equal(result.applicants[0].number,'STU-002');assert.equal(result.applicants[1].number,'STU-001');
});
test('duplicates against existing applicants or inside import block commit',()=>{
  const p=createProject();p.applicants.push(newApplicant(p,{name:'기존'}));const result=importRows(p,[['번호','이름'],['STU-001','새 지원자']]);assert.equal(result.applicants.length,0);assert.match(result.errors[0],/중복/);
  assert.equal(importRows(createProject(),[['번호','이름'],['X','첫째'],['X','둘째']]).applicants.length,0);
});
test('time constraints support dates and recurring ranges with validation',()=>{
  assert.deepEqual(parseTimeRanges('2026-10-01 9:00-12:00;2026-10-02;14:00~15:00'),[{date:'2026-10-01',start:'09:00',end:'12:00'},{date:'2026-10-02',start:'',end:''},{date:'',start:'14:00',end:'15:00'}]);
  assert.throws(()=>parseTimeRanges('2026-02-30'),/올바르지/);assert.throws(()=>parseTimeRanges('10:00-09:00'),/올바르지/);
});
test('header aliases, unavailable times and missing name validation',()=>{
  const r=normalizeApplicantRows([['수험번호','성명','이메일','불가시간'],['001','김하늘','test@example.com','2026-10-01']]);assert.equal(r.rows[0].number,'001');assert.equal(r.rows[0].unavailable.length,1);
  assert.ok(normalizeApplicantRows([['이름','연락처'],['','010']]).errors.length);
});
test('UTF-8 and CP949 file decoding',async()=>{
  const utf=new TextEncoder().encode('이름,연락처\n김하늘,010');const decoded=await importFile({name:'people.csv',size:utf.length,arrayBuffer:async()=>utf.buffer});assert.equal(decoded.rows[1][0],'김하늘');
  // EUC-KR bytes for 이름 / 김 (compatible with CP949 decoding).
  const cp=Uint8Array.from([0xc0,0xcc,0xb8,0xa7,0x0a,0xb1,0xe8]);const old=await importFile({name:'legacy.csv',size:cp.length,arrayBuffer:async()=>cp.buffer});assert.equal(old.rows[1][0],'김');assert.equal(old.encoding,'CP949/EUC-KR');
});
test('real XLSX import preserves formatted leading-zero applicant number',async()=>{
  const context={console};vm.createContext(context);vm.runInContext(readFileSync(new URL('../vendor/xlsx.full.min.js',import.meta.url),'utf8'),context);const XLSX=context.XLSX;globalThis.XLSX=XLSX;
  const sheet=XLSX.utils.aoa_to_sheet([['지원자번호','이름','연락처'],[1,'김하늘','010-0000'],['002','이서준','']]);sheet.A2.z='000';const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'지원자');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['무시']]),'두번째');
  const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'});const imported=await importFile({name:'people.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes});assert.equal(imported.rows[1][0],'001');assert.equal(imported.sheetName,'지원자');assert.match(imported.warnings[0],/첫 번째/);assert.equal(importRows(createProject(),imported.rows).applicants.length,2);delete globalThis.XLSX;
});
test('unknown extension and oversized file fail before parse',async()=>{
  await assert.rejects(()=>importFile({name:'huge.xlsx',size:11*1024*1024}),/10MB/);
  await assert.rejects(()=>importFile({name:'unsafe.exe',size:0,arrayBuffer:async()=>new ArrayBuffer(0)}),/CSV/);
});

test('recognized header without an applicant-name column is rejected instead of imported as fake people',()=>{
  const result=importRows(createProject(),[['지원자번호','연락처'],['001','010-0000']]);assert.equal(result.applicants.length,0);assert.match(result.errors.join(' '),/이름 열/);
  const headerless=importRows(createProject(),[['가상지원자','010-0000','홍보','메모']]);assert.equal(headerless.errors.length,0);assert.equal(headerless.applicants[0].name,'가상지원자');
});
test('quoted and unquoted oversized CSV cells have the same input limit',()=>{
  assert.throws(()=>parseDelimited(`이름,비고\n가상지원자,"${'가'.repeat(10001)}"`),/10,000/);
  assert.throws(()=>parseDelimited(`이름,비고\n가상지원자,${'가'.repeat(10001)}`),/10,000/);
  assert.equal(parseDelimited(`이름,비고\n가상지원자,"${'가'.repeat(10000)}"`)[1][1].length,10000);
});
test('structured time ranges reject invalid field types instead of silently dropping them',()=>{
  assert.throws(()=>parseTimeRanges([{date:0,start:0,end:0}]),/형식/);assert.throws(()=>parseTimeRanges([[]]),/형식/);
  assert.deepEqual(parseTimeRanges([{date:'2026-10-01',start:'09:00',end:'10:00'}]),[{date:'2026-10-01',start:'09:00',end:'10:00'}]);
});
