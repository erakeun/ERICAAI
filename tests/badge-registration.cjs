// Run from any directory: node tests/badge-registration.cjs
// Source/data regression checks, not a browser or physical-print test.
// Override BADGE_BASE_REF only when intentionally selecting another saved baseline.
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');

const root = path.resolve(__dirname, '..');
const baseRef = process.env.BADGE_BASE_REF || 'd9e4fdee01cf7c4890ac7210ab762bb525b5b354';
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const baseCommit = git('rev-parse', '--verify', `${baseRef}^{commit}`).trim();
const normal = text => text.replace(/\r\n/g, '\n');
const read = file => normal(fs.readFileSync(path.join(root, file), 'utf8'));
const readBase = file => normal(git('show', `${baseCommit}:${file}`));
const plain = value => JSON.parse(JSON.stringify(value));
const same = (actual, expected, message) => assert.ok(isDeepStrictEqual(plain(actual), plain(expected)), message);

function section(source, start, end) {
  const first = source.indexOf(start);
  assert.ok(first >= 0, `Missing source marker: ${start}`);
  const last = source.indexOf(end, first + start.length);
  assert.ok(last >= 0, `Missing end marker: ${end}`);
  return source.slice(first, last);
}

function readAPI(source) {
  const context = vm.createContext({});
  const data = section(source, '    const PROJECTS =', '    function renderProjects(){');
  vm.runInContext(data + '\n;globalThis.api = {PROJECTS,HIDDEN_PROJECT_IDS,VISIBLE_PROJECTS,PROJECT_METRICS,WORK_TAGS,PROJECT_PREVIEWS,projectMetrics,projectMatches,projectCardHtml,projectGuideHtml,projectUsageHtml,projectPreviewHtml};', context, { timeout: 2000 });
  return context.api;
}

function maskData(source) {
  let result = source;
  for (const [start, end, label] of [
    ['    const PROJECTS = [', '\n    ];', 'PROJECTS'],
    ['    const WORK_TAGS = {', '\n    };', 'WORK_TAGS'],
    ['    const PROJECT_PREVIEWS = {', '\n    };', 'PROJECT_PREVIEWS']
  ]) {
    const body = section(result, start, end);
    result = result.replace(body, `    /* ${label}: registration data */`);
  }
  const targets = /(function projectUsageHtml\(project\)\{\s*const targets=)\[[^\]]*\]/;
  assert.ok(targets.test(result), 'Usage target array remains independently identifiable');
  return result.replace(targets, '$1[/* usage IDs */]')
    .replace(/usage-guides\.js\?v=[^"'\s<]+/g, 'usage-guides.js?v=CACHE_VERSION');
}

const home = read('index.html');
const previousHome = readBase('index.html');
const current = readAPI(home);
const previous = readAPI(previousHome);
const previousIDs = new Set(previous.PROJECTS.map(project => project.id));
const additions = current.PROJECTS.filter(project => !previousIDs.has(project.id));
const additionIDs = new Set(additions.map(project => project.id));
const guides = JSON.parse(read('assets/usage-guides.json'));
const previousGuides = JSON.parse(readBase('assets/usage-guides.json'));
const deployedRoot = new URL('https://erakeun.github.io/ERICAAI/');
const expectedApps = new Set(['lanyard-badge/', 'clip-badge/']);
let passed = 0;
let failed = 0;

function test(name, run) {
  try {
    run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function localURL(value) {
  const url = new URL(value, deployedRoot);
  assert.equal(url.origin, deployedRoot.origin, 'New tool URLs stay on the ERICAAI site');
  assert.ok(url.pathname.startsWith(deployedRoot.pathname), 'New tool URLs stay within ERICAAI');
  assert.equal(url.search + url.hash, '', 'New tool URLs open their entry page directly');
  return decodeURIComponent(url.pathname.slice(deployedRoot.pathname.length));
}

test('all original project objects and their order are unchanged', () => {
  same(current.PROJECTS.slice(0, previous.PROJECTS.length), previous.PROJECTS,
    `Keep all ${previous.PROJECTS.length} original objects unchanged and append the new tools`);
});

test('exactly two new projects have unique two-digit IDs', () => {
  assert.equal(additions.length, 2, 'Exactly two badge makers must be appended');
  const ids = current.PROJECTS.map(project => project.id);
  assert.equal(new Set(ids).size, ids.length, 'No project ID may be duplicated');
  assert.ok(additions.every(project => /^\d{2}$/.test(project.id)), 'Usage deep links require two-digit IDs');
});

test('both new maker cards resolve to separate real local entry pages', () => {
  const actualApps = new Set(additions.map(project => localURL(project.url)));
  assert.deepEqual(actualApps, expectedApps, 'Register each badge app once at its local route');
  for (const project of additions) {
    assert.equal(project.internal, false, `Project ${project.id} must open as a public link`);
    assert.equal(project.category, 'maker', `Project ${project.id} belongs to the maker filter`);
    for (const field of ['name', 'description', 'date', 'url', 'previewClass']) {
      assert.ok(typeof project[field] === 'string' && project[field].trim(), `Project ${project.id}: missing ${field}`);
    }
    assert.ok(Array.isArray(project.tags) && project.tags.length > 0, `Project ${project.id} needs search tags`);
    assert.ok(fs.statSync(path.join(root, localURL(project.url), 'index.html')).isFile());
  }
});

test('hidden project 18 stays intact and excluded from visible cards and search', () => {
  same([...current.HIDDEN_PROJECT_IDS], ['18'], 'Only the already-hidden project 18 stays hidden');
  assert.equal(current.VISIBLE_PROJECTS.length, current.PROJECTS.length - 1);
  const hidden = current.PROJECTS.find(project => project.id === '18');
  same(hidden, previous.PROJECTS.find(project => project.id === '18'), 'The hidden original data must remain intact');
  assert.equal(current.projectCardHtml(hidden), '');
  assert.equal(current.projectMatches(hidden, '', [], 'all', false, new Set()), false);
});

test('all existing tag mappings retain their members and order', () => {
  for (const [tag, ids] of Object.entries(previous.WORK_TAGS)) {
    assert.ok(Array.isArray(current.WORK_TAGS[tag]), `Existing tag ${tag} is missing`);
    same(current.WORK_TAGS[tag].filter(id => previousIDs.has(id)), ids, `Original membership/order changed for ${tag}`);
  }
  const allIDs = new Set(current.PROJECTS.map(project => project.id));
  for (const [tag, ids] of Object.entries(current.WORK_TAGS)) {
    assert.equal(new Set(ids).size, ids.length, `Duplicate mapping in ${tag}`);
    assert.ok(ids.every(id => allIDs.has(id)), `Unknown project in ${tag}`);
    if (!Object.hasOwn(previous.WORK_TAGS, tag)) assert.ok(ids.every(id => additionIDs.has(id)), `New tag ${tag} must not remap old projects`);
  }
  for (const tag of ['행사', '명단', '인쇄']) {
    assert.ok(additions.every(project => current.WORK_TAGS[tag].includes(project.id)), `Both badge tools must be discoverable with ${tag}`);
  }
});

test('metrics and maker/category counts are derived from the visible data', () => {
  assert.equal(current.PROJECT_METRICS.total, previous.PROJECT_METRICS.total + 2);
  assert.equal(current.PROJECT_METRICS.sites, previous.PROJECT_METRICS.sites + 2);
  same(current.PROJECT_METRICS, current.projectMetrics(current.VISIBLE_PROJECTS), 'Summary metrics must use the visible data');
  for (const category of ['maker', 'request', 'manage', 'info']) {
    const count = api => api.VISIBLE_PROJECTS.filter(project => project.category === category).length;
    assert.equal(count(current), count(previous) + (category === 'maker' ? 2 : 0), `${category} count changed unexpectedly`);
  }
});

test('existing search/category/guide/tag matching stays identical', () => {
  for (const oldProject of previous.PROJECTS) {
    const project = current.PROJECTS.find(item => item.id === oldProject.id);
    const text = [oldProject.name, oldProject.description, ...oldProject.tags].join(' ').normalize('NFKC').toLocaleLowerCase('ko');
    for (const category of ['all', 'maker', 'request', 'manage', 'info']) {
      for (const needsGuide of [false, true]) {
        for (const tags of [[], ...Object.keys(previous.WORK_TAGS).map(tag => [tag]), ['행사', '인쇄']]) {
          for (const terms of [[], [oldProject.name.normalize('NFKC').toLocaleLowerCase('ko')], ['no-such-badge-project-query']]) {
            assert.equal(current.projectMatches(project, text, terms, category, needsGuide, new Set(tags)),
              previous.projectMatches(oldProject, text, terms, category, needsGuide, new Set(tags)),
              `Original project ${project.id} changed filter behavior`);
          }
        }
      }
    }
  }
  for (const project of additions) {
    assert.equal(current.projectMatches(project, project.name, [], 'maker', false, new Set(['행사', '명단', '인쇄'])), true);
  }
});

test('existing preview registrations and rendered guide/help outputs are unchanged', () => {
  for (const [id, preview] of Object.entries(previous.PROJECT_PREVIEWS)) {
    same(current.PROJECT_PREVIEWS[id], preview, `Original preview ${id} changed`);
  }
  for (const project of previous.PROJECTS) {
    const updated = current.PROJECTS.find(item => item.id === project.id);
    assert.equal(current.projectPreviewHtml(updated), previous.projectPreviewHtml(project), `Original preview output ${project.id} changed`);
    assert.equal(current.projectGuideHtml(updated), previous.projectGuideHtml(project), `Original design guide ${project.id} changed`);
    assert.equal(current.projectUsageHtml(updated), previous.projectUsageHtml(project), `Original usage control ${project.id} changed`);
    const removeLatest = html => html.replace('<span class="latest">LATEST</span>', '');
    assert.equal(removeLatest(current.projectCardHtml(updated)), removeLatest(previous.projectCardHtml(project)), `Original card ${project.id} changed`);
  }
  for (const [id, preview] of Object.entries(current.PROJECT_PREVIEWS)) {
    if (Object.hasOwn(previous.PROJECT_PREVIEWS, id)) continue;
    assert.ok(additionIDs.has(id), `Unexpected new preview ${id}`);
    assert.ok(typeof preview.src === 'string' && /^\.\/assets\/previews\/[\w.-]+\.(jpg|png|webp)$/.test(preview.src));
    assert.ok(fs.statSync(path.join(root, preview.src)).isFile(), `Preview image for ${id} does not exist`);
  }
});

test('every existing usage guide and its shared metadata are unchanged', () => {
  for (const [id, guide] of Object.entries(previousGuides.guides)) {
    same(guides.guides[id], guide, `Original usage guide ${id} changed`);
  }
  const metadata = data => Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'guides'));
  same(metadata(guides), metadata(previousGuides), 'Shared guide metadata must remain unchanged; use checkedAt on each new guide');
  same(Object.keys(guides.guides).filter(id => !Object.hasOwn(previousGuides.guides, id)).sort(),
    [...additionIDs].sort(), 'Add usage guides for exactly the two new cards');
});

test('usage target IDs preserve their original order and append only the new cards', () => {
  const targets = source => {
    const match = source.match(/function projectUsageHtml\(project\)\{\s*const targets=(\[[^\]]*\])/);
    assert.ok(match, 'Usage target array is missing');
    return plain(vm.runInNewContext(match[1], {}, { timeout: 1000 }));
  };
  const before = targets(previousHome);
  const after = targets(home);
  same(after.slice(0, before.length), before, 'Original usage target IDs/order changed');
  same(after.slice(before.length).sort(), [...additionIDs].sort(), 'Only the two new usage target IDs may be appended');
  assert.equal(new Set(after).size, after.length, 'Usage target IDs must be unique');
});

test('both new cards expose complete matching usage guides', () => {
  assert.equal(additions.length, 2);
  for (const project of additions) {
    assert.ok(current.projectUsageHtml(project).includes(`data-usage-id="${project.id}"`), `Card ${project.id} lacks usage help`);
    const guide = guides.guides[project.id];
    assert.ok(guide, `Missing guide ${project.id}`);
    assert.equal(guide.name, project.name);
    assert.equal(localURL(guide.url), localURL(project.url));
    for (const field of ['purpose', 'notice', 'result', 'verification']) {
      assert.ok(typeof guide[field] === 'string' && guide[field].trim(), `Guide ${project.id}: missing ${field}`);
    }
    for (const field of ['prepare', 'mistakes']) {
      assert.ok(Array.isArray(guide[field]) && guide[field].length > 0 && guide[field].every(value => typeof value === 'string' && value.trim()), `Guide ${project.id}: invalid ${field}`);
    }
    assert.ok(Array.isArray(guide.steps) && guide.steps.length > 0, `Guide ${project.id} needs steps`);
    for (const step of guide.steps) {
      assert.ok(typeof step.title === 'string' && step.title.trim() && typeof step.body === 'string' && step.body.trim());
      if (step.image) {
        assert.match(step.image, /^assets\/usage\/[\w.-]+\.jpg$/);
        assert.ok(step.alt && step.caption, 'Usage screenshots require accessible alt text and a caption');
        assert.ok(fs.statSync(path.join(root, step.image)).isFile());
      }
    }
  }
});

test('new cards open their actual URLs and only the final card is marked latest', () => {
  assert.equal(additions.length, 2);
  for (const project of additions) {
    const html = current.projectCardHtml(project);
    assert.ok(html.includes(`href="${project.url}" target="_blank"`), `Card ${project.id} must link to its tool`);
    assert.ok(html.includes(project.name), `Card ${project.id} needs its own title`);
  }
  const latest = current.VISIBLE_PROJECTS.filter(project => current.projectCardHtml(project).includes('<span class="latest">LATEST</span>'));
  assert.equal(latest.length, 1);
  assert.equal(latest[0].id, current.VISIBLE_PROJECTS.at(-1).id);
  assert.ok(additionIDs.has(latest[0].id));
});

test('all non-registration main-page HTML and behavior remain unchanged', () => {
  assert.ok(maskData(home) === maskData(previousHome),
    'Only PROJECTS, WORK_TAGS, PROJECT_PREVIEWS, usage target IDs and the usage script cache version may change in index.html');
  assert.equal(section(home, '    <section class="request-section">', '\n    <div class="wrap">'),
    section(previousHome, '    <section class="request-section">', '\n    <div class="wrap">'), 'Contact form markup changed');
  assert.equal(section(home, '    const requestForm =', '\n  </script>'),
    section(previousHome, '    const requestForm =', '\n  </script>'), 'Contact form behavior changed');
});

test('existing usage-dialog behavior is preserved apart from the data cache key', () => {
  const maskVersion = text => text.replace(/usage-guides\.json\?v=[^"'\s)]+/g, 'usage-guides.json?v=CACHE_VERSION');
  assert.ok(maskVersion(read('usage-guides.js')) === maskVersion(readBase('usage-guides.js')),
    'Keep existing guide navigation, dialogs, history, and accessibility behavior unchanged');
});

test('all other original tracked files, including NOW and existing tests/assets, are untouched', () => {
  const existing = new Set(git('ls-tree', '-r', '--name-only', baseCommit).trim().split('\n'));
  const changed = git('diff', '--name-only', '--no-renames', baseCommit, '--').trim().split('\n').filter(Boolean);
  const permitted = new Set(['index.html', 'assets/usage-guides.json', 'usage-guides.js']);
  const forbidden = changed.filter(file => existing.has(file) && !permitted.has(file));
  assert.deepEqual(forbidden, [], `Pre-existing files changed outside registration scope: ${forbidden.join(', ')}`);
});

console.log(`\n${passed} passed, ${failed} failed; baseline ${baseCommit}.`);
console.log(`Projects: ${previous.PROJECTS.length} -> ${current.PROJECTS.length}; visible: ${previous.VISIBLE_PROJECTS.length} -> ${current.VISIBLE_PROJECTS.length}.`);
console.log('Source/data checks only; this does not establish browser layout, exports, or physical print accuracy.');
if (failed) process.exitCode = 1;
