#!/usr/bin/env node
/* make-ai-brief.js — builds ONE file to give to any AI (Claude, GPT, Gemini, ...) so it can add or verify content.
 *
 *   npm run ai-brief                      compact brief: instructions + schema + index of existing ids      -> ai-brief.md
 *   npm run ai-brief -- --full            same + the complete current JSON of every pack (best for VERIFY)
 *   npm run ai-brief -- --task verify     ends with a ready-made "verify everything" request
 *   npm run ai-brief -- --out my.md       choose the output file
 *
 * Paste / attach the generated file in a new chat, then add your request at the bottom (or use --task verify).
 * Save the AI's answer to a file and merge it with:  npm run import -- answer.txt
 */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData } = require('./lib');

const args = process.argv.slice(2);
const full = args.includes('--full'), ti = args.indexOf('--task'), task = ti >= 0 ? args[ti + 1] : '';
const oi = args.indexOf('--out'), out = path.resolve(ROOT, oi >= 0 ? args[oi + 1] : 'ai-brief.md');

const data = loadData();
const all = { exercises: [], workouts: [], plans: [] };
data.files.forEach(f => ['exercises', 'workouts', 'plans'].forEach(k => (f.pack[k] || []).forEach(x => all[k].push(Object.assign({ _file: f.rel }, x)))));

const cell = v => String(v == null ? '' : v).replace(/\|/g, '/');
function table(head, rows) { return '| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |\n' + rows.map(r => '| ' + r.map(cell).join(' | ') + ' |').join('\n'); }

const exRows = all.exercises.map(e => [e.id, e.name, e.type, e.difficulty, e.bodyRegion || '', (e.primaryMuscles || []).join(', '), (e.equipment || []).join(', '), e.sides ? 'both sides' : '']);
const woRows = all.workouts.map(w => [w.id, w.name, w.exercises.length + ' ex', w.rounds || 1, w.restSeconds == null ? '' : w.restSeconds, w.category || '', w.difficulty || '']);
const plRows = all.plans.map(p => [p.id, p.name, p.days.length + ' days', p.days.filter(d => d.type === 'rest').length + ' rest', p.difficulty || '']);

let md = '';
md += fs.readFileSync(path.join(data.dir, 'AI_INSTRUCTIONS.md'), 'utf8') + '\n\n---\n\n';
md += '# Reference 1: JSON Schema of a content pack\n\n```json\n' + JSON.stringify(JSON.parse(fs.readFileSync(path.join(data.dir, 'schema', 'fitness.schema.json'), 'utf8')), null, 1) + '\n```\n\n';
md += '# Reference 2: what already exists (reuse these ids)\n\n';
md += '## Exercises (' + all.exercises.length + ')\n\n' + table(['id', 'name', 'type', 'difficulty', 'region', 'primary muscles', 'equipment', 'sides'], exRows) + '\n\n';
md += '## Workouts (' + all.workouts.length + ')\n\n' + table(['id', 'name', 'size', 'rounds', 'rest s', 'category', 'difficulty'], woRows) + '\n\n';
md += '## Plans (' + all.plans.length + ')\n\n' + table(['id', 'name', 'length', 'rest days', 'difficulty'], plRows) + '\n\n';
if (full) {
  md += '# Reference 3: the complete current content (JSON)\n\nEach block is one file of `data/`. Use it to check wording, style and details.\n\n';
  data.files.forEach(f => { md += '## ' + f.rel + '\n\n```json\n' + JSON.stringify(f.pack, null, 1) + '\n```\n\n'; });
}
md += '---\n\n# Your task\n\n';
if (task === 'verify') {
  md += 'VERIFY. Review ' + (full ? 'all the content in Reference 3' : 'the content listed above (ask me for the JSON of anything you need to see)') +
    ' against the quality checklist. Check facts, safety, muscles, difficulty, amounts, naming and plan structure. Return only the items you CHANGED as complete objects with their original ids, in one content pack, followed by Notes listing every change and every concern you did not change.\n';
} else if (task === 'add') {
  md += 'ADD. <<< Describe what you want, e.g. "Add 10 mobility exercises for the hips, one 20-minute hip mobility workout and a 4-week plan for desk workers with 5 training days and 2 rest days a week." >>>\n';
} else {
  md += '<<< Write your request here: ADD new exercises/workouts/plans, or VERIFY existing ones (see the Tasks section above). >>>\n';
}
fs.writeFileSync(out, md);
console.log('Wrote ' + path.relative(process.cwd(), out) + ' (' + Math.round(md.length / 1024) + ' KB, about ' + Math.round(md.length / 3.8 / 1000) + 'k tokens).');
console.log('Give this file to the AI. Save its answer, then run:  npm run import -- <answer file>');
