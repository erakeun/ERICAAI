/* Isolated Chromium regression: all source-based templates, logo modes, manufacturer
   dimensions, imported state compatibility, small/long text, and print geometry. */
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.BADGE_EVIDENCE || path.join(root, '..', 'evidence', 'design-patch'));
fs.mkdirSync(out, { recursive: true });
const templates = ['blue', 'official', 'hanyang', 'hibb', 'staff', 'ribbon', 'frame', 'side'];
const modes = ['none', 'hanyang', 'erica', 'both'];
const sizes = [[95,65], [85,54], [54,85], [95,122], [90,54], [75,40]];
const report = { checkedAt: new Date().toISOString(), cases: [], checks: [], errors: [] };
let browser, server;
function check(name, condition, detail) {
  report.checks.push({ name, pass: Boolean(condition), ...(detail ? { detail } : {}) });
  if (!condition) report.errors.push(name + (detail ? ': ' + JSON.stringify(detail) : ''));
}
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.complete ? Promise.resolve() : new Promise(r => { img.addEventListener('load',r,{once:true}); img.addEventListener('error',r,{once:true}); })));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}
function project(kind, template, logoMode, width, height, records) {
  return { version: 1, kind, template, logoMode, event: '한양 함께하는 날', selectedId: 'qa-1',
    settings: { width, height, pageMargin: 8, gap: 3, cardPadding: 4, cropMarks: true, fontScale: 100 },
    records: records || [{id:'qa-1', name:'윤해봄', affiliation:'미래협력팀', title:'참가자', event:''}, {id:'qa-2', name:'강도윤', affiliation:'캠퍼스기획팀', title:'운영진', event:''}] };
}
async function geometry(page, selector) {
  return page.locator(selector).evaluateAll(cards => cards.map(card => {
    const box = node => { const r = node.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
    const cb = box(card), logos = [...card.querySelectorAll('.badge-logo')], texts = [...card.querySelectorAll('.badge-event,.badge-affiliation,.badge-name,.badge-title')];
    const overlap = (a,b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.7 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.7;
    const inside = b => b.left >= cb.left-.7 && b.top >= cb.top-.7 && b.right <= cb.right+.7 && b.bottom <= cb.bottom+.7;
    return { width:cb.width, height:cb.height, text:card.textContent, overflow:card.dataset.overflow, logoCount:logos.length,
      nameFontPx:parseFloat(getComputedStyle(card.querySelector('.badge-name')).fontSize),
      logoSources:logos.map(n=>n.src.split('/').pop()),
      logosLoaded:logos.every(n=>n.complete && n.naturalWidth>0 && n.naturalHeight>0),
      logosContained:logos.every(n=>getComputedStyle(n).objectFit==='contain' && inside(box(n))),
      logoOverlap:logos.some((n,i)=>logos.slice(i+1).some(m=>overlap(box(n),box(m))) || texts.some(t=>overlap(box(n),box(t)))),
      textOverlap:texts.some((n,i)=>texts.slice(i+1).some(m=>overlap(box(n),box(m)))),
      textClipped:texts.some(n=>n.scrollWidth>n.clientWidth+1 || n.scrollHeight>n.clientHeight+1 || !inside(box(n))) };
  }));
}
(async () => {
  server = http.createServer((req,res) => {
    try {
      let f = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
      if (f!==root&&!f.startsWith(root+path.sep)) return res.writeHead(403).end();
      if (fs.existsSync(f)&&fs.statSync(f).isDirectory()) f=path.join(f,'index.html');
      res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');
      fs.createReadStream(f).on('error',()=>res.writeHead(404).end()).pipe(res);
    } catch {res.writeHead(400).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({headless:true, executablePath:process.env.BADGE_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  for (const kind of ['lanyard','clip']) {
    const page=await browser.newPage({viewport:{width:1440,height:1050}}), errors=[], requests=[];
    page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>requests.push(r.url()));
    await page.goto(base+kind+'-badge/',{waitUntil:'networkidle'}); await settle(page);
    check(kind+' default dual logos', await page.evaluate(()=>badgeApp.getState().logoMode==='both'));
    check(kind+' 8 design choices', await page.locator('#templateList [data-template]').count()===8);
    for (const [width,height] of sizes) for (const template of templates) for (const logoMode of modes) {
      const name=`${kind} ${width}x${height} ${template} ${logoMode}`;
      const input=project(kind,template,logoMode,width,height);
      const normalized=await page.evaluate(p=>badgeApp.setState(p),input); await settle(page);
      check(name+' state',normalized.valid);
      const before=await geometry(page,'#previewSlot .badge');
      const print=await page.evaluate(()=>badgeApp.preparePrint('all')); await settle(page);
      const after=await geometry(page,'#printRoot .badge');
      const expected=logoMode==='none'?0:logoMode==='both'?2:1;
      const good=c=>c.logoCount===expected&&c.logosLoaded&&c.logosContained&&!c.logoOverlap&&!c.textOverlap&&!c.textClipped&&c.overflow!=='true';
      check(name+' preview geometry', before.length===1&&before.every(good),before.filter(c=>!good(c)));
      check(name+' print geometry',print.valid&&after.length===2&&after.every(good),!print.valid?print:after.filter(c=>!good(c)));
      check(name+' actual mm',after.every(c=>Math.abs(c.width-width*96/25.4)<1&&Math.abs(c.height-height*96/25.4)<1));
      if(width===54&&height===85) check(name+' Korean portrait name retains intended size',before.concat(after).every(c=>c.nameFontPx>=34),before.concat(after).map(c=>c.nameFontPx));
      if(expected) check(name+' exact requested logos',after.every(c=>c.logoSources.every(s=>logoMode==='both'||(logoMode==='erica'?s.includes('erica'):!s.includes('erica')))));
      report.cases.push({kind,width,height,template,logoMode,valid:print.valid});
      if(logoMode==='both'&&width===(kind==='lanyard'?54:75)) await page.locator('#previewSlot').screenshot({path:path.join(out,`${kind}-${template}-both.png`)});
    }
    // Native control and explicit download roundtrip, independent of test setter.
    await page.evaluate(p=>badgeApp.setState(p),project(kind,'frame','both',90,54)); await settle(page);
    await page.locator('#logoMode').selectOption('none'); await settle(page);
    check(kind+' none control removes all logos',await page.locator('#previewSlot .badge-logo').count()===0);
    await page.locator('#logoMode').selectOption('erica'); await settle(page);
    check(kind+' ERICA control state',await page.evaluate(()=>badgeApp.getState().logoMode==='erica'));
    const downloading=page.waitForEvent('download'); await page.locator('#saveProject').click(); const downloaded=await downloading;
    const savedPath=path.join(out,kind+'-logo-project.json'); await downloaded.saveAs(savedPath);
    check(kind+' logo saved',JSON.parse(fs.readFileSync(savedPath,'utf8')).logoMode==='erica');
    await page.locator('#logoMode').selectOption('both'); await page.locator('#projectFile').setInputFiles(savedPath); await settle(page);
    check(kind+' logo restored',await page.evaluate(()=>badgeApp.getState().logoMode==='erica'));
    const legacy=project(kind,'blue','both',95,65); delete legacy.logoMode;
    await page.locator('#projectFile').setInputFiles({name:'legacy-v1.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))}); await settle(page);
    check(kind+' legacy one-logo compatibility',await page.evaluate(()=>badgeApp.getState().logoMode==='hanyang')&&await page.locator('#previewSlot .badge-logo').count()===1);
    // All designs and logo combinations with long names must either fit or explicitly block.
    for(const template of templates) for(const logoMode of modes){
      const input=project(kind,template,logoMode,75,40,[{id:'qa-1',name:'아주긴가상이름'.repeat(8),affiliation:'가상 공동연구 기획 협력 운영팀',title:'행사 현장 운영 책임자',event:'한양 함께하는 날 행사 운영'}]);
      await page.evaluate(p=>badgeApp.setState(p),input); await settle(page);
      const result=await page.evaluate(()=>badgeApp.preparePrint('all')); await settle(page);
      const cards=await geometry(page,'#printRoot .badge');
      check(`${kind} ${template} ${logoMode} long text safe`,result.valid ? cards.every(c=>!c.logoOverlap&&!c.textOverlap&&!c.textClipped&&c.overflow!=='true') : result.warnings.length>0);
      await page.evaluate(p=>badgeApp.setState(p),project(kind,template,logoMode,20,20)); await settle(page);
      const tiny=await page.evaluate(()=>badgeApp.preparePrint('all')); await settle(page);
      const tinyCards=await geometry(page,'#printRoot .badge');
      check(`${kind} ${template} ${logoMode} tiny custom size safe`,tiny.valid ? tinyCards.every(c=>c.logosContained&&!c.logoOverlap&&!c.textOverlap&&!c.textClipped&&c.overflow!=='true') : tiny.warnings.length>0);
    }
    // Every mode printed with all designs; PDF output retains A4 and ordered batch names.
    const records=Array.from({length:17},(_,i)=>({id:'qa-'+(i+1),name:'가상'+String(i+1).padStart(2,'0'),affiliation:'미래협력팀',title:'참가자',event:''}));
    for(const logoMode of modes){
      await page.evaluate(p=>badgeApp.setState(p),project(kind,kind==='lanyard'?'ribbon':'side',logoMode,90,54,records)); await settle(page);
      const printed=await page.evaluate(()=>badgeApp.preparePrint('all')); check(kind+' '+logoMode+' 17-row print',printed.valid&&printed.pages===3);
      const order=await page.locator('#printRoot .badge-name').allTextContents(); check(kind+' '+logoMode+' batch order',order.every((s,i)=>s===records[i].name)&&order.length===17);
      await page.emulateMedia({media:'print'}); await settle(page);
      const filename=kind+'-'+logoMode+'-design-sample.pdf'; await page.pdf({path:path.join(out,filename),printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
      const pdf=await PDFDocument.load(fs.readFileSync(path.join(out,filename)));
      check(filename+' A4/3 pages',pdf.getPageCount()===3&&pdf.getPages().every(p=>Math.abs(p.getWidth()-210*72/25.4)<1&&Math.abs(p.getHeight()-297*72/25.4)<1));
      await page.emulateMedia({media:'screen'});
    }
    await page.screenshot({path:path.join(out,kind+'-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844}); await settle(page);
    for(const mode of modes){await page.locator('#logoMode').selectOption(mode); await settle(page);check(kind+' mobile '+mode,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await page.locator('#logoMode').isVisible());}
    await page.screenshot({path:path.join(out,kind+'-mobile.png'),fullPage:true});
    check(kind+' no external requests',requests.every(u=>u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:')));
    check(kind+' no persistence',await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0));
    check(kind+' no JS errors',errors.length===0,errors); await page.close();
  }
  console.log(JSON.stringify({cases:report.cases.length,checks:report.checks.length,errors:report.errors.length,firstErrors:report.errors.slice(0,15)},null,2));
  assert.equal(report.errors.length,0,'All logo/design checks must pass; inspect badge-logo-browser-report.json');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{fs.writeFileSync(path.join(out,'badge-logo-browser-report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
