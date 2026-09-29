import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INTERVIEW_TYPES, QUESTION_FIELDS, QUESTION_BANK, DEFAULT_MESSAGE_TEMPLATES, CHECKLIST_ITEMS, getTypeDefaults } from '../data.js';
import { renderPrint, buildPrintDocument, PRINT_KINDS } from '../print.js';

const printedAt = '2026-09-29T01:00:00Z';
const fixture = () => ({
  id: 'project-a', name: '학생홍보단 선발', type: '서포터즈', field: '홍보', owner: '담당자', confirmed: true,
  revision: 7, targetScore: 100, materials: '학생증', operatingNotes: '운영 담당자에게만 보일 메모', displayMode: 'name-number',
  criteria: [{ id: 'c1', label: '의사소통', max: 50, description: '명료한 설명', rubric: '구체적인 근거' }, { id: 'c2', label: '책임감', max: 50, description: '역할 수행', rubric: '업무 공유' }],
  questions: [{ id: 'q1', text: '동기를 말씀해 주세요.', selected: true, minutes: 2, field: '홍보', tag: '지원동기', criterionId: 'c1', followUp: '사례는 무엇인가요?' }, { id: 'q2', text: '선택하지 않은 질문 비밀문자', selected: false }],
  checklist: [{ id: 'nameplate', label: '면접위원 명패', done: false, due: '2026-10-11' }],
  panelists: [{ id: 'p1', name: '김위원', organization: '학생처', position: '담당', role: '위원장', contact: 'PANEL-CONTACT-SECRET', note: 'PANEL-NOTE-SECRET', attendance: { s1: '참석' } }, { id: 'p2', name: '이위원', role: '위원' }],
  sessions: [
    { id: 's1', label: '첫째 날 오전', date: '2026-10-12', start: '09:00', end: '10:00', interviewMinutes: 8, turnoverMinutes: 2, arrivalMinutes: 10, panelistIds: ['p1'], mode: 'individual', venue: { campus: 'ERICA', building: '학생회관', room: '101호', waitingRoom: '102호', reception: '로비', reservation: '예약 확정', useStart: '08:30', useEnd: '10:30', contact: 'VENUE-CONTACT-SECRET', memo: 'VENUE-MEMO-SECRET' } },
    { id: 's2', label: '둘째 날 오후', date: '2026-10-13', start: '13:00', end: '14:00', interviewMinutes: 18, turnoverMinutes: 2, arrivalMinutes: 15, panelistIds: ['p2'], mode: 'group', groupSize: 3, venue: { room: '201호', building: '본관', waitingRoom: '202호' } },
  ],
  applicants: [
    { id: 'a1', number: 'STU-001', name: '홍동명', contact: 'APPLICANT-CONTACT-SECRET', note: 'APPLICANT-NOTE-SECRET', field: '홍보', assignment: { sessionId: 's1', start: '09:00' }, status: '지각', result: '합격', resultConfirmed: false, evaluations: { p1: { scores: { c1: 0, c2: 0 }, comment: 'EVALUATION-COMMENT-SECRET' } } },
    { id: 'a2', number: 'STU-002', name: '홍동명', contact: 'APPLICANT-SECOND-CONTACT', field: '홍보', assignment: { sessionId: 's2', start: '13:00' }, status: '면접 중', result: '예비합격', reserveRank: 1, resultConfirmed: true, evaluations: { p2: { scores: { c1: '', c2: 20 } } } },
  ],
});

test('six editable interview defaults contain 11 fields × at least 3 questions and all message/checklist stages', () => {
  assert.equal(INTERVIEW_TYPES.length, 6);
  assert.equal(QUESTION_FIELDS.length, 11);
  for (const field of QUESTION_FIELDS) assert.ok(QUESTION_BANK.filter(q => q.field === field).length >= 3, field);
  assert.equal(Object.keys(DEFAULT_MESSAGE_TEMPLATES).length, 8);
  assert.ok(CHECKLIST_ITEMS.length >= 19);
  for (const type of INTERVIEW_TYPES) {
    const first = getTypeDefaults(type.value); const second = getTypeDefaults(type.value);
    assert.equal(first.criteria.reduce((sum, c) => sum + c.max, 0), first.targetScore);
    assert.ok(first.questions.some(q => q.selected));
    first.criteria[0].label = '수정됨'; first.templates.interview.text = '수정됨'; first.checklist[0].done = true;
    assert.notEqual(second.criteria[0].label, '수정됨'); assert.notEqual(second.templates.interview.text, '수정됨'); assert.equal(second.checklist[0].done, false);
  }
});

test('public packet includes only number and permitted call state, no applicant or internal information', () => {
  const html = renderPrint(fixture(), 'public', { printedAt });
  for (const forbidden of ['홍동명', 'APPLICANT-', 'PANEL-', 'VENUE-', 'EVALUATION-', '예비합격', '지각', '김위원', '운영 담당자에게만']) assert.ok(!html.includes(forbidden), forbidden);
  assert.ok(html.includes('STU-001')); assert.ok(html.includes('면접 중')); assert.ok(html.includes('게시용'));
  assert.ok(html.includes('학생회관 101호')); assert.ok(html.includes('본관 201호'));
  const canceled = fixture(); canceled.applicants[0].status = '참여취소'; canceled.applicants[1].status = '결시';
  const board = renderPrint(canceled, 'public', { printedAt });
  assert.ok(!board.includes('STU-001')); assert.ok(!board.includes('STU-002'));
});

test('operator packet contains operational contacts while panel/reception/evaluation packets omit them', () => {
  const p = fixture();
  const operator = renderPrint(p, 'operator', { printedAt });
  for (const included of ['APPLICANT-CONTACT-SECRET', 'PANEL-CONTACT-SECRET', 'VENUE-CONTACT-SECRET', 'APPLICANT-NOTE-SECRET', '운영 담당자에게만 보일 메모']) assert.ok(operator.includes(included), included);
  for (const kind of ['panel', 'reception', 'evaluation', 'results', 'schedule', 'questions', 'criteria']) {
    const html = renderPrint(p, kind, { printedAt });
    for (const secret of ['APPLICANT-CONTACT-SECRET', 'PANEL-CONTACT-SECRET', 'VENUE-CONTACT-SECRET', 'APPLICANT-NOTE-SECRET', 'PANEL-NOTE-SECRET', 'VENUE-MEMO-SECRET', 'EVALUATION-COMMENT-SECRET']) assert.ok(!html.includes(secret), `${kind}: ${secret}`);
  }
});

test('one evaluation section per internal applicant ID preserves same-name applicants', () => {
  const html = renderPrint(fixture(), 'evaluation', { printedAt });
  assert.equal((html.match(/class="print-page evaluation-page/g) || []).length, 2);
  assert.equal((html.match(/지원자별 면접 평가표/g) || []).length, 2);
  assert.ok(html.includes('STU-001')); assert.ok(html.includes('STU-002'));
});

test('number-only evaluation hides the name and custom display interpolates supported variables safely', () => {
  const p = fixture();
  const html = renderPrint(p, 'evaluation', { printedAt, displayMode: 'number' });
  assert.ok(!html.includes('홍동명')); assert.ok(html.includes('STU-001'));
  p.customDisplay = '{지원분야} / {번호}'; p.displayMode = 'custom';
  const custom = renderPrint(p, 'evaluation', { printedAt });
  assert.ok(custom.includes('홍보 / STU-001')); assert.ok(!custom.includes('홍동명'));
});

test('session and panel filters select only their own applicants and packet schedule', () => {
  for (const options of [{ sessionId: 's1' }, { panelistId: 'p1' }]) {
    const html = renderPrint(fixture(), 'panel', { ...options, printedAt });
    assert.ok(html.includes('STU-001')); assert.ok(!html.includes('STU-002')); assert.ok(!html.includes('둘째 날 오후'));
  }
});

test('panel packet contains selected questions, linked criteria, turnover and group semantics', () => {
  const html = renderPrint(fixture(), 'panel', { printedAt });
  assert.ok(html.includes('동기를 말씀해 주세요.')); assert.ok(html.includes('평가 연결: 의사소통'));
  assert.ok(!html.includes('선택하지 않은 질문 비밀문자'));
  assert.ok(html.includes('면접 8분 + 교체 2분')); assert.ok(html.includes('그룹 전체 슬롯'));
  const p = fixture(); p.protocol = '인사 1분 → 질문 6분 → 마무리 1분\n<수정한 진행방법>';
  const custom = renderPrint(p, 'panel', { printedAt });
  assert.ok(custom.includes('인사 1분 → 질문 6분 → 마무리 1분')); assert.ok(custom.includes('&lt;수정한 진행방법&gt;'));
  assert.ok(!custom.includes(p.operatingNotes));
});

test('reception packet calculates arrival separately from interview time', () => {
  const html = renderPrint(fixture(), 'reception', { printedAt });
  assert.ok(html.includes('08:50')); assert.ok(html.includes('09:00')); assert.ok(html.includes('12:45'));
  const midnight = fixture(); midnight.applicants[0].assignment.start = '00:05';
  const safe = renderPrint(midnight, 'reception', { printedAt });
  assert.ok(safe.includes('00:00')); assert.ok(!safe.includes('23:55'));
});

test('results distinguish entered zero from incomplete evaluation and only list explicitly confirmed results', () => {
  const html = renderPrint(fixture(), 'results', { printedAt });
  assert.match(html, /<td>1\/1<\/td><td>0<\/td>/);
  assert.match(html, /<td>0\/1<\/td><td>평가 미완료<\/td>/);
  const confirmedSection = html.split('담당자 확정 결과명단')[1];
  assert.ok(!confirmedSection.includes('STU-001')); assert.ok(confirmedSection.includes('STU-002'));
  const exempt = fixture(); exempt.applicants[1].evaluationExemptReason = '지원자 요청으로 참여 취소를 담당자가 확인';
  const audit = renderPrint(exempt, 'results', { printedAt });
  assert.ok(audit.includes('평가 제외 사유(담당자 기록)')); assert.ok(audit.includes(exempt.applicants[1].evaluationExemptReason));
});

test('score sum mismatch warns on evaluation paper and does not fabricate a score', () => {
  const p = fixture(); p.criteria[1].max = 40;
  const html = renderPrint(p, 'evaluation', { printedAt });
  assert.ok(html.includes('배점 합계 90점 / 목표 100점'));
});

test('free text is escaped in all packet kinds and renderer does not mutate the project', () => {
  const p = fixture(); p.name = '<script>alert(1)</script>'; p.applicants[0].name = '<img src=x onerror=alert(1)>';
  const before = structuredClone(p);
  for (const kind of PRINT_KINDS) {
    const html = renderPrint(p, kind.value, { printedAt });
    assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img ')); assert.ok(html.includes('&lt;script&gt;'));
  }
  assert.deepEqual(p, before);
});

test('complete print document specifies language, CSS, version/time and A4 orientation', () => {
  const html = buildPrintDocument(fixture(), 'operator', { printedAt, orientation: 'landscape' });
  assert.ok(html.startsWith('<!doctype html>')); assert.ok(html.includes('<html lang="ko">'));
  assert.ok(html.includes('A4 landscape')); assert.ok(html.includes('data-version="7"')); assert.ok(html.includes('2026. 09. 29.'));
  assert.ok(html.includes('print.css')); assert.ok(html.includes('한국시간'));
  assert.ok(html.includes('@bottom-left')); assert.ok(html.includes('counter(page)')); assert.ok(html.includes('counter(pages)'));
  const portable = buildPrintDocument(fixture(), 'evaluation', { printedAt, cssText: 'body { color: navy; }' });
  assert.ok(portable.includes('<style>body { color: navy; }</style>')); assert.ok(!portable.includes('<link'));
});

test('repeated physical-page footer safely quotes dynamic metadata', () => {
  const p = fixture(); p.revision = '</style><script>alert(1)</script>';
  const html = buildPrintDocument(p, 'public', { printedAt });
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('content: "MACH · 버전 </style>'));
  assert.ok(html.includes('\\3c /style\\3e '));
});

test('print stylesheet requires A4, repeated table headers and an explicit page break between evaluations', async () => {
  const css = await readFile(new URL('../print.css', import.meta.url), 'utf8');
  assert.match(css, /@page\s*\{\s*size:\s*A4 portrait/);
  assert.match(css, /thead\s*\{\s*display:\s*table-header-group/);
  assert.match(css, /break-after:\s*page/); assert.match(css, /\.evaluation-page/);
});

test('nine print purposes are individually available and question/rubric sheets omit applicant records', () => {
  assert.equal(PRINT_KINDS.length, 9);
  const p = fixture();
  const schedule = renderPrint(p, 'schedule', { printedAt, sessionId: 's2' });
  assert.ok(schedule.includes('전체 면접시간표')); assert.ok(schedule.includes('STU-002')); assert.ok(!schedule.includes('STU-001'));
  assert.ok(schedule.includes('본관')); assert.ok(schedule.includes('202호'));
  const questions = renderPrint(p, 'questions', { printedAt });
  assert.ok(questions.includes('동기를 말씀해 주세요.')); assert.ok(!questions.includes('선택하지 않은 질문 비밀문자'));
  const criteria = renderPrint(p, 'criteria', { printedAt });
  assert.ok(criteria.includes('구체적인 근거')); assert.ok(criteria.includes('업무 공유'));
  for (const html of [questions, criteria]) for (const forbidden of ['STU-001', 'STU-002', '홍동명', 'APPLICANT-', 'PANEL-', 'VENUE-', 'EVALUATION-']) assert.ok(!html.includes(forbidden), forbidden);
});

test('twenty evaluation sheets preserve all internal identities and per-sheet document metadata', () => {
  const p = fixture();
  p.applicants = Array.from({ length: 20 }, (_, i) => ({ ...p.applicants[i % 2], id: `print-qa-${i}`, number: `QA-${String(i + 1).padStart(3, '0')}` }));
  const html = renderPrint(p, 'evaluation', { printedAt });
  assert.equal((html.match(/class="print-page evaluation-page/g) || []).length, 20);
  assert.equal((html.match(/문서 버전 7/g) || []).length, 20);
  for (const a of p.applicants) assert.equal(html.split(a.number).length - 1, 1);
});
