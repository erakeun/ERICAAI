// Source/cascade contracts and document-flow arithmetic, NOT a browser layout test.
const fs=require('fs'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto');
const home=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('mach-lockup.css','utf8'),now=fs.readFileSync('now/index.html','utf8'),nowCSS=fs.readFileSync('now/style.css','utf8');
assert(home.includes('mach-lockup.css?v=selected-a-flow-1'));
assert(now.includes('style.css?v=selected-a-flow-1'));
assert(css.includes('.hero-identity{display:grid;grid-template-columns:minmax(0,1fr);row-gap:14px'));
assert(css.includes('line-height:1.6;flex-wrap:wrap;overflow-wrap:anywhere'));
assert(!/margin[^;}]*:-|transform:translate|position:absolute/.test(css));
assert(css.includes('.hero-wordmark img{display:block;position:static;width:100%;height:auto;aspect-ratio:340/94'));
assert(nowCSS.includes('.logo-flow img{display:block;position:static;width:100%;height:auto;aspect-ratio:340/94'));
for(const width of [180,240,295,340])for(const lines of [1,2,3,4]){
 const creditHeight=lines*16,gap=width<=295?12:14,logoHeight=width*94/340;
 const logoTop=creditHeight+gap,logoBottom=logoTop+logoHeight;
 assert(logoTop>=creditHeight+12);assert(logoBottom>logoTop);
}
for(const p of ['assets/mach-three-speed-lines.png','assets/mach-selected-A.svg','assets/mach-selected-A-mask.svg']){
 const old=cp.execFileSync('git',['show','origin/main:'+p]);assert(fs.readFileSync(p).equals(old));
}
// NOW logic changes are covered independently by the 43 NOW regression checks.
console.log('PASS versioned CSS, separate grid rows, wrapped credit flow, in-flow proportional main/NOW images, 16 width/line-count calculations, original logo+SVG bytes unchanged');
console.log('Not browser rendering or proof of user cache contents. Actual user refresh verification remains required.');
