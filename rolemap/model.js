export const SCHEMA = 1;
export const MAX_MEMBERS = 50;
export const uid = () => globalThis.crypto.randomUUID();
export const clone = x => structuredClone(x);
export const ROLES = ['처장','부처장','팀장','선임팀원','팀원'];
export function hierarchy(names) {
  const members = names.map((name,i)=>({id:uid(),name:name.trim(),role:'팀원',team:'',parentId:null,color:i%6}));
  if(!members.length) return members;
  members[0].role='처장';
  if(members[1]) {members[1].role='부처장';members[1].parentId=members[0].id;}
  const rest=members.slice(2), groups=Math.max(1,Math.ceil(rest.length/6));
  for(let g=0;g<groups;g++) {
    const group=rest.slice(Math.floor(g*rest.length/groups),Math.floor((g+1)*rest.length/groups));
    group.forEach((m,i)=>{m.team=`${g+1}팀`;m.role=i===0?'팀장':i===1?'선임팀원':'팀원';m.parentId=i===0?members[1].id:i===1?group[0].id:group[1].id;});
  }
  return members;
}
export function makeDemo() {
 const m=hierarchy(['김민준','이서연','박도윤','최지우','정하린','강서준','윤지호','한수빈','오예린','임현우']);
 m.forEach((p,i)=>{if(i>1)p.team=i<6?'기획운영팀':'사업지원팀';});
 const labels=['연간 사업계획 수립','부서 성과 총괄','예산 편성 및 조정','대외 협력 및 보고','월간 실적 관리','조직·인사 운영','사업 일정 관리','회의체 운영','성과지표 관리','문서 및 기록 관리','계약·발주 관리','지출 및 정산','협력사 커뮤니케이션','내부 교육 운영','규정 및 지침 관리','자료 취합 및 보고','행사 기획 및 운영','시스템 운영 관리','민원 및 문의 대응','자산·비품 관리','신규 사업 검토','부서 간 협업 조율','인수인계 문서 정비','업무 프로세스 개선','비상 대응 계획','연말 평가 준비'];
 const assign=[0,0,1,1,2,2,3,3,4,4,6,6,7,7,8,8,5,5,9,9];
 return {schemaVersion:SCHEMA,updatedAt:new Date().toISOString(),activeDepartmentId:'dept-demo',departments:[{id:'dept-demo',name:'경영지원처',description:'함께 만드는 명확한 역할과 책임',effectiveDate:new Date().toLocaleDateString('sv-SE'),members:m,tasks:labels.map((title,i)=>({id:uid(),code:String.fromCharCode(65+i),title,category:i<10?'기획·운영':i<20?'사업·지원':'공통업무',owners:i<20?[m[assign[i]].id,...([4,10,14,18].includes(i)?[m[assign[i]===9?8:assign[i]+1].id]:[])]:[],weight:i%5===0?3:i%3===0?2:1,priority:i%7===0?'높음':'보통',notes:''}))}],history:[]};
}
export function validateState(input) {
 if(!input||typeof input!=='object'||input.schemaVersion!==SCHEMA) throw Error('지원하지 않는 파일 형식입니다. MACH에서 저장한 JSON 파일을 선택해 주세요.');
 if(!Array.isArray(input.departments)||!input.departments.length||input.departments.length>30) throw Error('부서는 1~30개여야 합니다.');
 const text=(s,max=160)=>typeof s==='string'&&s.length<=max;
 const ids=new Set();
 for(const d of input.departments) {
  if(!text(d.id)||!d.id||ids.has(d.id)||!text(d.name,60)||!d.name.trim()) throw Error('부서 정보가 올바르지 않습니다.');ids.add(d.id);
  if(!Array.isArray(d.members)||d.members.length>MAX_MEMBERS||!Array.isArray(d.tasks)||d.tasks.length>500) throw Error(`부서별 구성원은 최대 ${MAX_MEMBERS}명, 업무는 최대 500개입니다.`);
  const mids=new Set(d.members.map(m=>m.id)),tids=new Set();
  if(mids.size!==d.members.length) throw Error('중복된 구성원 ID가 있습니다.');
  const units=d.units||[];
  if(!Array.isArray(units)||units.length>100)throw Error('팀·파트는 최대 100개까지 가능합니다.');
  const uids=new Set(units.map(u=>u.id));
  if(uids.size!==units.length)throw Error('팀·파트 ID가 중복되었습니다.');
  for(const u of units){
   if(!text(u.id)||!u.id||!text(u.name,60)||!u.name.trim()||!['team','part','external'].includes(u.type)||u.parentId!=null&&!uids.has(u.parentId)||u.managerId!=null&&!mids.has(u.managerId)||!text(u.contact??'',100)||!text(u.notes??'',3000)||u.headcount!=null&&(!Number.isInteger(u.headcount)||u.headcount<0||u.headcount>10000)||u.scope!==undefined&&(!Array.isArray(u.scope)||u.scope.length>100||u.scope.some(s=>!text(s,300))))throw Error('팀·파트 또는 센터 정보가 올바르지 않습니다.');
   const seen=new Set([u.id]);let p=u.parentId;while(p){if(seen.has(p))throw Error('팀·파트에 순환 관계가 있습니다.');seen.add(p);p=units.find(x=>x.id===p)?.parentId;}
  }
  for(const m of d.members) {
   if(!text(m.id)||!m.id||!text(m.name,40)||!m.name.trim()||!text(m.role,30)||!text(m.team??'',60)||(!m.parentId&&m.parentId!==null)||m.parentId&&(!mids.has(m.parentId)||m.parentId===m.id)) throw Error('구성원 또는 보고 대상 정보가 올바르지 않습니다.');
   if(!text(m.grade??'',30)||!text(m.employment??'',30)||m.unitId!=null&&!uids.has(m.unitId))throw Error('직급·고용구분 또는 소속 파트를 확인해 주세요.');
   const seen=new Set([m.id]);let p=m.parentId;
   while(p){if(seen.has(p))throw Error('조직도에 순환 관계가 있습니다.');seen.add(p);p=d.members.find(x=>x.id===p)?.parentId;}
  }
  for(const t of d.tasks) {
   if(!text(t.id)||!t.id||tids.has(t.id)||!text(t.title,120)||!t.title.trim()||!text(t.code??'',16)||!text(t.category??'',50)||!text(t.notes??'',3000)||!Array.isArray(t.owners)||new Set(t.owners).size!==t.owners.length||t.owners.some(id=>!mids.has(id))||![1,2,3].includes(t.weight)||!['보통','높음','낮음'].includes(t.priority)) throw Error('업무 또는 담당자 정보가 올바르지 않습니다.');tids.add(t.id);
   if(t.primaryOwnerId!=null&&!t.owners.includes(t.primaryOwnerId)||t.unitId!=null&&!uids.has(t.unitId))throw Error('업무의 주담당 또는 소속 파트가 올바르지 않습니다.');
  }
  if(d.description!==undefined&&!text(d.description,200)) throw Error('부서 설명이 너무 깁니다.');
  if(d.effectiveDate!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveDate))throw Error('시행일 형식이 올바르지 않습니다.');
  if(d.reference&&(!text(d.reference.label,200)||!text(d.reference.dateText??'',80)||!Array.isArray(d.reference.notes)||d.reference.notes.length>30||d.reference.notes.some(n=>!text(n,1500))))throw Error('원본 검토사항 형식이 올바르지 않습니다.');
 }
 const result=clone(input);result.history=Array.isArray(input.history)?input.history.slice(0,100).filter(x=>x&&text(x.text,300)&&text(x.at,60)):[];
 result.activeDepartmentId=result.departments.some(d=>d.id===input.activeDepartmentId)?input.activeDepartmentId:result.departments[0].id;
 return result;
}
export function moveMember(dept,id,parentId) {
 const m=dept.members.find(m=>m.id===id);if(!m)throw Error('구성원을 찾을 수 없습니다.');
 if(parentId&&!dept.members.some(m=>m.id===parentId))throw Error('보고 대상을 찾을 수 없습니다.');
 let p=parentId;while(p){if(p===id)throw Error('본인이나 하위 구성원을 보고 대상으로 지정할 수 없습니다.');p=dept.members.find(m=>m.id===p)?.parentId;}
 m.parentId=parentId;
}
export function assignTask(dept,taskId,memberId,mode='move') {
 const t=dept.tasks.find(t=>t.id===taskId);if(!t)throw Error('업무를 찾을 수 없습니다.');
 if(memberId&&!dept.members.some(m=>m.id===memberId))throw Error('구성원을 찾을 수 없습니다.');
 t.owners=memberId?(mode==='share'?[...new Set([...t.owners,memberId])]:[memberId]):[];
 if(mode!=='share'||!memberId)t.primaryOwnerId=memberId||null;
}
export function removeMember(dept,id) {
 const p=dept.members.find(m=>m.id===id);if(!p)return;
 dept.members.forEach(m=>{if(m.parentId===id)m.parentId=p.parentId;});
 dept.tasks.forEach(t=>{const lead=primaryOwner(t);t.owners=t.owners.filter(x=>x!==id);if(lead===id)t.primaryOwnerId=t.owners[0]||null;});dept.members=dept.members.filter(m=>m.id!==id);
 (dept.units||[]).forEach(u=>{if(u.managerId===id)u.managerId=null;});
}
export function primaryOwner(task){return Object.hasOwn(task,'primaryOwnerId')?task.primaryOwnerId:(task.owners[0]||null);}
export function ownerRole(task,id){const lead=primaryOwner(task);return lead===id?'주담당':lead?'협업 담당':task.owners.length>1?'공동 담당':'담당 (주담당 미지정)';}
export function unitPath(dept,id){const path=[];let u=(dept.units||[]).find(u=>u.id===id);while(u){path.unshift(u.name);u=dept.units.find(x=>x.id===u.parentId);}return path.join(' / ');}
export function removeUnit(dept,id){const u=(dept.units||[]).find(u=>u.id===id);if(!u)return;dept.members.forEach(m=>{if(m.unitId===id)m.unitId=u.parentId||null;});dept.tasks.forEach(t=>{if(t.unitId===id)t.unitId=u.parentId||null;});dept.units.forEach(x=>{if(x.parentId===id)x.parentId=u.parentId||null;});dept.units=dept.units.filter(x=>x.id!==id);}
export function mergeWorkspace(current,incoming){
 const result=clone(current),source=validateState(incoming);if(result.departments.length+source.departments.length>30)throw Error('추가 후 부서 수가 최대 30개를 넘습니다.');
 const added=source.departments.map(d=>({...d,id:uid(),name:result.departments.some(x=>x.name===d.name)?`${d.name.slice(0,52)} (가져옴)`:d.name}));
 result.departments.push(...added);result.activeDepartmentId=added[0].id;return validateState(result);
}
export function workload(dept,id){return dept.tasks.reduce((sum,t)=>sum+(t.owners.includes(id)?t.weight/t.owners.length:0),0);}
export function exportState(state){return JSON.stringify({...state,schemaVersion:SCHEMA,exportedAt:new Date().toISOString()},null,2);}
