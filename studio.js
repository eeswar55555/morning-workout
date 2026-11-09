/* studio.js — Workout Studio: create, edit, duplicate, delete and preview your own exercises, workouts and plans.
 *
 * Everything the user makes is saved in the app state (Core.saveCustom) in exactly the shape of the content schema
 * (data/schema/types.ts), kept apart from the built-in packs: built-in items are read-only, "Customize" / "Duplicate"
 * makes an editable copy. The user never sees JSON: only forms, pickers, steppers, drag-to-reorder and a plan timeline.
 *
 * Screens:  Workouts | Plans | Exercises   (tabs of the Studio screen)
 * Editors:  full-screen overlays for a workout and a plan (with unsaved-changes protection), sheets for everything else.
 */
(function (root) {
  'use strict';
  var C = root.Core, K = root.Catalog;
  function ui() { return root.AppUI; }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return ui().esc(s); }
  function ico(n, c) { return ui().ico(n, c); }
  function toast(m) { ui().toast(m); }
  function sheet(h, o) { return ui().sheet(h, o); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function trim(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  var REGIONS = [['all', 'All'], ['upper_body', 'Upper body'], ['lower_body', 'Lower body'], ['core', 'Core'], ['full_body', 'Full body'], ['neck', 'Neck'], ['face', 'Face']];
  var LEVELS = [['all', 'Any level'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
  var BODY_MUSCLES = ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'back', 'lower_back', 'core', 'glutes', 'quadriceps', 'hamstrings', 'calves', 'hip_flexors'];
  var FACE_MUSCLES = ['neck', 'jaw', 'cheeks', 'lips', 'forehead', 'eyes'];
  var TYPES = [['reps', 'Reps', 'Counted, like push-ups'], ['time', 'Timed', 'Keep moving, like jumping jacks'], ['hold', 'Hold', 'Stay still, like a plank']];
  var LIMITS = { repetitions: [1, 200, 1], durationSeconds: [5, 900, 5], sets: [1, 10, 1] };

  var tab = 'workouts', Q = { workouts: '', plans: '', exercises: '' }, XF = { region: 'all', level: 'all', mine: false, off: false };
  var uidn = 0;
  function uid() { return 'k' + (++uidn); }

  /* ====================== small building blocks ====================== */
  function searchbar(ph) { return '<div class="searchbar">' + ico('search') + '<input id="sq" type="search" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" autocomplete="off"></div>'; }
  function chipRow(group, items, cur) {
    return '<div class="filters" data-g="' + group + '" role="group">' + items.map(function (i) { return '<button type="button" class="fchip' + (cur === i[0] ? ' on' : '') + '" data-v="' + i[0] + '" aria-pressed="' + (cur === i[0]) + '">' + esc(i[1]) + '</button>'; }).join('') + '</div>';
  }
  function bindChips(root_, group, onPick) {
    var row = $('[data-g="' + group + '"]', root_); if (!row) return;
    $$('.fchip', row).forEach(function (b) {
      b.onclick = function () { $$('.fchip', row).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); onPick(b.getAttribute('data-v')); };
    });
  }
  function bindSearch(scope, key, itemSel, onApply) {
    var inp = $('#sq', scope); if (!inp) return function () {};
    inp.value = Q[key] || '';
    function apply() {
      Q[key] = inp.value; var q = inp.value.trim().toLowerCase(), shown = 0;
      $$(itemSel, scope).forEach(function (r) { var ok = (!q || r.getAttribute('data-name').indexOf(q) >= 0) && (!onApply || onApply(r)); r.hidden = !ok; if (ok) shown++; });
      var n = $('#none', scope); if (n) n.hidden = shown > 0;
    }
    inp.oninput = apply; apply();
    return apply;
  }
  function confirmSheet(o) {
    var sh = sheet('<h2>' + esc(o.title) + '</h2><p class="muted">' + esc(o.text) + '</p><div class="rowbtns"><button class="ghost" data-close>' + esc(o.cancel || 'Cancel') + '</button><button class="btn small' + (o.danger ? ' dng' : '') + '" id="cfOk">' + esc(o.ok) + '</button></div>');
    $('#cfOk', sh.root).onclick = function () { sh.close(); o.onOk(); };
    return sh;
  }
  function notice(title, text) { sheet('<h2>' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p><div class="rowbtns"><button class="btn small" data-close>OK</button></div>'); }
  function actionSheet(title, rows, onPick) {
    var sh = sheet('<h2>' + esc(title) + '</h2><div class="acts">' + rows.map(function (r) { return '<button class="arow' + (r[3] ? ' danger' : '') + '" data-a="' + r[0] + '">' + ico(r[1]) + '<span>' + esc(r[2]) + '</span></button>'; }).join('') + '</div>');
    $$('[data-a]', sh.root).forEach(function (b) { b.onclick = function () { sh.close(); onPick(b.getAttribute('data-a')); }; });
  }
  function stepper(field, val, unit) {
    return '<div class="stp" data-f="' + field + '"><button type="button" data-d="-1" aria-label="Less ' + esc(unit) + '">' + ico('minus') + '</button><input type="number" inputmode="numeric" value="' + val + '" aria-label="' + esc(unit) + '"><span>' + esc(unit) + '</span><button type="button" data-d="1" aria-label="More ' + esc(unit) + '">' + ico('plus') + '</button></div>';
  }
  function clamp(f, n) { var L = LIMITS[f]; return Math.max(L[0], Math.min(L[1], n)); }

  /* full-screen editor overlay */
  function overlay(title) {
    var el = document.createElement('div');
    el.className = 'editor'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
    el.innerHTML = '<div class="ed-top"><button class="ic" type="button" data-x aria-label="Close editor">' + ico('close') + '</button><h2>' + esc(title) + '</h2></div><div class="ed-body"></div><div class="ed-foot"></div>';
    document.body.appendChild(el); document.body.classList.add('editing');
    ui().pushBack();
    var api = { el: el, body: $('.ed-body', el), foot: $('.ed-foot', el), onCancel: null, close: function () { el.remove(); document.body.classList.remove('editing'); } };
    $('[data-x]', el).onclick = function () { api.onCancel ? api.onCancel() : api.close(); };
    return api;
  }
  function guardClose(ov, isDirty) {
    ov.onCancel = function () {
      if (!isDirty()) { ov.close(); return; }
      confirmSheet({ title: 'Discard your changes?', text: 'What you changed has not been saved.', ok: 'Discard', cancel: 'Keep editing', danger: true, onOk: ov.close });
    };
  }

  /* drag-and-drop ordering: grab the handle (mouse or finger), drop where you want it. Arrow keys work on the handle too. */
  function sortable(list, scroller, onMove) {
    var d = null;
    function update() {
      var dy = d.y - d.y0 + scroller.scrollTop - d.s0, r = d.rects[d.from], center = r.top + r.h / 2 + dy;
      d.to = d.rects.filter(function (q, i) { return i !== d.from && q.top + q.h / 2 < center; }).length;
      var gap = d.rects.length > 1 ? Math.max(0, d.rects[1].top - d.rects[0].top - d.rects[0].h) : 0, shift = r.h + gap;
      d.rows.forEach(function (row, i) {
        if (i === d.from) { row.style.transform = 'translateY(' + dy + 'px)'; return; }
        var s = 0;
        if (d.from < d.to && i > d.from && i <= d.to) s = -shift; else if (d.from > d.to && i >= d.to && i < d.from) s = shift;
        row.style.transform = s ? 'translateY(' + s + 'px)' : '';
      });
    }
    function loop() {
      if (!d) return;
      var b = scroller.getBoundingClientRect();
      if (d.y < b.top + 70) scroller.scrollTop -= 12; else if (d.y > b.bottom - 150) scroller.scrollTop += 12;
      update(); d.raf = requestAnimationFrame(loop);
    }
    function end() {
      if (!d) return;
      cancelAnimationFrame(d.raf);
      d.rows.forEach(function (r) { r.style.transform = ''; r.classList.remove('dragging'); });
      list.classList.remove('sorting');
      var from = d.from, to = d.to; d = null;
      if (from !== to) onMove(from, to);
    }
    list.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.grip'); if (!g || d || (e.button && e.button !== 0)) return;
      var rows = $$('.erow', list), row = g.closest('.erow'); if (rows.length < 2) return;
      e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (x) {}
      var from = rows.indexOf(row);
      d = { rows: rows, from: from, to: from, y0: e.clientY, y: e.clientY, s0: scroller.scrollTop, raf: 0, rects: rows.map(function (r) { return { top: r.offsetTop, h: r.offsetHeight }; }) };
      row.classList.add('dragging'); list.classList.add('sorting'); loop();
    });
    list.addEventListener('pointermove', function (e) { if (d) d.y = e.clientY; });
    list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end); list.addEventListener('lostpointercapture', end);
    list.addEventListener('keydown', function (e) {
      var g = e.target.closest && e.target.closest('.grip'); if (!g || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      var rows = $$('.erow', list), i = rows.indexOf(g.closest('.erow')), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (j >= 0 && j < rows.length) { onMove(i, j); var ng = $$('.erow .grip', list)[j]; if (ng) ng.focus(); }
    });
  }

  /* ====================== the Studio screen ====================== */
  function render(v) {
    v.innerHTML = '<header class="top"><div><h1>Workout Studio</h1><div class="muted">Build your own workouts and plans</div></div></header>' +
      '<div class="tabs" role="tablist" aria-label="Studio sections">' + [['workouts', 'Workouts'], ['plans', 'Plans'], ['exercises', 'Exercises']].map(function (t) {
        return '<button role="tab" class="tab' + (tab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div><div id="pane"></div>';
    $$('.tab', v).forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); render(v); v.scrollTop = 0; ui().thumbs(v); }; });
    ({ workouts: workoutsPane, plans: plansPane, exercises: exercisesPane })[tab]($('#pane', v));
  }

  /* ---------- workouts ---------- */
  function minutesOf(w) { return Math.max(1, Math.round(C.estimateMinutes(w))); }
  function wMeta(w) {
    var n = w.exercises.length;
    return plural(n, 'exercise') + ' · ~' + minutesOf(w) + ' min' + (w.rounds > 1 ? ' · ' + w.rounds + ' rounds' : '') + (w.difficulty ? ' · ' + cap(w.difficulty) : '');
  }
  function wCard(w) {
    return '<div class="scard" data-name="' + esc((w.name + ' ' + (w.category || '') + ' ' + (w.tags || []).join(' ')).replace(/_/g, ' ').toLowerCase()) + '"><button class="smain" data-prev="' + esc(w.id) + '"><span class="nm">' + esc(w.name) + '</span><span class="muted small">' + esc(wMeta(w)) + '</span></button>' +
      '<button class="ic" data-more="' + esc(w.id) + '" aria-label="More actions for ' + esc(w.name) + '">' + ico('dots') + '</button></div>';
  }
  function workoutsPane(p) {
    var mine = K.workouts.filter(function (w) { return w.custom; }), built = K.workouts.filter(function (w) { return !w.custom; });
    p.innerHTML = '<button class="btn" id="newW">' + ico('plus') + 'New workout</button>' + searchbar('Search workouts') +
      '<h3 class="sh">Your workouts <span class="muted">' + mine.length + '</span></h3>' +
      (mine.length ? mine.map(wCard).join('') : '<div class="card empty-card"><b>No workouts of your own yet</b><p class="muted small">Tap “New workout” to build one in under a minute, or open ⋯ on a built-in workout and choose Customize.</p></div>') +
      '<h3 class="sh">Built-in workouts <span class="muted">' + built.length + '</span></h3>' + built.map(wCard).join('') +
      '<p class="empty muted" id="none" hidden>No workouts match.</p>';
    bindSearch(p, 'workouts', '.scard');
    $('#newW', p).onclick = function () { newFlow('workout'); };
    $$('[data-prev]', p).forEach(function (b) { b.onclick = function () { previewWorkout(b.getAttribute('data-prev')); }; });
    $$('[data-more]', p).forEach(function (b) { b.onclick = function () { workoutActions(b.getAttribute('data-more')); }; });
  }
  function workoutActions(id) {
    var w = K.workout(id); if (!w) return;
    var rows = [['prev', 'eye', 'Preview'], ['start', 'play', 'Start now'], [w.custom ? 'edit' : 'copyedit', 'edit', w.custom ? 'Edit' : 'Customize (your own copy)'], ['dup', 'copy', 'Duplicate']];
    if (w.custom) rows.push(['del', 'trash', 'Delete', true]);
    actionSheet(w.name, rows, function (a) { workoutDo(a, id); });
  }
  function workoutDo(a, id) {
    var w = K.workout(id); if (!w) return;
    if (a === 'prev') previewWorkout(id);
    else if (a === 'start') startNow(id);
    else if (a === 'edit') openWorkoutEditor(draftFromWorkout(w, false));
    else if (a === 'copyedit' || a === 'dup') openWorkoutEditor(draftFromWorkout(w, true));
    else if (a === 'del') deleteWorkout(id);
  }
  function startNow(id) {
    var s = C.sessionFor([id]);
    if (!s.blocks.length) { toast('Nothing to do: all its exercises are switched off.'); return; }
    ui().startWorkout(s);
  }
  function previewWorkout(id) {
    var w = K.workout(id); if (!w) return;
    var rows = w.exercises.map(function (en, i) {
      var ex = K.exercise(en.exerciseId); if (!ex) return '';
      return '<div class="item pvr">' + ui().thumbHtml(ex.id) + '<div class="meta" data-info="' + esc(ex.id) + '" role="button" tabindex="0"><div class="nm">' + (i + 1) + '. ' + esc(ex.name) + '</div><div class="muted small">' + esc(C.doseText(ex, en)) + (en.note ? ' · ' + esc(en.note) : '') + '</div></div></div>';
    }).join('');
    var sh = sheet('<h2>' + esc(w.name) + '</h2>' + (w.description ? '<p class="muted small">' + esc(w.description) + '</p>' : '') +
      '<div class="mchips"><span class="chip">' + plural(w.exercises.length, 'exercise') + '</span><span class="chip">~' + minutesOf(w) + ' min</span>' + (w.rounds > 1 ? '<span class="chip">' + w.rounds + ' rounds</span>' : '') + (w.custom ? '<span class="chip">Yours</span>' : '<span class="chip">Built-in</span>') + '</div>' +
      '<div class="pvlist">' + rows + '</div>' +
      '<div class="rowbtns"><button class="btn" id="pvStart">' + ico('play') + 'Start now</button></div>' +
      '<div class="rowbtns"><button class="ghost" id="pvEdit">' + ico('edit') + (w.custom ? 'Edit' : 'Customize') + '</button><button class="ghost" id="pvDup">' + ico('copy') + 'Duplicate</button></div>', { tall: true });
    $$('[data-info]', sh.root).forEach(function (m) { m.onclick = function () { ui().openDetail(m.getAttribute('data-info')); }; });
    $('#pvStart', sh.root).onclick = function () { sh.close(); startNow(id); };
    $('#pvEdit', sh.root).onclick = function () { sh.close(); workoutDo(w.custom ? 'edit' : 'copyedit', id); };
    $('#pvDup', sh.root).onclick = function () { sh.close(); workoutDo('dup', id); };
  }
  function deleteWorkout(id) {
    var w = K.workout(id), used = C.plansUsing(id).filter(function (p) { return p.custom; });
    confirmSheet({
      title: 'Delete “' + w.name + '”?',
      text: used.length ? 'It is used in ' + used.map(function (p) { return '“' + p.name + '”'; }).join(', ') + '. Those days will become rest days. This can’t be undone.' : 'This can’t be undone.',
      ok: 'Delete', danger: true, onOk: function () { C.deleteCustom('workouts', id); toast('Workout deleted'); ui().refresh(); }
    });
  }

  /* "New ..." : start from scratch or from a template (any existing workout / plan) */
  function newFlow(kind) {
    var list = kind === 'workout' ? K.workouts : K.plans, label = kind === 'workout' ? 'workout' : 'plan';
    var rows = list.map(function (x) {
      var meta = kind === 'workout' ? wMeta(x) : pMeta(x);
      return '<button class="smain tpl" data-id="' + esc(x.id) + '" data-name="' + esc(x.name.toLowerCase()) + '"><span class="nm">' + esc(x.name) + (x.custom ? ' <span class="chip tiny">Yours</span>' : '') + '</span><span class="muted small">' + esc(meta) + '</span></button>';
    }).join('');
    var sh = sheet('<h2>New ' + label + '</h2><button class="btn" id="nfBlank">' + ico('plus') + 'Start from scratch</button>' +
      '<h3>Or start from a template</h3><p class="muted small">You get your own copy to change; the original stays as it is.</p>' + searchbar('Search templates') + '<div id="tplist">' + rows + '</div><p class="empty muted" id="none" hidden>Nothing matches.</p>', { tall: true });
    Q.tpl = ''; bindSearch(sh.root, 'tpl', '.tpl');
    $('#nfBlank', sh.root).onclick = function () { sh.close(); kind === 'workout' ? openWorkoutEditor(blankWorkout()) : openPlanEditor(blankPlan()); };
    $$('.tpl', sh.root).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-id'); sh.close();
        if (kind === 'workout') openWorkoutEditor(draftFromWorkout(K.workout(id), true)); else openPlanEditor(draftFromPlan(K.plan(id), true));
      };
    });
  }

  /* ====================== exercise picker (used by the workout builder) ====================== */
  var DIFF_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };
  function pickExercises(onDone) {
    var sel = [], f = { q: '', region: 'all', level: 'all' };
    var sh = sheet('<h2>Add exercises</h2>' + searchbar('Search exercises') + chipRow('region', REGIONS, 'all') + chipRow('level', LEVELS, 'all') +
      '<button class="link" id="pkNew">' + ico('plus', 'sm') + 'Create a new exercise</button><div id="pkList"></div><p class="empty muted" id="none" hidden>No exercises match. Try another filter.</p>' +
      '<div class="pk-foot"><button class="btn" id="pkOk" disabled>Choose exercises</button></div>', { tall: true });
    var root_ = sh.root;
    function row(ex) {
      return '<div class="item lib pk" data-id="' + esc(ex.id) + '" data-region="' + esc(ex.bodyRegion || '') + '" data-level="' + esc(ex.difficulty) + '" data-name="' + esc([ex.name, ex.area, ex.category, (ex.tags || []).join(' '), (ex.equipment || []).join(' ')].join(' ').replace(/_/g, ' ').toLowerCase()) + '">' +
        '<label class="pkl">' + ui().thumbHtml(ex.id) + '<span class="meta"><span class="nm">' + esc(ex.name) + (ex.custom ? ' <span class="chip tiny">Yours</span>' : '') + '</span><span class="muted small">' + esc(ex.area) + ' · ' + esc(cap(ex.difficulty)) + '</span></span>' +
        '<input type="checkbox" value="' + esc(ex.id) + '" aria-label="Add ' + esc(ex.name) + '"><span class="tick" aria-hidden="true">' + ico('check') + '</span></label>' +
        '<button type="button" class="ic sm" data-info="' + esc(ex.id) + '" aria-label="About ' + esc(ex.name) + '">' + ico('info') + '</button></div>';
    }
    function draw() {
      $('#pkList', root_).innerHTML = K.exercises.map(row).join('');
      $$('#pkList input', root_).forEach(function (c) { c.checked = sel.indexOf(c.value) >= 0; });
      ui().thumbs(root_); filter();
    }
    function filter() {
      var q = f.q.trim().toLowerCase(), shown = 0;
      $$('#pkList .pk', root_).forEach(function (r) {
        var ok = (!q || r.getAttribute('data-name').indexOf(q) >= 0) && (f.region === 'all' || r.getAttribute('data-region') === f.region) && (f.level === 'all' || r.getAttribute('data-level') === f.level);
        r.hidden = !ok; if (ok) shown++;
      });
      $('#none', root_).hidden = shown > 0;
    }
    function count() { var b = $('#pkOk', root_); b.disabled = !sel.length; b.textContent = sel.length ? 'Add ' + plural(sel.length, 'exercise') : 'Choose exercises'; }
    $('#sq', root_).oninput = function () { f.q = this.value; filter(); };
    bindChips(root_, 'region', function (v) { f.region = v; filter(); });
    bindChips(root_, 'level', function (v) { f.level = v; filter(); });
    root_.addEventListener('change', function (e) {
      var c = e.target; if (c.type !== 'checkbox') return;
      var i = sel.indexOf(c.value); if (c.checked && i < 0) sel.push(c.value); else if (!c.checked && i >= 0) sel.splice(i, 1); count();
    });
    root_.addEventListener('click', function (e) { var b = e.target.closest('[data-info]'); if (b) ui().openDetail(b.getAttribute('data-info')); });
    $('#pkNew', root_).onclick = function () { openExerciseForm(null, function (ex) { sel.push(ex.id); draw(); count(); }); };
    $('#pkOk', root_).onclick = function () { sh.close(); onDone(sel.slice()); };
    draw(); count();
  }

  /* pick workouts (for plan days and auto-fill) */
  function pickWorkouts(opts) {
    var sel = [];
    var rows = K.workouts.slice().sort(function (a, b) { return (b.custom ? 1 : 0) - (a.custom ? 1 : 0); }).map(function (w) {
      return '<div class="item lib pk" data-name="' + esc(w.name.toLowerCase()) + '"><label class="pkl"><span class="meta"><span class="nm">' + esc(w.name) + (w.custom ? ' <span class="chip tiny">Yours</span>' : '') + '</span><span class="muted small">' + esc(wMeta(w)) + '</span></span>' +
        '<input type="checkbox" value="' + esc(w.id) + '" aria-label="Choose ' + esc(w.name) + '"><span class="tick" aria-hidden="true">' + ico('check') + '</span></label></div>';
    }).join('');
    var sh = sheet('<h2>' + esc(opts.title) + '</h2>' + (opts.hint ? '<p class="muted small">' + esc(opts.hint) + '</p>' : '') + searchbar('Search workouts') + '<div id="pwList">' + rows + '</div><p class="empty muted" id="none" hidden>No workouts match.</p>' +
      '<div class="pk-foot"><button class="btn" id="pwOk" disabled>' + esc(opts.cta) + '</button></div>', { tall: true });
    function count() { var b = $('#pwOk', sh.root); b.disabled = !sel.length; b.textContent = sel.length ? opts.ctaN(sel.length) : opts.cta; }
    Q.pw = ''; bindSearch(sh.root, 'pw', '.pk');
    sh.root.addEventListener('change', function (e) { var c = e.target; if (c.type !== 'checkbox') return; var i = sel.indexOf(c.value); if (c.checked && i < 0) sel.push(c.value); else if (!c.checked && i >= 0) sel.splice(i, 1); count(); });
    $('#pwOk', sh.root).onclick = function () { sh.close(); opts.onDone(sel.slice()); };
  }

  /* ====================== workout builder ====================== */
  function blankWorkout() { return { id: null, name: '', description: '', rounds: 1, restSeconds: 15, entries: [], keep: {} }; }
  function draftFromWorkout(w, asCopy) {
    return {
      id: asCopy ? null : w.id, name: asCopy ? w.name + ' copy' : w.name, description: w.description || '', rounds: w.rounds || 1,
      restSeconds: w.restSeconds != null ? w.restSeconds : 15,
      entries: w.exercises.filter(function (en) { return K.exercise(en.exerciseId); }).map(function (en) {
        return { k: uid(), exerciseId: en.exerciseId, repetitions: en.repetitions, durationSeconds: en.durationSeconds, sets: en.sets || 1, restSeconds: en.restSeconds, note: en.note };
      }),
      keep: { category: w.category, difficulty: w.difficulty, tags: w.tags }
    };
  }
  function newEntry(ex) {
    var en = { k: uid(), exerciseId: ex.id, sets: 1 };
    if (ex.type === 'reps') en.repetitions = 10; else en.durationSeconds = 30;
    return en;
  }
  function workoutFromDraft(d) {
    var w = { name: trim(d.name), exercises: d.entries.map(function (e) {
      var o = { exerciseId: e.exerciseId };
      if (e.repetitions != null) o.repetitions = e.repetitions;
      if (e.durationSeconds != null) o.durationSeconds = e.durationSeconds;
      if (e.sets > 1) o.sets = e.sets;
      if (e.restSeconds != null) o.restSeconds = e.restSeconds;
      if (e.note) o.note = e.note;
      return o;
    }) };
    if (d.id) w.id = d.id;
    if (trim(d.description)) w.description = trim(d.description);
    if (d.rounds > 1) w.rounds = d.rounds;
    w.restSeconds = d.restSeconds;
    if (d.keep.difficulty) w.difficulty = d.keep.difficulty;
    if (d.keep.category) w.category = d.keep.category;
    if (d.keep.tags) w.tags = d.keep.tags;
    return w;
  }
  function snapW(d) { return JSON.stringify([trim(d.name), trim(d.description), d.rounds, d.restSeconds, d.entries.map(function (e) { return [e.exerciseId, e.repetitions, e.durationSeconds, e.sets]; })]); }

  function openWorkoutEditor(d) {
    var ov = overlay(d.id ? 'Edit workout' : 'New workout'), initial = snapW(d);
    guardClose(ov, function () { return snapW(d) !== initial; });
    ov.body.innerHTML =
      '<label class="field">Workout name<input id="wName" maxlength="60" placeholder="e.g. Upper Body Beginner" autocomplete="off" value="' + esc(d.name) + '"></label>' +
      '<div class="err" id="wErr" role="alert" hidden></div>' +
      '<div class="shead"><h3>Exercises</h3><span class="muted small" id="wCount"></span></div>' +
      '<div class="elist" id="wList"></div>' +
      '<button class="addbtn" id="wAdd" type="button">' + ico('plus') + 'Add exercises</button>' +
      '<details class="opts"' + (d.rounds > 1 ? ' open' : '') + '><summary>More options</summary>' +
      '<div class="orow"><div><b>Rounds</b><div class="muted small">Repeat the whole list, like a circuit</div></div>' + stepper('rounds', d.rounds, 'rounds') + '</div>' +
      '<div class="orow"><div><b>Rest</b><div class="muted small">Between sets and exercises</div></div>' + stepper('restSeconds', d.restSeconds, 'sec') + '</div>' +
      '<label class="field">Description (optional)<input id="wDesc" maxlength="140" value="' + esc(d.description) + '"></label></details>';
    ov.foot.innerHTML = '<div class="ed-sum"><b id="wSum"></b></div><button class="btn small" id="wSave" type="button">Save workout</button>';
    var list = $('#wList', ov.el), nameEl = $('#wName', ov.el), errEl = $('#wErr', ov.el);

    function find(k) { for (var i = 0; i < d.entries.length; i++) if (d.entries[i].k === k) return i; return -1; }
    function sum() {
      var n = d.entries.length;
      $('#wCount', ov.el).textContent = n ? plural(n, 'exercise') : '';
      $('#wSum', ov.el).textContent = n ? plural(n, 'exercise') + ' · ~' + Math.max(1, Math.round(C.estimateMinutes(workoutFromDraft(d)))) + ' min' : 'No exercises yet';
    }
    function rowHtml(en) {
      var ex = K.exercise(en.exerciseId), reps = ex.type === 'reps', per = ex.sides ? ' / side' : '';
      return '<div class="erow" data-k="' + en.k + '"><div class="erow-top"><button type="button" class="grip" aria-label="Reorder ' + esc(ex.name) + '. Drag, or use the up and down arrow keys">' + ico('grip') + '</button>' + ui().thumbHtml(ex.id) +
        '<div class="en"><div class="nm">' + esc(ex.name) + '</div><div class="muted small">' + esc(ex.area) + '</div></div>' +
        '<button type="button" class="ic sm" data-dup aria-label="Duplicate ' + esc(ex.name) + '">' + ico('copy') + '</button><button type="button" class="ic sm danger" data-del aria-label="Remove ' + esc(ex.name) + '">' + ico('trash') + '</button></div>' +
        '<div class="erow-ctl">' + (reps ? stepper('repetitions', en.repetitions, 'reps' + per) : stepper('durationSeconds', en.durationSeconds, 'sec' + per)) + stepper('sets', en.sets || 1, (en.sets || 1) === 1 ? 'set' : 'sets') + '</div></div>';
    }
    function draw() {
      if (!d.entries.length) list.innerHTML = '<div class="empty-card"><b>Add your first exercise</b><p class="muted small">Pick from ' + K.exercises.length + ' exercises, or create your own.</p></div>';
      else list.innerHTML = d.entries.map(rowHtml).join('');
      ui().thumbs(list); sum(); errEl.hidden = true;
    }
    sortable(list, ov.body, function (from, to) { var x = d.entries.splice(from, 1)[0]; d.entries.splice(to, 0, x); draw(); });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var row = b.closest('.erow'); if (!row) return;
      var i = find(row.getAttribute('data-k')); if (i < 0) return;
      if (b.hasAttribute('data-d')) { var s = b.closest('.stp'); setField(i, s, +b.getAttribute('data-d')); }
      else if (b.hasAttribute('data-dup')) { var c = {}; for (var k in d.entries[i]) c[k] = d.entries[i][k]; c.k = uid(); d.entries.splice(i + 1, 0, c); draw(); }
      else if (b.hasAttribute('data-del')) { d.entries.splice(i, 1); draw(); }
    });
    function setField(i, stp, delta, abs) {
      var f = stp.getAttribute('data-f'), en = d.entries[i], cur = en[f] != null ? en[f] : 1;
      var n = clamp(f, abs != null ? abs : cur + delta * LIMITS[f][2]);
      en[f] = n; var inp = $('input', stp); inp.value = n;
      if (f === 'sets') { var u = $('span', stp); u.textContent = n === 1 ? 'set' : 'sets'; }
      sum();
    }
    list.addEventListener('change', function (e) {
      var inp = e.target.closest('.stp input'); if (!inp) return;
      var row = inp.closest('.erow'), i = find(row.getAttribute('data-k')), n = parseInt(inp.value, 10);
      if (i < 0) return;
      setField(i, inp.closest('.stp'), 0, isNaN(n) ? (LIMITS[inp.closest('.stp').getAttribute('data-f')][0]) : n);
    });
    nameEl.oninput = function () { d.name = this.value; this.classList.remove('bad'); errEl.hidden = true; };
    $('#wDesc', ov.el).oninput = function () { d.description = this.value; };
    $$('.opts .stp', ov.el).forEach(function (stp) {
      var f = stp.getAttribute('data-f'), lim = f === 'rounds' ? [1, 10, 1] : [0, 300, 5];
      function set(n) { n = Math.max(lim[0], Math.min(lim[1], n)); d[f] = n; $('input', stp).value = n; sum(); }
      $$('button', stp).forEach(function (b) { b.onclick = function () { set(d[f] + (+b.getAttribute('data-d')) * lim[2]); }; });
      $('input', stp).onchange = function () { var n = parseInt(this.value, 10); set(isNaN(n) ? lim[0] : n); };
    });
    $('#wAdd', ov.el).onclick = function () {
      pickExercises(function (ids) {
        ids.forEach(function (id) { var ex = K.exercise(id); if (ex) d.entries.push(newEntry(ex)); });
        draw(); setTimeout(function () { ov.body.scrollTop = ov.body.scrollHeight; }, 0);
      });
    };
    $('#wSave', ov.el).onclick = function () {
      var name = trim(d.name), err = '';
      var clash = C.S.custom.workouts.some(function (w) { return w.id !== d.id && trim(w.name).toLowerCase() === name.toLowerCase(); });
      if (!name) err = 'Give your workout a name.';
      else if (clash) err = 'You already have a workout called “' + name + '”. Pick a different name.';
      else if (!d.entries.length) err = 'Add at least one exercise.';
      if (err) { errEl.textContent = err; errEl.hidden = false; if (!name || clash) { nameEl.classList.add('bad'); nameEl.focus(); } ov.body.scrollTop = 0; return; }
      var saved = C.saveCustom('workouts', workoutFromDraft(d));
      ov.close(); toast('Workout saved'); tab = 'workouts'; ui().refresh();
      return saved;
    };
    draw();
    if (!d.id && !d.name) setTimeout(function () { nameEl.focus(); }, 50);
  }

  /* ====================== exercises: library + create / edit your own ====================== */
  function exercisesPane(p) {
    p.innerHTML = '<button class="btn" id="newE">' + ico('plus') + 'New exercise</button>' + searchbar('Search exercises') +
      chipRow('region', REGIONS, XF.region) + chipRow('level', LEVELS, XF.level) +
      '<div class="filters"><button class="fchip' + (XF.mine ? ' on' : '') + '" id="fMine" aria-pressed="' + XF.mine + '">My exercises</button><button class="fchip' + (XF.off ? ' on' : '') + '" id="fOff" aria-pressed="' + XF.off + '">Switched off</button></div>' +
      '<div class="liblist" id="liblist">' + K.exercises.map(function (ex) {
        var off = !!C.S.disabled[ex.id];
        return '<div class="item lib" data-name="' + esc([ex.name, ex.area, ex.category, (ex.tags || []).join(' '), (ex.equipment || []).join(' ')].join(' ').replace(/_/g, ' ').toLowerCase()) + '" data-region="' + esc(ex.bodyRegion || '') + '" data-level="' + esc(ex.difficulty) + '" data-mine="' + (ex.custom ? 1 : 0) + '" data-off="' + (off ? 1 : 0) + '">' +
          ui().thumbHtml(ex.id) + '<div class="meta" data-open="' + esc(ex.id) + '" role="button" tabindex="0"><div class="nm">' + esc(ex.name) + (ex.custom ? ' <span class="chip tiny">Yours</span>' : '') + '</div><div class="muted small">' + esc(ex.area) + ' · ' + esc(cap(ex.difficulty)) + '</div></div>' +
          '<label class="switch" title="Use in my workouts"><input type="checkbox" data-en="' + esc(ex.id) + '" aria-label="Use ' + esc(ex.name) + ' in my workouts"' + (off ? '' : ' checked') + '><span></span></label></div>';
      }).join('') + '</div><p class="empty muted" id="none" hidden>No exercises match.</p>' +
      '<p class="muted small">The switch hides an exercise from every workout. Built-in exercises can’t be edited; create your own with “New exercise”.</p>';
    var apply = bindSearch(p, 'exercises', '#liblist .item', function (r) {
      return (XF.region === 'all' || r.getAttribute('data-region') === XF.region) && (XF.level === 'all' || r.getAttribute('data-level') === XF.level) &&
        (!XF.mine || r.getAttribute('data-mine') === '1') && (!XF.off || r.getAttribute('data-off') === '1');
    });
    bindChips(p, 'region', function (v) { XF.region = v; apply(); });
    bindChips(p, 'level', function (v) { XF.level = v; apply(); });
    $('#fMine', p).onclick = function () { XF.mine = !XF.mine; this.classList.toggle('on', XF.mine); this.setAttribute('aria-pressed', XF.mine); apply(); };
    $('#fOff', p).onclick = function () { XF.off = !XF.off; this.classList.toggle('on', XF.off); this.setAttribute('aria-pressed', XF.off); apply(); };
    $('#newE', p).onclick = function () { openExerciseForm(null, function () { ui().refresh(); }); };
    $$('[data-open]', p).forEach(function (m) {
      m.onclick = function () { ui().openDetail(m.getAttribute('data-open')); };
      m.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui().openDetail(m.getAttribute('data-open')); } };
    });
    $$('[data-en]', p).forEach(function (c) {
      c.onchange = function () {
        var id = c.getAttribute('data-en'); if (c.checked) delete C.S.disabled[id]; else C.S.disabled[id] = 1;
        c.closest('.item').setAttribute('data-off', c.checked ? 0 : 1); C.save(); apply();
      };
    });
  }

  function editExercise(id) { var ex = K.exercise(id); if (ex && ex.custom) openExerciseForm(ex, function () { ui().refresh(); }); }
  function deleteExercise(id) {
    var ex = K.exercise(id), used = C.workoutsUsing(id);
    if (used.length) { notice('Can’t delete yet', '“' + ex.name + '” is used in ' + used.map(function (w) { return '“' + w.name + '”'; }).join(', ') + '. Remove it from there first.'); return; }
    confirmSheet({ title: 'Delete “' + ex.name + '”?', text: 'This can’t be undone.', ok: 'Delete', danger: true, onOk: function () { C.deleteCustom('exercises', id); toast('Exercise deleted'); ui().refresh(); } });
  }

  function openExerciseForm(ex, onSaved) {
    var used = ex ? C.workoutsUsing(ex.id).length : 0;
    var st = { type: ex ? ex.type : 'reps', muscles: ex ? (ex.primaryMuscles || []).slice() : [] };
    var looks = K.exercises.filter(function (e) { return !e.custom && e.anim && !e.anim.placeholder; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    function chipBtn(m) { return '<button type="button" class="fchip' + (st.muscles.indexOf(m) >= 0 ? ' on' : '') + '" data-m="' + m + '" aria-pressed="' + (st.muscles.indexOf(m) >= 0) + '">' + esc(K.NAME[m] || m) + '</button>'; }
    var h = '<h2>' + (ex ? 'Edit exercise' : 'New exercise') + '</h2>' +
      '<label class="field">Name<input id="xName" maxlength="60" placeholder="e.g. Standing quad stretch" autocomplete="off" value="' + esc(ex ? ex.name : '') + '"></label>' +
      '<div class="err" id="xErr" role="alert" hidden></div>' +
      '<div class="field">How is it measured?<div class="seg typeseg" id="xType">' + TYPES.map(function (t) { return '<button type="button" data-v="' + t[0] + '" class="' + (st.type === t[0] ? 'on' : '') + '"' + (used ? ' disabled' : '') + '><b>' + t[1] + '</b><small>' + t[2] + '</small></button>'; }).join('') + '</div>' +
      (used ? '<div class="muted small">The type can’t change while the exercise is used in a workout.</div>' : '') + '</div>' +
      '<div class="field">Muscles worked <span class="muted">(pick at least one)</span><div class="filters" id="xMus">' + BODY_MUSCLES.map(chipBtn).join('') + '</div><div class="filters" id="xMus2">' + FACE_MUSCLES.map(chipBtn).join('') + '</div></div>' +
      '<div class="two"><label class="field">Body area<select id="xRegion">' + REGIONS.slice(1).map(function (r) { return '<option value="' + r[0] + '"' + ((ex ? ex.bodyRegion : 'full_body') === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">Difficulty<select id="xLevel">' + LEVELS.slice(1).map(function (r) { return '<option value="' + r[0] + '"' + ((ex ? ex.difficulty : 'beginner') === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="check"><input type="checkbox" id="xSides"' + (ex && ex.sides ? ' checked' : '') + '> Done on each side (right, then left)</label>' +
      '<label class="field">How to do it <span class="muted">(optional, one step per line; read aloud)</span><textarea id="xSteps" rows="4" placeholder="Stand tall.&#10;Hold your ankle behind you.">' + esc(ex && ex.instructions ? (ex.instructions.steps || []).join('\n') : '') + '</textarea></label>' +
      '<label class="field">Picture <span class="muted">(which existing exercise looks most like it?)</span><select id="xLooks"><option value="">No picture (plain placeholder)</option>' + looks.map(function (e) { return '<option value="' + esc(e.id) + '"' + (ex && ex.looks === e.id ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="rowbtns"><button class="ghost" data-close>Cancel</button><button class="btn small" id="xSave">' + (ex ? 'Save changes' : 'Save exercise') + '</button></div>';
    var sh = sheet(h, { tall: true }), r = sh.root, errEl = $('#xErr', r);
    $$('#xType button', r).forEach(function (b) { b.onclick = function () { if (b.disabled) return; st.type = b.getAttribute('data-v'); $$('#xType button', r).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $$('[data-m]', r).forEach(function (b) {
      b.onclick = function () { var m = b.getAttribute('data-m'), i = st.muscles.indexOf(m); if (i >= 0) st.muscles.splice(i, 1); else st.muscles.push(m); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0); errEl.hidden = true; };
    });
    $('#xSave', r).onclick = function () {
      var name = trim($('#xName', r).value), err = '';
      var clash = K.exercises.some(function (e) { return (!ex || e.id !== ex.id) && trim(e.name).toLowerCase() === name.toLowerCase(); });
      if (!name) err = 'Give the exercise a name.'; else if (clash) err = 'There is already an exercise called “' + name + '”.'; else if (!st.muscles.length) err = 'Pick at least one muscle it works.';
      if (err) { errEl.textContent = err; errEl.hidden = false; return; }
      var steps = $('#xSteps', r).value.split('\n').map(trim).filter(Boolean), o = {
        name: name, description: ex && ex.description && ex.name === name ? ex.description : name, type: st.type, primaryMuscles: st.muscles.slice(),
        difficulty: $('#xLevel', r).value, bodyRegion: $('#xRegion', r).value, tags: ['custom']
      };
      if (ex) o.id = ex.id;
      if ($('#xSides', r).checked) o.sides = ['right', 'left'];
      o.tempoSeconds = st.type === 'reps' ? 4 : 2;
      o.instructions = { steps: steps.length ? steps : [name + '.'] };
      var lk = $('#xLooks', r).value; if (lk) o.looks = lk;
      var saved = C.saveCustom('exercises', o);
      sh.close(); toast(ex ? 'Exercise updated' : 'Exercise created');
      onSaved && onSaved(K.exercise(saved.id));
    };
    if (!ex) setTimeout(function () { $('#xName', r).focus(); }, 50);
  }

  /* ====================== plans ====================== */
  function pMeta(p) {
    var wd = p.days.filter(function (d) { return !d.rest; }).length;
    return plural(p.days.length, 'day') + ' · ' + plural(wd, 'workout') + ' · ' + plural(p.days.length - wd, 'rest day');
  }
  function pCard(p, active) {
    return '<div class="scard" data-name="' + esc((p.name + ' ' + (p.tags || []).join(' ')).replace(/_/g, ' ').toLowerCase()) + '"><button class="smain" data-prev="' + esc(p.id) + '"><span class="nm">' + esc(p.name) + (active ? ' <span class="chip tiny ok">Active · day ' + active.day.day + '</span>' : '') + '</span><span class="muted small">' + esc(pMeta(p)) + '</span></button>' +
      '<button class="ic" data-more="' + esc(p.id) + '" aria-label="More actions for ' + esc(p.name) + '">' + ico('dots') + '</button></div>';
  }
  function plansPane(p) {
    var pos = C.planPosition(C.dateKey()), mine = K.plans.filter(function (x) { return x.custom; }), built = K.plans.filter(function (x) { return !x.custom; });
    var card = function (x) { return pCard(x, x.id === pos.plan.id ? pos : null); };
    p.innerHTML = '<button class="btn" id="newP">' + ico('plus') + 'New plan</button>' + searchbar('Search plans') +
      '<h3 class="sh">Your plans <span class="muted">' + mine.length + '</span></h3>' +
      (mine.length ? mine.map(card).join('') : '<div class="card empty-card"><b>No plans of your own yet</b><p class="muted small">A plan is a day-by-day schedule of workouts and rest days. Create one, or open ⋯ on a built-in plan and choose Customize.</p></div>') +
      '<h3 class="sh">Built-in plans <span class="muted">' + built.length + '</span></h3>' + built.map(card).join('') + '<p class="empty muted" id="none" hidden>No plans match.</p>';
    bindSearch(p, 'plans', '.scard');
    $('#newP', p).onclick = function () { newFlow('plan'); };
    $$('[data-prev]', p).forEach(function (b) { b.onclick = function () { previewPlan(b.getAttribute('data-prev')); }; });
    $$('[data-more]', p).forEach(function (b) { b.onclick = function () { planActions(b.getAttribute('data-more')); }; });
  }
  function planActions(id) {
    var p = K.plan(id); if (!p) return;
    var rows = [['prev', 'eye', 'Preview'], ['use', 'play', 'Use this plan'], [p.custom ? 'edit' : 'copyedit', 'edit', p.custom ? 'Edit' : 'Customize (your own copy)'], ['dup', 'copy', 'Duplicate']];
    if (p.custom) rows.push(['del', 'trash', 'Delete', true]);
    actionSheet(p.name, rows, function (a) { planDo(a, id); });
  }
  function planDo(a, id) {
    var p = K.plan(id); if (!p) return;
    if (a === 'prev') previewPlan(id);
    else if (a === 'use') usePlan(id);
    else if (a === 'edit') openPlanEditor(draftFromPlan(p, false));
    else if (a === 'copyedit' || a === 'dup') openPlanEditor(draftFromPlan(p, true));
    else if (a === 'del') deletePlan(id);
  }
  function usePlan(id) {
    var p = K.plan(id), cur = C.planPosition(C.dateKey());
    function go() { C.setPlan(id); toast('Plan started. Today is day 1.'); ui().go('today'); }
    if (cur.plan.id === id) { toast('This plan is already active.'); return; }
    confirmSheet({ title: 'Start “' + p.name + '”?', text: 'Today becomes day 1 of this plan. Your history and streak are kept.', ok: 'Start plan', cancel: 'Not now', onOk: go });
  }
  function deletePlan(id) {
    var p = K.plan(id), active = C.planPosition(C.dateKey()).plan.id === id;
    confirmSheet({ title: 'Delete “' + p.name + '”?', text: active ? 'It is your active plan, so you will go back to the default plan. This can’t be undone.' : 'This can’t be undone.', ok: 'Delete', danger: true,
      onOk: function () { C.deleteCustom('plans', id); toast('Plan deleted'); ui().refresh(); } });
  }

  /* the plan as a week-by-week timeline (read-only in previews, tappable in the editor) */
  function timeline(days, o) {
    o = o || {};
    var h = '', weeks = Math.ceil(days.length / 7);
    for (var w = 0; w < weeks; w++) {
      var chunk = days.slice(w * 7, w * 7 + 7), wd = chunk.filter(function (d) { return !d.rest; }).length;
      h += '<section class="wk"><div class="wk-h"><b>Week ' + (w + 1) + '</b><span class="muted small">' + plural(wd, 'workout') + ' · ' + (chunk.length - wd) + ' rest</span>' +
        (o.editable ? '<button type="button" class="ic sm" data-wk="' + w + '" aria-label="Week ' + (w + 1) + ' options">' + ico('dots') + '</button>' : '') + '</div>';
      chunk.forEach(function (d, k) {
        var i = w * 7 + k, names = d.workoutIds.map(function (id) { var x = K.workout(id); return x ? x.name : 'Missing workout'; }).join(' + ');
        var mins = d.workoutIds.reduce(function (a, id) { var x = K.workout(id); return a + (x ? minutesOf(x) : 0); }, 0);
        var inner = '<span class="dn">Day ' + (i + 1) + '</span><span class="dw">' + (d.rest ? '<span class="rest">' + ico('moon', 'sm') + 'Rest day</span>' : '<b>' + esc(names) + '</b><small class="muted">~' + mins + ' min' + (d.note ? ' · ' + esc(d.note) : '') + '</small>') + '</span>' + (o.editable ? ico('chev', 'chev r') : '');
        var cls = 'drow' + (d.rest ? ' isrest' : '') + (o.current === i + 1 ? ' cur' : '');
        h += o.editable ? '<button type="button" class="' + cls + '" data-day="' + i + '">' + inner + '</button>' : '<div class="' + cls + '">' + inner + (o.current === i + 1 ? '<span class="chip tiny ok">You are here</span>' : '') + '</div>';
      });
      h += '</section>';
    }
    return h;
  }
  function previewPlan(id) {
    var p = K.plan(id); if (!p) return;
    var pos = C.planPosition(C.dateKey()), active = pos.plan.id === id;
    var sh = sheet('<h2>' + esc(p.name) + '</h2>' + (p.description ? '<p class="muted small">' + esc(p.description) + '</p>' : '') +
      '<div class="mchips"><span class="chip">' + esc(pMeta(p)) + '</span>' + (p.custom ? '<span class="chip">Yours</span>' : '<span class="chip">Built-in</span>') + (active ? '<span class="chip ok">Active</span>' : '') + '</div>' +
      '<div class="rowbtns">' + (active ? '' : '<button class="btn" id="ppUse">' + ico('play') + 'Use this plan</button>') + '</div>' +
      '<div class="rowbtns"><button class="ghost" id="ppEdit">' + ico('edit') + (p.custom ? 'Edit' : 'Customize') + '</button><button class="ghost" id="ppDup">' + ico('copy') + 'Duplicate</button></div>' +
      '<div class="tl">' + timeline(p.days.map(function (d) { return { rest: d.rest, workoutIds: d.workoutIds, note: d.note }; }), { current: active ? pos.day.day : 0 }) + '</div>', { tall: true });
    var u = $('#ppUse', sh.root); if (u) u.onclick = function () { sh.close(); usePlan(id); };
    $('#ppEdit', sh.root).onclick = function () { sh.close(); planDo(p.custom ? 'edit' : 'copyedit', id); };
    $('#ppDup', sh.root).onclick = function () { sh.close(); planDo('dup', id); };
  }

  /* ====================== plan builder ====================== */
  function restDay() { return { rest: true, workoutIds: [], note: '' }; }
  function blankPlan() { var days = []; for (var i = 0; i < 7; i++) days.push(restDay()); return { id: null, name: '', description: '', days: days, keep: {} }; }
  function draftFromPlan(p, asCopy) {
    return { id: asCopy ? null : p.id, name: asCopy ? p.name + ' copy' : p.name, description: p.description || '',
      days: p.days.map(function (d) { return { rest: d.rest, workoutIds: d.workoutIds.slice(), note: d.note || '' }; }), keep: { difficulty: p.difficulty, goal: p.goal, tags: p.tags } };
  }
  function planFromDraft(d) {
    var p = { name: trim(d.name), days: d.days.map(function (x, i) {
      var o = { day: i + 1 };
      if (x.rest || !x.workoutIds.length) o.type = 'rest'; else if (x.workoutIds.length === 1) o.workoutId = x.workoutIds[0]; else o.workoutIds = x.workoutIds.slice();
      if (trim(x.note)) o.note = trim(x.note);
      return o;
    }) };
    if (d.id) p.id = d.id;
    if (trim(d.description)) p.description = trim(d.description);
    ['difficulty', 'goal', 'tags'].forEach(function (k) { if (d.keep[k]) p[k] = d.keep[k]; });
    return p;
  }
  function snapP(d) { return JSON.stringify([trim(d.name), trim(d.description), d.days.map(function (x) { return [x.rest, x.workoutIds, trim(x.note)]; })]); }

  function openPlanEditor(d) {
    var ov = overlay(d.id ? 'Edit plan' : 'New plan'), initial = snapP(d);
    guardClose(ov, function () { return snapP(d) !== initial; });
    ov.body.innerHTML =
      '<label class="field">Plan name<input id="pName" maxlength="60" placeholder="e.g. 30 Day Beginner" autocomplete="off" value="' + esc(d.name) + '"></label>' +
      '<div class="err" id="pErr" role="alert" hidden></div>' +
      '<div class="orow lenrow"><div><b>Length</b><div class="muted small">How many days</div></div><div class="stp" id="pLen"><button type="button" data-d="-1" aria-label="Fewer days">' + ico('minus') + '</button><input type="number" inputmode="numeric" aria-label="days"><span>days</span><button type="button" data-d="1" aria-label="More days">' + ico('plus') + '</button></div></div>' +
      '<div class="filters" id="pQuick">' + [7, 14, 21, 28, 30, 60, 90].map(function (n) { return '<button type="button" class="fchip" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
      '<button class="ghost wide" id="pFill" type="button">' + ico('wand') + 'Auto-fill from your workouts</button>' +
      '<p class="muted small hint2">Tap a day to choose its workout or make it a rest day.</p>' +
      '<div class="tl" id="pTl"></div>' +
      '<label class="field">Description (optional)<input id="pDesc" maxlength="160" value="' + esc(d.description) + '"></label>';
    ov.foot.innerHTML = '<div class="ed-sum"><b id="pSum"></b></div><button class="btn small" id="pSave" type="button">Save plan</button>';
    var nameEl = $('#pName', ov.el), errEl = $('#pErr', ov.el), lenIn = $('#pLen input', ov.el);

    function stats() { var wd = d.days.filter(function (x) { return !x.rest; }).length; return [wd, d.days.length - wd]; }
    function draw() {
      $('#pTl', ov.el).innerHTML = timeline(d.days, { editable: true });
      lenIn.value = d.days.length;
      var s = stats(); $('#pSum', ov.el).textContent = plural(d.days.length, 'day') + ' · ' + plural(s[0], 'workout') + ' · ' + s[1] + ' rest';
      $$('#pQuick .fchip', ov.el).forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-n') === d.days.length); });
      errEl.hidden = true;
    }
    function setLength(n) {
      n = Math.max(1, Math.min(365, n));
      if (n === d.days.length) { draw(); return; }
      if (n < d.days.length) {
        var lost = d.days.slice(n).filter(function (x) { return !x.rest; }).length;
        if (lost) { confirmSheet({ title: 'Shorten the plan?', text: 'The last ' + plural(d.days.length - n, 'day') + ' include ' + plural(lost, 'workout day') + ' that will be removed.', ok: 'Shorten', danger: true, onOk: function () { d.days.length = n; draw(); } }); draw(); return; }
        d.days.length = n;
      } else while (d.days.length < n) d.days.push(restDay());
      draw();
    }
    $$('#pLen button', ov.el).forEach(function (b) { b.onclick = function () { setLength(d.days.length + (+b.getAttribute('data-d'))); }; });
    lenIn.onchange = function () { var n = parseInt(this.value, 10); setLength(isNaN(n) ? d.days.length : n); };
    $$('#pQuick .fchip', ov.el).forEach(function (b) { b.onclick = function () { setLength(+b.getAttribute('data-n')); }; });
    nameEl.oninput = function () { d.name = this.value; this.classList.remove('bad'); errEl.hidden = true; };
    $('#pDesc', ov.el).oninput = function () { d.description = this.value; };

    $('#pTl', ov.el).addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-day')) editDay(+b.getAttribute('data-day'));
      else if (b.hasAttribute('data-wk')) weekMenu(+b.getAttribute('data-wk'));
    });
    function weekMenu(w) {
      actionSheet('Week ' + (w + 1), [['copy', 'copy', 'Copy this week to every other week'], ['rest', 'moon', 'Make this week all rest days']], function (a) {
        var src = d.days.slice(w * 7, w * 7 + 7);
        if (a === 'rest') { for (var i = w * 7; i < Math.min(d.days.length, w * 7 + 7); i++) d.days[i] = restDay(); }
        else { for (var j = 0; j < d.days.length; j++) { if (Math.floor(j / 7) === w) continue; var s = src[j % 7]; if (s) d.days[j] = { rest: s.rest, workoutIds: s.workoutIds.slice(), note: s.note }; } toast('Week ' + (w + 1) + ' copied to the other weeks'); }
        draw();
      });
    }
    function editDay(i) {
      var x = d.days[i], cur = { rest: x.rest || !x.workoutIds.length, workoutIds: x.workoutIds.slice(), note: x.note };
      var sh = sheet('<h2>Day ' + (i + 1) + '</h2><div class="seg" id="dKind"><button type="button" data-v="w">' + 'Workout day</button><button type="button" data-v="r">Rest day</button></div>' +
        '<div id="dWork"></div><label class="field">Note (optional)<input id="dNote" maxlength="120" placeholder="e.g. Walk for 20 minutes afterwards" value="' + esc(cur.note) + '"></label>' +
        '<div class="err" id="dErr" role="alert" hidden></div><div class="rowbtns"><button class="ghost" data-close>Cancel</button><button class="btn small" id="dSave">Done</button></div>');
      var r = sh.root;
      function dr() {
        $$('#dKind button', r).forEach(function (b) { b.classList.toggle('on', (b.getAttribute('data-v') === 'r') === cur.rest); });
        var box = $('#dWork', r);
        if (cur.rest) { box.innerHTML = '<p class="muted">A day off. Rest is part of the plan.</p>'; return; }
        box.innerHTML = '<div class="dwl">' + cur.workoutIds.map(function (id, k) {
          var w = K.workout(id);
          return '<div class="dwrow"><div class="en"><div class="nm">' + esc(w ? w.name : 'Missing workout') + '</div><div class="muted small">' + (w ? esc(wMeta(w)) : '') + '</div></div>' +
            '<button type="button" class="ic sm" data-up="' + k + '" aria-label="Move up"' + (k === 0 ? ' disabled' : '') + '>' + ico('up') + '</button><button type="button" class="ic sm" data-dn="' + k + '" aria-label="Move down"' + (k === cur.workoutIds.length - 1 ? ' disabled' : '') + '>' + ico('down') + '</button>' +
            '<button type="button" class="ic sm danger" data-rm="' + k + '" aria-label="Remove">' + ico('close') + '</button></div>';
        }).join('') + '</div><button class="addbtn" type="button" id="dAdd">' + ico('plus') + 'Add workout</button><p class="muted small">Several workouts on one day are done one after another (for example warm-up, main workout, cool-down).</p>';
        $('#dAdd', r).onclick = function () {
          pickWorkouts({ title: 'Choose workouts', hint: 'Done in the order you choose.', cta: 'Choose workouts', ctaN: function (n) { return 'Add ' + plural(n, 'workout'); }, onDone: function (ids) { cur.workoutIds = cur.workoutIds.concat(ids); $('#dErr', r).hidden = true; dr(); } });
        };
        $$('[data-up]', r).forEach(function (b) { b.onclick = function () { var k = +b.getAttribute('data-up'), t = cur.workoutIds.splice(k, 1)[0]; cur.workoutIds.splice(k - 1, 0, t); dr(); }; });
        $$('[data-dn]', r).forEach(function (b) { b.onclick = function () { var k = +b.getAttribute('data-dn'), t = cur.workoutIds.splice(k, 1)[0]; cur.workoutIds.splice(k + 1, 0, t); dr(); }; });
        $$('[data-rm]', r).forEach(function (b) { b.onclick = function () { cur.workoutIds.splice(+b.getAttribute('data-rm'), 1); dr(); }; });
      }
      $$('#dKind button', r).forEach(function (b) { b.onclick = function () { cur.rest = b.getAttribute('data-v') === 'r'; $('#dErr', r).hidden = true; dr(); }; });
      $('#dSave', r).onclick = function () {
        if (!cur.rest && !cur.workoutIds.length) { var e = $('#dErr', r); e.textContent = 'Pick at least one workout, or choose Rest day.'; e.hidden = false; return; }
        d.days[i] = { rest: cur.rest, workoutIds: cur.rest ? [] : cur.workoutIds, note: $('#dNote', r).value };
        sh.close(); draw();
      };
      dr();
    }
    $('#pFill', ov.el).onclick = function () { autoFill(); };
    function autoFill() {
      var per = Math.min(7, Math.max(1, Math.round(stats()[0] / Math.max(1, d.days.length / 7)) || 4));
      var sh = sheet('<h2>Auto-fill the plan</h2><p class="muted small">Spreads your workouts evenly over every week and leaves the other days as rest. You can still change any day afterwards.</p>' +
        '<div class="field">Training days per week</div>' + '<div class="filters" id="afPer">' + [1, 2, 3, 4, 5, 6, 7].map(function (n) { return '<button type="button" class="fchip' + (n === per ? ' on' : '') + '" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
        '<div class="field">Workouts to rotate</div><button class="ghost wide" id="afPick" type="button">' + ico('plus') + 'Choose workouts</button><div id="afSel" class="mchips"></div>' +
        '<div class="err" id="afErr" role="alert" hidden></div><div class="warn small" id="afWarn" hidden>This replaces every day of the plan.</div>' +
        '<div class="rowbtns"><button class="ghost" data-close>Cancel</button><button class="btn small" id="afGo">Fill plan</button></div>');
      var r = sh.root, ids = [];
      if (d.days.some(function (x) { return !x.rest; })) $('#afWarn', r).hidden = false;
      $$('#afPer .fchip', r).forEach(function (b) { b.onclick = function () { per = +b.getAttribute('data-n'); $$('#afPer .fchip', r).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      $('#afPick', r).onclick = function () {
        pickWorkouts({ title: 'Workouts to rotate', hint: 'They are used in this order, one after another, on your training days.', cta: 'Choose workouts', ctaN: function (n) { return 'Use ' + plural(n, 'workout'); },
          onDone: function (sel) { ids = sel; $('#afErr', r).hidden = true; $('#afSel', r).innerHTML = ids.map(function (id) { var w = K.workout(id); return '<span class="chip">' + esc(w ? w.name : id) + '</span>'; }).join(''); } });
      };
      $('#afGo', r).onclick = function () {
        if (!ids.length) { var e = $('#afErr', r); e.textContent = 'Choose at least one workout to rotate.'; e.hidden = false; return; }
        var pos = []; for (var i = 0; i < per; i++) pos.push(Math.floor(i * 7 / per));
        var k = 0;
        d.days = d.days.map(function (x, j) { return pos.indexOf(j % 7) >= 0 ? { rest: false, workoutIds: [ids[k++ % ids.length]], note: '' } : restDay(); });
        sh.close(); draw(); toast('Plan filled. Tap any day to change it.');
      };
    }
    $('#pSave', ov.el).onclick = function () {
      var name = trim(d.name), err = '';
      var clash = C.S.custom.plans.some(function (p) { return p.id !== d.id && trim(p.name).toLowerCase() === name.toLowerCase(); });
      var missing = d.days.some(function (x) { return !x.rest && x.workoutIds.some(function (id) { return !K.workout(id); }); });
      if (!name) err = 'Give your plan a name.'; else if (clash) err = 'You already have a plan called “' + name + '”. Pick a different name.';
      else if (!stats()[0]) err = 'Add at least one workout day. Tap a day, or use Auto-fill.';
      else if (missing) err = 'Some days use a workout that no longer exists. Tap those days and choose another workout.';
      if (err) { errEl.textContent = err; errEl.hidden = false; if (!name || clash) { nameEl.classList.add('bad'); nameEl.focus(); } ov.body.scrollTop = 0; return; }
      var wasNew = !d.id, saved = C.saveCustom('plans', planFromDraft(d));
      ov.close(); tab = 'plans'; ui().refresh();
      if (wasNew) confirmSheet({ title: 'Plan saved', text: 'Start “' + saved.name + '” today? You can also start it any time from the Plans list.', ok: 'Start today', cancel: 'Not now', onOk: function () { C.setPlan(saved.id); toast('Plan started. Today is day 1.'); ui().go('today'); } });
      else toast('Plan saved');
    };
    draw();
    if (!d.id && !d.name) setTimeout(function () { nameEl.focus(); }, 50);
  }

  root.Studio = { render: render, editExercise: editExercise, deleteExercise: deleteExercise };
})(window);
