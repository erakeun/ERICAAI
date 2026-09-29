/** Existing MACH native file contracts, inspected 2026-09-29. */
import { BUILDINGS } from './data/buildings.js';
export { BUILDINGS };

export const TOOL_URLS = Object.freeze({
  mach: 'https://erakeun.github.io/ERICAAI/',
  nameplate: 'https://erakeun.github.io/nameplate-maker/',
  notice: 'https://erakeun.github.io/notice-maker/',
  signage: 'https://erakeun.github.io/digital-signage-maker/',
  map: 'https://erakeun.github.io/erica-campus-map/',
  event: 'https://erakeun.github.io/erica-event-oneq/'
});
export const NOTICE_TYPES = Object.freeze(['면접실', '대기실', '접수처', '면접 진행 중', '관계자 외 출입금지', '방향안내']);

const string = value => String(value ?? '');
const clean = value => string(value).trim();
const projectName = project => clean(project.name || project.title || project.projectName) || '면접';
const committeePool = project => project.panelists || project.committee || project.committees || project.committeePool || project.interviewers || [];
const place = session => session?.venue && typeof session.venue === 'object' ? session.venue : session || {};
const memberName = person => clean(person.name);
const html = value => string(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Existing makers distinguish rich text by an allowed tag on every reload.
// They strip unstyled spans; an empty strong marker survives sanitization
// without changing visible text and prevents repeated entity escaping.
const rich = value => `${html(value).replace(/\r?\n/g, '<br>')}<strong></strong>`;
const nonnegative = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
function uuid() {
  if (!globalThis.crypto?.randomUUID) throw new Error('안전한 ID를 만들 수 없습니다. HTTPS 또는 localhost에서 열어 주세요.');
  return globalThis.crypto.randomUUID();
}
function identifier(value, label) {
  const id = string(value);
  if (id.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id) || ['constructor', 'prototype', '__proto__'].includes(id)) throw new Error(`${label} ID가 올바르지 않습니다. 프로젝트를 저장한 후 다시 시도해 주세요.`);
  return id;
}
function bounded(value, label) {
  const text = clean(value);
  if (text.length > 500) throw new Error(`${label}은 명패 연동 시 500자 이하여야 합니다.`);
  return text;
}

/** Download this as JSON and select 명패 제작기 > 변경분 JSON 가져오기. */
export function nameplatePayload(project, selectedIds) {
  const all = committeePool(project);
  const selected = selectedIds ? new Set(selectedIds) : null;
  const people = all.filter(person => !selected || selected.has(person.id));
  if (!people.length) throw new Error('명패를 만들 면접위원을 선택해 주세요.');
  if (people.length > 300) throw new Error('명패는 한 번에 300명까지 전달할 수 있습니다.');
  const ids = new Set();
  const participants = people.map(person => {
    const participantId = identifier(person.id, '위원');
    if (ids.has(participantId)) throw new Error('위원 ID가 중복되어 명패를 전달할 수 없습니다.');
    ids.add(participantId);
    if (!memberName(person)) throw new Error('이름이 없는 면접위원을 먼저 확인해 주세요.');
    const position = clean(person.position || person.title);
    const role = clean(person.role);
    return { participantId, name: bounded(person.name, '이름'), organization: bounded(person.organization || person.org || person.affiliation, '소속'), position: bounded([position, role && role !== position ? role : ''].filter(Boolean).join(' · '), '직위·역할'), status: 'attending' };
  });
  return {
    schemaVersion: 1, kind: 'roster', eventId: identifier('interview-' + project.id, '프로젝트'),
    eventName: bounded(projectName(project), '면접명'), revision: nonnegative(project.revision), baseRevision: 0,
    transferId: uuid(), participants
  };
}

/** Start a distinct native nameplate work file; save the maker's previous work before importing. */
export function nameplateProjectPayload(project, selectedIds) {
  const roster = nameplatePayload(project, selectedIds);
  const baseline = person => ({...person,replacesParticipantId:'',seatId:''});
  return {
    app:'nameplate-maker', version:'2.9.1', savedAt:new Date().toISOString(),
    people:roster.participants.map(({participantId,...person})=>({id:participantId,...person,logoKey:'default'})),
    customLogos:[], design:{}, selectedIndex:0,
    mach:{schemaVersion:1,eventId:roster.eventId,eventName:roster.eventName,localEventId:uuid(),revision:roster.revision,
      baselines:Object.fromEntries(roster.participants.map(person=>[person.participantId,baseline(person)])),
      applied:{},printJobs:[],confirmed:{},recalls:{}}
  };
}

export function selectedBuilding(session) {
  const venue = place(session);
  const id = string(venue.buildingId || session?.buildingId);
  return BUILDINGS.find(building => building.id === id) || BUILDINGS.find(building => building.nameKo === (venue.building || venue.buildingName)) || null;
}
export function buildingLabel(session) {
  const venue = place(session);
  return selectedBuilding(session)?.nameKo || clean(venue.building || venue.buildingName);
}

/** The production map's deployed receiver accepts only its registered public building IDs. */
export function mapLink(session, options = {}) {
  const building = selectedBuilding(session);
  if (options.localBase && building) {
    const base = new URL(options.localBase);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || !['http:', 'https:'].includes(base.protocol) || !base.pathname.endsWith('/erica-campus-map/')) throw new Error('건물 선택 링크는 확장 적용을 확인한 로컬 지도에서만 사용할 수 있습니다.');
    base.search = ''; base.hash = ''; base.searchParams.set('building', building.id);
    return base.href;
  }
  const url = new URL(TOOL_URLS.map);
  if (building) url.searchParams.set('building', building.id);
  return url.href;
}
export function locationInfo(session, options = {}) {
  const building = selectedBuilding(session);
  const venue = place(session);
  return {
    url: mapLink(session, options), buildingId: building?.id || '', building: buildingLabel(session),
    room: clean(venue.interviewRoom || venue.room), waitingRoom: clean(venue.waitingRoom),
    structureUrl: building?.urlKo || '',
    guidance: building ? `${building.nameKo} (${building.id}) 위치가 강조됩니다.` : 'ERICA 캠퍼스 지도에서 건물명을 검색하세요.'
  };
}

export function noticePayload(project, session, type = '면접실', direction = '') {
  if (!NOTICE_TYPES.includes(type)) throw new Error('지원하는 안내문 유형을 선택해 주세요.');
  const venue = place(session);
  const location = locationInfo(session);
  const date = clean(session?.date);
  const time = [session?.start || session?.startTime, session?.end || session?.endTime].filter(Boolean).join(' ~ ');
  const room = type === '대기실' ? location.waitingRoom : type === '접수처' ? clean(venue.reception || venue.receptionLocation) : location.room;
  const locationText = [location.building, room].filter(Boolean).join(' ');
  const description = {
    '면접실': '면접 순서에 따라 안내를 받고 입장해 주세요.',
    '대기실': '접수 후 대기해 주세요. 안내에 따라 면접실로 이동합니다.',
    '접수처': '지원자번호를 확인하고 접수해 주세요.',
    '면접 진행 중': '면접 진행 중입니다. 조용히 이동해 주세요.',
    '관계자 외 출입금지': '면접 운영 관계자 외 출입을 제한합니다.',
    '방향안내': '표시된 방향으로 이동해 주세요.'
  }[type];
  return {
    app: 'notice-maker', version: '1.7.0', savedAt: new Date().toISOString(),
    state: {
      orientation: 'landscape', template: 1, title: rich(type), subtitle: rich(projectName(project)),
      body: [locationText, [date, time].filter(Boolean).join('  '), direction, description].filter(Boolean).map(rich).join('<br><br>'),
      emphasis: '', footer: '', outputName: filenameSafe(`${projectName(project)}-${type}`)
    }
  };
}

export function signagePayload(project, session) {
  const location = locationInfo(session);
  return {
    app: 'digital-signage-maker', version: '1.5.4', savedAt: new Date().toISOString(),
    state: {
      layout: 'warm-welcome', template: 23, title: rich(projectName(project)),
      subtitle: rich([session?.date, [session?.start || session?.startTime, session?.end || session?.endTime].filter(Boolean).join(' ~ ')].filter(Boolean).join(' ')),
      body: rich([location.building, location.room].filter(Boolean).join(' ')), emphasis: '', footer: ''
    }, playlist: [], selectedPlaylistIndex: -1
  };
}

export function filenameSafe(value) {
  const name = clean(value).normalize('NFC').replace(/[\x00-\x1f<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '').slice(0, 110);
  return !name || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) ? '면접-자료' : name;
}
export function downloadJSON(payload, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filenameSafe(filename); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Locally vendored MIT qrcode-generator; neither URL nor interview data is sent to a QR service. */
export function renderQRCode(container, text, { size = 160 } = {}) {
  if (!globalThis.qrcode) throw new Error('QR 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
  const url = new URL(text);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('QR에는 웹 위치링크만 사용할 수 있습니다.');
  const code = globalThis.qrcode(0, 'M'); code.addData(url.href); code.make();
  container.innerHTML = code.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  const svg = container.querySelector('svg');
  svg.setAttribute('width', string(size)); svg.setAttribute('height', string(size));
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '캠퍼스 위치링크 QR');
  return svg;
}
