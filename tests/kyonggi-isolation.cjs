const assert=require('assert/strict'),core=require('../kyonggi/badge-shared/core.js');
const p={brand:'kyonggi',version:2,kind:'lanyard',template:'blue',logoMode:'kgu',settings:{width:95,height:65},records:[{name:'가상참가자'}]};
assert(core.normalizeProject(p).valid);assert(!core.normalizeProject({...p,brand:'hanyang'}).valid);delete p.brand;assert(!core.normalizeProject(p).valid);assert(core.normalizeDesign({version:1,byTemplate:{}}).valid);console.log('Kyonggi isolation passed');
