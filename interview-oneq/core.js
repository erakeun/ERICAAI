import { getTypeDefaults, INTERVIEW_TYPES } from './data.js';

export const SCHEMA_VERSION = 1;
export const BACKUP_FORMAT = 'MACH_INTERVIEW_ONEQ';
export const MAX_APPLICANTS = 5000;
export const MAX_SESSIONS = 100;
export const APPLICANT_STATUSES = ['예정', '도착·대기', '면접 중', '완료', '지각', '결시', '참여취소', '일정변경'];
export const RESULT_STATUSES = ['미정', '합격', '예비합격', '불합격', '보류', '참여취소'];
const clone = value => JSON.parse(JSON.stringify(value));
export const uid = () => globalThis.crypto?.randomUUID?.() || `mach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const text = value => typeof value === 'string' ? value.trim() : String(value ?? '').trim();
const overlaps = (a, b, c, d) => a < d && c < b;
export function toMinutes(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : NaN;
}
export function toTime(value) {
  if (!Number.isInteger(value) || value < 0 || value >= 1440) return '';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function newSession(overrides = {}) {
  const venue = {campus:'ERICA', buildingId:'', building:'', room:'', waitingRoom:'', reception:'', useStart:'', useEnd:'', reservation:'미정', contact:'', memo:''};
  return {...{id:uid(), label:'1회차', date:'', start:'09:00', end:'12:00', interviewMinutes:8, turnoverMinutes:2, breaks:[], mode:'individual', groupSize:3, arrivalMinutes:10, field:'', panelistIds:[], venue}, ...overrides, venue:{...venue, ...overrides.venue}};
}
export function createProject(type = '학생단체') {
  const defaults = getTypeDefaults(type);
  const now = new Date().toISOString();
  return {schemaVersion:SCHEMA_VERSION, id:uid(), name:'새 면접', type, field:'', owner:'', startDate:'', endDate:'', sessions:[], panelists:[], applicants:[], ...clone(defaults), revision:1, history:[], prints:[], confirmed:false, confirmedAt:null, replyBy:'', inquiry:'', displayMode:'name-number', customDisplay:'{번호}', createdAt:now, updatedAt:now, operatingNotes:'', retentionDate:''};
}
export function nextApplicantNumber(project) {
  const entry = INTERVIEW_TYPES.find(v => (typeof v === 'string' ? v : v.value) === project.type);
  const prefix = typeof entry === 'object' && entry.prefix ? entry.prefix : 'APP';
  const used = new Set(project.applicants.map(a => a.number));
  let n = 1;
  while (used.has(`${prefix}-${String(n).padStart(3, '0')}`)) n++;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
export function newApplicant(project, data = {}) {
  return {...{id:uid(), number:Object.prototype.propertyIsEnumerable.call(data, 'number') ? undefined : nextApplicantNumber(project), name:'', contact:'', field:project.field || '', note:'', available:[], unavailable:[], assignment:null, locked:false, fixed:false, status:'예정', message:{generated:false,sent:false,replied:false,needsUpdate:false}, result:'미정', resultConfirmed:false, reserveRank:null, evaluations:{}, changeRequest:'', resultMessage:{generated:false,sent:false,replied:false}}, ...data, message:{generated:false,sent:false,replied:false,needsUpdate:false,...data.message}, evaluations:data.evaluations || {}};
}
export function sessionErrors(session) {
  const errors = [];
  if (!validDate(session.date)) errors.push('면접 날짜를 지정해 주세요.');
  const start = toMinutes(session.start), end = toMinutes(session.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) errors.push('시작·종료시간을 확인해 주세요. 종료시간은 시작시간보다 늦어야 합니다.');
  if (!Number.isInteger(Number(session.interviewMinutes)) || Number(session.interviewMinutes) < 1 || Number(session.interviewMinutes) > 480) errors.push('실제 면접시간을 1~480분으로 입력해 주세요.');
  if (!Number.isInteger(Number(session.turnoverMinutes)) || Number(session.turnoverMinutes) < 0 || Number(session.turnoverMinutes) > 120) errors.push('평가·교체시간을 0~120분으로 입력해 주세요.');
  if (!Number.isInteger(Number(session.groupSize)) || Number(session.groupSize) < 1 || Number(session.groupSize) > 100) errors.push('조별 인원 설정은 1~100명으로 입력해 주세요. 개인면접에서는 배정 정원에 반영되지 않습니다.');
  if (!['individual','group'].includes(session.mode)) errors.push('개인면접 또는 조별면접 방식을 선택해 주세요.');
  if (!Number.isInteger(Number(session.arrivalMinutes)) || Number(session.arrivalMinutes) < 0 || Number(session.arrivalMinutes) > 240) errors.push('도착 권장시간은 0~240분 전으로 입력해 주세요.');
  const venue=session.venue || {}, useStart=toMinutes(venue.useStart), useEnd=toMinutes(venue.useEnd);
  if ((venue.useStart || venue.useEnd) && (!Number.isFinite(useStart) || !Number.isFinite(useEnd) || useStart>=useEnd || useStart>start || useEnd<end)) errors.push('장소 사용시간은 면접 운영시간을 포함하도록 시작·종료를 모두 입력해 주세요.');
  if (!Array.isArray(session.breaks)) errors.push('휴식시간 형식을 확인해 주세요.');
  else for (const br of session.breaks) {
    const bs = toMinutes(br.start), be = toMinutes(br.end);
    if (!Number.isFinite(bs) || !Number.isFinite(be) || bs >= be || bs < start || be > end) errors.push('휴식시간은 회차 운영시간 안에서 시작보다 종료가 늦도록 입력해 주세요.');
  }
  return [...new Set(errors)];
}
export function generateSlots(session) {
  if (sessionErrors(session).length) return [];
  const duration = Number(session.interviewMinutes), step = duration + Number(session.turnoverMinutes), end = toMinutes(session.end);
  const breaks = session.breaks.map(b => [toMinutes(b.start), toMinutes(b.end)]).sort((a,b) => a[0] - b[0]);
  const slots = [];
  let cursor = toMinutes(session.start);
  while (cursor + step <= end) {
    const br = breaks.find(([s,e]) => overlaps(cursor, cursor + step, s,e));
    if (br) { cursor = br[1]; continue; }
    slots.push({sessionId:session.id, date:session.date, start:toTime(cursor), end:toTime(cursor + duration), blockEnd:toTime(cursor + step), capacity:session.mode === 'group' ? Number(session.groupSize) : 1, index:slots.length});
    cursor += step;
  }
  return slots;
}
export function applicantFits(applicant, session, slot) {
  if (session.field && session.field !== applicant.field) return false;
  const start = toMinutes(slot.start), end = toMinutes(slot.end);
  const covers = range => (!range.date || range.date === session.date) && (!range.start || toMinutes(range.start) <= start) && (!range.end || toMinutes(range.end) >= end);
  const intersects = range => (!range.date || range.date === session.date) && overlaps(start,end,range.start ? toMinutes(range.start) : 0,range.end ? toMinutes(range.end) : 1440);
  if (applicant.available?.length && !applicant.available.some(covers)) return false;
  if (applicant.unavailable?.some(intersects)) return false;
  return true;
}
function slotKey(assignment) { return `${assignment.sessionId}|${assignment.start}`; }
function activeApplicants(project) { return project.applicants.filter(a => a.status !== '참여취소'); }
export function validateMove(project, applicantId, assignment, {ignoreLock = false, ignoreCapacity = false} = {}) {
  const reasons = [], applicant = project.applicants.find(a => a.id === applicantId);
  if (!applicant) return {valid:false,reasons:['지원자를 찾을 수 없습니다.']};
  if (!ignoreLock && (applicant.locked || applicant.fixed)) reasons.push('시간 고정 또는 안내 후 잠금을 먼저 해제해 주세요.');
  if (!assignment) return {valid:reasons.length === 0,reasons};
  const session = project.sessions.find(s => s.id === assignment.sessionId);
  const slot = session && generateSlots(session).find(s => s.start === assignment.start);
  if (!session || !slot) reasons.push('해당 회차에서 사용할 수 없는 시간입니다. 운영시간·휴식·면접시간을 확인해 주세요.');
  else {
    if (!applicantFits(applicant,session,slot)) reasons.push('지원자의 가능·불가시간 또는 모집분야 조건과 맞지 않습니다. 다른 시간을 선택해 주세요.');
    const count = activeApplicants(project).filter(a => a.id !== applicantId && a.assignment && slotKey(a.assignment) === slotKey(assignment)).length;
    if (!ignoreCapacity && count >= slot.capacity) reasons.push('선택한 시간의 정원이 찼습니다. 빈 시간이나 다른 회차로 옮겨 주세요.');
  }
  return {valid:reasons.length === 0,reasons};
}
export function moveApplicant(project, id, assignment) {
  const result = validateMove(project,id,assignment);
  if (result.valid) project.applicants.find(a => a.id === id).assignment = assignment ? {sessionId:assignment.sessionId,start:assignment.start} : null;
  return result;
}
export function assignmentIssues(project) {
  const issues = [];
  for (const a of activeApplicants(project)) {
    if (!a.assignment) continue;
    const validation = validateMove(project,a.id,a.assignment,{ignoreLock:true});
    if (!validation.valid) issues.push({applicantId:a.id,number:a.number,message:validation.reasons.join(' ')});
  }
  return issues;
}
export function autoAssign(project) {
  const sessions = [...project.sessions].sort((a,b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  const slots = sessions.flatMap(s => generateSlots(s).map(slot => ({...slot,session:s})));
  const indexed = new Map(slots.map((s,i) => [slotKey(s),i]));
  const remaining = slots.map(s => s.capacity), owners = slots.map(() => []), choices = new Map(), assignedSlot = new Map();
  const applicants = activeApplicants(project), preserved = applicants.filter(a => a.locked || a.fixed);
  if (slots.length * applicants.length > 2000000) return {assigned:applicants.filter(a=>a.assignment).length,unassigned:applicants.filter(a=>!a.assignment).length,preserved:preserved.length,aborted:true,issues:[{message:'자동배정 계산 범위가 너무 큽니다. 모집분야별 프로젝트로 나누거나 회차·지원자 수를 줄여 주세요. 기존 배정은 유지했습니다.'}]};
  for (const applicant of preserved) {
    const index = applicant.assignment && indexed.get(slotKey(applicant.assignment));
    if (index !== undefined && index !== null) remaining[index] = Math.max(0, remaining[index] - 1);
  }
  const candidates = applicants.filter(a => !a.locked && !a.fixed);
  for (const applicant of candidates) {
    applicant.assignment = null;
    choices.set(applicant.id,slots.map((s,i) => remaining[i] > 0 && applicantFits(applicant,s.session,s) ? i : -1).filter(i => i >= 0));
  }
  // Maximum bipartite matching, with immutable reservations removed first. Constrained
  // applicants are visited first; augmenting paths prevent greedy avoidable omissions.
  const sorted = [...candidates].sort((a,b) => choices.get(a.id).length - choices.get(b.id).length);
  for (const applicant of sorted) {
    const queue = [applicant.id], seenApplicants = new Set(queue), seenSlots = new Set(), parents = new Map();
    let found = null;
    for (let q = 0; q < queue.length && !found; q++) {
      const current = queue[q];
      for (const index of choices.get(current)) {
        if (seenSlots.has(index)) continue;
        seenSlots.add(index);
        if (owners[index].length < remaining[index]) { found = {id:current,index}; break; }
        for (const owner of owners[index]) if (!seenApplicants.has(owner)) {
          seenApplicants.add(owner); parents.set(owner,{id:current,index}); queue.push(owner);
        }
      }
    }
    while (found) {
      const {id,index} = found, previous = assignedSlot.get(id);
      if (previous !== undefined) owners[previous] = owners[previous].filter(owner => owner !== id);
      owners[index].push(id); assignedSlot.set(id,index); found = parents.get(id) || null;
    }
  }
  for (const applicant of candidates) {
    const index = assignedSlot.get(applicant.id);
    if (index !== undefined) applicant.assignment = {sessionId:slots[index].sessionId,start:slots[index].start};
  }
  return {assigned:applicants.filter(a => a.assignment).length,unassigned:applicants.filter(a => !a.assignment).length,preserved:preserved.length,issues:[...sessions.flatMap(s => sessionErrors(s).map(message => ({sessionId:s.id,message}))),...assignmentIssues(project)]};
}
export function simulate(project) {
  const sessions = project.sessions.map(session => {
    const slots = generateSlots(session), capacity = slots.reduce((sum,s) => sum+s.capacity,0);
    const count = activeApplicants(project).filter(a => a.assignment?.sessionId === session.id).length;
    return {sessionId:session.id,slots:slots.length,capacity,assigned:count,slotMinutes:Number(session.interviewMinutes)+Number(session.turnoverMinutes),operatingMinutes:Math.max(0,toMinutes(session.end)-toMinutes(session.start)) || 0,interviewMinutes:slots.length*Number(session.interviewMinutes),expectedEnd:slots.at(-1)?.blockEnd || '',errors:sessionErrors(session)};
  });
  const applicants = activeApplicants(project), capacity = sessions.reduce((sum,s) => sum+s.capacity,0), assigned = applicants.filter(a => a.assignment).length;
  const shortage=Math.max(0,applicants.length-capacity),largestGroup=Math.max(1,...project.sessions.map(s=>s.mode==='group'?Number(s.groupSize)||1:1));
  return {sessions,capacity,applicants:applicants.length,assigned,unassigned:applicants.length-assigned,slots:sessions.reduce((sum,s) => sum+s.slots,0),operatingMinutes:sessions.reduce((sum,s) => sum+s.operatingMinutes,0),shortage,neededSlots:Math.ceil(shortage/largestGroup),neededSlotsBasis:largestGroup,additionalSlotsBySession:project.sessions.map(s=>({sessionId:s.id,neededSlots:Math.ceil(shortage/(s.mode==='group'?Number(s.groupSize)||1:1))})),issues:assignmentIssues(project)};
}
export function sessionConflicts(project) {
  const conflicts = [];
  for (let i=0;i<project.sessions.length;i++) for (let j=i+1;j<project.sessions.length;j++) {
    const a=project.sessions[i], b=project.sessions[j];
    if (!a.date || a.date !== b.date) continue;
    const sessionIds=[a.id,b.id], timing=overlaps(toMinutes(a.start),toMinutes(a.end),toMinutes(b.start),toMinutes(b.end));
    if (timing) for (const id of a.panelistIds.filter(id => b.panelistIds.includes(id))) {
      const name=project.panelists.find(p=>p.id===id)?.name || '등록되지 않은 위원';
      conflicts.push({type:'panelist',panelistId:id,sessionIds,message:`${name} 위원의 ${a.label}·${b.label} 일정이 겹칩니다. 참여 회차나 시간을 조정해 주세요.`});
    }
    const av=a.venue||{},bv=b.venue||{}, sameBuilding = text(av.campus)===text(bv.campus) && (av.buildingId&&bv.buildingId ? av.buildingId===bv.buildingId : !!text(av.building)&&text(av.building)===text(bv.building));
    const placeOverlap=overlaps(toMinutes(av.useStart||a.start),toMinutes(av.useEnd||a.end),toMinutes(bv.useStart||b.start),toMinutes(bv.useEnd||b.end));
    if (sameBuilding && (av.buildingId || text(av.building)) && text(av.room) && text(av.room)===text(bv.room) && placeOverlap) conflicts.push({type:'room',sessionIds,message:`${a.label}·${b.label}의 ${av.building} ${av.room} 장소 사용시간이 겹칩니다. 다른 장소 또는 사용시간을 지정해 주세요.`});
    if (sameBuilding && placeOverlap) for (const [interview,waiting,interviewLabel,waitingLabel] of [[av,bv,a.label,b.label],[bv,av,b.label,a.label]]) {
      if (text(interview.room) && text(interview.room)===text(waiting.waitingRoom)) conflicts.push({type:'room',sessionIds,message:`${interviewLabel} 면접실과 ${waitingLabel} 대기실이 ${interview.building} ${interview.room}에서 겹칩니다. 면접실과 대기실을 분리해 주세요.`});
    }
  }
  return conflicts;
}
export function scoreWarnings(project) {
  const sum=project.criteria.reduce((total,c)=>total+Number(c.max||0),0), issues=[];
  if (!project.criteria.length) issues.push('평가항목을 하나 이상 등록해 주세요.');
  const target=Number(project.targetScore), tolerance=Number.EPSILON*Math.max(1,Math.abs(sum),Math.abs(target))*Math.max(1,project.criteria.length);
  if (!Number.isFinite(target)||target<=0) issues.push('목표 총점은 0보다 큰 숫자로 입력해 주세요.');
  if (!Number.isFinite(sum)||Math.abs(sum-target)>tolerance) issues.push(`배점 합계 ${Number(sum.toPrecision(12))}점이 목표 총점 ${project.targetScore}점과 다릅니다. 배점 또는 목표 총점을 수정해 주세요.`);
  if (project.criteria.some(c=>!Number.isFinite(Number(c.max))||Number(c.max)<=0)) issues.push('평가항목별 배점은 0보다 큰 숫자로 입력해 주세요.');
  return issues;
}
export function evaluationSummary(project, applicant) {
  const session=project.sessions.find(s=>s.id===applicant.assignment?.sessionId);
  const ids=[...new Set(session?.panelistIds || [])];
  const evaluations=ids.map(panelistId=>{
    const scores=applicant.evaluations?.[panelistId]?.scores || {}, missing=[],invalid=[];
    let total=0;
    for (const criterion of project.criteria) {
      const raw=scores[criterion.id];
      if (raw===undefined||raw===null||raw===''||(typeof raw==='string'&&raw.trim()==='')) missing.push(criterion.id);
      else if ((typeof raw !== 'number' && typeof raw !== 'string')||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>Number(criterion.max)) invalid.push(criterion.id);
      else total+=Number(raw);
    }
    return {panelistId,total,missing,invalid,complete:project.criteria.length>0 && !missing.length&&!invalid.length};
  });
  const completed=evaluations.filter(e=>e.complete), complete=ids.length>0 && completed.length===ids.length && !scoreWarnings(project).length;
  const total=completed.reduce((sum,e)=>sum+e.total,0);
  const missingPanelists=evaluations.filter(e=>!e.complete).map(e=>({id:e.panelistId,name:project.panelists.find(p=>p.id===e.panelistId)?.name || '미등록 위원',missing:e.missing,invalid:e.invalid}));
  const labels=ids=>ids.map(id=>project.criteria.find(c=>c.id===id)?.label||id).join(', ');
  const missing=[...(!session?['배정된 회차가 없습니다.']:!ids.length?['회차 참여위원을 등록해 주세요.']:[]),...missingPanelists.flatMap(panel=>[...(panel.missing.length?[`${panel.name}: ${labels(panel.missing)} 미입력`]:[]),...(panel.invalid.length?[`${panel.name}: ${labels(panel.invalid)} 점수 범위 확인`]:[])]),...scoreWarnings(project)];
  return {complete,expected:ids.length,countComplete:completed.length,missingPanelists,missing,evaluations,total:completed.length?total:null,average:complete?total/ids.length:null};
}
export function getApplicantTiming(project, applicant) {
  const session=project.sessions.find(s=>s.id===applicant.assignment?.sessionId);
  const slot=session && generateSlots(session).find(s=>s.start===applicant.assignment?.start);
  if (!session || !slot) return null;
  const arrival=toMinutes(slot.start)-Number(session.arrivalMinutes||0);
  return {...slot,session,arrival:toTime(Math.max(0,arrival))};
}
function scheduleSnapshot(project,applicant) {
  const timing=getApplicantTiming(project,applicant), session=timing?.session, venue=session?.venue || {};
  return {number:applicant.number,name:applicant.name,field:applicant.field,date:session?.date||'',start:applicant.assignment?.start||'',end:timing?.end||'',arrival:timing?.arrival||'',sessionId:applicant.assignment?.sessionId||'',sessionLabel:session?.label||'',campus:venue.campus||'',buildingId:venue.buildingId||'',building:venue.building||'',room:venue.room||'',waitingRoom:venue.waitingRoom||'',reception:venue.reception||'',materials:project.materials,replyBy:project.replyBy,inquiry:project.inquiry,projectName:project.name};
}
export function captureSchedule(project) {
  const {revision,history,prints,updatedAt,...state}=project;
  return {confirmed:project.confirmed,revision:project.revision,state:JSON.stringify(state),applicants:Object.fromEntries(project.applicants.map(a=>[a.id,scheduleSnapshot(project,a)])),resultBasis:Object.fromEntries(project.applicants.map(a=>[a.id,JSON.stringify({criteria:project.criteria,target:project.targetScore,panels:project.sessions.find(s=>s.id===a.assignment?.sessionId)?.panelistIds||[],evaluations:a.evaluations,result:a.result,reserveRank:a.reserveRank})]))};
}
export function trackChanges(project,before,label='설정 변경') {
  const after=captureSchedule(project);
  if (before.state===after.state) return [];
  const changes=[];
  for (const applicant of project.applicants) if (before.resultBasis?.[applicant.id] && before.resultBasis[applicant.id]!==after.resultBasis[applicant.id]) applicant.resultConfirmed=false;
  // Reopening a confirmed timetable does not retract messages already sent.
  // Keep comparing their dates/places after confirmation is released as well.
  if (before.confirmed || project.confirmed || project.confirmedAt || project.applicants.some(a=>a.message?.sent)) {
    for (const applicant of project.applicants) {
      const previous=before.applicants[applicant.id], next=after.applicants[applicant.id];
      if (previous && JSON.stringify(previous)!==JSON.stringify(next)) {
        const fields=Object.keys(next).filter(k=>previous[k]!==next[k]);
        const change={id:uid(),at:new Date().toISOString(),applicantId:applicant.id,number:applicant.number,label,fields,before:previous,after:next};
        changes.push(change);
        if (applicant.message.sent) applicant.message.needsUpdate=true;
        applicant.resultConfirmed=false;
      }
    }
    for (const [id,previous] of Object.entries(before.applicants)) if (!after.applicants[id]) changes.push({id:uid(),at:new Date().toISOString(),applicantId:id,number:previous.number,label:'지원자 삭제',fields:['deleted'],before:previous,after:null});
  }
  project.history.push(...changes);
  // A saved schedule may cease to be valid after editing a session, venue,
  // availability or roster. Keep the old assignments for review but require
  // confirmation again before they can be marked as sent.
  if (project.confirmed && scheduleIssues(project).length) project.confirmed=false;
  project.revision=Math.max(1,Number(project.revision)||1)+1;
  project.updatedAt=new Date().toISOString();
  return changes;
}
function scheduleIssues(project) {
  const issues=[...project.sessions.flatMap(s=>sessionErrors(s).map(message=>({sessionId:s.id,message}))),...assignmentIssues(project),...sessionConflicts(project)];
  const unassigned=activeApplicants(project).filter(a=>!a.assignment);
  if (!project.sessions.length) issues.push({message:'회차를 하나 이상 등록해 주세요.'});
  if (unassigned.length) issues.push({message:`미배정 지원자 ${unassigned.length}명의 시간을 먼저 배정해 주세요.`});
  return issues;
}
export function confirmSchedule(project) {
  const issues=scheduleIssues(project);
  if (issues.length) return {valid:false,issues};
  project.confirmed=true; project.confirmedAt=new Date().toISOString();
  return {valid:true,issues:[]};
}
export function recordPrint(project,kind,options={}) {
  const print={id:uid(),kind,revision:project.revision,at:new Date().toISOString(),...options};
  project.prints.push(print); return print;
}
export function stalePrints(project) {
  const scope=p=>`${p.kind}|${p.sessionId||''}|${p.panelistId||''}`;
  const refreshed=new Set(project.prints.filter(p=>p.revision===project.revision&&p.confirmed===true).map(scope));
  return project.prints.filter(p=>p.revision<project.revision&&!refreshed.has(scope(p)));
}
/** Deliberate erasure: call outside trackChanges so deleted snapshots cannot be re-created. */
export function purgeApplicantData(project) {
  project.applicants=[];
  project.history=[];
  project.prints=[];
  project.confirmed=false;
  project.confirmedAt=null;
  project.resultsConfirmedAt=null;
  project.revision=Math.max(1,Number(project.revision)||1)+1;
  project.updatedAt=new Date().toISOString();
  return project;
}
export function cloneProject(source,{venue=false,panelists=false}={}) {
  const project=createProject(source.type);
  Object.assign(project,{name:`${source.name} (설정 복사)`,field:source.field,owner:source.owner,questions:clone(source.questions),criteria:clone(source.criteria),targetScore:source.targetScore,templates:clone(source.templates),materials:source.materials,displayMode:source.displayMode,customDisplay:source.customDisplay});
  if(typeof source.protocol==='string')project.protocol=source.protocol;
  project.checklist=source.checklist.map(item=>({...clone(item),done:false,due:'',deadline:'',note:''}));
  const panelMap=new Map();
  if (panelists) project.panelists=source.panelists.map(person=>{const id=uid();panelMap.set(person.id,id);return {id,name:person.name,organization:person.organization,position:person.position,role:person.role,contact:'',note:'',attendance:{}};});
  project.sessions=source.sessions.map(s=>newSession({...clone(s),id:uid(),date:'',panelistIds:panelists?s.panelistIds.map(id=>panelMap.get(id)).filter(Boolean):[],venue:venue?{...clone(s.venue),reservation:'미정',contact:'',memo:''}:undefined}));
  return project;
}
export function createDemo() {
  const project=createProject('학생단체'); project.name='학생홍보단 12기 선발 면접';project.field='홍보·SNS';project.owner='학생지원팀';project.materials='학생증 또는 신분증, 필기구';project.inquiry='학생지원팀 031-000-0000';project.replyBy='면접 전날 17:00';
  project.panelists=[{id:uid(),name:'김위원',organization:'학생지원팀',position:'팀장',role:'위원장',contact:'',note:'예시 인물',attendance:{}},{id:uid(),name:'박위원',organization:'홍보팀',position:'담당',role:'면접위원',contact:'',note:'예시 인물',attendance:{}}];
  const today=new Date(), local=new Date(today.getTime()+9*3600000);local.setUTCDate(local.getUTCDate()+7);const date=local.toISOString().slice(0,10);local.setUTCDate(local.getUTCDate()+1);const nextDate=local.toISOString().slice(0,10);
  project.sessions=[newSession({label:'1일차 오전',date,start:'09:00',end:'10:00',panelistIds:project.panelists.map(p=>p.id),venue:{building:'학생회관',room:'201호',waitingRoom:'202호',reception:'2층 로비',reservation:'예약 확정'}}),newSession({label:'2일차 오후',date:nextDate,start:'14:00',end:'15:00',panelistIds:[project.panelists[0].id],venue:{building:'학생회관',room:'201호',waitingRoom:'202호',reservation:'문의 중'}})];
  for(const [i,name] of ['김하늘','이서준','박지우','최서연','정민준','김하늘','한지민','윤도현'].entries()) project.applicants.push(newApplicant(project,{name,contact:'',note:'실제 개인정보가 아닌 예시',unavailable:i===0?[{date,start:'09:00',end:'09:20'}]:[]}));
  autoAssign(project);return project;
}

function isRecord(value) { return !!value && typeof value==='object' && !Array.isArray(value); }
export function exportBackup(projects) { return JSON.stringify({format:BACKUP_FORMAT,version:SCHEMA_VERSION,exportedAt:new Date().toISOString(),projects},null,2); }
export function validateBackup(input) {
  const errors=[];let value;
  if(typeof input==='string'&&input.length>30*1024*1024)return {valid:false,errors:['백업 파일은 30MB까지 가져올 수 있습니다. 프로젝트별 내보내기를 사용해 주세요.'],projects:[]};
  try { value=typeof input==='string'?JSON.parse(input):clone(input); } catch { return {valid:false,errors:['JSON 파일을 읽을 수 없습니다. 원본 백업 파일을 선택해 주세요.'],projects:[]}; }
  if(!isRecord(value)||value.format!==BACKUP_FORMAT||value.version!==SCHEMA_VERSION||!Array.isArray(value.projects)) return {valid:false,errors:['면접 준비 원큐 V0.1 백업 형식이 아닙니다.'],projects:[]};
  if(value.projects.length>100) errors.push('한 번에 가져올 수 있는 프로젝트는 100개까지입니다.');
  const seen=new Set();
  const string=(v,path,max=10000)=>{if(typeof v!=='string'||v.length>max)errors.push(`${path}: 문자 형식 또는 길이가 올바르지 않습니다.`);};
  const list=(v,path,max)=>{if(!Array.isArray(v)||v.length>max){errors.push(`${path}: 목록 형식 또는 개수 제한을 확인해 주세요.`);return [];}return v;};
  const records=(v,path,max)=>list(v,path,max).filter(x=>{if(!isRecord(x)){errors.push(`${path}: 항목 형식이 올바르지 않습니다.`);return false;}return true;});
  const ids=(items,path)=>{const ids=new Set();for(const item of items){string(item.id,`${path}.id`,200);if(!item.id||ids.has(item.id))errors.push(`${path}: 내부 ID가 비어 있거나 중복되었습니다.`);ids.add(item.id);}return ids;};
  const ranges=(ranges,path)=>{for(const range of records(ranges,path,300)){if(range.date&&!validDate(range.date))errors.push(`${path}: 날짜가 올바르지 않습니다.`);if(range.start&&!Number.isFinite(toMinutes(range.start)))errors.push(`${path}: 시작시간이 올바르지 않습니다.`);if(range.end&&!Number.isFinite(toMinutes(range.end)))errors.push(`${path}: 종료시간이 올바르지 않습니다.`);if(range.start&&range.end&&toMinutes(range.start)>=toMinutes(range.end))errors.push(`${path}: 시간 순서가 올바르지 않습니다.`);}};
  const forbidden=(obj,depth=0)=>{if(depth>20){errors.push('백업 데이터가 지나치게 중첩되어 있습니다.');return;}if(obj&&typeof obj==='object')for(const key of Object.keys(obj)){if(['__proto__','constructor','prototype'].includes(key))errors.push('허용하지 않는 데이터 필드가 포함되어 있습니다.');else forbidden(obj[key],depth+1);}};
  forbidden(value);
  for(const p of value.projects.slice(0,100)) {
    if(!isRecord(p)){errors.push('프로젝트 형식이 올바르지 않습니다.');continue;}
    string(p.id,'프로젝트 ID',200);if(!p.id||seen.has(p.id))errors.push('프로젝트 ID가 비어 있거나 중복되었습니다.');seen.add(p.id);
    for(const key of ['name','type','field','owner','materials','replyBy','inquiry','displayMode'])string(p[key],`프로젝트 ${key}`);
    for(const key of ['protocol','customDisplay','operatingNotes'])if(p[key]!==undefined)string(p[key],`프로젝트 ${key}`,10000);
    if(p.schemaVersion!==SCHEMA_VERSION)errors.push('지원하지 않는 프로젝트 버전입니다.');
    if(!Number.isInteger(p.revision)||p.revision<1)errors.push('문서 버전이 올바르지 않습니다.');
    if(typeof p.confirmed!=='boolean')errors.push('시간표 확정 상태가 올바르지 않습니다.');
    const sessions=records(p.sessions,'회차',MAX_SESSIONS),sessionIds=ids(sessions,'회차');
    const panels=records(p.panelists,'위원',300),panelIds=ids(panels,'위원');
    for(const panel of panels){
      for(const key of ['name','organization','position','role','contact','note'])string(panel[key],`위원 ${key}`);
      if(panel.attendance!==undefined){if(!isRecord(panel.attendance))errors.push('위원 참석확인 형식이 올바르지 않습니다.');else for(const status of Object.values(panel.attendance))string(status,'위원 참석확인',100);}
    }
    for(const s of sessions) {
      for(const key of ['label','date','start','end','field'])string(s[key],`회차 ${key}`,300);
      if(s.date&&!validDate(s.date))errors.push('회차 날짜가 올바르지 않습니다.');
      if(!Number.isFinite(toMinutes(s.start))||!Number.isFinite(toMinutes(s.end))||toMinutes(s.start)>=toMinutes(s.end))errors.push('회차 시간이 올바르지 않습니다.');
      for(const [key,min,max] of [['interviewMinutes',1,480],['turnoverMinutes',0,120],['groupSize',1,100],['arrivalMinutes',0,240]])if(!Number.isInteger(s[key])||s[key]<min||s[key]>max)errors.push(`회차 ${key} 범위를 확인해 주세요.`);
      if(!['individual','group'].includes(s.mode))errors.push('면접 방식이 올바르지 않습니다.');
      for(const id of list(s.panelistIds,'회차 위원',300))if(!panelIds.has(id))errors.push('회차에서 없는 위원을 참조하고 있습니다.');
      ranges(s.breaks,'휴식시간');
      if(!isRecord(s.venue))errors.push('장소 형식이 올바르지 않습니다.');else {
        for(const key of ['campus','buildingId','building','room','waitingRoom','reception','useStart','useEnd','reservation','contact','memo'])string(s.venue[key],`장소 ${key}`);
        const start=toMinutes(s.venue.useStart),end=toMinutes(s.venue.useEnd);
        if((s.venue.useStart||s.venue.useEnd)&&(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||start>toMinutes(s.start)||end<toMinutes(s.end)))errors.push('장소 사용시간은 면접 운영시간을 포함해야 합니다.');
      }
    }
    const criteria=records(p.criteria,'평가항목',10),criterionIds=ids(criteria,'평가항목');
    if(!Number.isFinite(p.targetScore)||p.targetScore<=0||p.targetScore>10000)errors.push('목표 총점이 올바르지 않습니다.');
    for(const c of criteria){string(c.label,'평가항목 이름',80);for(const key of ['description','rubric'])string(c[key],`평가항목 ${key}`);if(!Number.isFinite(c.max)||c.max<=0||c.max>10000)errors.push('평가 배점이 올바르지 않습니다.');}
    const applicants=records(p.applicants,'지원자',MAX_APPLICANTS);ids(applicants,'지원자');const numbers=new Set();
    for(const a of applicants) {
      for(const key of ['number','name','contact','field','note'])string(a[key],`지원자 ${key}`);
      for(const key of ['changeRequest','evaluationExemptReason'])if(a[key]!==undefined)string(a[key],`지원자 ${key}`);
      if(typeof a.name==='string'&&!a.name.trim())errors.push('지원자 이름이 비어 있습니다.');
      if(!a.number||numbers.has(a.number))errors.push('지원자번호가 비어 있거나 중복되었습니다.');numbers.add(a.number);
      if(!APPLICANT_STATUSES.includes(a.status)||!RESULT_STATUSES.includes(a.result))errors.push('지원자 운영·결과 상태가 올바르지 않습니다.');
      for(const key of ['locked','fixed','resultConfirmed'])if(typeof a[key]!=='boolean')errors.push(`지원자 ${key} 상태가 올바르지 않습니다.`);
      if(!isRecord(a.message))errors.push('안내 상태 형식이 올바르지 않습니다.');else for(const key of ['generated','sent','replied','needsUpdate'])if(typeof a.message[key]!=='boolean')errors.push('안내 상태 값이 올바르지 않습니다.');
      if(a.resultMessage!==undefined){if(!isRecord(a.resultMessage))errors.push('결과 안내 상태 형식이 올바르지 않습니다.');else for(const key of ['generated','sent','replied','needsUpdate'])if(a.resultMessage[key]!==undefined&&typeof a.resultMessage[key]!=='boolean')errors.push('결과 안내 상태 값이 올바르지 않습니다.');}
      if(a.reserveRank!==undefined&&a.reserveRank!==null&&(!Number.isInteger(a.reserveRank)||a.reserveRank<1))errors.push('예비순번은 1 이상의 정수여야 합니다.');
      ranges(a.available,'가능시간');ranges(a.unavailable,'불가시간');
      if(a.assignment!==null&&(!isRecord(a.assignment)||!sessionIds.has(a.assignment.sessionId)||!Number.isFinite(toMinutes(a.assignment.start))))errors.push('지원자 배정이 없는 회차나 잘못된 시간을 참조합니다.');
      if(!isRecord(a.evaluations))errors.push('평가 데이터 형식이 올바르지 않습니다.');else for(const [id,e] of Object.entries(a.evaluations)) {
        if(!panelIds.has(id)||!isRecord(e)||!isRecord(e.scores)){errors.push('평가 위원 또는 점수 형식이 올바르지 않습니다.');continue;}
        if(e.comment!==undefined)string(e.comment,'평가의견');
        // A later max-score edit may legitimately leave an old score out of the
        // current range. Preserve it on restore; evaluationSummary flags it and
        // blocks completion instead of silently clamping or losing the score.
        for(const [cid,score] of Object.entries(e.scores))if(!criterionIds.has(cid)||!(score===''||score===null||(typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=10000)))errors.push('평가항목 또는 입력 점수가 올바르지 않습니다.');
      }
    }
    const questions=records(p.questions,'질문',1000);ids(questions,'질문');for(const q of questions){for(const key of ['field','tag','text','criterionId','followUp'])string(q[key],`질문 ${key}`);if(!Number.isFinite(q.minutes)||q.minutes<0||q.minutes>480)errors.push('질문 소요시간이 올바르지 않습니다.');if(typeof q.selected!=='boolean')errors.push('질문 선택 상태가 올바르지 않습니다.');}
    if(!isRecord(p.templates))errors.push('안내문 템플릿 형식이 올바르지 않습니다.');else for(const [k,v] of Object.entries(p.templates)){if(!isRecord(v))errors.push(`템플릿 ${k}: 형식이 올바르지 않습니다.`);else{string(v.label,`템플릿 ${k} 이름`,300);string(v.text,`템플릿 ${k} 본문`,20000);}}
    const checks=records(p.checklist,'체크리스트',300);ids(checks,'체크리스트');for(const c of checks){string(c.label,'체크리스트 이름');if(typeof c.done!=='boolean')errors.push('체크리스트 완료 상태가 올바르지 않습니다.');}
    for(const h of records(p.history,'변경 이력',50000)){for(const key of ['id','at','applicantId','number','label'])string(h[key],`변경 이력 ${key}`,500);if(!Array.isArray(h.fields)||h.fields.some(f=>typeof f!=='string')||!isRecord(h.before)||(h.after!==null&&!isRecord(h.after)))errors.push('변경 이력의 변경 전·후 형식이 올바르지 않습니다.');}
    for(const print of records(p.prints,'출력 이력',10000)){for(const key of ['id','kind','at'])string(print[key],`출력 ${key}`,500);if(!Number.isInteger(print.revision)||print.revision<1)errors.push('출력 버전이 올바르지 않습니다.');}
  }
  return {valid:errors.length===0,errors:[...new Set(errors)].slice(0,30),projects:errors.length?[]:value.projects};
}
