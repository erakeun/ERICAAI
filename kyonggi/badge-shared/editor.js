(function () {
  'use strict';
  const app = window.badgeApp;
  const $ = id => document.getElementById(id);
  const panel = $('precisionPanel');
  if (!app || !panel || !app.getElementLayout) return;

  const labels = { name: '이름', affiliation: '소속·기관', title: '직책·역할', event: '행사명', date: '날짜', logoKgu: '경기대학교 로고', logoSecondary: 'ERICA 로고' };
  const templates = { blue: '열린 문', official: '공식 심플', hanyang: '기룡이', hibb: '기룡이 스카이', staff: '행사·스태프', ribbon: '블루 시그널', frame: '네이비 프레임', side: '네이비 사이드' };
  const numbers = {
    xMm: { id: 'elementX', label: '가로 위치', min: -210, max: 420, unit: 'mm' },
    yMm: { id: 'elementY', label: '세로 위치', min: -297, max: 594, unit: 'mm' },
    widthMm: { id: 'elementWidth', label: '너비', min: .5, max: 420, unit: 'mm' },
    heightMm: { id: 'elementHeight', label: '높이', min: .5, max: 594, unit: 'mm' },
    fontSizePt: { id: 'elementFontSize', label: '글자 크기', min: 4, max: 144, unit: 'pt' },
    lineHeight: { id: 'elementLineHeight', label: '줄 간격', min: .9, max: 3, unit: '배' },
    letterSpacingEm: { id: 'elementTracking', label: '자간', min: -.1, max: 1, unit: 'em' }
  };
  let selected = 'name';
  let drag = null;
  let refreshing = false;
  let invalidInput = null;
  let context = '';
  let announceTimer;
  const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const display = n => Number.isFinite(Number(n)) ? String(round(n)) : '';
  const isImage = id => id === 'logoKgu' || id === 'logoSecondary';
  const nodeFor = id => $('previewSlot').querySelector('[data-element="' + id + '"]');
  const previewNodes = () => $('previewSlot').querySelectorAll('[data-element]');

  function announce(message) {
    clearTimeout(announceTimer);
    $('precisionAnnouncement').textContent = '';
    announceTimer = setTimeout(() => { $('precisionAnnouncement').textContent = message; }, 30);
  }
  function clearError() {
    if (invalidInput) invalidInput.removeAttribute('aria-invalid');
    invalidInput = null;
    $('precisionError').textContent = '';
    $('precisionError').hidden = true;
  }
  function error(input, message) {
    if (invalidInput && invalidInput !== input) invalidInput.removeAttribute('aria-invalid');
    invalidInput = input;
    input.setAttribute('aria-invalid', 'true');
    $('precisionError').textContent = message + ' 마지막으로 적용된 값은 유지됩니다.';
    $('precisionError').hidden = false;
  }
  function setValue(id, value, force) {
    const input = $(id);
    if (force || document.activeElement !== input) input.value = value;
  }
  function setSelected(id, open) {
    if (!Object.prototype.hasOwnProperty.call(labels, id)) return;
    if (drag) finishDrag();
    const changed = selected !== id;
    selected = id;
    if (open) panel.open = true;
    clearError();
    refresh(true);
    if (changed) announce(labels[id] + ' 선택됨');
  }
  function decoratePreview() {
    for (const node of previewNodes()) {
      const id = node.dataset.element;
      if (!labels[id]) continue;
      node.classList.toggle('is-design-selected', panel.open && selected === id);
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', labels[id] + ' 디자인 조정');
      node.setAttribute('aria-describedby', 'previewEditHelp');
      node.setAttribute('aria-pressed', String(panel.open && selected === id));
      node.setAttribute('draggable', 'false');
    }
    $('badgeStage').classList.toggle('is-design-editing', panel.open);
    $('precisionPreviewStatus').hidden = !panel.open;
    $('precisionPreviewStatus').textContent = labels[selected] + ' 선택 · 드래그 또는 방향키로 이동';
  }
  function refresh(force) {
    if (refreshing) return;
    refreshing = true;
    try {
      const state = app.getState();
      const nextContext = state.template + ':' + state.selectedId;
      if (context !== nextContext) { context = nextContext; clearError(); force = true; }
      const layout = app.getElementLayout(selected);
      $('elementSelect').value = selected;
      $('precisionTemplateName').textContent = (templates[state.template] || '현재 디자인') + ' · 모든 명찰에 적용';
      const image = isImage(selected);
      $('elementTextOptions').hidden = image;
      $('elementVisibilityRow').hidden = image;
      $('elementLogoHelp').hidden = !image;
      $('elementHeightField').hidden = image;
      $('elementLogoHeight').hidden = !image;
      $('resetElement').disabled = !layout || !layout.override || Object.keys(layout.override).length === 0;
      const overrides = state.design && state.design.byTemplate && state.design.byTemplate[state.template];
      $('resetDesign').disabled = !overrides || !Object.values(overrides).some(value => Object.keys(value).length > 0);
      if (!layout) return;
      for (const [key, field] of Object.entries(numbers)) {
        if (image && (key === 'heightMm' || key === 'fontSizePt' || key === 'lineHeight' || key === 'letterSpacingEm')) continue;
        const value = layout[key];
        setValue(field.id, display(value), force);
      }
      if (image) {
        $('elementLogoHeight').textContent = '현재 높이 ' + display(layout.heightMm) + ' mm · 원본 비율 유지';
      } else {
        $('elementVisible').checked = layout.override && typeof layout.override.visible === 'boolean' ? layout.override.visible : true;
        setValue('elementFont', layout.fontId || 'pretendard', force);
        setValue('elementAlign', layout.align || 'center', force);
        const color = /^#[0-9a-f]{6}$/i.test(layout.color || '') ? layout.color : '#0e4a84';
        setValue('elementColor', color, force);
        setValue('elementColorHex', color.toUpperCase(), force);
        $('elementAutoFit').checked = layout.fitMode !== 'manual';
        $('elementSizeLabel').textContent = layout.fitMode === 'manual' ? '글자 크기' : '최대 글자 크기';
        $('elementFitHelp').textContent = layout.fitMode === 'manual'
          ? '수동: 입력한 pt 크기를 유지합니다. 상자를 넘는 글은 잘릴 수 있으니 경고와 인쇄 결과를 확인하세요.'
          : '자동: 입력한 pt에 전체 글자 크기 비율을 적용한 값을 최대 크기로 삼아 각 명찰의 글을 상자에 맞게 줄입니다.';
        const requested = layout.requestedFontSizePt ?? layout.fontSizePt;
        const applied = layout.appliedFontSizePt ?? layout.fontSizePt;
        $('elementAppliedSize').textContent = Number.isFinite(applied)
          ? '현재 미리보기 ' + display(applied) + ' pt' + (Number.isFinite(requested) && applied < requested - .05 ? ' · 자동 축소됨' : '')
          : '';
      }
      let status = '';
      if (image && !layout.visible) status = '현재 표시하지 않는 로고입니다. 위의 ‘명찰에 넣을 로고’에서 표시할 로고를 선택하세요.';
      else if (!image && !$('elementVisible').checked) status = '숨겨진 요소입니다. ‘명찰에 표시’를 켜면 다시 표시됩니다.';
      else if (layout.empty) status = '현재 사람에게 입력된 내용이 없습니다. 명찰 내용에서 입력하면 이 설정으로 표시됩니다.';
      else if (!layout.exists) status = '명찰 미리보기에서 위치와 크기를 확인할 수 있습니다.';
      $('elementStatus').textContent = status;
      $('elementStatus').hidden = !status;
      decoratePreview();
    } finally { refreshing = false; }
  }
  function update(patch) {
    const result = app.updateElement(selected, patch);
    if (result && result.valid === false) {
      announce('설정을 적용하지 못했습니다. 입력 값을 확인하세요.');
      return false;
    }
    refresh();
    return true;
  }
  for (const [key, field] of Object.entries(numbers)) {
    const input = $(field.id);
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      const value = input.valueAsNumber;
      if (!raw || !Number.isFinite(value)) {
        error(input, field.label + '에 숫자를 입력하세요.');
        return;
      }
      if (value < field.min || value > field.max) {
        error(input, field.label + '은 ' + field.min + '–' + field.max + ' ' + field.unit + ' 범위입니다.');
        return;
      }
      clearError();
      update({ [key]: value });
    });
    input.addEventListener('blur', () => {
      if (invalidInput === input) { clearError(); refresh(true); announce('입력하지 못한 값은 마지막 적용 값으로 되돌렸습니다.'); }
    });
  }
  $('elementSelect').addEventListener('change', event => setSelected(event.target.value));
  $('elementVisible').addEventListener('change', event => update({ visible: event.target.checked }));
  $('elementFont').addEventListener('change', event => update({ fontId: event.target.value }));
  $('elementAlign').addEventListener('change', event => update({ align: event.target.value }));
  $('elementAutoFit').addEventListener('change', event => update({ fitMode: event.target.checked ? 'auto' : 'manual' }));
  $('elementColor').addEventListener('input', event => { clearError(); update({ color: event.target.value }); });
  $('elementColorHex').addEventListener('input', event => {
    const input = event.target;
    let color = input.value.trim();
    if (!/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)) { error(input, '색상은 #0E4A84처럼 3자리 또는 6자리 HEX 값으로 입력하세요.'); return; }
    if (color.length === 4) color = '#' + [...color.slice(1)].map(character => character + character).join('');
    clearError();
    update({ color: color.toLowerCase() });
  });
  $('elementColorHex').addEventListener('blur', () => { clearError(); refresh(true); });
  $('resetElement').addEventListener('click', () => {
    if (drag) finishDrag();
    app.resetElement(selected);
    clearError(); refresh(true);
    announce(labels[selected] + '의 조정을 현재 디자인 기본값으로 되돌렸습니다.');
  });
  $('resetDesign').addEventListener('click', () => {
    if (drag) finishDrag();
    app.resetDesign();
    clearError(); refresh(true);
    announce('현재 디자인의 모든 요소 조정을 되돌렸습니다. 명단과 삽입지·인쇄 설정은 유지됩니다.');
  });
  $('showLogoChoice').addEventListener('click', () => { $('logoMode').focus(); $('logoMode').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  panel.addEventListener('toggle', () => {
    if (!panel.open && drag) finishDrag();
    decoratePreview();
  });

  // Pointer coordinates are converted through the scaled badge, never through the selected
  // element. Keeping the starting offset prevents the text from jumping under the pointer.
  function pointerDown(event) {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const node = event.target.closest('[data-element]');
    if (!node || !node.closest('#previewSlot') || !labels[node.dataset.element]) return;
    const id = node.dataset.element;
    const layout = app.getElementLayout(id);
    const card = node.closest('.badge');
    if (!layout || !card || !layout.visible) return;
    const rect = card.getBoundingClientRect();
    const settings = app.getState().settings;
    if (!rect.width || !rect.height || !Number.isFinite(settings.width) || !Number.isFinite(settings.height)) return;
    event.preventDefault();
    setSelected(id, true);
    node.focus({ preventScroll: true });
    drag = {
      node, captureNode: $('previewSlot'), id, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY,
      xMm: layout.xMm, yMm: layout.yMm, mmPerX: settings.width / rect.width, mmPerY: settings.height / rect.height,
      changed: false
    };
    node.classList.add('is-design-dragging');
    $('badgeStage').classList.add('is-design-dragging');
    // The stable preview container keeps capture when a first move reparents a flowing element.
    drag.captureNode.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const xMm = round(Math.max(numbers.xMm.min, Math.min(numbers.xMm.max, drag.xMm + (event.clientX - drag.startClientX) * drag.mmPerX)));
    const yMm = round(Math.max(numbers.yMm.min, Math.min(numbers.yMm.max, drag.yMm + (event.clientY - drag.startClientY) * drag.mmPerY)));
    if (Math.abs(xMm - drag.xMm) < .005 && Math.abs(yMm - drag.yMm) < .005 && !drag.changed) return;
    app.updateElement(drag.id, { xMm, yMm }, { render: false });
    drag.changed = true;
    $('elementX').value = display(xMm);
    $('elementY').value = display(yMm);
  }
  function finishDrag(event) {
    if (!drag || (event && event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const ended = drag;
    drag = null;
    ended.node.classList.remove('is-design-dragging');
    $('badgeStage').classList.remove('is-design-dragging');
    if (ended.captureNode.hasPointerCapture(ended.pointerId)) ended.captureNode.releasePointerCapture(ended.pointerId);
    // A cancel commits the last displayed position, so state and the visible preview agree.
    if (ended.changed) {
      app.renderVisual();
      const nextNode = nodeFor(ended.id);
      if (nextNode && document.activeElement === document.body) nextNode.focus({ preventScroll: true });
      refresh(true);
      announce(labels[ended.id] + ' 위치 ' + $('elementX').value + ', ' + $('elementY').value + ' mm');
    }
  }
  $('previewSlot').addEventListener('pointerdown', pointerDown);
  $('previewSlot').addEventListener('pointermove', pointerMove);
  $('previewSlot').addEventListener('pointerup', finishDrag);
  $('previewSlot').addEventListener('pointercancel', finishDrag);
  $('previewSlot').addEventListener('lostpointercapture', finishDrag);
  window.addEventListener('blur', () => finishDrag());
  document.addEventListener('visibilitychange', () => { if (document.hidden) finishDrag(); });
  $('previewSlot').addEventListener('click', event => {
    const node = event.target.closest('[data-element]');
    if (node && labels[node.dataset.element]) setSelected(node.dataset.element, true);
  });
  $('previewSlot').addEventListener('keydown', event => {
    const node = event.target.closest('[data-element]');
    if (!node || !labels[node.dataset.element]) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(node.dataset.element, true); return; }
    if (event.key === 'Escape') { finishDrag(); $('elementSelect').focus(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    setSelected(node.dataset.element, true);
    const layout = app.getElementLayout(selected);
    if (!layout) return;
    const key = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 'xMm' : 'yMm';
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const value = round(Math.max(numbers[key].min, Math.min(numbers[key].max, layout[key] + direction * (event.shiftKey ? 1 : .1))));
    update({ [key]: value });
    nodeFor(selected)?.focus({ preventScroll: true });
    announce(labels[selected] + ' ' + numbers[key].label + ' ' + display(value) + ' mm');
  });
  window.BadgeEditor = { refresh, select: id => setSelected(id, true), getSelected: () => selected };
  refresh(true);
}());
