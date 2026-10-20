(() => {
  'use strict';
  const dialog=document.getElementById('usageDialog'),body=document.getElementById('usageBody'),zoom=document.getElementById('usageImageDialog');
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dataPromise,lastTrigger,historyClosing=false,queuedOpen=null,requestNumber=0;
  const getData=()=>dataPromise||(dataPromise=fetch('./assets/usage-guides.json?v=1f10c3f79114').then(r=>{if(!r.ok)throw Error('load');return r.json();}).catch(e=>{dataPromise=null;throw e;}));
  const image=(s)=>s.image&&/^assets\/usage\/[\w.-]+\.jpg$/.test(s.image)?`<figure class="usage-figure"><button type="button" class="usage-picture" data-usage-image="${esc(s.image)}" data-usage-alt="${esc(s.alt)}" aria-label="${esc(s.alt)} 확대 보기"><img src="${esc(s.image)}" alt="${esc(s.alt)}" loading="lazy" decoding="async"></button><figcaption>${esc(s.caption)}<span class="usage-enlarge">화면을 누르면 확대할 수 있습니다.</span></figcaption></figure>`:'';
  async function open(id,trigger,fromHistory=false){
    if(historyClosing){queuedOpen=[id,trigger,fromHistory];return;}
    const run=++requestNumber;lastTrigger=trigger||lastTrigger;
    body.innerHTML='<h2 id="usageTitle" class="usage-loading">사용방법</h2><p class="usage-loading" role="status">사용방법을 불러오는 중입니다…</p>';
    if(!dialog.open)dialog.showModal();document.body.style.overflow='hidden';dialog.scrollTop=0;
    if(!fromHistory)history.pushState({machUsage:true},'',`#usage=${encodeURIComponent(id)}`);
    try{const d=await getData();if(run!==requestNumber||!dialog.open)return;const g=d.guides[id];if(!g)throw Error('missing');
      body.innerHTML=`<h2 id="usageTitle">${esc(g.name)} 사용방법</h2><p class="usage-purpose">${esc(g.purpose)}</p><section class="usage-section usage-ready"><h3>시작 전에 준비하세요</h3><ul>${g.prepare.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section><p class="usage-notice">${esc(g.notice)}</p>${g.steps.map((s,i)=>`<section class="usage-step"><h3><span class="usage-number">${i+1}</span>${esc(s.title)}</h3><p>${esc(s.body)}</p>${image(s)}</section>`).join('')}<section class="usage-section"><h3>결과는 이렇게 확인하세요</h3><p>${esc(g.result)}</p></section><section class="usage-section usage-mistakes"><h3>자주 헷갈리는 부분</h3><ul>${g.mistakes.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section><p class="usage-verified">확인일 ${esc(g.checkedAt||d.checkedAt)} · ${esc(g.verification)}</p><a class="usage-open-tool" href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">도구 열기 · 새 탭 ↗</a>`;
    }catch{body.innerHTML='<h2 id="usageTitle">사용방법을 불러오지 못했습니다</h2><p>연결을 확인한 뒤 닫고 다시 열어주세요. 기존 사이트 링크와 설계방법은 그대로 사용할 수 있습니다.</p>';}
  }
  function closeGuide(fromHistory=false){
    requestNumber++;if(zoom.open)zoom.close();if(dialog.open)dialog.close();document.body.style.overflow='';
    if(!fromHistory){if(history.state?.machUsage){historyClosing=true;history.back();}else history.replaceState(null,'',location.pathname+location.search);}
    lastTrigger?.focus({preventScroll:true});
  }
  function fromLocation(){historyClosing=false;const m=location.hash.match(/^#usage=(\d{2})$/);if(m)open(m[1],null,true);else if(dialog.open)closeGuide(true);const next=queuedOpen;queuedOpen=null;if(next)open(...next);}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-usage-id]');if(b){open(b.dataset.usageId,b);return;}const p=e.target.closest('[data-usage-image]');if(p){document.getElementById('usageFullImage').src=p.dataset.usageImage;document.getElementById('usageFullImage').alt=p.dataset.usageAlt;document.getElementById('usageFullLink').href=p.dataset.usageImage;zoom.showModal();}});
  document.querySelectorAll('[data-usage-close]').forEach(b=>b.addEventListener('click',()=>b.dataset.usageClose==='usageDialog'?closeGuide():zoom.close()));
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeGuide();});
  window.addEventListener('popstate',fromLocation);
  document.addEventListener('keydown',e=>{if(dialog.open&&e.key==='/')e.stopImmediatePropagation();},true);
  fromLocation();
})();
