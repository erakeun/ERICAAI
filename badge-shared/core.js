(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BadgeCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_RECORDS = 1000;
  var MAX_TEXT_LENGTH = 2 * 1024 * 1024;
  var FIELD_LIMITS = Object.freeze({ name: 120, affiliation: 240, title: 240, event: 240 });
  var FIELDS = ['name', 'affiliation', 'title', 'event'];
  var TEMPLATES = ['blue', 'official', 'hanyang', 'hibb', 'staff'];
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  var plain = function (value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };
  var finite = function (value) { return typeof value === 'number' && Number.isFinite(value); };

  var presets = [
    { id: 'artsign-2397', kind: 'lanyard', label: '아트사인 95 × 65', width: 95, height: 65, outer: null, source: 'https://www.artsign.co.kr/shop/item.php?it_id=2397', date: '2026-10-26' },
    { id: 'artsign-2342', kind: 'lanyard', label: '아트사인 85 × 54', width: 85, height: 54, outer: null, source: 'https://www.artsign.co.kr/shop/item.php?ca_id=4007&it_id=2342&page=1', date: '2026-10-26' },
    { id: 'artsign-2408', kind: 'lanyard', label: '아트사인 54 × 85 (세로)', width: 54, height: 85, outer: null, source: 'https://www.artsign.co.kr/shop/item.php?ca_id=4007&it_id=2408&page=1', date: '2026-10-26' },
    { id: 'artsign-2348', kind: 'lanyard', label: '아트사인 95 × 122 (대형)', width: 95, height: 122, outer: null, source: 'https://www.artsign.co.kr/shop/item.php?ca_id=4007&it_id=2348&page=1', date: '2026-10-26' },
    { id: 'durable-821419', kind: 'clip', label: 'DURABLE 90 × 54', width: 90, height: 54, outer: Object.freeze({ width: 95, height: 60 }), source: 'https://www.durable-uk.com/en_GB/name-badge-click-fold-54x90-mm-with-combi-clip-pp/821419', date: '2026-10-26' },
    { id: 'durable-815719', kind: 'clip', label: 'DURABLE 75 × 40', width: 75, height: 40, outer: Object.freeze({ width: 75, height: 42 }), source: 'https://www.durable-uk.com/en_GB/name-badge-40x75-mm-with-combi-clip/815719', date: '2026-10-26' }
  ].map(function (preset) {
    preset.sizeBasis = '속지크기 기준 · 가로 × 세로';
    return Object.freeze(preset);
  });
  Object.freeze(presets);

  function defaultSettings(kind) {
    return { width: kind === 'clip' ? 90 : 95, height: kind === 'clip' ? 54 : 65, pageMargin: 10, gap: 3, cardPadding: 4, cropMarks: true, fontScale: 100 };
  }

  function layout(options) {
    var input = plain(options) ? options : {};
    var result = {
      valid: false, errors: [], pageWidth: 210, pageHeight: 297,
      width: input.width, height: input.height,
      pageMargin: input.pageMargin === undefined ? 10 : input.pageMargin,
      gap: input.gap === undefined ? 3 : input.gap,
      columns: 0, rows: 0, capacity: 0, usableWidth: 0, usableHeight: 0,
      gridWidth: 0, gridHeight: 0, originX: 0, originY: 0
    };
    ['width', 'height', 'pageMargin', 'gap'].forEach(function (key) {
      var positive = key === 'width' || key === 'height';
      if (!finite(result[key]) || (positive ? result[key] <= 0 : result[key] < 0)) {
        result.errors.push(key + ': ' + (positive ? '0보다 큰 유한한 숫자' : '0 이상의 유한한 숫자') + '가 필요합니다.');
      }
    });
    if (result.errors.length) return result;
    result.usableWidth = Math.max(0, 210 - result.pageMargin * 2);
    result.usableHeight = Math.max(0, 297 - result.pageMargin * 2);
    function fit(space, size) {
      var epsilon = 1e-9 * Math.max(1, space, size);
      if (space <= 0 || size > space + epsilon) return 0;
      return 1 + Math.floor((space - size + epsilon) / (size + result.gap));
    }
    result.columns = fit(result.usableWidth, result.width);
    result.rows = fit(result.usableHeight, result.height);
    var count = result.columns * result.rows;
    if (!Number.isSafeInteger(result.columns) || !Number.isSafeInteger(result.rows) || !Number.isSafeInteger(count)) {
      result.columns = 0;
      result.rows = 0;
      result.errors.push('계산 가능한 배치 수를 초과했습니다. 속지 크기를 확인하세요.');
      return result;
    }
    result.capacity = count;
    if (!result.capacity) {
      result.errors.push('현재 속지 크기와 여백으로 A4 용지에 배치할 수 없습니다.');
      return result;
    }
    result.gridWidth = result.columns * result.width + (result.columns - 1) * result.gap;
    result.gridHeight = result.rows * result.height + (result.rows - 1) * result.gap;
    result.originX = result.pageMargin + Math.max(0, (result.usableWidth - result.gridWidth) / 2);
    result.originY = result.pageMargin + Math.max(0, (result.usableHeight - result.gridHeight) / 2);
    result.valid = true;
    return result;
  }

  function validateRecord(value) {
    var errors = [];
    var record = { id: '', name: '', affiliation: '', title: '', event: '' };
    if (!plain(value)) return { valid: false, errors: ['명단 항목은 객체여야 합니다.'], record: null };
    if (['__proto__', 'prototype', 'constructor'].some(function (key) { return own(value, key); })) {
      return { valid: false, errors: ['명단에 허용되지 않는 속성이 있습니다.'], record: null };
    }
    FIELDS.forEach(function (field) {
      var entry = own(value, field) ? value[field] : '';
      if (typeof entry !== 'string') {
        errors.push(field + ': 문자열이 필요합니다.');
        return;
      }
      record[field] = entry.trim();
      if (record[field].length > FIELD_LIMITS[field]) errors.push(field + ': ' + FIELD_LIMITS[field] + '자 이내로 입력하세요.');
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(record[field])) errors.push(field + ': 허용되지 않는 제어 문자가 있습니다.');
    });
    if (!record.name) errors.push('이름은 필수입니다.');
    if (own(value, 'id')) {
      if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 80) errors.push('id: 1~80자의 문자열이 필요합니다.');
      else record.id = value.id;
    }
    return { valid: errors.length === 0, errors: errors, record: record };
  }

  function delimiterFor(text) {
    var quoted = false;
    var tabs = 0;
    for (var index = 0; index < text.length; index += 1) {
      var character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted) {
        if (character === '\t') tabs += 1;
        if ((character === '\n' || character === '\r') && text.slice(0, index).trim()) break;
      }
    }
    return tabs ? '\t' : ',';
  }

  function readDelimited(text, delimiter) {
    var rows = [];
    var cells = [];
    var cell = '';
    var quoted = false;
    var closed = false;
    var line = 1;
    var startLine = 1;
    var errors = [];
    function pushCell() { cells.push(cell); cell = ''; closed = false; }
    function pushRow() {
      pushCell();
      if (cells.some(function (value) { return value.trim() !== ''; })) rows.push({ cells: cells, line: startLine });
      cells = [];
      startLine = line;
    }
    for (var index = 0; index < text.length; index += 1) {
      var character = text[index];
      if (quoted) {
        if (character === '"') {
          if (text[index + 1] === '"') { cell += '"'; index += 1; }
          else { quoted = false; closed = true; }
        } else if (character === '\r' || character === '\n') {
          if (character === '\r' && text[index + 1] === '\n') index += 1;
          cell += '\n';
          line += 1;
        } else cell += character;
      } else if (character === delimiter) {
        pushCell();
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        line += 1;
        pushRow();
      } else if (character === '"') {
        if (cell === '' && !closed) quoted = true;
        else { errors.push(line + '행: 따옴표 위치가 올바르지 않습니다.'); break; }
      } else if (closed) {
        if (character !== ' ' && character !== '\t') { errors.push(line + '행: 닫는 따옴표 뒤에는 구분자 또는 줄바꿈이 필요합니다.'); break; }
      } else cell += character;
    }
    if (quoted) errors.push(startLine + '행: 닫히지 않은 따옴표가 있습니다.');
    if (!errors.length && (cell !== '' || cells.length || closed)) pushRow();
    return { rows: rows, errors: errors };
  }

  function parseRoster(text) {
    var result = { records: [], errors: [], warnings: [], diagnostics: [], delimiter: ',', hasHeader: false };
    function report(level, code, row, message) {
      result[level === 'error' ? 'errors' : 'warnings'].push(message);
      result.diagnostics.push({ level: level, code: code, row: row, message: message });
    }
    if (typeof text !== 'string') {
      report('error', 'invalid-text', null, '명단은 CSV 또는 TSV 문자열이어야 합니다.');
      return result;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      report('error', 'text-limit', null, '명단 파일은 2MB 이내로 입력하세요.');
      return result;
    }
    text = text.replace(/^\uFEFF/, '');
    result.delimiter = delimiterFor(text);
    var parsed = readDelimited(text, result.delimiter);
    parsed.errors.forEach(function (message) { report('error', 'csv-syntax', null, message); });
    if (parsed.errors.length) return result;
    if (!parsed.rows.length) {
      report('warning', 'empty-roster', null, '입력된 명단이 없습니다.');
      return result;
    }
    var aliases = { '이름': 'name', 'name': 'name', '소속': 'affiliation', 'affiliation': 'affiliation', '직책': 'title', 'title': 'title', '행사명': 'event', 'event': 'event' };
    var header = parsed.rows[0].cells.map(function (cell) {
      var key = cell.trim().toLowerCase();
      return own(aliases, key) ? aliases[key] : null;
    });
    var recognized = header.filter(Boolean);
    result.hasHeader = recognized.indexOf('name') !== -1 || recognized.length >= 2;
    var mapping = FIELDS;
    var data = parsed.rows;
    if (result.hasHeader) {
      mapping = header;
      data = parsed.rows.slice(1);
      if (recognized.indexOf('name') === -1) report('error', 'missing-name-header', parsed.rows[0].line, '머리글에 이름 또는 name 열이 필요합니다.');
      if (recognized.some(function (field, index) { return recognized.indexOf(field) !== index; })) report('error', 'duplicate-header', parsed.rows[0].line, '같은 뜻의 머리글 열을 중복해서 사용할 수 없습니다.');
      if (header.some(function (field) { return field === null; })) report('warning', 'unknown-header', parsed.rows[0].line, '알 수 없는 머리글 열은 가져오지 않습니다.');
      if (result.errors.length) return result;
    }
    if (data.length > MAX_RECORDS) {
      report('error', 'record-limit', null, '명단은 최대 ' + MAX_RECORDS + '명까지 가져올 수 있습니다.');
      return result;
    }
    data.forEach(function (row, index) {
      var record = { id: 'import-' + (index + 1), name: '', affiliation: '', title: '', event: '' };
      mapping.forEach(function (field, column) { if (field) record[field] = row.cells[column] === undefined ? '' : row.cells[column]; });
      if (row.cells.length > mapping.length && row.cells.slice(mapping.length).some(function (cell) { return cell.trim() !== ''; })) {
        report('warning', 'extra-columns', row.line, row.line + '행: 추가 열은 가져오지 않습니다.');
      }
      var checked = validateRecord(record);
      if (checked.valid) result.records.push(checked.record);
      else checked.errors.forEach(function (message) { report('error', 'invalid-record', row.line, row.line + '행: ' + message); });
    });
    if (result.hasHeader && !data.length) report('warning', 'empty-roster', null, '머리글 아래에 명단을 입력하세요.');
    return result;
  }

  function csvCell(value) {
    var text = value === undefined || value === null ? '' : String(value);
    // Prefix the exported cell only. The original record stays untouched.
    if (/^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(text)) text = "'" + text;
    return /[",\r\n\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function toCSV(records) {
    if (!Array.isArray(records)) throw new TypeError('명단 배열이 필요합니다.');
    if (records.length > MAX_RECORDS) throw new RangeError('명단은 최대 ' + MAX_RECORDS + '명까지 내보낼 수 있습니다.');
    return ['이름,소속,직책,행사명'].concat(records.map(function (record) {
      if (!plain(record)) throw new TypeError('명단 항목은 객체여야 합니다.');
      return FIELDS.map(function (field) { return csvCell(own(record, field) ? record[field] : ''); }).join(',');
    })).join('\r\n');
  }

  function inspectJSON(value) {
    var seen = new Set();
    var stack = [{ value: value, depth: 0 }];
    var count = 0;
    while (stack.length) {
      var next = stack.pop();
      var current = next.value;
      if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
      if (typeof current === 'number') { if (!Number.isFinite(current)) return '유한하지 않은 숫자는 사용할 수 없습니다.'; continue; }
      if (typeof current !== 'object') return 'JSON으로 저장할 수 없는 값이 있습니다.';
      if ((!Array.isArray(current) && !plain(current)) || seen.has(current)) return '일반 JSON 객체와 배열만 사용할 수 있습니다.';
      if (next.depth > 8 || ++count > 12000) return '프로젝트 데이터 구조가 너무 큽니다.';
      seen.add(current);
      var keys = Object.keys(current);
      for (var index = 0; index < keys.length; index += 1) {
        var key = keys[index];
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return '허용되지 않는 객체 속성이 있습니다.';
        var descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !own(descriptor, 'value')) return '계산형 객체 속성은 사용할 수 없습니다.';
        stack.push({ value: descriptor.value, depth: next.depth + 1 });
      }
    }
    return null;
  }

  function normalizeProject(value) {
    var result = { valid: false, project: null, errors: [], warnings: [] };
    if (typeof value === 'string') {
      if (value.length > MAX_TEXT_LENGTH) { result.errors.push('프로젝트 파일은 2MB 이내여야 합니다.'); return result; }
      try { value = JSON.parse(value); } catch (error) { result.errors.push('올바른 JSON 프로젝트 파일이 아닙니다.'); return result; }
    }
    if (!plain(value)) { result.errors.push('프로젝트는 JSON 객체여야 합니다.'); return result; }
    var unsafe = inspectJSON(value);
    if (unsafe) { result.errors.push(unsafe); return result; }
    if (value.version !== 1) result.errors.push('지원하는 프로젝트 버전은 1입니다.');
    if (value.kind !== 'lanyard' && value.kind !== 'clip') result.errors.push('프로젝트 종류는 lanyard 또는 clip이어야 합니다.');
    if (!plain(value.settings)) result.errors.push('프로젝트 settings 객체가 필요합니다.');
    if (!Array.isArray(value.records)) result.errors.push('프로젝트 records 배열이 필요합니다.');
    else if (value.records.length > MAX_RECORDS) result.errors.push('명단은 최대 ' + MAX_RECORDS + '명까지 저장할 수 있습니다.');
    if (result.errors.length) return result;
    var settings = defaultSettings(value.kind);
    var ranges = { width: [20, 210], height: [20, 297], pageMargin: [0, 100], gap: [0, 50], cardPadding: [0, 30], fontScale: [50, 160] };
    Object.keys(ranges).forEach(function (key) {
      if (!own(value.settings, key)) { result.warnings.push(key + ': 기본값을 적용했습니다.'); return; }
      var setting = value.settings[key];
      if (!finite(setting) || setting < ranges[key][0] || setting > ranges[key][1] || (key === 'fontScale' && !Number.isInteger(setting))) {
        result.errors.push(key + ': ' + ranges[key][0] + '~' + ranges[key][1] + ' 범위의 ' + (key === 'fontScale' ? '정수' : '숫자') + '가 필요합니다.');
      } else settings[key] = setting;
    });
    if (own(value.settings, 'cropMarks')) {
      if (typeof value.settings.cropMarks !== 'boolean') result.errors.push('cropMarks: 불리언 값이 필요합니다.');
      else settings.cropMarks = value.settings.cropMarks;
    }
    if (settings.cardPadding * 2 >= Math.min(settings.width, settings.height)) result.errors.push('속지 안쪽 여백은 속지 가로·세로의 절반보다 작아야 합니다.');
    var placement = layout(settings);
    if (!placement.valid) result.errors = result.errors.concat(placement.errors);
    var template = own(value, 'template') ? value.template : 'blue';
    if (TEMPLATES.indexOf(template) === -1) result.errors.push('지원하지 않는 템플릿입니다.');
    var event = own(value, 'event') ? value.event : '';
    if (typeof event !== 'string' || event.length > FIELD_LIMITS.event || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(event)) result.errors.push('행사명은 제어 문자가 없는 240자 이내의 문자열이어야 합니다.');
    var records = [];
    var ids = new Set();
    value.records.forEach(function (record, index) {
      var checked = validateRecord(record);
      if (!checked.valid) { checked.errors.forEach(function (message) { result.errors.push((index + 1) + '번째 명단: ' + message); }); return; }
      if (!checked.record.id) checked.record.id = 'record-' + (index + 1);
      if (ids.has(checked.record.id)) result.errors.push('명단 id가 중복되었습니다: ' + checked.record.id);
      ids.add(checked.record.id);
      records.push(checked.record);
    });
    var selectedId = own(value, 'selectedId') ? value.selectedId : (records[0] ? records[0].id : null);
    if (selectedId !== null && typeof selectedId !== 'string') result.errors.push('selectedId는 문자열 또는 null이어야 합니다.');
    else if (records.length && !ids.has(selectedId)) { selectedId = records[0].id; result.warnings.push('선택한 명단을 첫 번째 항목으로 변경했습니다.'); }
    else if (!records.length) selectedId = null;
    if (result.errors.length) return result;
    result.project = { version: 1, kind: value.kind, template: template, event: event.trim(), records: records, selectedId: selectedId, settings: settings };
    result.valid = true;
    return result;
  }

  function paginate(records, capacity) {
    if (!Array.isArray(records) || !Number.isSafeInteger(capacity) || capacity < 1) return [];
    var pages = [];
    for (var index = 0; index < records.length; index += capacity) pages.push(records.slice(index, index + capacity));
    return pages;
  }

  return Object.freeze({
    MAX_RECORDS: MAX_RECORDS, FIELD_LIMITS: FIELD_LIMITS, presets: presets, PRESETS: presets,
    defaultSettings: defaultSettings, layout: layout, parseRoster: parseRoster,
    validateRecord: validateRecord, toCSV: toCSV, normalizeProject: normalizeProject, paginate: paginate
  });
}));
