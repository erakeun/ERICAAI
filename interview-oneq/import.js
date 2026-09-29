import { newApplicant, MAX_APPLICANTS, validDate, toMinutes } from './core.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const headers = {
  number:['번호','지원자번호','접수번호','수험번호','지원번호','number','applicantnumber','id'],
  name:['이름','성명','지원자명','지원자이름','name','applicantname'],
  contact:['연락처','전화','전화번호','휴대폰','휴대전화','이메일','contact','phone','email'],
  field:['분야','지원분야','모집분야','직무','field','department'],
  note:['비고','메모','note','memo'],
  available:['가능시간','가능일시','면접가능시간','available','availability'],
  unavailable:['불가시간','불가일시','면접불가시간','unavailable'],
};
const cleanHeader = value => String(value??'').replace(/[\s_()\[\]·]/g,'').toLowerCase().replace(/^\uFEFF/,'');
const resolveHeader = value => Object.entries(headers).find(([,aliases])=>aliases.includes(cleanHeader(value)))?.[0];

/** RFC 4180 quoting, escaped quotes and embedded newlines, plus TSV paste. */
export function parseDelimited(source, delimiter) {
  source=String(source??'').replace(/^\uFEFF/,'');
  if(!delimiter) {
    let quoted=false,commas=0,tabs=0;
    for(let i=0;i<source.length;i++) { const ch=source[i];if(ch==='"'){if(quoted&&source[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted){if(ch==='\n'||ch==='\r')break;if(ch===',')commas++;if(ch==='\t')tabs++;} }
    delimiter=tabs>commas?'\t':',';
  }
  if(![',','\t',';'].includes(delimiter))throw new Error('지원하지 않는 열 구분자입니다.');
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  const pushCell=()=>{if(cell.length>10000)throw new Error('셀 내용은 10,000자까지 가져올 수 있습니다.');row.push(cell);cell='';closed=false;};
  const pushRow=()=>{pushCell();if(row.some(value=>value.trim()))rows.push(row);row=[];if(rows.length>MAX_APPLICANTS+1)throw new Error(`한 번에 ${MAX_APPLICANTS}명까지 가져올 수 있습니다.`);};
  for(let i=0;i<source.length;i++) {
    const ch=source[i];
    if(quoted) {if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
    if(ch===delimiter){pushCell();continue;}
    if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i++;pushRow();continue;}
    if(ch==='"'&&!cell&&!closed){quoted=true;continue;}
    if(closed&&ch.trim())throw new Error('따옴표로 묶은 셀 뒤에 잘못된 문자가 있습니다. CSV 형식을 확인해 주세요.');
    if(!closed)cell+=ch;
    if(cell.length>10000)throw new Error('셀 내용은 10,000자까지 가져올 수 있습니다.');
  }
  if(quoted)throw new Error('닫히지 않은 따옴표가 있습니다. CSV 파일을 다시 저장해 주세요.');
  if(cell||row.length||closed)pushRow();
  return rows;
}
export function parseTimeRanges(value) {
  if(Array.isArray(value))return value.map(v=>{
    if(!v||typeof v!=='object'||Array.isArray(v)||['date','start','end'].some(key=>v[key]!==undefined&&typeof v[key]!=='string'))throw new Error('가능·불가시간 형식이 올바르지 않습니다.');
    const date=v.date||'',start=v.start||'',end=v.end||'';
    if((date&&!validDate(date))||(start&&!Number.isFinite(toMinutes(start)))||(end&&!Number.isFinite(toMinutes(end)))||(start&&end&&toMinutes(start)>=toMinutes(end)))throw new Error('가능·불가시간의 날짜 또는 시간 순서가 올바르지 않습니다.');
    return {date,start,end};
  });
  if(!String(value??'').trim())return [];
  return String(value).split(/[;\n]/).filter(part=>part.trim()).map(part=>{
    const match=part.trim().match(/^(?:(\d{4}-\d{2}-\d{2})\s*)?(?:(\d{1,2}:\d{2})\s*[-~–]\s*(\d{1,2}:\d{2}))?$/);
    if(!match||(!match[1]&&!match[2]))throw new Error(`시간 조건 '${part.trim()}' 형식을 확인해 주세요. 예: 2026-10-01 09:00-12:00`);
    const date=match[1]||'',start=match[2]?.padStart(5,'0')||'',end=match[3]?.padStart(5,'0')||'';
    if((date&&!validDate(date))||(start&&(!Number.isFinite(toMinutes(start))||!Number.isFinite(toMinutes(end))||toMinutes(start)>=toMinutes(end))))throw new Error(`시간 조건 '${part.trim()}'의 날짜 또는 시간 순서가 올바르지 않습니다.`);
    return {date,start,end};
  });
}
export function normalizeApplicantRows(rawRows) {
  const errors=[],warnings=[],rows=[];
  if(!Array.isArray(rawRows)||!rawRows.length)return {rows,errors:['가져올 지원자 행이 없습니다.'],warnings};
  if(rawRows.length>MAX_APPLICANTS+1)return {rows,errors:[`한 번에 ${MAX_APPLICANTS}명까지 가져올 수 있습니다.`],warnings};
  let source,mapping;
  if(Array.isArray(rawRows[0])) {
    const head=rawRows[0].map(resolveHeader);
    const headerRow=head.includes('name');
    if(headerRow) {
      mapping=head;source=rawRows.slice(1);
      const recognized=head.filter(Boolean);
      if(new Set(recognized).size!==recognized.length)errors.push('같은 종류의 열 이름이 중복되었습니다. 연락처 등 필요한 열을 하나만 남겨 주세요.');
      if(head.some((name,i)=>!name&&String(rawRows[0][i]??'').trim()))warnings.push('지원하지 않는 열은 제외했습니다. 이름·번호·연락처·분야·비고·가능시간·불가시간을 지원합니다.');
    } else {
      if(head[0])return {rows:[],errors:['제목 행에 이름 열이 없습니다. 이름 또는 성명 열을 추가해 주세요.'],warnings:[]};
      const first=String(rawRows[0][0]??'').trim();
      mapping=/^(?:[A-Za-z]+[-_]?)?\d{2,}$/.test(first)?['number','name','contact','field','note','available','unavailable']:['name','contact','field','note','available','unavailable'];
      source=rawRows;warnings.push(`제목 행이 없어 ${mapping[0]==='number'?'번호, 이름':'이름'}, 연락처, 분야, 비고 순서로 읽었습니다. 미리보기를 확인해 주세요.`);
    }
    source=source.map((row,i)=>({values:Object.fromEntries(mapping.flatMap((key,j)=>key?[[key,row[j]??'']]:[])),line:i+(headerRow?2:1)}));
  } else source=rawRows.map((row,i)=>({values:Object.fromEntries(Object.entries(row||{}).flatMap(([key,value])=>{const mapped=resolveHeader(key)||(['number','name','contact','field','note','available','unavailable'].includes(key)?key:null);return mapped?[[mapped,value]]:[];})),line:i+1}));
  for(const {values,line} of source) {
    if(!Object.values(values).some(v=>Array.isArray(v)?v.length:String(v??'').trim()))continue;
    const row={};
    for(const key of ['number','name','contact','field','note'])row[key]=String(values[key]??'').trim();
    if(!row.name)errors.push(`${line}행: 이름을 입력해 주세요.`);
    if(Object.values(row).some(v=>v.length>10000))errors.push(`${line}행: 셀 내용은 10,000자까지 가능합니다.`);
    for(const key of ['available','unavailable'])try{row[key]=parseTimeRanges(values[key]);}catch(error){errors.push(`${line}행: ${error.message}`);row[key]=[];}
    rows.push(row);
  }
  if(!rows.length&&!errors.length)errors.push('가져올 지원자 행이 없습니다.');
  return {rows,errors,warnings};
}
/** Pure preview: existing applicants are never overwritten, even when names match. */
export function importRows(project,rawRows) {
  const normalized=normalizeApplicantRows(rawRows),errors=[...normalized.errors],warnings=[...normalized.warnings],applicants=[];
  if(project.applicants.length+normalized.rows.length>MAX_APPLICANTS)errors.push(`프로젝트당 지원자는 ${MAX_APPLICANTS}명까지 등록할 수 있습니다.`);
  const working={...project,applicants:[...project.applicants]},used=new Set(project.applicants.map(a=>a.number)),names=new Set(project.applicants.map(a=>a.name));
  // Reserve user-provided numbers before generating any automatic numbers.
  for(const row of normalized.rows)if(row.number){if(used.has(row.number))errors.push(`지원자번호 '${row.number}'가 중복되었습니다. 번호를 수정해 주세요.`);used.add(row.number);}
  working.applicants.push(...normalized.rows.filter(row=>row.number).map(row=>({number:row.number})));
  for(const row of normalized.rows) {
    const data={...row,field:row.field||project.field||''};if(!data.number)delete data.number;
    const applicant=newApplicant(working,data);applicants.push(applicant);working.applicants.push(applicant);
    if(names.has(row.name))warnings.push(`'${row.name}' 동명이인이 있습니다. 내부 ID와 지원자번호로 구분하여 새 지원자로 등록합니다.`);
    names.add(row.name);
  }
  return {...normalized,applicants:errors.length?[]:applicants,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
export async function importFile(file) {
  if(file.size>MAX_FILE_BYTES)throw new Error('가져오기 파일은 10MB까지 가능합니다. 필요한 시트·행만 남겨 다시 저장해 주세요.');
  const extension=file.name.split('.').pop().toLowerCase(),buffer=await file.arrayBuffer();
  if(['xlsx','xls'].includes(extension)) {
    const XLSX=globalThis.XLSX;if(!XLSX)throw new Error('Excel 읽기 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도하거나 CSV로 저장해 주세요.');
    let workbook;
    try{workbook=XLSX.read(buffer,{type:'array',cellText:true,cellDates:false,sheetRows:MAX_APPLICANTS+2});}catch{throw new Error('Excel 파일을 읽을 수 없습니다. 암호를 해제하고 XLSX로 다시 저장해 주세요.');}
    const sheetName=workbook.SheetNames[0];if(!sheetName)throw new Error('Excel에 읽을 수 있는 시트가 없습니다.');
    const sheet=workbook.Sheets[sheetName],ref=sheet['!fullref']||sheet['!ref'];
    if(ref&&XLSX.utils.decode_range(ref).e.r>MAX_APPLICANTS)throw new Error(`한 번에 ${MAX_APPLICANTS}명까지 가져올 수 있습니다. Excel 행 수를 줄여 주세요.`);
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});
    return {rows,sheetName,encoding:'Excel',warnings:workbook.SheetNames.length>1?[`첫 번째 시트 '${sheetName}'만 읽었습니다.`]:[]};
  }
  if(!['csv','tsv','txt'].includes(extension))throw new Error('CSV, TSV, XLSX 또는 XLS 파일을 선택해 주세요.');
  let content,encoding='UTF-8';
  try{content=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{try{content=new TextDecoder('euc-kr',{fatal:true}).decode(buffer);encoding='CP949/EUC-KR';}catch{throw new Error('문자 인코딩을 읽을 수 없습니다. UTF-8 CSV로 다시 저장해 주세요.');}}
  return {rows:parseDelimited(content,extension==='tsv'?'\t':undefined),sheetName:'',encoding,warnings:[]};
}
export const IMPORT_SAMPLE='지원자번호,이름,연락처,지원분야,비고,가능시간,불가시간\n,김하늘,,홍보·SNS,,,2026-10-01 09:00-10:00\n,이서준,,홍보·SNS,,2026-10-02 09:00-12:00,\n';
