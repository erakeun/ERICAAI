(() => {
  'use strict';
  const details = document.getElementById('mach-play');
  const toggle = document.getElementById('mach-play-toggle');
  const mount = document.getElementById('mach-play-mount');
  const status = document.getElementById('mach-play-status');
  let frame = null;

  function syncViewport() {
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    frame.contentWindow?.postMessage({type: 'mach-play:viewport',
      top: Math.max(0, -rect.top) + 16,
      height: Math.max(120, Math.min(rect.bottom, window.innerHeight) - Math.max(0, rect.top) - 32)
    }, location.origin);
  }

  function closeGame() {
    details.open = false;
    unload();
    toggle.focus({preventScroll: true});
    toggle.scrollIntoView({block: 'nearest'});
  }

  function unload() {
    if (!frame) return;
    frame.contentWindow?.postMessage({type: 'mach-play:pause'}, location.origin);
    // Destroying the browsing context stops rendering, audio and input handlers.
    // No game asset is requested again until the visitor opens this disclosure.
    frame.remove();
    frame = null;
    status.textContent = '';
  }

  function sync() {
    if (!details.open) { unload(); return; }
    if (frame) return;
    status.textContent = '마하탐험을 불러오는 중이에요…';
    frame = document.createElement('iframe');
    frame.className = 'play-frame';
    frame.title = '하냥이의 마하탐험 — 같은 페이지에서 플레이';
    frame.setAttribute('aria-describedby', 'mach-play-help');
    frame.src = './play/?embed=1';
    const loadingFrame = frame;
    frame.addEventListener('load', () => {
      if (frame === loadingFrame) {
        status.textContent = '';
        frame.scrollIntoView({block: 'start', behavior: 'instant'});
        syncViewport();
        frame.contentWindow?.postMessage({type: 'mach-play:focus'}, location.origin);
      }
    });
    mount.append(frame);
  }

  details.addEventListener('toggle', sync);
  document.getElementById('mach-play-close').addEventListener('click', closeGame);
  window.addEventListener('message', event => {
    if (!frame || event.origin !== location.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'mach-play:height' && Number.isFinite(data.height)) {
      frame.style.height = Math.ceil(Math.min(4000, Math.max(400, data.height))) + 'px';
    }
    if (data.type === 'mach-play:ready') status.textContent = '';
    if (data.type === 'mach-play:escape') toggle.focus({preventScroll: true});
    if (data.type === 'mach-play:close') closeGame();
    if (data.type === 'mach-play:dialog') {
      frame.scrollIntoView({block: 'start', behavior: 'instant'});
      syncViewport();
    }
  });
  window.addEventListener('pagehide', unload);
  window.addEventListener('pageshow', sync);
  window.addEventListener('resize', syncViewport);
  window.addEventListener('scroll', syncViewport, {passive: true});
  sync();
})();
