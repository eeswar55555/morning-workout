#!/usr/bin/env node
/* validate-data.js — checks every content pack in data/ (no dependencies).  Run:  npm run validate
 *
 *  1. Structure   each pack must match data/schema/fitness.schema.json
 *  2. References  workouts -> exercises, plan days -> workouts, index -> plan and files
 *  3. Consistency reps exercises use `repetitions`, time/hold exercises use `durationSeconds`,
 *                 plan days run 1..N, rest days carry no workouts, ids are unique
 *
 * Errors exit with code 1. Notes (unused content, exercises without an illustration) never fail the run.
 * Use it after any AI (or person) adds content:  node scripts/validate-data.js [path/to/extra-pack.json ...]
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), DATA = process.env.FITNESS_DATA_DIR || path.join(ROOT, 'data');   // the env var lets import-pack.js check a temporary copy
const SCHEMA = JSON.parse(fs.readFileSync(path.join(DATA, 'schema', 'fitness.schema.json'), 'utf8'));

const errors = [], notes = [];
const err = (where, msg) => errors.push(where + ': ' + msg);

/* ---------- a small JSON Schema checker (the subset fitness.schema.json uses) ---------- */
function resolve(ref) { return ref.replace('#/', '').split('/').reduce((o, k) => o[k], SCHEMA); }
function check(value, schema, where) {
  if (schema.$ref) return check(value, resolve(schema.$ref), where);
  if ('const' in schema && value !== schema.const) return err(where, 'must be ' + JSON.stringify(schema.const));
  if (schema.enum && !schema.enum.includes(value)) return err(where, 'must be one of ' + schema.enum.join(', ') + ' (got ' + JSON.stringify(value) + ')');
  const t = schema.type;
  if (t) {
    const ok = t === 'array' ? Array.isArray(value) : t === 'object' ? (value && typeof value === 'object' && !Array.isArray(value)) :
      t === 'integer' ? Number.isInteger(value) : typeof value === t;
    if (!ok) return err(where, 'must be ' + t + ' (got ' + JSON.stringify(value) + ')');
  }
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) err(where, 'must not be empty');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) err(where, 'must match ' + schema.pattern + ' (got "' + value + '")');
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) err(where, 'must be >= ' + schema.minimum);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) err(where, 'needs at least ' + schema.minItems + ' item(s)');
    if (schema.maxItems != null && value.length > schema.maxItems) err(where, 'allows at most ' + schema.maxItems + ' item(s)');
    if (schema.items) value.forEach((v, i) => check(v, schema.items, where + '[' + i + ']'));
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && (schema.properties || schema.required)) {
    (schema.required || []).forEach(k => { if (!(k in value)) err(where, 'missing required field "' + k + '"'); });
    for (const k of Object.keys(value)) {
      if (schema.properties && schema.properties[k]) check(value[k], schema.properties[k], where + '.' + k);
      else if (schema.additionalProperties === false) err(where, 'unknown field "' + k + '"');
    }
  }
}

/* ---------- load ---------- */
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(path.relative(ROOT, file), e.message); return null; }
}
const extra = process.argv.slice(2).map(f => path.resolve(f));
const index = readJson(path.join(DATA, 'index.json')) || { files: [] };
check(index, { type: 'object', required: ['schemaVersion', 'defaultPlanId', 'files'], additionalProperties: false,
  properties: { schemaVersion: { const: 1 }, defaultPlanId: { type: 'string' }, files: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } } } }, 'data/index.json');

const files = index.files.map(f => path.join(DATA, f)).concat(extra);
const ex = new Map(), wo = new Map(), pl = new Map(), where = new Map();
for (const file of files) {
  let rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('..')) rel = path.basename(file);       // a pack passed on the command line from elsewhere
  if (!fs.existsSync(file)) { err(rel, 'file listed in data/index.json does not exist'); continue; }
  const pack = readJson(file); if (!pack) continue;
  check(pack, SCHEMA, rel);
  const add = (map, list, kind) => (list || []).forEach((item, i) => {
    const w = rel + ' ' + kind + '[' + i + ']' + (item && item.id ? ' (' + item.id + ')' : '');
    if (!item || typeof item.id !== 'string') return;
    if (map.has(item.id)) err(w, 'duplicate ' + kind + ' id "' + item.id + '" (also in ' + where.get(kind + item.id) + ')');
    else { map.set(item.id, item); where.set(kind + item.id, rel); }
  });
  add(ex, pack.exercises, 'exercise'); add(wo, pack.workouts, 'workout'); add(pl, pack.plans, 'plan');
}

/* ---------- references and consistency ---------- */
const usedEx = new Set(), usedWo = new Set();
for (const [id, w] of wo) {
  (w.exercises || []).forEach((en, i) => {
    const at = 'workout ' + id + ' exercises[' + i + ']';
    const e = ex.get(en.exerciseId);
    if (!e) return err(at, 'exerciseId "' + en.exerciseId + '" is not in the exercise library');
    usedEx.add(e.id);
    if (e.type === 'reps') {
      if (en.repetitions == null) err(at, e.id + ' is a reps exercise: add "repetitions"');
      if (en.durationSeconds != null) err(at, e.id + ' is a reps exercise: remove "durationSeconds"');
    } else {
      if (en.durationSeconds == null) err(at, e.id + ' is a ' + e.type + ' exercise: add "durationSeconds"');
      if (en.repetitions != null) err(at, e.id + ' is a ' + e.type + ' exercise: remove "repetitions"');
    }
  });
}
for (const [id, p] of pl) {
  let gap = false;
  (p.days || []).forEach((d, i) => {
    const at = 'plan ' + id + ' days[' + i + ']';
    if (d.day !== i + 1 && !gap) { gap = true; err(at, 'day numbers must run 1..N in order, without gaps (expected ' + (i + 1) + ', got ' + d.day + ')'); }
    const ids = d.workoutIds || (d.workoutId ? [d.workoutId] : []);
    if (d.type === 'rest') { if (ids.length) err(at, 'a rest day cannot have workouts'); return; }
    if (d.workoutId && d.workoutIds) err(at, 'use workoutId or workoutIds, not both');
    if (!ids.length) err(at, 'a workout day needs workoutId or workoutIds (or type "rest")');
    ids.forEach(w => { if (!wo.has(w)) err(at, 'workoutId "' + w + '" is not defined'); else usedWo.add(w); });
  });
}
if (index.defaultPlanId && !pl.has(index.defaultPlanId)) err('data/index.json', 'defaultPlanId "' + index.defaultPlanId + '" is not a defined plan');

/* ---------- notes ---------- */
let anim = new Set();
try {
  const A = path.join(ROOT, 'animations.js');
  const win = { Figure: { props: new Proxy({}, { get: () => () => ({}) }), line: () => ({ hip: [0, 0], t: 0 }) } };
  vm.runInContext(fs.readFileSync(A, 'utf8'), vm.createContext({ window: win }));
  anim = new Set(Object.keys(win.ANIMATIONS || {}));
} catch (e) { notes.push('could not read animations.js (' + e.message + ')'); }
const noAnim = [...ex.keys()].filter(id => !anim.has(id));
for (const id of anim) if (!ex.has(id)) err('animations.js', 'animation "' + id + '" has no exercise in the library');
const unusedEx = [...ex.keys()].filter(id => !usedEx.has(id)), unusedWo = [...wo.keys()].filter(id => !usedWo.has(id));
if (noAnim.length) notes.push(noAnim.length + ' exercise(s) have no illustration yet (a placeholder is shown): ' + noAnim.join(', '));
if (unusedEx.length) notes.push(unusedEx.length + ' exercise(s) are not used by any workout: ' + unusedEx.join(', '));
if (unusedWo.length) notes.push(unusedWo.length + ' workout(s) are not used by any plan: ' + unusedWo.join(', '));

console.log('Checked ' + files.length + ' file(s): ' + ex.size + ' exercises, ' + wo.size + ' workouts, ' + pl.size + ' plans.');
notes.forEach(n => console.log('  note: ' + n));
if (errors.length) { console.error('\n' + errors.length + ' problem(s):'); errors.forEach(e => console.error('  ✗ ' + e)); process.exit(1); }
console.log('OK, no problems.');
