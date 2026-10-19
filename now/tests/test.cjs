const fs=require('fs'),vm=require('vm'),assert=require('assert');
class El{constructor(){this.value='';this.children=[];this.dataset={};this.classList={toggle(){}};this.handlers={};}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(){}addEventListener(k,f){this.handlers[k]=f}focus(){}select(){this.selected=true}}
const els={},tabs=['build','bug','handoff'].map(x=>{const e=new El;e.dataset.mode=x;return e}),storage=new Map;let confirms=true;
const document={querySelector:s=>els[s]??=new El,querySelectorAll:()=>tabs,createElement:()=>new El,createTextNode:s=>s,title:''};
const ctx={document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},history:{pushState(s,t,url){assert(url===undefined||url==='');this.last=s},replaceState(){}},window:{},confirm:()=>confirms,navigator:{clipboard:{writeText:async()=>{throw Error('denied')}}},Event:class{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../app.js','utf8'),ctx);const run=s=>vm.runInContext(s,ctx);let results=[];function test(name,f){f();results.push('PASS '+name)}
test('빈 입력은 확인할 사항에 남김',()=>{assert(run('generate()').includes('AI와 확인할 사항'));assert(run('generate()').includes('내 역할·직무와 코딩 경험'));});
test('입력 왕복과 브라우저 뒤로가기',()=>{run("state.answers.build.role='가상 담당자';navigate(1);navigate(2);window.onpopstate({state:{step:0,mode:'build'}})");assert.equal(run('state.step'),0);assert.equal(run('state.answers.build.role'),'가상 담당자')});
test('특수문자·긴 입력 원문 보존',()=>{const value='<script>가상</script>&\"\n'+ '긴 문장'.repeat(10000);ctx.testValue=value;run('state.answers.build.role=testValue');assert(run('generate()').includes(value));});
test('기본 메모리 보관',()=>{run('save()');assert.equal(storage.size,0)});
test('명시적 기기 저장·해제 삭제',()=>{run('state.persist=true;save()');assert.equal(storage.size,1);els['#persist'].onchange({target:{checked:false}});assert.equal(storage.size,0);assert(run('state.answers.build.role').length>1000)});
test('초기화 취소·승인',()=>{confirms=false;els['#reset'].onclick();assert(run('state.answers.build.role'));confirms=true;els['#reset'].onclick();assert.equal(run('state.answers.build.role'),undefined)});
test('예시 덮어쓰기 취소·승인',()=>{confirms=false;els['#example'].onchange({target:{value:'event'}});assert.equal(run('state.answers.build.role'),undefined);confirms=true;els['#example'].onchange({target:{value:'event'}});assert(run('state.answers.build.role').includes('행정'));});
test('모순 선택 안내',()=>{run("state.answers.build.install='설치 불가';state.answers.build.launch='프로그램 설치';navigate(5)");assert(els['#checks'].children.some(x=>x.textContent.includes('두 답')))});
test('결과 편집 보존과 질문 수정시 재조합',()=>{run("state.drafts.build='직접 수정';navigate(7)");assert(run("state.drafts.build==='직접 수정'"));run('navigate(0)');});
test('보조 요청문 2종',()=>{run("navigate(0,'bug');state.answers.bug.action='가상 재현';");assert(run('generate()').includes('가상 재현'));run("navigate(0,'handoff')");assert(run('generate()').includes('새 대화 인수인계'));});
test('외부 통신 코드·URL 입력 저장 없음',()=>{const js=fs.readFileSync(__dirname+'/../app.js','utf8');assert(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|location\.(search|hash)/.test(js));const html=fs.readFileSync(__dirname+'/../index.html','utf8');assert(html.includes("connect-src 'none'"));assert(!/https?:\/\//.test(html));});
console.log(results.join('\n'));console.log('These are Node VM logic tests, not browser layout/UI tests.');
