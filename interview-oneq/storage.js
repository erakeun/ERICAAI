export const STORAGE_KEY='mach:interview-oneq:v1';
export function readStore(storage){
  const raw=storage.getItem(STORAGE_KEY); if(!raw)return {projects:[],activeId:null,stamp:null};
  const value=JSON.parse(raw);if(value.version!==1||!Array.isArray(value.projects))throw Error('저장 형식이 다릅니다. 자동으로 덮어쓰지 않았습니다.');return value;
}
export function writeStore(storage,projects,activeId,expectedStamp){
  const previous=storage.getItem(STORAGE_KEY);const old=previous?JSON.parse(previous):null;
  if((old?.stamp ?? null)!==(expectedStamp ?? null))throw Error('다른 탭에서 내용이 바뀌었습니다. 현재 작업을 JSON으로 보관한 뒤 새로고침하세요.');
  const stamp=crypto.randomUUID();const next={version:1,projects,activeId,stamp};
  storage.setItem(STORAGE_KEY,JSON.stringify(next));return stamp;
}
