const fs=require('fs'),vm=require('vm'),assert=require('assert'),cp=require('child_process');
const s=fs.readFileSync('index.html','utf8'),old=cp.execFileSync('git',['show','origin/main:index.html'],{encoding:'utf8'});
const data=s.slice(s.indexOf('    const PROJECTS ='),s.indexOf('    // Verified screenshots only.'));
const c=vm.createContext({});vm.runInContext(data+';globalThis.api={PROJECTS,WORK_TAGS,projectMatches}',c);const {PROJECTS:P,WORK_TAGS:T,projectMatches:m}=c.api;
let count=0;function test(name,f){f();console.log('PASS '+name);count++}
const find=(tags=[],q='',cat='all',guide=false)=>P.filter(p=>m(p,[p.name,p.description,...p.tags,...Object.keys(T).filter(t=>T[t].includes(p.id))].join(' ').toLowerCase(),q.split(' ').filter(Boolean),cat,guide,new Set(tags))).map(p=>p.id);
test('single tag exact mapping',()=>assert.deepEqual(find(['좌석']),['21','22','23','25']));
test('multiple tags use intersection',()=>assert.deepEqual(find(['좌석','인쇄']),['21','22','23']));
test('text and tags combine',()=>assert.deepEqual(find(['좌석'],'서울'),['22']));
test('category and tags combine',()=>{assert.deepEqual(find(['행사'],'','maker'),['02','04','20']);assert.equal(find(['좌석'],'','request').length,0)});
test('guide filter combines',()=>assert.deepEqual(find(['인쇄'],'','all',true),['02','28']));
test('no result and reset full dataset',()=>{assert.equal(find(['재고','좌석']).length,0);assert.equal(find([], '없는검색어').length,0);assert.equal(find().length,28)});
test('all mappings exist and no unsupported settlement tag',()=>{for(const ids of Object.values(T))for(const id of ids)assert(P.some(p=>p.id===id));assert(!T['정산'])});
test('project data unchanged',()=>assert.equal(s.slice(s.indexOf('    const PROJECTS ='),s.indexOf('    // 업무 태그')),old.slice(old.indexOf('    const PROJECTS ='),old.indexOf('    // Verified screenshots only.'))));
test('newest/oldest original ordering logic unchanged',()=>assert(s.includes("projectSort.value === 'newest' ? [...projectItems].reverse() : projectItems")));
test('selected toggle, aria pressed, reset clear and no scroll in filter',()=>{assert(s.includes('selectedWorkTags.delete(tag)'));assert(s.includes('selectedWorkTags.clear()'));assert(s.includes("String(selectedWorkTags.has(tag))"));assert(!s.slice(s.indexOf('    function filterProjects(){'),s.indexOf("    document.getElementById('projectFilters').addEventListener")).includes('scrollIntoView'))});
test('native buttons, wrapping, intersection explanation and empty state',()=>{assert(s.includes("button.type = 'button'"));assert(s.includes('.work-tags{display:flex;flex-wrap:wrap'));assert(s.includes('여러 태그를 고르면 모두 해당'));assert(s.includes('검색·필터 초기화 버튼'))});
// NOW logic is covered by now/tests/*.cjs in the combined release.
test('logo assets unchanged from deployed main',()=>{for(const p of ['mach-lockup.css','now/style.css','assets/mach-three-speed-lines.png','assets/mach-selected-A.svg','assets/mach-selected-A-mask.svg'])assert(fs.readFileSync(p).equals(cp.execFileSync('git',['show','origin/main:'+p])))});
console.log(count+' checks passed; Node logic/source only, no actual browser or keyboard test.');
