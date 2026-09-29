import { evaluationSummary } from './core.js';

export const PRINT_KINDS = [
  { value: 'panel', label: '면접위원용 패킷', privacy: '내부용 · 지원자 식별정보 포함' },
  { value: 'operator', label: '운영자용 패킷', privacy: '내부용 · 연락처·운영메모 포함' },
  { value: 'reception', label: '접수·안내용', privacy: '접수 담당용 · 이름·번호 포함' },
  { value: 'public', label: '현장 게시용', privacy: '게시용 · 지원자번호만 표시' },
  { value: 'results', label: '평가·결과 검토표', privacy: '내부용 · 평가·결과 포함' },
  { value: 'evaluation', label: '지원자별 평가표', privacy: '면접위원용 · 점수 직접 기입' },
  { value: 'schedule', label: '전체 면접시간표', privacy: '내부용 · 지원자 식별정보 포함' },
  { value: 'questions', label: '면접 질문지', privacy: '면접위원용 · 선택 질문만 포함' },
  { value: 'criteria', label: '평가기준표', privacy: '면접위원용 · 평가기준·진행방법' },
];

const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const array = value => Array.isArray(value) ? value : [];
const timeNumber = value => { const parts = String(value || '').split(':').map(Number); return parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : null; };
const clock = value => { const minute = ((Math.round(value) % 1440) + 1440) % 1440; return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; };
const arrivalTime = (value, amount) => timeNumber(value) === null ? '—' : clock(Math.max(0, timeNumber(value) - Number(amount || 0)));
const venueText = session => [session?.venue?.campus, session?.venue?.building, session?.venue?.room].filter(Boolean).join(' ') || '장소 미정';
const safeNumber = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const cssString = value => `"${String(value).replace(/[\\\n\r\f"'<>]/g, c => `\\${c.codePointAt(0).toString(16)} `)}"`;

function context(project, kind, options) {
  const definition = PRINT_KINDS.find(item => item.value === kind) || PRINT_KINDS[0];
  const sessions = array(project.sessions).filter(s => !options.sessionId || s.id === options.sessionId).filter(s => !options.panelistId || array(s.panelistIds).includes(options.panelistId));
  const sessionIds = new Set(sessions.map(s => s.id));
  const applicants = array(project.applicants).filter(a => !options.applicantIds || options.applicantIds.includes(a.id)).filter(a => (!options.sessionId && !options.panelistId) || sessionIds.has(a.assignment?.sessionId));
  applicants.sort((a, b) => {
    const sa = sessions.find(s => s.id === a.assignment?.sessionId); const sb = sessions.find(s => s.id === b.assignment?.sessionId);
    const ka = `${sa?.date || '9999'} ${a.assignment?.start || '99:99'} ${a.number || ''}`;
    const kb = `${sb?.date || '9999'} ${b.assignment?.start || '99:99'} ${b.number || ''}`;
    return ka.localeCompare(kb, 'ko');
  });
  const printedAt = options.printedAt || new Date().toISOString();
  const date = new Date(printedAt);
  const stamp = Number.isNaN(date.getTime()) ? String(printedAt) : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  return { project, kind: definition.value, definition, options, sessions, applicants, stamp, printedAt };
}

function header(ctx, title, extra = '') {
  return `<header class="print-header"><div class="print-brand">PROJECT MACH · 면접 준비 원큐</div><h1>${e(title)}</h1><p>${e(ctx.project.name || '이름 없는 면접')}</p><div class="print-meta"><span class="print-privacy">${e(ctx.definition.privacy)}</span>문서 버전 ${e(ctx.project.revision ?? 1)} · 생성 ${e(ctx.stamp)} (한국시간)${extra ? ` · ${e(extra)}` : ''}</div></header>`;
}

function footer(ctx) { return `<footer class="print-footer">${e(ctx.project.name || '면접')} · 버전 ${e(ctx.project.revision ?? 1)} · ${e(ctx.stamp)} · ${e(ctx.definition.privacy)}</footer>`; }
function page(ctx, title, body, className = '') { return `<section class="print-page ${e(className)}">${header(ctx, title)}${body}${footer(ctx)}</section>`; }
function table(headers, rows, className = '') {
  return `<table class="${e(className)}"><thead><tr>${headers.map(h => `<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="print-muted">등록된 내용이 없습니다.</td></tr>`}</tbody></table>`;
}
function field(label, value) { return `<div><span class="print-label">${e(label)}</span>${e(value || '—')}</div>`; }
function sessionFor(ctx, applicant) { return ctx.sessions.find(s => s.id === applicant.assignment?.sessionId); }
function identity(ctx, applicant) {
  const mode = ctx.options.displayMode || ctx.project.displayMode || 'name-number';
  if (['number', 'numberOnly', 'number-only', '번호만'].includes(mode)) return String(applicant.number || '번호 미정');
  if (mode === 'custom' || mode === '사용자 정의') {
    const template = ctx.options.customLabel || ctx.project.customDisplay || '{번호}';
    return String(template).replaceAll('{이름}', applicant.name || '').replaceAll('{번호}', applicant.number || '').replaceAll('{지원분야}', applicant.field || '');
  }
  return `${applicant.number || '번호 미정'} · ${applicant.name || '이름 미정'}`;
}
function scheduleRows(ctx, mode = 'panel') {
  return ctx.applicants.map(a => {
    const s = sessionFor(ctx, a); const start = a.assignment?.start || '미배정';
    const base = [e(s?.date || '—'), e(start), e(a.number || '—')];
    if (mode !== 'public') base.push(e(mode === 'panel' ? identity(ctx, a) : a.name));
    if (mode === 'operator') return [...base, e(a.field || '—'), e(s?.label || '미배정'), e(a.contact || '—'), e(a.status || '예정'), e(a.note || '')];
    if (mode === 'reception') return [e(s?.date || '—'), e(s && a.assignment ? arrivalTime(start, s.arrivalMinutes ?? 10) : '—'), e(start), e(a.number || '—'), e(a.name), e(s?.label || '미배정'), e(a.status || '예정'), '□'];
    if (mode === 'public') return [e(s?.date || '—'), e(start), `<span class="public-number">${e(a.number || '—')}</span>`, e(s?.venue?.room || '—'), e(a.status || '예정')];
    return [...base, e(a.field || '—'), e(s?.label || '미배정')];
  });
}
function overview(ctx) {
  return `<div class="print-grid">${field('면접유형', ctx.project.type)}${field('모집분야', ctx.project.field)}${field('담당자', ctx.project.owner)}${field('시간표 상태', ctx.project.confirmed ? '확정' : '초안 · 안내 전 확인 필요')}${field('지원자', `${ctx.applicants.length}명`)}${field('준비물', ctx.project.materials)}</div>`;
}
function sessionTable(ctx, operator = false) {
  return table(['회차·일자', '면접 운영', '면접실·대기실', operator ? '예약·장소사용' : '참여위원'], ctx.sessions.map(s => {
    const venue = s.venue || {};
    return [e(`${s.label || '회차'} / ${s.date || '날짜 미정'}`), `${e(s.start)}–${e(s.end)}<br>면접 ${e(s.interviewMinutes)}분 + 교체 ${e(s.turnoverMinutes)}분${s.mode === 'group' || s.mode === '조별' ? `<br>조별 ${e(s.groupSize)}명 / 그룹 전체 슬롯` : ''}`, `${e(venueText(s))}<br><span class="print-muted">대기: ${e(venue.waitingRoom || '미정')} / 접수: ${e(venue.reception || '미정')}</span>`, operator ? `${e(venue.reservation || '미정')}<br>${e(venue.useStart || '—')}–${e(venue.useEnd || '—')}<br>${e(venue.contact || '')}<br>${e(venue.memo || '')}` : e(array(ctx.project.panelists).filter(p => array(s.panelistIds).includes(p.id)).map(p => `${p.name}(${p.role || '위원'})`).join(', ') || '미정')];
  }), 'print-small');
}

function evaluationPage(ctx, applicant) {
  const session = sessionFor(ctx, applicant); const criteria = array(ctx.project.criteria);
  const sum = criteria.reduce((total, c) => total + (safeNumber(c.max) ? Number(c.max) : 0), 0);
  const panelist = array(ctx.project.panelists).find(p => p.id === ctx.options.panelistId);
  const body = `<div class="print-grid">${field('지원자', identity(ctx, applicant))}${field('지원분야', applicant.field)}${field('면접일·시간', session ? `${session.date} ${applicant.assignment?.start || ''}` : '미배정')}${field('면접실', session ? venueText(session) : '미정')}</div>
    ${sum !== Number(ctx.project.targetScore ?? 100) ? `<p class="print-notice print-warning">배점 합계 ${e(sum)}점 / 목표 ${e(ctx.project.targetScore ?? 100)}점: 출력 전에 배점을 확인하세요.</p>` : ''}
    ${table(['번호', '평가항목', '배점', '점수'], criteria.map((c, i) => [e(i + 1), e(c.label), e(c.max), '']), 'score-table')}
    <table><tbody><tr><th scope="row">총점</th><td>　　　　/ ${e(sum)}점</td></tr></tbody></table>
    <h3>종합의견</h3><div class="print-comment" aria-label="종합의견 기입란"></div>
    <div class="print-signature"><span>위원명: ${e(panelist?.name || '')}　　　　　　　　　</span><span>확인(서명):　　　　　　　　　</span></div>
    <p class="print-meta">각 항목을 직접 평가해 기입해 주세요. 미평가 항목은 0점으로 간주하지 않습니다.</p>`;
  return page(ctx, '지원자별 면접 평가표', body, `evaluation-page${criteria.length > 7 ? ' dense' : ''}`);
}
function questionsPage(ctx) {
  const questions = array(ctx.project.questions).filter(q => q.selected);
  const total = questions.reduce((sum, q) => sum + Number(q.minutes || 0), 0);
  const content = questions.length ? questions.map((q, i) => {
    const criterion = array(ctx.project.criteria).find(c => c.id === q.criterionId);
    return `<article class="print-question"><h3>${e(i + 1)}. ${e(q.text)}</h3><p class="print-question-meta">${e(q.field || '')} · ${e(q.tag || '')} · 예상 ${e(q.minutes || 0)}분${criterion ? ` · 평가 연결: ${e(criterion.label)}` : ''}</p>${q.followUp ? `<p>후속질문: ${e(q.followUp)}</p>` : ''}</article>`;
  }).join('') : '<p class="print-empty">선택된 질문이 없습니다. 질문은행에서 사용할 질문을 선택하세요.</p>';
  return page(ctx, '면접 질문지', `<p class="print-notice">동일 분야의 지원자에게 질문과 평가기준을 일관되게 적용하세요. 선택 질문 예상 합계 ${e(total)}분이며, 실제 진행시간은 담당자가 조정합니다.</p>${content}`);
}
function criteriaPage(ctx) {
  const protocol = String(ctx.project.protocol || '').trim() || '확정 시간표를 기준으로 진행하고, 일정 변경은 운영자에게 알려 주세요. 면접이 일찍 끝나도 다음 확정시간을 임의로 앞당기지 않습니다. 작성한 평가표는 담당자에게 반환합니다.';
  return page(ctx, '평가기준·진행방법', `<p class="print-notice">지원자의 답변에 근거하여 항목별 점수를 직접 기록합니다. 점수 합계는 계산 자료이며, 합격·예비합격 여부는 담당자가 확정합니다.</p>${table(['평가항목·배점', '확인 내용·평가기준'], array(ctx.project.criteria).map(c => [e(`${c.label} (${c.max}점)`), `${e(c.description || '')}<p class="print-rubric">${e(c.rubric || '별도 기준을 확인해 주세요.')}</p>`]), 'criteria-table')}<h2>진행방법·운영 안내</h2><p class="print-rubric">${e(protocol)}</p>`);
}
function panelPacket(ctx) {
  return page(ctx, '면접위원용 면접개요·시간표', `${overview(ctx)}${sessionTable(ctx)}<h2>지원자 시간표</h2>${table(['일자', '면접시간', '지원자번호', '표시명', '지원분야', '회차'], scheduleRows(ctx))}<p class="print-meta">연락처와 내부 운영메모는 위원용 패킷에서 제외했습니다.</p>`) + questionsPage(ctx) + criteriaPage(ctx) + ctx.applicants.map(a => evaluationPage(ctx, a)).join('');
}
function schedulePacket(ctx) {
  return page(ctx, '전체 면접시간표', `${sessionTable(ctx)}${table(['일자', '면접시간', '지원자번호', '표시명', '지원분야', '회차'], scheduleRows(ctx))}<p class="print-notice">${ctx.project.confirmed ? '확정된 시간표입니다. 변경이 발생하면 지원자와 면접위원에게 다시 안내하세요.' : '초안 시간표입니다. 미배정 및 충돌을 검토한 뒤 확정해 주세요.'}</p>`);
}
function operatorPacket(ctx) {
  const checks = array(ctx.project.checklist);
  const panels = array(ctx.project.panelists).filter(p => ctx.sessions.some(s => array(s.panelistIds).includes(p.id)));
  return page(ctx, '운영자용 준비·장소 확인', `${overview(ctx)}${sessionTable(ctx, true)}<h2>준비 체크리스트</h2>${table(['확인', '준비 항목', '기한', '메모'], checks.map(c => [c.done ? '☑' : '□', e(c.label), e(c.due || '—'), e(c.note || '')]), 'print-small checklist-table')}`)
    + page(ctx, '운영자용 시간표·출석부', `${table(['일자', '면접', '번호', '이름', '분야', '회차', '연락처', '현장상태', '운영메모'], scheduleRows(ctx, 'operator'), 'print-small')}<p class="print-notice">지각·결시는 현장상태로 기록합니다. 결과를 자동으로 변경하지 않으며, 확정시간 변경 시 지원자 재안내 여부를 확인합니다.</p>`)
    + page(ctx, '면접위원 연락·안내물 준비', `${table(['위원명', '소속·직위', '역할', '연락처', '회차별 참석', '비고'], panels.map(p => [e(p.name), e([p.organization, p.position].filter(Boolean).join(' / ')), e(p.role), e(p.contact || '—'), e(ctx.sessions.filter(s => array(s.panelistIds).includes(p.id)).map(s => `${s.label}: ${p.attendance?.[s.id] || '미확인'}`).join('\n')), e(p.note || '')]), 'print-small')}<h2>안내물 준비현황</h2>${table(['항목', '상태'], checks.filter(c => /명패|안내문|자료|평가표/.test(c.label || '')).map(c => [e(c.label), c.done ? '준비 확인' : '미확인']))}<h2>운영메모</h2><div class="print-comment">${e(ctx.project.operatingNotes || '')}</div>`);
}
function receptionPacket(ctx) {
  return page(ctx, '도착예정·출석 확인표', `${sessionTable(ctx)}${table(['일자', '도착권장', '면접', '번호', '이름', '회차', '현장상태', '출석확인'], scheduleRows(ctx, 'reception'), 'print-small')}<p class="print-notice">도착 권장시간은 면접시간에서 회차별 준비시간을 뺀 값입니다. 지각·결시·일정변경은 운영 담당자에게 전달해 주세요.</p>`);
}
function publicPacket(ctx) {
  // Public rendering deliberately never reads applicant.name/contact/note/evaluations/result.
  const rows = ctx.applicants.filter(a => a.assignment && !['참여취소', '결시'].includes(a.status)).map(a => {
    const s = sessionFor(ctx, a);
    const publicStatus = ['면접 중', '도착·대기', '완료'].includes(a.status) ? a.status : '예정';
    return [e(s?.date || '—'), e(a.assignment.start), `<span class="public-number">${e(a.number || '—')}</span>`, e([s?.venue?.building, s?.venue?.room].filter(Boolean).join(' ') || '—'), e(publicStatus)];
  });
  return page(ctx, '면접 순서·호출 안내', `<p class="print-notice">본인의 지원자번호를 확인해 주세요. 일정은 현장 운영에 따라 달라질 수 있으니 담당자의 안내를 따라 주세요.</p>${table(['일자', '예정시간', '지원자번호', '면접실', '호출상태'], rows)}`, 'public-page');
}
function evaluationStats(project, applicant) {
  const stats = evaluationSummary({ ...project, sessions: array(project.sessions), panelists: array(project.panelists), criteria: array(project.criteria) }, applicant);
  const missing = stats.missingPanelists.map(panel => `${panel.name}: ${[...panel.missing, ...array(panel.invalid)].map(id => array(project.criteria).find(c => c.id === id)?.label || id).join(', ') || '평가항목 없음'}`);
  return { completeCount: stats.countComplete, expected: stats.expected, missing, average: stats.average === null ? null : Math.round(stats.average * 100) / 100 };
}
function resultsPacket(ctx) {
  const rows = ctx.applicants.map(a => {
    const stats = evaluationStats(ctx.project, a);
    const missing = stats.expected ? stats.missing.join(' / ') || '없음' : '배정 회차·참여위원 확인';
    const exemption = String(a.evaluationExemptReason || '').trim();
    const audit = exemption ? `${e(missing)}<br><strong>평가 제외 사유(담당자 기록)</strong><br>${e(exemption)}` : e(missing);
    return [e(a.number), e(a.name), e(a.field || '—'), e(`${stats.completeCount}/${stats.expected}`), stats.average === null ? '평가 미완료' : e(stats.average), audit, e(a.result || '미정'), e(a.reserveRank || '—'), a.resultConfirmed ? '담당자 확정' : '미확정'];
  });
  const confirmed = ctx.applicants.filter(a => a.resultConfirmed);
  return page(ctx, '평가 누락·결과 검토표', `<p class="print-notice">평균은 참여위원의 모든 평가항목 입력과 배점 확인이 끝난 후 계산합니다. 미입력은 0점으로 처리하지 않습니다. 시스템은 합격자를 추천하거나 선정하지 않습니다.</p>${table(['번호', '이름', '분야', '평가완료', '평균', '누락 확인', '결과', '예비순번', '확정'], rows, 'print-small result-table')}<p class="print-meta">확정 ${e(confirmed.length)}명 / 전체 ${e(ctx.applicants.length)}명. 미확정 결과는 최종 결과 안내 전에 검토하세요.</p>`)
    + page(ctx, '담당자 확정 결과명단', `${table(['번호', '이름', '지원분야', '확정 결과', '예비순번'], confirmed.map(a => [e(a.number), e(a.name), e(a.field || '—'), e(a.result || '미정'), e(a.reserveRank || '—')]))}<div class="print-signature"><span>검토자:　　　　　　　　　</span><span>담당자 확인:　　　　　　　　　</span></div>`);
}

/** Pure body renderer. It does not mark documents as printed or mutate project data. */
export function renderPrint(project, kind = 'panel', options = {}) {
  const ctx = context(project || {}, kind, options);
  const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  let content;
  switch (ctx.kind) {
    case 'operator': content = operatorPacket(ctx); break;
    case 'reception': content = receptionPacket(ctx); break;
    case 'public': content = publicPacket(ctx); break;
    case 'results': content = resultsPacket(ctx); break;
    case 'schedule': content = schedulePacket(ctx); break;
    case 'questions': content = questionsPage(ctx); break;
    case 'criteria': content = criteriaPage(ctx); break;
    case 'evaluation': content = ctx.applicants.length ? ctx.applicants.map(a => evaluationPage(ctx, a)).join('') : page(ctx, '지원자별 면접 평가표', '<p class="print-empty">출력할 지원자가 없습니다.</p>'); break;
    default: content = panelPacket(ctx);
  }
  return `<main class="print-document ${orientation}" data-kind="${e(ctx.kind)}" data-version="${e(project?.revision ?? 1)}">${content}</main>`;
}

/** Complete HTML for iframe.srcdoc. Supply cssText to make downloaded HTML self-contained. */
export function buildPrintDocument(project, kind = 'panel', options = {}) {
  const printOptions = { ...options, printedAt: options.printedAt || new Date().toISOString() };
  const ctx = context(project || {}, kind, printOptions);
  const title = `${project?.name || '면접'} · ${PRINT_KINDS.find(item => item.value === kind)?.label || '출력'}`;
  const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  const cssHref = options.cssHref || new URL('./print.css', import.meta.url).href;
  const stylesheet = typeof options.cssText === 'string' ? `<style>${options.cssText.replace(/<\/style/gi, '<\\/style')}</style>` : `<link rel="stylesheet" href="${e(cssHref)}">`;
  const pageStamp = cssString(`MACH · 버전 ${project?.revision ?? 1} · ${ctx.stamp} (한국시간) · ${ctx.definition.privacy}`);
  return `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title>${stylesheet}<style>@page { size: A4 ${orientation}; @bottom-left { content: ${pageStamp}; font-family: Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 7pt; color: #53677d; } @bottom-right { content: counter(page) " / " counter(pages); font-family: Arial, sans-serif; font-size: 7pt; color: #53677d; } }${orientation === 'landscape' ? '@page landscape { size: A4 landscape; }' : ''}</style></head><body>${renderPrint(project, kind, printOptions)}</body></html>`;
}
