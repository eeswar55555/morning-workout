/* catalog.js — loads the content packs in data/ and joins exercises with their illustrations.
 *
 *   data/index.json  ->  data/**.json packs  ->  Catalog.exercises / .workouts / .plans
 *
 * The three levels only reference each other by id (see data/schema/types.ts). This file is the one place that
 * knows how the files are laid out; the rest of the app just asks the Catalog. A runtime exercise is the JSON exercise
 * plus two derived fields: `anim` (the illustration) and `area` (muscle names for display and search).
 */
(function (root) {
  'use strict';

  var NAME = { chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', back: 'Back', core: 'Core',
    glutes: 'Glutes', quadriceps: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves', hip_flexors: 'Hip flexors', lower_back: 'Lower back', neck: 'Neck',
    jaw: 'Jaw', cheeks: 'Cheeks', lips: 'Lips', forehead: 'Forehead', eyes: 'Eyes' };
  /* the illustrated character can tint these; other muscles are drawn as the closest one */
  var DRAWN = { chest: 1, shoulders: 1, biceps: 1, triceps: 1, core: 1, back: 1, glutes: 1, quadriceps: 1, hamstrings: 1, calves: 1 };
  var DRAW_AS = { forearms: 'biceps', hip_flexors: 'quadriceps', lower_back: 'back' };
  /* body zones for the muscle overlay in the workout player */
  var ZONE = { legs: ['glutes', 'quadriceps', 'hamstrings', 'calves', 'hip_flexors'], torso: ['chest', 'back', 'core'], arms: ['shoulders', 'biceps', 'triceps', 'forearms'] };

  /* Two sources, kept apart: built-in packs (data/*.json, read-only) and the user's own items (saved in the app state
   * and handed over with setCustom). Runtime objects carry `custom: true` for the user's items. */
  var C = { exercises: [], workouts: [], plans: [], defaultPlanId: null, NAME: NAME }, byEx = {}, byWo = {}, byPl = {};
  var sys = { ex: [], wo: [], pl: [] }, cust = { exercises: [], workouts: [], plans: [] };

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' (' + r.status + ')');
      return r.json();
    });
  }

  function drawable(list) {
    var out = [];
    (list || []).forEach(function (m) { m = DRAW_AS[m] || m; if (DRAWN[m] && out.indexOf(m) < 0) out.push(m); });
    return out;
  }

  /* Camera-angle labels for the switchable-view UI (SPEC-anim-multi-view). */
  var VIEW_LABEL = { side: 'Side', front: 'Front', 'close-up': 'Close-up', oblique: 'Oblique' };

  /* An exercise without an illustration gets a neutral placeholder (so any exercise from any AI works at once). */
  function placeholder(ex) {
    return {
      poses: [{}, {}], mode: 'cycle', placeholder: true, _cfg: {}, _ex: ex,
      custom: function (g, u, el) {
        if (g.firstChild) return;
        var svg = g.ownerSVGElement, thumb = svg && svg.parentNode && /(^|\s)thumb(\s|$)/.test(svg.parentNode.className || '');
        if (svg) svg.setAttribute('viewBox', '0 -16 260 176');
        if (g.parentNode) g.parentNode.removeAttribute('transform');
        var ic = el('g', { style: 'fill:var(--label);opacity:.5' }, g);
        el('rect', { x: 96, y: 66, width: 68, height: 7, rx: 3 }, ic);
        [[84, 52], [96, 56], [158, 56], [166, 52]].forEach(function (p, i) { el('rect', { x: p[0], y: p[1], width: i % 3 ? 6 : 8, height: i % 3 ? 36 : 44, rx: 3 }, ic); });
        if (thumb) return;
        var t1 = el('text', { x: 130, y: 112, 'text-anchor': 'middle', class: 'pr-label', style: 'font-size:11px' }, g); t1.textContent = ex.name;
        var t2 = el('text', { x: 130, y: 127, 'text-anchor': 'middle', class: 'pr-label', style: 'font-size:8px;opacity:.7' }, g); t2.textContent = 'Illustration coming soon';
      }
    };
  }

  function rawAnim(ex) {
    var A = root.ANIMATIONS || {}, src = A[ex.looks || ex.id], guard = 0;      // a custom exercise borrows the picture of `looks`
    while (src && src.like && guard++ < 5) src = A[src.like];          // { like: 'other_id' } reuses another picture
    return src || null;
  }

  /* Multi-view entries: { defaultView, views: { side: {...}, front: {...} } }. Legacy entries are a single block. */
  function pickView(raw, viewId) {
    if (!raw || !raw.views) return { block: raw, viewId: null, views: null, defaultView: null, map: null };
    var ids = Object.keys(raw.views), def = (raw.defaultView && raw.views[raw.defaultView]) ? raw.defaultView : ids[0];
    var id = (viewId && raw.views[viewId]) ? viewId : def;
    return { block: raw.views[id], viewId: id, views: ids, defaultView: def, map: raw.views };
  }

  function fromBlock(block, ex) {
    if (block && block.face && root.Face) return root.Face.build(block.face, ex);   // face-only drawing (face.js)
    if (!block || !block.poses) return null;
    var anim = {}, k;
    for (k in block) anim[k] = block[k];                                  // own copy: _cfg and _ex belong to this exercise
    anim._cfg = {};
    for (k in (block.cfg || {})) anim._cfg[k] = block.cfg[k];
    anim._cfg.primary = drawable(ex.primaryMuscles);
    anim._cfg.secondary = drawable(ex.secondaryMuscles).filter(function (m) { return anim._cfg.primary.indexOf(m) < 0; });
    anim._ex = ex;
    return anim;
  }

  function stampViews(anim, picked) {
    if (!anim || !picked.views) return anim;
    anim._views = picked.views;
    anim._defaultView = picked.defaultView;
    anim._viewId = picked.viewId;
    anim._viewMap = picked.map;
    return anim;
  }

  function animFor(ex, viewId) {
    var raw = rawAnim(ex);
    if (!raw) return placeholder(ex);
    var picked = pickView(raw, viewId);
    var anim = fromBlock(picked.block, ex);
    if (!anim) return placeholder(ex);
    /* Meta that lives on the multi-view root (not inside each view block). */
    if (raw.views) {
      ['reverseSide2', 'bag', 'noFloor', 'down', 'dynamic'].forEach(function (k) {
        if (raw[k] != null && anim[k] == null) anim[k] = raw[k];
      });
    }
    return stampViews(anim, picked);
  }

  function runtimeExercise(e) {
    var ex = {}, k;
    for (k in e) ex[k] = e[k];
    ex.area = C.muscleNames(e, false).join(' · ');
    ex.anim = animFor(ex);
    return ex;
  }

  function normalizeDay(d) {
    var rest = d.type === 'rest', ids = rest ? [] : (d.workoutIds || (d.workoutId ? [d.workoutId] : []));
    return { day: d.day, rest: rest || !ids.length, workoutIds: ids, note: d.note || '' };
  }

  function merge(into, map, list, kind) {
    (list || []).forEach(function (item) {
      if (!item || !item.id) return;
      if (map[item.id]) { console.warn('[catalog] duplicate ' + kind + ' id ignored: ' + item.id); return; }
      map[item.id] = item; into.push(item);
    });
  }

  function flag(o, custom) { var r = {}; for (var k in o) r[k] = o[k]; r.custom = !!custom; return r; }

  /* (re)build every lookup from the built-in packs plus the user's own items; built-in ids always win */
  function rebuild() {
    var ex = [], wo = [], pl = [];
    byEx = {}; byWo = {}; byPl = {};
    sys.ex.forEach(function (e) { merge(ex, byEx, [flag(e, false)], 'exercise'); });
    (cust.exercises || []).forEach(function (e) { if (e && e.id && e.name && e.type) merge(ex, byEx, [flag(e, true)], 'exercise'); });
    sys.wo.forEach(function (w) { merge(wo, byWo, [flag(w, false)], 'workout'); });
    (cust.workouts || []).forEach(function (w) { if (w && w.id && Array.isArray(w.exercises)) merge(wo, byWo, [flag(w, true)], 'workout'); });
    sys.pl.forEach(function (p) { merge(pl, byPl, [flag(p, false)], 'plan'); });
    (cust.plans || []).forEach(function (p) { if (p && p.id && Array.isArray(p.days)) merge(pl, byPl, [flag(p, true)], 'plan'); });
    C.exercises = ex.map(function (e) { var r = runtimeExercise(e); byEx[e.id] = r; return r; });
    C.workouts = wo;
    C.plans = pl.map(function (p) {
      var days = (p.days || []).slice().sort(function (a, b) { return a.day - b.day; }).map(normalizeDay);
      var r = {}; for (var k in p) r[k] = p[k]; r.days = days; byPl[p.id] = r; return r;
    }).filter(function (p) { return p.days.length; });
  }

  C.load = function () {
    return fetchJson('data/index.json').then(function (idx) {
      return Promise.all((idx.files || []).map(function (f) { return fetchJson('data/' + f); })).then(function (packs) {
        sys = { ex: [], wo: [], pl: [] };
        packs.forEach(function (p) { sys.ex = sys.ex.concat(p.exercises || []); sys.wo = sys.wo.concat(p.workouts || []); sys.pl = sys.pl.concat(p.plans || []); });
        rebuild();
        C.defaultPlanId = (byPl[idx.defaultPlanId] && !byPl[idx.defaultPlanId].custom) ? idx.defaultPlanId : (C.plans.filter(function (p) { return !p.custom; })[0] || {}).id;
        if (!C.defaultPlanId) throw new Error('no training plans found in data/');
      });
    });
  };
  /* the user's own exercises / workouts / plans (from the saved app state) */
  C.setCustom = function (c) {
    c = c || {};
    cust = { exercises: c.exercises || [], workouts: c.workouts || [], plans: c.plans || [] };
    if (sys.pl.length) rebuild();
  };

  C.exercise = function (id) { return byEx[id]; };
  C.workout = function (id) { return byWo[id]; };
  C.plan = function (id) { return byPl[id]; };
  C.muscleNames = function (ex, withSecondary) {
    var l = (ex.primaryMuscles || []).concat(withSecondary ? (ex.secondaryMuscles || []) : []);
    return l.map(function (m) { return NAME[m] || m; });
  };
  C.zonesOf = function (ex) {
    if (ex.bodyRegion === 'full_body') return ['legs', 'torso', 'arms'];
    var ms = (ex.primaryMuscles || []).concat(ex.secondaryMuscles || []), z = [];
    Object.keys(ZONE).forEach(function (k) { if (ms.some(function (m) { return ZONE[k].indexOf(m) >= 0; })) z.push(k); });
    return z;
  };
  /* "each side" for right/left, "each way" for forward/backward */
  C.leftRight = function (ex) { return !!ex.sides && ex.sides.indexOf('left') >= 0; };
  /* Switchable teaching angles (empty = single fixed view). */
  C.viewIds = function (ex) { return (ex && ex.anim && ex.anim._views) ? ex.anim._views.slice() : []; };
  C.viewLabel = function (id) {
    if (VIEW_LABEL[id]) return VIEW_LABEL[id];
    if (!id) return '';
    return id.charAt(0).toUpperCase() + id.slice(1);
  };
  C.animForView = function (ex, viewId) { return ex ? animFor(ex, viewId) : null; };

  root.Catalog = C;
})(window);
