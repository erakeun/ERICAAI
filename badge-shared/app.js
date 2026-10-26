(function () {
  'use strict';
  const Core = window.BadgeCore;
  const $ = id => document.getElementById(id);
  const kind = document.body.dataset.kind === 'clip' ? 'clip' : 'lanyard';
  const assets = '../badge-shared/assets/';
  const templates = [
    { id: 'blue', name: '한양 블루', description: '단정하고 선명하게' },
    { id: 'official', name: '공식 심플', description: '격식을 담은 여백' },
    { id: 'hanyang', name: '하냥이', description: '반가운 첫인사' },
    { id: 'hibb', name: 'HiBB', description: '가볍고 친근하게' },
    { id: 'staff', name: '행사·스태프', description: '현장에서 한눈에' },
    { id: 'ribbon', name: '블루 시그널', description: '행사명을 담은 하단 띠' },
    { id: 'frame', name: '네이비 프레임', description: '테두리와 사선 포인트' },
    { id: 'side', name: '네이비 사이드', description: '측면 패널과 골드 선' }
  ];
  const logoModes = ['none', 'hanyang', 'erica', 'both'];
  const fields = ['name', 'affiliation', 'title', 'event'];
  const labels = { name: '이름', affiliation: '소속·기관', title: '직책·역할', event: '개별 행사명' };
  let nextId = 0;
  const uid = () => 'badge-' + Date.now().toString(36) + '-' + (++nextId);
  let state = {
    version: 1, kind, template: 'blue', logoMode: 'both', event: '한양 함께하는 날', selectedId: 'sample-1',
    settings: Object.assign(Core.defaultSettings(kind), { pageMargin: 8, gap: 3 }),
    records: [
      { id: 'sample-1', name: '윤해봄', affiliation: '미래협력팀', title: '참가자', event: '' },
      { id: 'sample-2', name: '강도윤', affiliation: '캠퍼스기획팀', title: '운영진', event: '' }
    ]
  };
  let selectedIds = new Set(['sample-1']);
  let view = 'single';
  let printPrepared = false;
  let toastTimer;
  let resizeFrame;

  // User text is assigned only through textContent or form values. Never interpreted as HTML.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function imageNode(file, className, alt) {
    const image = el('img', className);
    image.src = assets + file;
    image.alt = alt || '';
    image.draggable = false;
    return image;
  }
  function makeLogoBand(template, miniature) {
    const mode = logoModes.includes(state.logoMode) ? state.logoMode : 'hanyang';
    if (mode === 'none') return null;
    const white = template === 'blue' || template === 'staff';
    const band = el('div', miniature ? 'mini-logo-band' : 'badge-logo-band');
    band.dataset.logoMode = mode;
    for (const logo of mode === 'both' ? ['hanyang', 'erica'] : [mode]) {
      const file = (logo === 'hanyang' ? 'hyu' : 'hyu-erica') + (white ? '-white' : '') + '.png';
      const img = imageNode(file, miniature ? 'mini-logo' : 'badge-logo', logo === 'hanyang' ? '한양대학교' : '한양대학교 ERICA');
      img.dataset.logo = logo;
      img.width = white ? (logo === 'hanyang' ? 2710 : 2269) : 2048;
      img.height = logo === 'hanyang' ? (white ? 591 : 446) : (white ? 354 : 319);
      band.append(img);
    }
    return band;
  }
  const currentRecord = () => state.records.find(record => record.id === state.selectedId) || state.records[0] || null;
  const mm = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  function notify(message, error) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.toggle('is-error', Boolean(error));
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 6500 : 4000);
  }
  function getChecks() {
    const errors = [];
    const warnings = [];
    const s = state.settings;
    const ranges = { width: [20, 210], height: [20, 297], pageMargin: [0, 100], gap: [0, 50], cardPadding: [0, 30], fontScale: [50, 160] };
    const names = { width: '삽입지 가로', height: '삽입지 세로', pageMargin: 'A4 여백', gap: '명찰 간격', cardPadding: '글자 안쪽 여백', fontScale: '글자 크기' };
    for (const [key, bounds] of Object.entries(ranges)) {
      if (!Number.isFinite(s[key]) || s[key] < bounds[0] || s[key] > bounds[1]) errors.push(names[key] + '는 ' + bounds[0] + '–' + bounds[1] + (key === 'fontScale' ? '%' : ' mm') + '로 입력하세요.');
    }
    if (s.cardPadding * 2 >= Math.min(s.width, s.height)) errors.push('글자 안쪽 여백이 명찰의 절반 이상입니다. 여백을 줄여주세요.');
    const layout = Core.layout(s);
    if (!layout.valid && errors.length === 0) errors.push(...layout.errors);
    if (s.pageMargin < 5) warnings.push('A4 여백이 작습니다. 프린터의 인쇄 불가 영역을 확인하고 시험 인쇄하세요.');
    if (s.cropMarks && (s.gap < 3 || s.pageMargin < 3)) warnings.push('재단 표시가 이웃 명찰이나 종이 밖과 겹칠 수 있습니다. A4 여백·명찰 간격을 3 mm 이상 권장합니다.');
    if (s.width < 50 || s.height < 35) warnings.push('작은 삽입지입니다. 글자가 작아질 수 있으니 실물 크기로 확인하세요.');
    return { errors, warnings, layout, valid: errors.length === 0 };
  }
  function safeSettings() {
    const s = Object.assign({}, state.settings);
    const defaults = Core.defaultSettings(kind);
    for (const key of ['width', 'height', 'pageMargin', 'gap', 'cardPadding', 'fontScale']) {
      if (!Number.isFinite(s[key])) s[key] = defaults[key];
    }
    s.width = Math.max(20, Math.min(210, s.width));
    s.height = Math.max(20, Math.min(297, s.height));
    s.cardPadding = Math.max(0, Math.min(s.cardPadding, Math.min(s.width, s.height) / 2 - 2));
    return s;
  }
  function setPhysicalProperties(node, settings) {
    node.style.setProperty('--badge-width', settings.width + 'mm');
    node.style.setProperty('--badge-height', settings.height + 'mm');
    node.style.setProperty('--card-padding', settings.cardPadding + 'mm');
    node.style.setProperty('--page-margin', settings.pageMargin + 'mm');
    node.style.setProperty('--badge-gap', settings.gap + 'mm');
  }
  function makeBadge(record, settings) {
    const s = settings || safeSettings();
    const cell = el('div', 'badge-cell');
    setPhysicalProperties(cell, s);
    const card = el('article', 'badge' + (s.height > s.width ? ' is-portrait' : ''));
    card.dataset.template = templates.some(template => template.id === state.template) ? state.template : 'blue';
    card.dataset.logoMode = logoModes.includes(state.logoMode) ? state.logoMode : 'hanyang';
    card.classList.toggle('is-compact', s.width < 70 || s.height < 45);
    card.dataset.recordId = record.id;
    card.setAttribute('aria-label', record.name ? record.name + ' 명찰' : '빈 명찰');
    const scale = s.fontScale / 100;
    const base = Math.min(s.width / 95, s.height / 65);
    const nameSize = Math.min(46, Math.max(13, Math.min(s.width * (s.height > s.width ? .48 : .35), s.height * .48))) * scale;
    card.style.setProperty('--name-size', nameSize + 'pt');
    card.style.setProperty('--sub-size', Math.max(6.5, 10 * base) * scale + 'pt');
    card.style.setProperty('--title-size', Math.max(7, 11.5 * base) * scale + 'pt');
    card.style.setProperty('--event-size', Math.max(6.5, 9.5 * base) * scale + 'pt');
    card.style.setProperty('--logo-height', Math.min(5.5, Math.max(1.5, (s.height - s.cardPadding * 2) * .12), (s.width - s.cardPadding * 2) / (card.dataset.logoMode === 'both' ? 12 : 6)) + 'mm');
    card.style.setProperty('--content-gap', Math.min(1.8, Math.max(.5, s.height * .025)) + 'mm');
    const header = el('div', 'badge-header');
    const logoBand = makeLogoBand(card.dataset.template);
    if (logoBand) header.append(logoBand);
    const event = record.event || state.event;
    const eventNode = event ? el('div', 'badge-event', event) : null;
    if (eventNode && card.dataset.template !== 'ribbon') header.append(eventNode);
    const person = el('div', 'badge-person');
    if (record.affiliation) person.append(el('div', 'badge-affiliation', record.affiliation));
    person.append(el('div', 'badge-name', record.name || '이름 입력'));
    if (record.title) person.append(el('div', 'badge-title', record.title));
    const footer = el('div', 'badge-footer');
    footer.setAttribute('aria-hidden', 'true');
    card.append(header, person, footer);
    if (eventNode && card.dataset.template === 'ribbon') {
      eventNode.classList.add('badge-event-ribbon');
      card.append(eventNode);
    }
    if (card.dataset.template === 'hanyang' || card.dataset.template === 'hibb') card.append(imageNode(card.dataset.template === 'hanyang' ? 'hanyangi.png' : 'hibb.png', 'badge-character', card.dataset.template === 'hanyang' ? '하냥이' : 'HiBB'));
    cell.append(card);
    if (s.cropMarks) {
      for (const corner of ['tl', 'tr', 'bl', 'br']) for (const direction of ['h', 'v']) cell.append(el('span', 'crop-mark ' + corner + ' ' + direction));
    }
    return cell;
  }
  function fitBadge(card) {
    const issues = [];
    const textNodes = [...card.querySelectorAll('.badge-event,.badge-affiliation,.badge-name,.badge-title')];
    for (const text of textNodes) {
      let size = parseFloat(getComputedStyle(text).fontSize);
      const initial = size;
      const min = text.classList.contains('badge-name') ? 10.67 : 8;
      let guard = 0;
      while ((text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1) && size > min && guard++ < 100) {
        size = Math.max(min, size - .65);
        text.style.fontSize = size + 'px';
      }
      if (size < initial * .73) issues.push('문구가 길어 글자를 작게 조정했습니다. 실제 크기로 읽을 수 있는지 확인하세요.');
      else if (size < 10) issues.push('작은 글자가 있습니다. 실제 크기로 읽을 수 있는지 확인하세요.');
      if (text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1) issues.push('일부 문구가 명찰 영역을 넘습니다. 문구를 줄이거나 글자 크기·안쪽 여백을 줄여주세요.');
    }
    const person = card.querySelector('.badge-person');
    function personOverflows() {
      const style = getComputedStyle(person);
      const usable = person.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const used = [...person.children].reduce((sum, child) => sum + child.offsetHeight, 0) + Math.max(0, person.children.length - 1) * parseFloat(style.rowGap);
      return used > usable + 2;
    }
    let safety = 0;
    while (personOverflows() && safety++ < 60) {
      let changed = false;
      for (const node of person.children) {
        const size = parseFloat(getComputedStyle(node).fontSize);
        if (size > 8) { node.style.fontSize = Math.max(8, size - .5) + 'px'; changed = true; }
      }
      person.style.gap = '1mm';
      if (!changed) break;
    }
    if (safety > 1) issues.push('세로 공간에 맞게 글자를 축소했습니다. 안쪽 여백 또는 문구 길이를 조정할 수 있어요.');
    if (personOverflows()) issues.push('내용이 명찰 높이를 넘습니다. 높이를 늘리거나 문구·글자 크기를 줄이세요.');
    const bounds = card.getBoundingClientRect();
    const logos = [...card.querySelectorAll('.badge-logo')];
    const content = [...card.querySelectorAll('.badge-event,.badge-affiliation,.badge-name,.badge-title')];
    const outside = rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
    const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    if ([...logos, ...content].some(node => outside(node.getBoundingClientRect()))) issues.push('로고 또는 문구가 명찰 영역을 넘습니다. 크기를 늘리거나 안쪽 여백을 줄이세요.');
    if (logos.some((logo, index) => [...logos.slice(index + 1), ...content].some(node => overlaps(logo.getBoundingClientRect(), node.getBoundingClientRect())))) issues.push('로고가 다른 로고 또는 문구 영역을 넘습니다. 크기를 늘리거나 로고 선택·안쪽 여백을 조정하세요.');
    if (content.some((node, index) => content.slice(index + 1).some(other => overlaps(node.getBoundingClientRect(), other.getBoundingClientRect())))) issues.push('문구가 서로의 영역을 넘습니다. 크기를 늘리거나 문구·글자 크기를 줄이세요.');
    card.dataset.overflow = issues.some(issue => /넘/.test(issue)) ? 'true' : 'false';
    card.dataset.fitWarning = issues.join(' ');
    return [...new Set(issues)];
  }
  function makePage(records, layout, settings) {
    const page = el('section', 'print-page');
    setPhysicalProperties(page, settings);
    page.style.setProperty('--columns', layout.columns);
    const grid = el('div', 'print-grid');
    for (const record of records) grid.append(makeBadge(record, settings));
    page.append(grid);
    return page;
  }
  function renderTemplates() {
    $('templateList').replaceChildren();
    for (const template of templates) {
      const button = el('button', 'template-button');
      button.type = 'button';
      button.dataset.template = template.id;
      button.setAttribute('aria-pressed', String(template.id === state.template));
      const thumb = el('span', 'template-thumb ' + template.id);
      thumb.setAttribute('aria-hidden', 'true');
      thumb.dataset.logoMode = state.logoMode;
      const band = makeLogoBand(template.id, true);
      if (band) thumb.append(band);
      thumb.append(el('small', '', '함께하는 날'), el('b', '', '윤해봄'));
      if (template.id === 'hanyang' || template.id === 'hibb') thumb.append(imageNode(template.id === 'hanyang' ? 'hanyangi.png' : 'hibb.png', 'mini-char'));
      button.append(thumb, el('strong', '', template.name), el('span', 'template-description', template.description));
      button.addEventListener('click', () => { state.template = template.id; renderTemplates(); renderVisual(); });
      $('templateList').append(button);
    }
  }
  function renderPreset() {
    const preset = Core.presets.find(item => item.kind === kind && item.width === state.settings.width && item.height === state.settings.height);
    $('sizePreset').value = preset ? preset.id : 'custom';
    $('presetDescription').replaceChildren();
    if (!preset) { $('presetDescription').textContent = '직접 입력한 삽입지 규격입니다. 케이스의 내부 치수와 맞는지 확인하세요.'; return; }
    const outer = preset.outer ? ' · 케이스 외곽 ' + mm(preset.outer.width) + ' × ' + mm(preset.outer.height) + ' mm' : ' · 케이스 외곽은 별도 확인';
    $('presetDescription').append(el('span', '', '삽입지 ' + mm(preset.width) + ' × ' + mm(preset.height) + ' mm' + outer), document.createElement('br'));
    const source = el('a', '', '제조사 원문 ↗');
    source.href = preset.source;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    $('presetDescription').append(source, el('span', '', ' · 확인 ' + preset.date + ' · 공통 표준이 아닌 제품별 규격'));
  }
  function renderEditor() {
    const record = currentRecord();
    for (const field of fields) {
      const input = $(field === 'event' ? 'recordEvent' : field);
      input.value = record ? record[field] || '' : '';
      input.disabled = !record;
    }
    $('event').value = state.event;
    $('logoMode').value = state.logoMode;
    $('editingLabel').textContent = record ? '미리보기의 사람 편집 중' : '명단을 추가하세요';
    for (const key of ['width', 'height', 'pageMargin', 'gap', 'cardPadding', 'fontScale']) $(key).value = Number.isFinite(state.settings[key]) ? state.settings[key] : '';
    $('cropMarks').checked = state.settings.cropMarks;
    $('fontScaleValue').textContent = state.settings.fontScale + '%';
    renderPreset();
  }
  function updateSelection() {
    const count = state.records.filter(record => selectedIds.has(record.id)).length;
    $('selectionCount').textContent = count + '명 선택';
    $('selectAll').checked = state.records.length > 0 && count === state.records.length;
    $('selectAll').indeterminate = count > 0 && count < state.records.length;
    $('selectAll').disabled = state.records.length === 0;
    $('deleteSelected').disabled = count === 0;
    $('exportCSV').disabled = state.records.length === 0;
    $('printSelected').textContent = count + '명 선택 인쇄·PDF';
  }
  function renderRoster() {
    $('rosterBody').replaceChildren();
    state.records.forEach((record, index) => {
      const row = el('tr', record.id === state.selectedId ? 'is-current' : '');
      row.dataset.id = record.id;
      const checkCell = el('td');
      const check = el('input');
      check.type = 'checkbox'; check.checked = selectedIds.has(record.id); check.dataset.select = record.id;
      check.setAttribute('aria-label', (index + 1) + '번째 명찰 인쇄 선택');
      check.addEventListener('change', () => { if (check.checked) selectedIds.add(record.id); else selectedIds.delete(record.id); updateSelection(); updatePrintAvailability(); printPrepared = false; });
      checkCell.append(check);
      const viewCell = el('td');
      const button = el('button', '', '보기');
      button.dataset.preview = record.id;
      button.setAttribute('aria-label', (index + 1) + '번째 명찰 미리보기');
      button.addEventListener('click', () => { state.selectedId = record.id; renderRoster(); renderEditor(); renderVisual(); });
      viewCell.append(button);
      row.append(checkCell, viewCell);
      for (const field of fields) {
        const cell = el('td');
        const input = el('input');
        input.type = 'text'; input.value = record[field] || ''; input.maxLength = field === 'name' ? 120 : 240;
        input.dataset.id = record.id; input.dataset.field = field;
        input.setAttribute('aria-label', (index + 1) + '번째 ' + labels[field]);
        if (field === 'event') input.placeholder = '공통 행사명';
        input.addEventListener('input', () => {
          record[field] = input.value;
          if (record.id === state.selectedId) $(field === 'event' ? 'recordEvent' : field).value = input.value;
          renderVisual();
        });
        cell.append(input); row.append(cell);
      }
      const deleteCell = el('td');
      const remove = el('button', '', '×');
      remove.dataset.delete = record.id;
      remove.setAttribute('aria-label', (index + 1) + '번째 명찰 삭제');
      remove.addEventListener('click', () => removeRecords(new Set([record.id])));
      deleteCell.append(remove); row.append(deleteCell);
      $('rosterBody').append(row);
    });
    $('rosterCount').textContent = state.records.length + '명';
    $('emptyRoster').hidden = state.records.length !== 0;
    updateSelection();
  }
  function removeRecords(ids) {
    const count = state.records.filter(record => ids.has(record.id)).length;
    state.records = state.records.filter(record => !ids.has(record.id));
    for (const id of ids) selectedIds.delete(id);
    if (!state.records.some(record => record.id === state.selectedId)) state.selectedId = state.records[0] ? state.records[0].id : '';
    render();
    notify(count + '명을 명단에서 삭제했습니다.');
  }
  function scalePreviews() {
    const cell = $('previewSlot').firstElementChild;
    if (cell && !$('badgeStage').hidden && cell.classList.contains('badge-cell')) {
      const w = cell.offsetWidth, h = cell.offsetHeight;
      const available = Math.max(100, $('badgeStage').clientWidth - 38);
      const scale = Math.min(1.5, available / w, 410 / h);
      cell.style.transform = 'scale(' + scale + ')';
      $('previewSlot').style.width = w * scale + 'px';
      $('previewSlot').style.height = h * scale + 'px';
    }
    const page = $('sheetSlot').firstElementChild;
    if (page && !$('sheetStage').hidden) {
      const scale = Math.min(.45, Math.max(100, $('sheetStage').clientWidth - 34) / page.offsetWidth);
      page.style.transform = 'scale(' + scale + ')';
      $('sheetSlot').style.width = page.offsetWidth * scale + 'px';
      $('sheetSlot').style.height = page.offsetHeight * scale + 'px';
    }
  }
  function updatePrintAvailability() {
    const checks = getChecks();
    const valid = records => records.length > 0 && records.every(record => Core.validateRecord(record).valid);
    $('printAll').disabled = !checks.valid || !valid(state.records);
    $('printSelected').disabled = !checks.valid || !valid(state.records.filter(record => selectedIds.has(record.id)));
  }
  function renderVisual() {
    printPrepared = false;
    const checks = getChecks();
    const s = safeSettings();
    const record = currentRecord();
    const issues = [];
    $('previewSlot').replaceChildren();
    $('sheetSlot').replaceChildren();
    if (record) {
      $('previewSlot').append(makeBadge(record, s));
      if (!$('badgeStage').hidden) issues.push(...fitBadge($('previewSlot').querySelector('.badge')));
    } else $('previewSlot').append(el('p', 'hint', '명단을 추가하면 미리보기가 나타납니다.'));
    if (checks.valid && state.records.length) {
      const shown = state.records.slice(0, checks.layout.capacity);
      $('sheetSlot').append(makePage(shown, checks.layout, s));
      if (!$('sheetStage').hidden) for (const card of $('sheetSlot').querySelectorAll('.badge')) fitBadge(card);
      $('sheetCaption').textContent = '첫 페이지 · ' + shown.length + '개 배치 · 명단 순서대로 왼쪽에서 오른쪽, 위에서 아래로 출력';
    } else $('sheetCaption').textContent = checks.valid ? '명단을 추가하면 A4 배치를 볼 수 있어요.' : '규격과 여백을 조정하면 A4 배치를 볼 수 있어요.';
    $('previewPerson').textContent = record ? (record.name || '이름 미입력') + ' · ' + templates.find(template => template.id === state.template)?.name : '미리보기할 명단 없음';
    $('previewSize').textContent = mm(state.settings.width) + ' × ' + mm(state.settings.height) + ' mm';
    $('capacitySummary').textContent = checks.valid ? checks.layout.capacity + '개 · ' + checks.layout.columns + '열 × ' + checks.layout.rows + '행' : '배치 불가';
    $('pagesSummary').textContent = checks.valid ? state.records.length + '명 / ' + Math.ceil(state.records.length / checks.layout.capacity) + '장' : '—';
    const invalidCount = state.records.filter(item => !Core.validateRecord(item).valid).length;
    if (invalidCount) issues.push(invalidCount + '명의 이름이 비어 있거나 입력 형식이 올바르지 않습니다. 명단에서 수정하세요.');
    if (state.records.length === 0) issues.push('명단이 비어 있습니다. 사람을 추가하거나 명단을 가져오세요.');
    if (state.records.some(item => item.name.length > 10 || item.affiliation.length > 30 || item.title.length > 25 || (item.event || state.event).length > 35)) issues.push('긴 문구가 있는 명찰은 글자가 축소될 수 있습니다. 해당 사람의 미리보기를 확인하세요.');
    const warnings = [...new Set([...checks.errors, ...checks.warnings, ...issues])];
    $('warnings').replaceChildren();
    $('warnings').classList.toggle('error', !checks.valid || invalidCount > 0);
    if (warnings.length) { const list = el('ul'); for (const warning of warnings) list.append(el('li', '', warning)); $('warnings').append(list); }
    updatePrintAvailability();
    requestAnimationFrame(scalePreviews);
  }
  function render() {
    if (!state.records.some(record => record.id === state.selectedId)) state.selectedId = state.records[0] ? state.records[0].id : '';
    selectedIds = new Set([...selectedIds].filter(id => state.records.some(record => record.id === id)));
    renderTemplates(); renderEditor(); renderRoster(); renderVisual();
  }
  function showPrintError(message) {
    const page = el('section', 'print-page print-error', message);
    $('printRoot').replaceChildren(page);
  }
  function preparePrint(scope) {
    scope = scope || 'all';
    const checks = getChecks();
    const records = scope === 'selected' ? state.records.filter(record => selectedIds.has(record.id)) : state.records;
    const invalid = records.filter(record => !Core.validateRecord(record).valid);
    const errors = [...checks.errors];
    if (!records.length) errors.push(scope === 'selected' ? '인쇄할 사람을 명단에서 체크하세요.' : '인쇄할 명단이 없습니다.');
    if (invalid.length) errors.push('이름이 비어 있거나 올바르지 않은 명찰이 ' + invalid.length + '개 있습니다. 명단을 수정하세요.');
    if (errors.length) {
      showPrintError('명찰을 인쇄할 수 없습니다. ' + errors.join(' '));
      printPrepared = true;
      return { valid: false, pages: 0, count: 0, layout: checks.layout, warnings: errors };
    }
    const pages = Core.paginate(records, checks.layout.capacity);
    $('printRoot').replaceChildren();
    for (const recordsOnPage of pages) $('printRoot').append(makePage(recordsOnPage, checks.layout, state.settings));
    const warnings = [...checks.warnings];
    for (const card of $('printRoot').querySelectorAll('.badge')) warnings.push(...fitBadge(card));
    const clipped = $('printRoot').querySelectorAll('.badge[data-overflow="true"]').length;
    if (clipped) {
      warnings.unshift(clipped + '개 명찰의 문구가 잘립니다. 명단 미리보기에서 문구·글자 크기·안쪽 여백을 조정한 뒤 다시 인쇄하세요.');
      showPrintError(warnings[0]);
      printPrepared = true;
      return { valid: false, pages: 0, count: records.length, layout: checks.layout, warnings: [...new Set(warnings)], clippedCount: clipped };
    }
    printPrepared = true;
    return { valid: true, pages: pages.length, count: records.length, layout: checks.layout, warnings: [...new Set(warnings)] };
  }
  function prepareRuler() {
    const page = el('section', 'print-page ruler-page');
    page.append(el('h2', '', '100 mm 시험 인쇄'), el('p', '', 'A4 · 세로 · 배율 100% / 실제 크기 · 여백 없음\n머리글/바닥글 해제 · 페이지에 맞춤 해제'));
    const ruler = el('div', 'test-ruler');
    for (let i = 0; i <= 100; i += 5) {
      const tick = el('span', 'ruler-tick' + (i % 10 === 0 ? ' major' : ''));
      tick.style.left = i + 'mm';
      if (i % 10 === 0) tick.append(el('span', '', i));
      ruler.append(tick);
    }
    page.append(ruler, el('p', '', '위 눈금의 0부터 100까지 자로 재었을 때 정확히 100 mm(10 cm)여야 합니다.'), el('div', 'ruler-box', '50 × 50 mm'), el('p', '', '정사각형의 가로·세로도 각각 50 mm인지 확인하세요. 다르면 인쇄창 또는 프린터 설정에서 확대·축소를 해제한 뒤 다시 출력하세요.'), el('p', 'ruler-footnote', '이 페이지는 크기 확인용입니다. 명찰을 출력할 때도 같은 설정을 유지하세요.'));
    $('printRoot').replaceChildren(page);
    printPrepared = true;
    return { valid: true, pages: 1, count: 0 };
  }
  async function printNow(scope) {
    const result = scope === 'ruler' ? prepareRuler() : preparePrint(scope);
    if (result.warnings && result.warnings.length) {
      const list = el('ul');
      for (const warning of result.warnings) list.append(el('li', '', warning));
      $('warnings').replaceChildren(list);
      $('warnings').classList.toggle('error', !result.valid);
    }
    if (!result.valid) { notify(result.warnings.join(' '), true); return; }
    await document.fonts.ready;
    await Promise.all([...$('printRoot').querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    if (scope !== 'ruler') for (const card of $('printRoot').querySelectorAll('.badge')) fitBadge(card);
    window.print();
  }
  function download(name, type, content) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = el('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importRoster(replace) {
    const parsed = Core.parseRoster($('bulkInput').value);
    const errors = parsed.errors.slice();
    if (!parsed.records.length && !errors.length) errors.push('가져올 명단을 먼저 입력하세요. 빈 명단으로 기존 작업을 교체할 수 없습니다.');
    if (!replace && state.records.length + parsed.records.length > Core.MAX_RECORDS) errors.push('명단은 최대 1,000명까지 추가할 수 있습니다.');
    if (errors.length) {
      $('importMessage').textContent = errors.join('\n') + '\n현재 명단은 바뀌지 않았습니다.';
      $('importMessage').classList.add('is-error');
      notify('가져올 명단의 오류를 확인해주세요.', true); return;
    }
    const imported = parsed.records.map(record => Object.assign({}, record, { id: uid() }));
    state.records = replace ? imported : state.records.concat(imported);
    if (replace) selectedIds.clear();
    if (imported[0]) { state.selectedId = imported[0].id; selectedIds.add(imported[0].id); }
    render();
    $('importMessage').classList.remove('is-error');
    $('importMessage').textContent = imported.length + '명을 ' + (replace ? '새 명단으로 불러왔습니다.' : '추가했습니다.') + (parsed.warnings.length ? '\n' + parsed.warnings.join('\n') : '');
    notify(imported.length + '명 가져오기 완료');
  }
  function openHelp() { if (!$('helpDialog').open) $('helpDialog').showModal(); }
  function setup() {
    $('appTitle').textContent = kind === 'clip' ? '집게형 명찰 제작기' : '목걸이형 명찰 제작기';
    $('appDescription').textContent = kind === 'clip' ? '작은 명찰에도 또렷하게. 회의와 현장의 첫인사를 준비하세요.' : '디자인을 고르고, 이름을 넣으면 행사 준비 끝.';
    document.querySelector('[data-nav="' + kind + '"]').setAttribute('aria-current', 'page');
    for (const preset of Core.presets.filter(item => item.kind === kind)) {
      const option = el('option', '', preset.label + ' mm'); option.value = preset.id; $('sizePreset').append(option);
    }
    const custom = el('option', '', '사용자 지정 · 직접 입력'); custom.value = 'custom'; $('sizePreset').append(custom);
    $('sizePreset').addEventListener('change', () => {
      const preset = Core.presets.find(item => item.id === $('sizePreset').value);
      if (preset) { state.settings.width = preset.width; state.settings.height = preset.height; renderEditor(); renderVisual(); }
      else { $('presetDescription').textContent = '아래 가로·세로에 원하는 삽입지 크기를 입력하세요.'; $('width').focus(); }
    });
    $('event').addEventListener('input', () => { state.event = $('event').value; renderVisual(); });
    $('logoMode').addEventListener('change', () => {
      if (!logoModes.includes($('logoMode').value)) return;
      state.logoMode = $('logoMode').value;
      renderTemplates(); renderVisual();
    });
    for (const field of fields) {
      const input = $(field === 'event' ? 'recordEvent' : field);
      input.addEventListener('input', () => {
        const record = currentRecord(); if (!record) return;
        record[field] = input.value;
        const tableInput = [...$('rosterBody').querySelectorAll('input[data-field]')].find(node => node.dataset.id === record.id && node.dataset.field === field);
        if (tableInput) tableInput.value = input.value;
        renderVisual();
      });
    }
    for (const key of ['width', 'height', 'pageMargin', 'gap', 'cardPadding', 'fontScale']) $(key).addEventListener('input', () => {
      state.settings[key] = $(key).value === '' ? NaN : Number($(key).value);
      if (key === 'width' || key === 'height') renderPreset();
      $('fontScaleValue').textContent = state.settings.fontScale + '%';
      renderVisual();
    });
    $('cropMarks').addEventListener('change', () => { state.settings.cropMarks = $('cropMarks').checked; renderVisual(); });
    $('swapOrientation').addEventListener('click', () => { [state.settings.width, state.settings.height] = [state.settings.height, state.settings.width]; renderEditor(); renderVisual(); });
    $('addRecord').addEventListener('click', () => {
      if (state.records.length >= Core.MAX_RECORDS) { notify('명단은 최대 1,000명까지 만들 수 있습니다.', true); return; }
      const record = { id: uid(), name: '', affiliation: '', title: '', event: '' };
      state.records.push(record); state.selectedId = record.id; selectedIds.add(record.id); render(); $('name').focus();
    });
    $('selectAll').addEventListener('change', () => { selectedIds = new Set($('selectAll').checked ? state.records.map(record => record.id) : []); renderRoster(); updatePrintAvailability(); printPrepared = false; });
    $('deleteSelected').addEventListener('click', () => removeRecords(new Set(selectedIds)));
    $('singleView').addEventListener('click', () => setView('single'));
    $('sheetView').addEventListener('click', () => setView('sheet'));
    $('printAll').addEventListener('click', () => printNow('all'));
    $('printSelected').addEventListener('click', () => printNow('selected'));
    $('rulerPrint').addEventListener('click', () => printNow('ruler'));
    $('appendImport').addEventListener('click', () => importRoster(false));
    $('replaceImport').addEventListener('click', () => importRoster(true));
    $('chooseRosterFile').addEventListener('click', () => $('rosterFile').click());
    $('rosterFile').addEventListener('change', async () => {
      const file = $('rosterFile').files[0]; if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error('명단 파일은 2 MB 이내로 선택하세요.');
        const buffer = await file.arrayBuffer(); let text; let encoding = 'UTF-8';
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
        catch (_) { text = new TextDecoder('euc-kr', { fatal: true }).decode(buffer); encoding = '한국어 Windows'; }
        $('bulkInput').value = text; $('importDetails').open = true;
        $('importMessage').classList.remove('is-error');
        $('importMessage').textContent = file.name + ' · ' + encoding + '로 읽었습니다. 내용을 확인한 뒤 추가 또는 교체를 선택하세요.';
        $('bulkInput').focus();
      } catch (error) { notify(error.message || '파일을 읽을 수 없습니다. UTF-8 CSV로 다시 저장해주세요.', true); }
      $('rosterFile').value = '';
    });
    $('sampleCSV').addEventListener('click', () => download('MACH-명찰-명단예시.csv', 'text/csv;charset=utf-8', '\uFEFF' + Core.toCSV([
      { name: '윤해봄', affiliation: '미래협력팀', title: '참가자', event: '' },
      { name: '강도윤', affiliation: '캠퍼스기획팀', title: '운영진', event: '한양 함께하는 날' }
    ])));
    $('exportCSV').addEventListener('click', () => { download('MACH-명찰-명단.csv', 'text/csv;charset=utf-8', '\uFEFF' + Core.toCSV(state.records)); notify('명단 CSV를 저장했습니다.'); });
    $('saveProject').addEventListener('click', () => {
      const checked = Core.normalizeProject(state);
      if (!checked.valid) { notify('저장 전에 입력 오류를 수정하세요. ' + checked.errors.join(' '), true); return; }
      download('MACH-' + (kind === 'clip' ? '집게형' : '목걸이형') + '-명찰.json', 'application/json;charset=utf-8', JSON.stringify(checked.project, null, 2));
      notify('작업 JSON을 저장했습니다. 다음에는 불러오기로 이어서 편집하세요.');
    });
    $('loadProject').addEventListener('click', () => $('projectFile').click());
    $('projectFile').addEventListener('change', async () => {
      const file = $('projectFile').files[0]; if (!file) return;
      try {
        if (file.size > 4 * 1024 * 1024) throw new Error('작업 파일은 4 MB 이내로 선택하세요.');
        const checked = Core.normalizeProject(await file.text());
        if (!checked.valid) throw new Error(checked.errors.join(' '));
        state = checked.project;
        const otherKind = state.kind !== kind;
        state.kind = kind;
        selectedIds = new Set(state.selectedId ? [state.selectedId] : []);
        render();
        notify('작업을 불러왔습니다.' + (otherKind ? ' 다른 명찰 유형의 크기와 디자인도 그대로 유지했습니다.' : ''));
      } catch (error) { notify('불러오지 못했습니다. ' + error.message + ' 현재 작업은 유지됩니다.', true); }
      $('projectFile').value = '';
    });
    $('helpButton').addEventListener('click', openHelp);
    $('closeHelp').addEventListener('click', () => $('helpDialog').close());
    $('helpDialog').addEventListener('click', event => { if (event.target === $('helpDialog')) { const bounds = $('helpDialog').getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('helpDialog').close(); } });
    window.addEventListener('hashchange', () => { if (location.hash === '#help') openHelp(); });
    window.addEventListener('beforeprint', () => { if (!printPrepared) preparePrint('all'); });
    window.addEventListener('afterprint', () => { printPrepared = false; });
    new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(scalePreviews); }).observe($('previewSection'));
    render();
    document.fonts.ready.then(renderVisual);
    if (location.hash === '#help') openHelp();
  }
  function setView(nextView) {
    view = nextView;
    $('singleView').setAttribute('aria-pressed', String(view === 'single'));
    $('sheetView').setAttribute('aria-pressed', String(view === 'sheet'));
    $('badgeStage').hidden = view !== 'single'; $('sheetStage').hidden = view !== 'sheet';
    // Hidden previews have no measurable geometry; rebuild after revealing the chosen view.
    renderVisual();
  }
  window.badgeApp = {
    get state() { return state; },
    getState: () => JSON.parse(JSON.stringify(state)),
    render, preparePrint, prepareRuler,
    getSelectedIds: () => [...selectedIds],
    select: ids => { selectedIds = new Set(ids); renderRoster(); updatePrintAvailability(); },
    setState: value => { const checked = Core.normalizeProject(value); if (!checked.valid) return checked; state = checked.project; state.kind = kind; selectedIds = new Set(state.selectedId ? [state.selectedId] : []); render(); return checked; }
  };
  setup();
}());
