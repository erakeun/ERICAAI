import test from 'node:test';
import assert from 'node:assert/strict';
import {readStore,writeStore,STORAGE_KEY} from '../storage.js';
import {createDemo,exportBackup,validateBackup} from '../core.js';

class MemoryStorage {
  values=new Map(); quota=Infinity;
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){if(value.length>this.quota)throw new Error('QuotaExceededError');this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
}

test('empty storage starts clean and leaves other MACH tools untouched',()=>{
  const storage=new MemoryStorage();storage.setItem('mach:event-oneq','existing-operation');
  assert.deepEqual(readStore(storage),{projects:[],activeId:null,stamp:null});
  writeStore(storage,[],'',null);assert.equal(storage.getItem('mach:event-oneq'),'existing-operation');
});
test('save and reload preserve dates, assignments, explicitly entered zero and private local data',()=>{
  const storage=new MemoryStorage(),p=createDemo(),a=p.applicants[0],panel=p.sessions.find(s=>s.id===a.assignment.sessionId).panelistIds[0];
  a.contact='010-private-local';a.evaluations[panel]={scores:{[p.criteria[0].id]:0},comment:'담당자 입력'};
  const stamp=writeStore(storage,[p],p.id,null),restored=readStore(storage);
  assert.equal(restored.stamp,stamp);assert.equal(restored.activeId,p.id);assert.deepEqual(restored.projects,[p]);assert.equal(validateBackup(exportBackup(restored.projects)).valid,true);
});
test('two tab stale stamp cannot overwrite newer saved data',()=>{
  const storage=new MemoryStorage(),p=createDemo(),first=writeStore(storage,[p],p.id,null);
  const secondTab=readStore(storage);const next=structuredClone(p);next.name='다른 탭의 최신 수정';
  writeStore(storage,[next],p.id,first);const exact=storage.getItem(STORAGE_KEY);
  assert.throws(()=>writeStore(storage,secondTab.projects,p.id,secondTab.stamp),/다른 탭/);assert.equal(storage.getItem(STORAGE_KEY),exact);
});
test('a removed store also invalidates an old tab stamp instead of resurrecting erased data',()=>{
  const storage=new MemoryStorage(),p=createDemo(),stamp=writeStore(storage,[p],p.id,null);
  storage.removeItem(STORAGE_KEY);
  assert.throws(()=>writeStore(storage,[p],p.id,stamp),/다른 탭/);assert.equal(storage.getItem(STORAGE_KEY),null);
});
test('malformed or unsupported stored envelopes are reported and never overwritten during read',()=>{
  for(const value of ['{broken',JSON.stringify({version:2,projects:[]}),JSON.stringify({version:1,projects:{}})]) {
    const storage=new MemoryStorage();storage.setItem(STORAGE_KEY,value);assert.throws(()=>readStore(storage));assert.equal(storage.getItem(STORAGE_KEY),value);
  }
});
test('storage quota failure preserves last successful save and propagates error',()=>{
  const storage=new MemoryStorage(),p=createDemo(),stamp=writeStore(storage,[p],p.id,null),previous=storage.getItem(STORAGE_KEY);
  storage.quota=previous.length+10;p.operatingNotes='문자'.repeat(1000);
  assert.throws(()=>writeStore(storage,[p],p.id,stamp),/QuotaExceededError/);assert.equal(storage.getItem(STORAGE_KEY),previous);assert.equal(readStore(storage).stamp,stamp);
});
