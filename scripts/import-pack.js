#!/usr/bin/env node
/* import-pack.js — merge an AI's answer into data/ safely.
 *
 *   npm run import -- answer.txt            validate, then merge
 *   npm run import -- answer.txt --dry      validate and show what would happen, change nothing
 *
 * The answer file may be the raw AI reply (the JSON is found inside the ```json fence) or a plain .json pack.
 *  - an item whose id already exists REPLACES it in the file it lives in (this is how VERIFY fixes land)
 *  - a new item is added to data/<kind>/ai-additions.json (created and listed in data/index.json if needed)
 * Everything is checked first on a temporary copy with `npm run validate`; if anything is wrong nothing is changed.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { ROOT, KINDS, loadData, fmt, extractJson } = require('./lib');

const args = process.argv.slice(2), dry = args.includes('--dry'), file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('Usage: npm run import -- <answer file> [--dry]'); process.exit(2); }
let answer;
try { answer = extractJson(fs.readFileSync(path.resolve(file), 'utf8')); }
catch (e) { console.error('Could not read JSON from ' + file + ': ' + e.message + '\nThe file should contain the AI\'s ```json block.'); process.exit(1); }
if (!answer || typeof answer !== 'object' || Array.isArray(answer)) { console.error('The JSON must be one object like { "schemaVersion": 1, "exercises": [...] }.'); process.exit(1); }
const unknown = Object.keys(answer).filter(k => k !== 'schemaVersion' && !KINDS.includes(k));
if (unknown.length) console.log('  note: ignoring top-level key(s): ' + unknown.join(', '));
if (answer.schemaVersion !== 1) { console.error('schemaVersion must be 1.'); process.exit(1); }

/* work on a temporary copy of data/ */
const real = loadData(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-import-'));
fs.cpSync(real.dir, tmp, { recursive: true });
const work = loadData(tmp), touched = new Set(), report = { added: [], updated: [], same: [] };

KINDS.forEach(kind => {
  (answer[kind] || []).forEach(item => {
    if (!item || typeof item.id !== 'string') { console.error('Every ' + kind.slice(0, -1) + ' needs an id.'); process.exit(1); }
    let done = false;
    work.files.forEach(f => (f.pack[kind] || []).forEach((old, i) => {
      if (done || old.id !== item.id) return;
      done = true;
      if (JSON.stringify(old) === JSON.stringify(item)) report.same.push(kind + ':' + item.id);
      else { f.pack[kind][i] = item; touched.add(f.rel); report.updated.push(kind + ':' + item.id + '  (in ' + f.rel + ')'); }
    }));
    if (done) return;
    const rel = kind + '/ai-additions.json';
    let f = work.files.find(x => x.rel === rel);
    if (!f) { f = { rel, pack: { schemaVersion: 1 } }; work.files.push(f); work.index.files.push(rel); touched.add('index.json'); }
    (f.pack[kind] = f.pack[kind] || []).push(item); touched.add(rel); report.added.push(kind + ':' + item.id);
  });
});

fs.mkdirSync(path.join(tmp, 'exercises'), { recursive: true });
touched.forEach(rel => {
  if (rel === 'index.json') return;
  const f = work.files.find(x => x.rel === rel); fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
  fs.writeFileSync(path.join(tmp, rel), fmt(f.pack) + '\n');
});
if (touched.has('index.json')) fs.writeFileSync(path.join(tmp, 'index.json'), fmt(work.index) + '\n');

console.log('Checking the merged content...');
const run = cp.spawnSync(process.execPath, [path.join(__dirname, 'validate-data.js')], { env: Object.assign({}, process.env, { FITNESS_DATA_DIR: tmp }), encoding: 'utf8' });
const lines = (run.stdout + run.stderr).split('\n').filter(l => !/^\s*note:/.test(l));
if (run.status !== 0) {
  console.error(lines.join('\n').trim() + '\n\nNothing was changed. Fix the problems above (paste them back to the AI) and import again.');
  fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1);
}
console.log(lines.join('\n').trim());
const show = (title, l) => l.length && console.log('\n' + title + ' (' + l.length + '):\n  ' + l.join('\n  '));
show(dry ? 'Would add' : 'Added', report.added); show(dry ? 'Would update' : 'Updated', report.updated); show('Already identical, skipped', report.same);
if (!report.added.length && !report.updated.length) console.log('\nNothing to change.');
if (!dry) {
  touched.forEach(rel => { fs.mkdirSync(path.dirname(path.join(real.dir, rel)), { recursive: true }); fs.copyFileSync(path.join(tmp, rel), path.join(real.dir, rel)); });
  if (touched.size) console.log('\nDone. Review with `git diff`, try it in the app, then commit and push.');
} else console.log('\nDry run: nothing was written.');
fs.rmSync(tmp, { recursive: true, force: true });
