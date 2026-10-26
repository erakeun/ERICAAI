(function () {
  'use strict';
  // IDs are the two existing MACH catalog cards. Do not substitute another tool.
  // Production GET verified both exact badge titles on 2026-10-26; no submission.
  const verifiedForBadgeTools = true;
  const endpoint = 'https://script.google.com/macros/s/AKfycby2ShSY4ruQr9Ku-QlljB05Ygk3ygDRtX-hXWO0hfUmEULl-jK9Z7mqh_k2m9GSV70v/exec';
  const toolId = document.body.dataset.kind === 'clip' ? '31' : '30';
  const actions = document.querySelector('.header-actions');
  if (!actions || document.getElementById('feedbackButton')) return;
  const button = document.createElement(verifiedForBadgeTools ? 'a' : 'button');
  button.id = 'feedbackButton';
  button.className = 'btn badge-feedback-link';
  button.dataset.machFeedback = toolId;
  button.dataset.html2canvasIgnore = 'true';
  if (verifiedForBadgeTools) {
    // Only the fixed tool ID leaves this page. No names, roster, design, or URL data.
    const url = new URL(endpoint);
    url.searchParams.set('tool', toolId);
    button.href = url.href;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.referrerPolicy = 'no-referrer';
    button.textContent = '의견 남기기 ↗';
    button.setAttribute('aria-label', '의견 남기기 · 별도 접수 화면 새 창');
  } else {
    button.type = 'button';
    button.disabled = true;
    button.textContent = '의견 남기기 · 준비 중';
    button.title = '이 제작기의 의견 접수 연결을 확인하고 있습니다.';
    button.setAttribute('aria-label', '의견 남기기 · 접수 연결 확인 중');
  }
  actions.append(button);
}());
