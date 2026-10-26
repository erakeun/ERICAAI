/* Run from repository root. Requires playwright and pdf-lib; BADGE_BROWSER can select
   an installed Chromium/Edge executable. Always opens an isolated headless profile. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.BADGE_EVIDENCE||path.join(root,'..','evidence'));
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
let server,browser,base;const report={checkedAt:new Date().toISOString(),checks:[],products:{}};
function check(name,value){assert(value,name);report.checks.push(name);console.log('PASS '+name)}
async function fill(page,id,value){await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change')}
async function settled(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
async function pdfCheck(page,file,expectedPages){await page.emulateMedia({media:'print'});await settled(page);await page.pdf({path:path.join(out,file),printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});const pdf=await PDFDocument.load(fs.readFileSync(path.join(out,file)));check(file+' page count',pdf.getPageCount()===expectedPages);for(const p of pdf.getPages()){const s=p.getSize();check(file+' A4 size',Math.abs(s.width-210*72/25.4)<1&&Math.abs(s.height-297*72/25.4)<1)}return pdf.getPageCount()}
(async()=>{
 if(process.env.BADGE_BASE_URL)base=process.env.BADGE_BASE_URL.replace(/\/$/,'')+'/';
 else{server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(file!==root&&!file.startsWith(root+path.sep))return res.writeHead(403).end();if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res)}catch{res.writeHead(400).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`}
 report.base=base;
 browser=await chromium.launch({headless:true,executablePath:process.env.BADGE_BROWSER||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined)});
 for(const kind of ['lanyard','clip']){
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('dialog',d=>d.accept());
  const response=await page.goto(base+kind+'-badge/',{waitUntil:'networkidle'});check(kind+' HTTP 200',response.status()===200);await page.waitForFunction(()=>window.badgeApp&&window.BadgeCore);await settled(page);
  check(kind+' five templates',await page.locator('#templateList [data-template]').count()===5);
  await page.screenshot({path:path.join(out,kind+'-desktop.png')});
  await fill(page,'name','가온테스트');await settled(page);check(kind+' live preview',await page.locator('#previewSection').innerText().then(t=>t.includes('가온테스트')));
  await fill(page,'name','<img src=x onerror=alert(1)>');await settled(page);check(kind+' HTML is inert',await page.evaluate(()=>!document.querySelector('img[src="x"]')&&!document.querySelector('[onerror]')));
  await fill(page,'name','=2+2');const csvDownload=page.waitForEvent('download');await page.locator('#exportCSV').click();await (await csvDownload).saveAs(path.join(out,kind+'-formula.csv'));check(kind+' CSV formula export escaped',fs.readFileSync(path.join(out,kind+'-formula.csv'),'utf8').includes("'=2+2"));
  await fill(page,'name','가온테스트');
  const width=kind==='lanyard'?95:90,height=kind==='lanyard'?122:54,count=kind==='lanyard'?9:17;
  for(const [id,v] of Object.entries({width,height,pageMargin:8,gap:3,cardPadding:4}))await fill(page,id,v);
  const rows=Array.from({length:count},(_,i)=>`가상${String(i+1).padStart(2,'0')},미래협력팀,${i%2?'운영진':'참가자'},한양 함께하는 날`);
  const importDetails=page.locator('details').filter({has:page.locator('#bulkInput')});if(!await importDetails.getAttribute('open'))await importDetails.locator('summary').click();
  await fill(page,'bulkInput','이름,소속,직책,행사명\n'+rows.join('\n'));await page.locator('#replaceImport').click();await settled(page);
  check(kind+' CSV roster count',(await page.evaluate(()=>badgeApp.getState().records.length))===count);
  const csvPath=path.join(out,kind+'-import.csv');fs.writeFileSync(csvPath,'\ufeff이름,소속,직책,행사명\n'+rows.join('\n'));await page.locator('#rosterFile').setInputFiles(csvPath);await page.waitForFunction(()=>document.getElementById('bulkInput').value.includes('가상01'));check(kind+' UTF-8 CSV file load',(await page.locator('#bulkInput').inputValue()).includes('가상'+String(count).padStart(2,'0')));
  await fill(page,'bulkInput','');await page.locator('#replaceImport').click();check(kind+' empty import preserves roster',(await page.evaluate(()=>badgeApp.getState().records.length))===count);
  await fill(page,'bulkInput','이름,소속\n"닫히지 않은,셀');await page.locator('#replaceImport').click();check(kind+' malformed import preserves roster',(await page.evaluate(()=>badgeApp.getState().records.length))===count);
  const layout=await page.evaluate(()=>BadgeCore.layout(badgeApp.getState().settings));check(kind+' A4 capacity',layout.capacity===(kind==='lanyard'?4:8));
  for(const template of ['blue','official','hanyang','hibb','staff']){
   await page.locator(`#templateList [data-template="${template}"]`).click();await settled(page);const print=await page.evaluate(()=>badgeApp.preparePrint('all'));check(kind+' '+template+' all pages',print.pages===3||print.pages.length===3);
   await page.emulateMedia({media:'print'});await settled(page);
   const geometry=await page.evaluate(()=>Array.from(document.querySelectorAll('#printRoot .badge')).map(el=>{const r=el.getBoundingClientRect(),p=el.closest('.print-page').getBoundingClientRect();return {w:r.width,h:r.height,inside:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1,text:el.innerText}}));
   check(kind+' '+template+' badge geometry/order',geometry.length===count&&geometry.every((g,i)=>Math.abs(g.w-width*96/25.4)<1&&Math.abs(g.h-height*96/25.4)<1&&g.inside&&g.text.includes('가상'+String(i+1).padStart(2,'0'))));
   const cuts=await page.evaluate(()=>Array.from(document.querySelectorAll('#printRoot .crop-mark')).map(el=>{const r=el.getBoundingClientRect(),p=el.closest('.print-page').getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1}));check(kind+' '+template+' crop marks within A4',cuts.length===count*8&&cuts.every(Boolean));
   if(template===(kind==='lanyard'?'hanyang':'official')){await pdfCheck(page,kind+'-sample.pdf',3);await page.screenshot({path:path.join(out,kind+'-print.png'),fullPage:true})}
   await page.emulateMedia({media:'screen'});
  }
  const selects=page.locator('#rosterBody input[data-select]');for(let i=0;i<count;i++)await selects.nth(i).uncheck();await selects.nth(1).check();await selects.nth(count-1).check();
  const selected=await page.evaluate(()=>badgeApp.preparePrint('selected'));check(kind+' selected count',selected.count===2);await pdfCheck(page,kind+'-selected.pdf',1);
  await page.evaluate(()=>badgeApp.prepareRuler());await pdfCheck(page,kind+'-ruler.pdf',1);await page.emulateMedia({media:'screen'});
  await fill(page,'width',400);await settled(page);check(kind+' invalid size blocks print',await page.locator('#printAll').isDisabled());await fill(page,'width',width);
  await page.locator('#swapOrientation').click();await settled(page);check(kind+' orientation swaps',Number(await page.locator('#width').inputValue())===height&&Number(await page.locator('#height').inputValue())===width);await page.locator('#swapOrientation').click();
  await page.locator('#helpButton').click();check(kind+' beginner help opens',await page.locator('#helpDialog').isVisible());await page.locator('#closeHelp').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#saveProject').click();const download=await downloadPromise;await download.saveAs(path.join(out,kind+'-project.json'));const saved=JSON.parse(fs.readFileSync(path.join(out,kind+'-project.json'),'utf8'));check(kind+' explicit JSON save',saved.records.length===count);
  await fill(page,'event','수정 확인');await page.locator('#projectFile').setInputFiles(path.join(out,kind+'-project.json'));await settled(page);check(kind+' JSON restore',await page.locator('#event').inputValue()===saved.event);
  check(kind+' no automatic local persistence',await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0));
  check(kind+' no external requests',requests.every(u=>u.startsWith(new URL(base).origin)||u.startsWith('data:')));
  await page.setViewportSize({width:390,height:844});await settled(page);await page.screenshot({path:path.join(out,kind+'-mobile.png'),fullPage:true});check(kind+' mobile no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await fill(page,'name','모바일가상');await settled(page);check(kind+' mobile editable preview',await page.locator('#previewSection').innerText().then(t=>t.includes('모바일가상')));
  check(kind+' no JavaScript errors',errors.length===0);report.products[kind]={width,height,count,capacity:layout.capacity,pages:3,errors};await page.close();
 }
 fs.writeFileSync(path.join(out,'badge-browser-report.json'),JSON.stringify(report,null,2));console.log(report.checks.length+' browser/print checks passed');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
