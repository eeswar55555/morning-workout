/* Shared helpers for the content scripts (no dependencies). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const KINDS = ['exercises', 'workouts', 'plans'];

/* read data/index.json and every pack it lists */
function loadData(dir) {
  dir = dir || path.join(ROOT, 'data');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const files = index.files.map(rel => ({ rel, pack: JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) }));
  return { dir, index, files };
}

/* JSON pretty-printer that keeps the data files readable: objects multi-line, short arrays of values on one line,
 * small objects in arrays (workout entries, plan days) on one line each */
function fmt(v, ind) {
  ind = ind || '';
  const pad = ind + '  ', prim = x => x === null || typeof x !== 'object';
  if (Array.isArray(v)) {
    if (v.every(prim)) {
      const one = '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
      return one.length + ind.length < 110 ? one : '[\n' + v.map(x => pad + JSON.stringify(x)).join(',\n') + '\n' + ind + ']';
    }
    const small = x => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length <= 6 && Object.values(x).every(y => prim(y) || (Array.isArray(y) && y.every(prim)));
    if (v.every(small)) {
      const lines = v.map(x => pad + '{ ' + Object.keys(x).map(k => JSON.stringify(k) + ': ' + (Array.isArray(x[k]) ? '[' + x[k].map(y => JSON.stringify(y)).join(', ') + ']' : JSON.stringify(x[k]))).join(', ') + ' }');
      if (lines.every(l => l.length < 190)) return '[\n' + lines.join(',\n') + '\n' + ind + ']';
    }
    return '[\n' + v.map(x => pad + fmt(x, pad)).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v);
    return ks.length ? '{\n' + ks.map(k => pad + JSON.stringify(k) + ': ' + fmt(v[k], pad)).join(',\n') + '\n' + ind + '}' : '{}';
  }
  return JSON.stringify(v);
}

/* pull the JSON out of an AI answer: the first ```json fence, else the first {...} block, else the whole text */
function extractJson(text) {
  const t = String(text).replace(/^﻿/, '');
  const fence = t.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  if (fence) return JSON.parse(fence[1]);
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
}

module.exports = { ROOT, KINDS, loadData, fmt, extractJson };
