'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const core = require('../badge-shared/core.js');

function project(overrides = {}) {
  return { version: 1, kind: 'lanyard', template: 'blue', logoMode: 'both', event: 'MACH 행사', selectedId: 'p1', settings: core.defaultSettings('lanyard'), records: [{ id: 'p1', name: '홍길동', affiliation: '한양대학교', title: '참가자', event: '' }], ...overrides };
}

test('UMD loads in a plain browser realm without Node globals', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../badge-shared/core.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.BadgeCore.parseRoster, 'function');
  assert.equal(sandbox.BadgeCore.MAX_RECORDS, 1000);
});

test('verified presets preserve insert orientation and distinguish outer sizes', () => {
  assert.equal(core.presets.length, 6);
  assert.deepEqual(core.presets.filter(p => p.kind === 'lanyard').map(p => [p.width, p.height]), [[95, 65], [85, 54], [54, 85], [95, 122]]);
  assert.deepEqual(core.presets.filter(p => p.kind === 'clip').map(p => [p.width, p.height]), [[90, 54], [75, 40]]);
  assert.deepEqual(core.presets[4].outer, { width: 95, height: 60 });
  assert.ok(core.presets.every(p => p.date === '2026-10-26' && p.source.startsWith('https://') && p.sizeBasis.includes('속지')));
  assert.ok(Object.isFrozen(core.presets) && Object.isFrozen(core.presets[0]));
});

test('A4 layout accounts for margins, gaps and explicit insert orientation', () => {
  const lanyard = core.layout({ width: 95, height: 65, pageMargin: 10, gap: 0 });
  assert.equal(lanyard.valid, true);
  assert.deepEqual([lanyard.columns, lanyard.rows, lanyard.capacity], [2, 4, 8]);
  assert.deepEqual([lanyard.usableWidth, lanyard.usableHeight], [190, 277]);
  const clip = core.layout(core.defaultSettings('clip'));
  assert.deepEqual([clip.columns, clip.rows, clip.capacity], [2, 4, 8]);
  const vertical = core.layout({ width: 54, height: 85, pageMargin: 10, gap: 3 });
  assert.deepEqual([vertical.columns, vertical.rows, vertical.capacity], [3, 3, 9]);
  const gapped = core.layout({ width: 95, height: 65, pageMargin: 10, gap: 3 });
  assert.deepEqual([gapped.columns, gapped.rows], [1, 4]);
});

test('layout boundary tolerance fixes floating errors without accepting material overflow', () => {
  const exact = core.layout({ width: 62.66666666666667, height: 65, pageMargin: 10, gap: 1 });
  assert.equal(exact.columns, 3);
  assert.equal(core.layout({ width: 62.666667, height: 65, pageMargin: 10, gap: 1 }).columns, 2);
  assert.equal(core.layout({ width: 210, height: 297, pageMargin: 0, gap: 0 }).capacity, 1);
  assert.equal(core.layout({ width: 210.01, height: 297, pageMargin: 0, gap: 0 }).capacity, 0);
});

test('layout rejects nonfinite, coercible, negative, zero-fit and unsafe capacities', () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity, '95', null, undefined]) {
    const result = core.layout({ width: value, height: 65, pageMargin: 10, gap: 0 });
    assert.equal(result.valid, false, String(value));
    assert.equal(result.capacity, 0);
    assert.ok(result.errors.length);
  }
  for (const settings of [{ pageMargin: -1 }, { gap: -1 }, { gap: '3' }, { pageMargin: Infinity }, { pageMargin: 106 }, { height: 300 }, { width: Number.MIN_VALUE, height: Number.MIN_VALUE }]) {
    assert.equal(core.layout({ width: 95, height: 65, pageMargin: 10, gap: 0, ...settings }).valid, false);
  }
  assert.equal(core.layout(null).valid, false);
});

test('pagination preserves all records and order across pages without mutating input', () => {
  const records = Array.from({ length: 25 }, (_, index) => ({ id: String(index) }));
  const pages = core.paginate(records, 8);
  assert.deepEqual(pages.map(page => page.length), [8, 8, 8, 1]);
  assert.deepEqual(pages.flat(), records);
  assert.notEqual(pages[0], records);
  assert.equal(pages[0][0], records[0]);
  for (const invalid of [0, -1, Infinity, NaN, 1.5, '8']) assert.deepEqual(core.paginate(records, invalid), []);
  assert.deepEqual(core.paginate([], 8), []);
});

test('CSV parses escaped quotes, commas, multiline fields, BOM and CRLF', () => {
  const result = core.parseRoster('\uFEFF이름,소속,직책,행사명\r\n"김,민수","연구 ""개발"" 팀","첫째\r\n둘째",행사\r\n이지은,대학,학생,\r\n');
  assert.deepEqual(result.errors, []);
  assert.equal(result.hasHeader, true);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0], { id: 'import-1', name: '김,민수', affiliation: '연구 "개발" 팀', title: '첫째\n둘째', event: '행사' });
  assert.equal(result.records[1].event, '');
});

test('TSV handles quoted tabs, shuffled English/Korean headings and optional columns', () => {
  const parsed = core.parseRoster('event\tTITLE\t이름\taffiliation\n개회\t강사\t"이\t서연"\t대학');
  assert.equal(parsed.delimiter, '\t');
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.records[0].name, '이\t서연');
  assert.equal(parsed.records[0].event, '개회');
  assert.equal(parsed.records[0].title, '강사');
  assert.equal(core.parseRoster('name\nAlice').records[0].affiliation, '');
  assert.equal(core.parseRoster('소속,이름,직책,행사명\n대학,홍길동,강사,행사').records[0].name, '홍길동');
});

test('headerless roster uses name, affiliation, title, event and ignores empty lines', () => {
  const result = core.parseRoster('\n홍길동, 대학 ,팀장,행사\n\n이지은\n,,,\n');
  assert.equal(result.hasHeader, false);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].affiliation, '대학');
  assert.equal(result.records[1].title, '');
  assert.equal(core.parseRoster('이름,이메일\n홍길동,test@example.com').warnings.length, 1);
});

test('roster reports malformed CSV and invalid headings without silently importing', () => {
  for (const csv of ['name\n"unclosed', 'name\n"name"suffix', 'name\nna"me', 'name,이름\nKim,Lee', '소속,직책\n대학,팀장']) {
    const result = core.parseRoster(csv);
    assert.equal(result.records.length, 0, csv);
    assert.ok(result.errors.length, csv);
  }
  const badRow = core.parseRoster('name,affiliation\n,대학\n정상,회사');
  assert.equal(badRow.records.length, 1);
  assert.equal(badRow.diagnostics[0].row, 2);
  assert.ok(core.parseRoster(null).errors.length);
  assert.ok(core.parseRoster('').warnings.length);
});

test('roster limits reject oversize input and individual overlong names', () => {
  const thousand = Array.from({ length: 1000 }, (_, index) => '사람' + index).join('\n');
  assert.equal(core.parseRoster(thousand).records.length, 1000);
  assert.equal(core.parseRoster(thousand + '\n초과').records.length, 0);
  assert.ok(core.parseRoster('a'.repeat(2 * 1024 * 1024 + 1)).errors.length);
  assert.ok(core.parseRoster('가'.repeat(121)).errors.length);
});

test('XSS text stays inert data; formula protection affects only CSV output', () => {
  const xss = '<img src=x onerror=alert(1)>';
  assert.equal(core.parseRoster('name\n' + xss).records[0].name, xss);
  for (const name of ['=SUM(1,2)', '+1+2', '-2+3', '@SUM(A1:A2)', '  =HYPERLINK("x")', '\t=1+1', '\r\n +2', '\u0001=2', '\u00a0@SUM(A1)']) {
    const records = [{ name, affiliation: '', title: '', event: '' }];
    const output = core.toCSV(records);
    assert.equal(records[0].name, name);
    assert.ok(output.includes("'"), name);
    if (!name.includes('\u0001')) assert.equal(core.parseRoster(output).records[0].name, "'" + name.replace(/\r\n?/g, '\n'), name);
  }
  assert.ok(!core.toCSV([{ name: '홍길동', affiliation: '', title: '', event: '' }]).includes("'"));
});

test('CSV export quotes commas, quotes, newlines and round-trips ordinary Unicode', () => {
  const records = [{ name: '김,민수', affiliation: '연구 "개발"', title: '첫째\n둘째', event: '행사' }];
  const csv = core.toCSV(records);
  assert.ok(csv.includes('"김,민수"'));
  assert.ok(csv.includes('"연구 ""개발"""'));
  const loaded = core.parseRoster(csv).records[0];
  for (const key of ['name', 'affiliation', 'title', 'event']) assert.equal(loaded[key], records[0][key]);
  assert.throws(() => core.toCSV(null), TypeError);
  assert.throws(() => core.toCSV(Array(1001).fill({ name: 'a' })), RangeError);
});

test('record validation requires text names and preserves event overrides', () => {
  const input = { name: ' 홍길동 ', event: ' 개별 행사 ', affiliation: '', title: '' };
  const result = core.validateRecord(input);
  assert.equal(result.valid, true);
  assert.equal(result.record.name, '홍길동');
  assert.equal(result.record.event, '개별 행사');
  assert.equal(input.name, ' 홍길동 ');
  for (const record of [null, [], { name: '' }, { name: '   ' }, { name: 42 }, { name: '홍길동', title: {} }, { name: 'a\u0000b' }, { id: '', name: 'Kim' }]) assert.equal(core.validateRecord(record).valid, false);
});

test('project validates, normalizes and round-trips without mutating source', () => {
  const source = project();
  const result = core.normalizeProject(JSON.stringify(source));
  assert.equal(result.valid, true);
  assert.deepEqual(result.project, source);
  result.project.records[0].name = '변경';
  assert.equal(source.records[0].name, '홍길동');
  const defaults = core.normalizeProject({ version: 1, kind: 'clip', records: [{ name: 'Kim' }], settings: {} });
  assert.equal(defaults.valid, true);
  assert.equal(defaults.project.settings.width, 90);
  assert.equal(defaults.project.settings.height, 54);
  assert.equal(defaults.project.selectedId, 'record-1');
  assert.ok(defaults.warnings.length);
  const empty = core.normalizeProject(project({ records: [] }));
  assert.equal(empty.valid, true);
  assert.equal(empty.project.selectedId, null);
});

test('legacy version 1 projects retain the Hanyang logo without mutating the saved data', () => {
  for (const kind of ['lanyard', 'clip']) {
    for (const template of ['blue', 'official', 'hanyang', 'hibb', 'staff']) {
      const legacy = project({ kind, template, settings: core.defaultSettings(kind) });
      delete legacy.logoMode;
      for (const input of [legacy, JSON.stringify(legacy)]) {
        const result = core.normalizeProject(input);
        assert.equal(result.valid, true, `${kind}/${template}`);
        assert.deepEqual(result.project, { ...legacy, logoMode: 'hanyang' });
        assert.deepEqual(core.normalizeProject(JSON.stringify(result.project)).project, result.project);
      }
      assert.equal(Object.hasOwn(legacy, 'logoMode'), false);
    }
  }
  const minimal = core.normalizeProject({ version: 1, kind: 'clip', settings: {}, records: [] });
  assert.equal(minimal.valid, true);
  assert.equal(minimal.project.logoMode, 'hanyang');
});

test('all logo modes and templates round-trip for both badge kinds with exact millimeter settings', () => {
  for (const kind of ['lanyard', 'clip']) {
    for (const template of ['blue', 'official', 'hanyang', 'hibb', 'staff', 'ribbon', 'frame', 'side']) {
      for (const logoMode of ['none', 'hanyang', 'erica', 'both']) {
        const source = project({
          kind, template, logoMode,
          settings: { ...core.defaultSettings(kind), width: 88.5, height: 53.25, gap: 2.5, cardPadding: 3.75 }
        });
        const saved = JSON.stringify(source);
        const result = core.normalizeProject(saved);
        assert.equal(result.valid, true, `${kind}/${template}/${logoMode}: ${result.errors.join(', ')}`);
        assert.deepEqual(result.project, source);
        assert.deepEqual(core.normalizeProject(JSON.stringify(result.project)).project, source);
        assert.equal(JSON.stringify(source), saved);
      }
    }
  }
});

test('logo modes and template IDs require exact strings and reject arbitrary asset URLs', () => {
  const invalidValues = [
    undefined, null, false, true, 0, 1, '', ' ', 'Both', 'both ', 'hanyang,erica',
    [], ['both'], {}, { src: 'https://example.com/logo.svg' }, new String('both'),
    'https://example.com/logo.svg', '//example.com/logo.svg', '../assets/logo.svg',
    'data:image/svg+xml,<svg onload=alert(1)>', 'javascript:alert(1)',
    '<img src=x onerror=alert(1)>', 'both\u0000'
  ];
  for (const field of ['logoMode', 'template']) {
    for (const value of invalidValues) {
      const result = core.normalizeProject(project({ [field]: value }));
      assert.equal(result.valid, false, `${field}: ${String(value)}`);
      assert.equal(result.project, null);
      assert.ok(result.errors.length);
    }
    const accessor = project();
    Object.defineProperty(accessor, field, { enumerable: true, get() { throw new Error('must not run'); } });
    assert.equal(core.normalizeProject(accessor).valid, false);
  }
});

test('normalized projects preserve inert user text and discard unsupported asset configuration', () => {
  const url = 'https://example.com/untrusted.svg';
  const xss = '<img src=x onerror=alert(1)>';
  const result = core.normalizeProject(project({
    logoMode: 'none', template: 'ribbon', event: xss,
    logoUrl: url, logoAssets: { hanyang: url, erica: url },
    settings: { ...core.defaultSettings('lanyard'), logoUrl: url },
    records: [{ id: 'p1', name: xss, affiliation: '', title: '', event: '', logoUrl: url }]
  }));
  assert.equal(result.valid, true);
  assert.equal(result.project.event, xss);
  assert.equal(result.project.records[0].name, xss);
  assert.equal(result.project.logoMode, 'none');
  assert.equal(JSON.stringify(result.project).includes(url), false);
  assert.deepEqual(core.normalizeProject(JSON.stringify(result.project)).project, result.project);
});

test('project rejects incompatible schema and unsafe setting values', () => {
  const invalid = [null, [], '{}', '{broken', project({ version: '1' }), project({ version: 2 }), project({ kind: 'unknown' }), project({ settings: null }), project({ records: {} }), project({ template: 'unknown' }), project({ event: 42 }), project({ selectedId: 1 }), project({ records: [{ name: '' }] }), project({ records: Array(1001).fill({ name: 'Kim' }) })];
  for (const setting of [{ width: '95' }, { width: Infinity }, { width: 0 }, { height: 301 }, { pageMargin: -1 }, { gap: 51 }, { fontScale: 99.5 }, { cropMarks: 'false' }, { cardPadding: 30, width: 40 }]) invalid.push(project({ settings: { ...core.defaultSettings('lanyard'), ...setting } }));
  for (const value of invalid) {
    const result = core.normalizeProject(value);
    assert.equal(result.valid, false, JSON.stringify(value));
    assert.equal(result.project, null);
    assert.ok(result.errors.length);
  }
});

test('project blocks prototype pollution, accessors, cycles and duplicate IDs', () => {
  const before = Object.prototype.polluted;
  const malicious = JSON.parse(JSON.stringify(project()).replace('"version":1', '"version":1,"__proto__":{"polluted":true}'));
  assert.equal(core.normalizeProject(malicious).valid, false);
  assert.equal(Object.prototype.polluted, before);
  const nested = project();
  nested.extra = { constructor: { prototype: { polluted: true } } };
  assert.equal(core.normalizeProject(nested).valid, false);
  const cyclical = project();
  cyclical.extra = cyclical;
  assert.equal(core.normalizeProject(cyclical).valid, false);
  const accessor = project();
  Object.defineProperty(accessor, 'extra', { enumerable: true, get() { throw new Error('must not run'); } });
  assert.equal(core.normalizeProject(accessor).valid, false);
  const duplicate = project({ records: [{ id: 'same', name: 'Kim' }, { id: 'same', name: 'Lee' }] });
  assert.equal(core.normalizeProject(duplicate).valid, false);
  const stale = core.normalizeProject(project({ selectedId: 'deleted' }));
  assert.equal(stale.valid, true);
  assert.equal(stale.project.selectedId, 'p1');
});
