/* core.js — saved state, today's session, progress rules, voice and sound. No screens in here.
 *
 * What to do today comes from the content in data/ (see catalog.js):  plan day -> workouts -> exercise entries -> exercises.
 * This file only decides WHICH plan day it is, turns the workouts of that day into the steps the player runs, and keeps
 * the user's own state (settings, history, pain log). It contains no week- or level-specific rules.
 */
(function (root) {
  'use strict';
  var KEY = 'morningfit.v1';          // the storage key stays; the data inside is versioned by `v`
  var VERSION = 3;
  var WEEK = 7;                        // the review window for "ready for the next week?" (calendar days, not plan content)

  var DEFAULTS = {
    v: VERSION, start: null, planId: null, ack: false, reviewed: '',
    settings: { voice: true, rate: 1, voiceName: '', beep: true, vibrate: true, detail: 'auto', pace: 1, restStrength: 0, theme: 'auto', basePain: null },
    disabled: {}, dose: {}, history: [], pain: {}, counts: {},
    custom: { exercises: [], workouts: [], plans: [] }        // the user's own content; built-in content stays in data/*.json
  };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var S;

  /* ---------- dates ---------- */
  function dateKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }
  function addDays(k, n) { var d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }

  /* ---------- storage ---------- */
  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    S = clone(DEFAULTS);
    if (raw && typeof raw === 'object') {
      for (var k in raw) if (k !== 'settings') S[k] = raw[k];
      Object.assign(S.settings, raw.settings || {});
    }
    if (!S.start) S.start = dateKey();
    migrate(S);
    S.custom = S.custom || {};
    ['exercises', 'workouts', 'plans'].forEach(function (k) { if (!Array.isArray(S.custom[k])) S.custom[k] = []; });
    if (root.Catalog) root.Catalog.setCustom(S.custom);
    return S;
  }
  /* v1 -> v2: exercise ids became snake_case, the six "levels" became days of a plan, and the in-app plan editor,
   * custom exercises and per-day swaps were dropped (content now lives in data/*.json). */
  var OLD_ID = { 'incline-pushup': 'incline_push_up', 'wall-pushup': 'wall_push_up', 'march': 'march_in_place' };
  function newId(id) { return OLD_ID[id] || String(id).replace(/-/g, '_'); }
  function renameKeys(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { r[newId(k)] = o[k]; }); return r; }
  /* v2 -> v3: the user's own exercises, workouts and plans (Workout Studio) get their own place in the state. */
  function migrate(s) {
    var v = s.v || 1;
    if (v >= VERSION) return s;
    if (v < 2) migrateV1(s);
    s.custom = { exercises: [], workouts: [], plans: [] };
    s.v = VERSION;
    return s;
  }
  function migrateV1(s) {
    s.disabled = renameKeys(s.disabled); s.counts = renameKeys(s.counts); s.dose = renameKeys(s.dose);
    (s.history || []).forEach(function (h) { h.done = (h.done || []).map(newId); h.skipped = (h.skipped || []).map(newId); });
    if (s.level > 1) s.start = addDays(dateKey(), -(s.level - 1) * 14);       // old level N = day 1 of the matching two weeks
    ['level', 'routine', 'custom', 'plans'].forEach(function (k) { delete s[k]; });
    if (s.settings) delete s.settings.lightDay;
    s.reviewed = s.reviewed || ''; s.planId = s.planId || null;
  }
  var saveFailed = false;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); saveFailed = false; } catch (e) { saveFailed = true; } }

  /* ---------- content (exercise library, workouts, plans) ---------- */
  function lib() { return root.Catalog.exercises; }
  function getEx(id) { return root.Catalog.exercise(id); }
  function plan() { return root.Catalog.plan(S.planId) || root.Catalog.plan(root.Catalog.defaultPlanId); }

  function sidesOf(ex) { return ex.sides && ex.sides.length ? ex.sides : null; }

  /* How much of an exercise to do: the workout entry says (repetitions / durationSeconds / sets); a number the user typed
   * in the exercise sheet replaces the plan's amount for that exercise. */
  var DEFAULT_REPS = 10, DEFAULT_SECS = 30;
  function dose(ex, entry) {
    var o = S.dose[ex.id] || {}, e = entry || {};
    var d = { type: ex.type, sides: sidesOf(ex), sets: Math.max(1, e.sets || 1) };
    if (ex.type === 'reps') d.reps = o.n != null ? o.n : (e.repetitions || DEFAULT_REPS);
    else d.secs = o.n != null ? o.n : (e.durationSeconds || DEFAULT_SECS);
    return d;
  }
  function planAmount(ex, entry) { var e = entry || {}; return ex.type === 'reps' ? (e.repetitions || DEFAULT_REPS) : (e.durationSeconds || DEFAULT_SECS); }
  function eachWord(ex) { return root.Catalog.leftRight(ex) ? 'each side' : 'each way'; }
  function doseText(ex, entry) {
    var d = dose(ex, entry), sd = d.sides ? ' ' + eachWord(ex) : '', sets = d.sets > 1 ? d.sets + ' × ' : '';
    if (d.type === 'reps') return sets + d.reps + ' reps' + sd;
    if (d.type === 'hold') return sets + d.secs + ' s hold' + sd;
    return sets + d.secs + ' s' + sd;
  }
  function spokenDose(ex, entry) {
    var d = dose(ex, entry), sd = d.sides ? (root.Catalog.leftRight(ex) ? ' on each side' : ' in each direction') : '';
    var times = d.sets > 1 ? ', ' + d.sets + ' times' : '';
    if (d.type === 'reps') return d.reps + ' reps' + times + sd;
    if (d.type === 'hold') return 'Hold for ' + d.secs + ' seconds' + times + sd;
    return d.secs + ' seconds' + times + sd;
  }
  function period(ex) { return Math.max(1, (ex.tempoSeconds || 4) * (S.settings.pace || 1)); }

  /* ---------- which day of the plan is it? ----------
   * Day 1 is the start date; the plan then advances one day per calendar day. Past the last day it starts again. */
  function planPosition(key) {
    var p = plan(), n = p.days.length, idx = Math.max(0, daysBetween(S.start, key));
    return { plan: p, idx: idx, day: p.days[idx % n], total: n, looped: idx >= n };
  }
  function shiftPlan(days) {                         // +7 = repeat the last week; never before day 1
    S.start = addDays(S.start, days);
    if (daysBetween(S.start, dateKey()) < 0) S.start = dateKey();
    S.reviewed = dateKey(); save();
  }
  function setPlanDay(n) { S.start = addDays(dateKey(), -(Math.max(1, n) - 1)); save(); }
  function setPlan(id) { S.planId = id; S.start = dateKey(); S.reviewed = ''; save(); }

  /* one workout as a block of the session; exercises the user switched off are skipped (unless ignoreDisabled) */
  function blockOf(w, wi, ignoreDisabled) {
    var items = [];
    (w.exercises || []).forEach(function (en, i) {
      var ex = getEx(en.exerciseId);
      if (ex && (ignoreDisabled || !S.disabled[ex.id])) items.push({ key: wi + ':' + i, id: ex.id, entry: en });
    });
    return items.length ? { id: w.id, title: w.name, workout: w, rounds: Math.max(1, w.rounds || 1), items: items } : null;
  }
  /* today's session: the workouts of the plan day */
  function buildPlan(key) {
    var pos = planPosition(key), day = pos.day, blocks = [];
    if (!day.rest) day.workoutIds.forEach(function (wid, wi) {
      var w = root.Catalog.workout(wid), b = w && blockOf(w, wi);
      if (b) blocks.push(b);
    });
    return { date: key, planId: pos.plan.id, planName: pos.plan.name, day: day.day, total: pos.total, looped: pos.looped,
      rest: day.rest, note: day.note, blocks: blocks };
  }
  /* a session that is not part of the plan: "start this workout now" from the Workout Studio */
  function sessionFor(workoutIds) {
    var blocks = [];
    workoutIds.forEach(function (wid, wi) { var w = root.Catalog.workout(wid), b = w && blockOf(w, wi); if (b) blocks.push(b); });
    return { date: dateKey(), planId: null, planName: '', day: null, total: 0, looped: false, rest: false, note: '', blocks: blocks };
  }
  /* how long a workout takes, in minutes (also works for a draft that is not saved yet) */
  function estimateMinutes(w) {
    var b = blockOf(w, 0, true);
    return b ? estimate(buildSteps({ blocks: [b] })) / 60 : 0;
  }

  /* ---------- the user's own exercises, workouts and plans ----------
   * Kept in S.custom, apart from the built-in packs, so built-in content can never be changed by accident.
   * Items have exactly the shape of the JSON schema (data/schema/types.ts); an exercise may also carry `looks`
   * (the id of a built-in exercise whose picture it borrows). */
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'item'; }
  function makeId(kind, name) {
    var K = root.Catalog, has = { exercises: K.exercise, workouts: K.workout, plans: K.plan }[kind];
    var base = 'my_' + slug(name), id = base;
    for (var i = 2; has(id); i++) id = base + '_' + i;
    return id;
  }
  function saveCustom(kind, item) {
    if (!item.id) item.id = makeId(kind, item.name);
    var list = S.custom[kind], at = -1;
    list.forEach(function (x, i) { if (x.id === item.id) at = i; });
    if (at >= 0) list[at] = item; else list.push(item);
    save(); root.Catalog.setCustom(S.custom);
    return item;
  }
  function isCustom(kind, id) {
    var K = root.Catalog, o = { exercises: K.exercise, workouts: K.workout, plans: K.plan }[kind](id);
    return !!(o && o.custom);
  }
  function workoutsUsing(exerciseId) { return root.Catalog.workouts.filter(function (w) { return w.exercises.some(function (e) { return e.exerciseId === exerciseId; }); }); }
  function plansUsing(workoutId) { return root.Catalog.plans.filter(function (p) { return p.days.some(function (d) { return d.workoutIds.indexOf(workoutId) >= 0; }); }); }
  function deleteCustom(kind, id) {
    S.custom[kind] = S.custom[kind].filter(function (x) { return x.id !== id; });
    if (kind === 'workouts') {                       // days that used it fall back to rest days
      S.custom.plans.forEach(function (p) {
        p.days = p.days.map(function (d) {
          if (d.type === 'rest') return d;
          var ids = (d.workoutIds || [d.workoutId]).filter(function (x) { return x && x !== id; }), o = { day: d.day };
          if (!ids.length) o.type = 'rest'; else if (ids.length === 1) o.workoutId = ids[0]; else o.workoutIds = ids;
          if (d.note) o.note = d.note;
          return o;
        });
      });
    }
    save(); root.Catalog.setCustom(S.custom);
    if (kind === 'plans' && S.planId === id) setPlan(root.Catalog.defaultPlanId);
  }

  /* ---------- turn a session into the ordered list of steps the player runs ---------- */
  /* There is no instruction step: every exercise starts straight from a short transition
     ("Next: X, starting in 3-2-1"). Instructions are optional and live in a bottom sheet. */
  var DEFAULT_REST = 8, MIN_REST = 3, WORKOUT_REST = 10, SWITCH_REST = 6, START_LEAD = 6;
  function restAfter(inst) {                         // rest taken after a set of this entry
    var w = inst.block.workout, en = inst.entry, s;
    if (en.restSeconds != null) s = en.restSeconds;
    else if (w.category === 'strength' && S.settings.restStrength) s = S.settings.restStrength;   // the "rest between strength exercises" setting
    else s = w.restSeconds != null ? w.restSeconds : DEFAULT_REST;
    return Math.max(MIN_REST, s);
  }
  function buildSteps(session) {
    var insts = [], steps = [];
    session.blocks.forEach(function (b) {
      for (var r = 1; r <= b.rounds; r++) b.items.forEach(function (it) { insts.push({ block: b, ex: getEx(it.id), entry: it.entry, round: r, rounds: b.rounds }); });
    });
    insts.forEach(function (inst, i) {
      var ex = inst.ex, d = dose(ex, inst.entry), prev = insts[i - 1];
      if (prev) steps.push({ kind: 'rest', why: 'between', secs: prev.block !== inst.block ? WORKOUT_REST : restAfter(prev), exi: i });
      else steps.push({ kind: 'rest', why: 'start', secs: START_LEAD, exi: i });
      (d.sides || [null]).forEach(function (sd, si) {
        if (si > 0) steps.push({ kind: 'rest', why: 'switch', secs: SWITCH_REST, exi: i, sideIdx: si, side: sd });
        for (var s = 1; s <= d.sets; s++) {
          if (s > 1) steps.push({ kind: 'rest', why: 'breathe', secs: restAfter(inst), exi: i, sideIdx: si, side: sd });
          var st = { kind: 'work', mode: d.type, side: sd, sideIdx: si, set: s, sets: d.sets, exi: i };
          if (d.type === 'reps') st.n = d.reps; else st.secs = d.secs;
          steps.push(st);
        }
      });
    });
    return { steps: steps, insts: insts };
  }
  function estimate(built) {
    var tot = 0;
    built.steps.forEach(function (st) {
      var ex = built.insts[st.exi].ex;
      if (st.kind === 'rest') tot += st.secs;
      else if (st.mode === 'reps') tot += st.n * period(ex);
      else tot += st.secs;
    });
    return tot;
  }

  /* ---------- progress ---------- */
  function sessions() { return S.history.filter(function (h) { return h.completed; }); }
  function streak() {
    var days = {}; sessions().forEach(function (h) { days[h.date] = 1; });
    var k = dateKey(), n = 0;
    if (!days[k]) k = addDays(k, -1);
    while (days[k]) { n++; k = addDays(k, -1); }
    return n;
  }
  function basePain() {
    if (S.settings.basePain != null) return S.settings.basePain;
    var ks = Object.keys(S.pain).sort();
    return ks.length ? S.pain[ks[0]] : null;
  }
  /* "move on only after a full week where every set was finished with good form, you could have done
      2+ more reps, and back pain was no worse than your baseline". The plan itself advances daily; this only
      suggests repeating the week (or stepping back after a pain flare) at the start of each new week. */
  function advice() {
    var today = dateKey(), from = addDays(today, -WEEK), pos = planPosition(today);
    var wk = sessions().filter(function (h) { return h.date >= from && h.date <= today; });
    var base = basePain(), out = { back: false, repeat: false, text: '', count: wk.length };
    var weekStart = !pos.looped && pos.idx >= WEEK && pos.idx % WEEK === 0 && S.reviewed !== today;
    var lastFlare = Object.keys(S.pain).sort().slice(-1).map(function (k) { return { k: k, v: S.pain[k] }; })[0];
    if (lastFlare && base != null && lastFlare.v >= base + 3 && lastFlare.k >= addDays(today, -2)) {
      out.back = pos.idx >= WEEK && S.reviewed !== today;
      out.text = 'Your back was much sorer than usual recently. If it flared up, go back one week in the plan.';
      return out;
    }
    var form = wk.every(function (h) { return h.form === true; }), extra = wk.every(function (h) { return h.extra === true; });
    var painOk = Object.keys(S.pain).filter(function (k) { return k >= from; }).every(function (k) { return base == null || S.pain[k] <= base; });
    if (wk.length >= 5 && form && extra && painOk) out.text = 'Great week. Every set felt good and you had reps in reserve. Carry on with the plan.';
    else {
      out.repeat = weekStart;
      out.text = 'Ready for the next week after 5 or more sessions where you finish every set with good form, could do 2+ more reps, and your back is no worse than usual. Last 7 days: ' + wk.length + ' session' + (wk.length === 1 ? '' : 's') + '.';
    }
    return out;
  }

  /* ---------- sound ---------- */
  var Sound = {
    ctx: null,
    unlock: function () {
      try {
        if (!this.ctx) this.ctx = new (root.AudioContext || root.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) {}
    },
    beep: function (freq, dur, vol) {
      if (!S.settings.beep || !this.ctx) return;
      try {
        var c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.frequency.value = freq || 660; o.type = 'sine';
        g.gain.setValueAtTime(vol || 0.12, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.12));
        o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + (dur || 0.12) + 0.02);
      } catch (e) {}
    },
    buzz: function (p) { if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(p || 80); } catch (e) {} }
  };

  /* ---------- voice (built-in text-to-speech, works offline on Android) ----------
   * Indian English (en-IN) is the default. Android Chrome can be slow to start speaking, drops a
   * sentence that is spoken straight after a cancel, and its "network" voices can stall, so:
   *  - prefer an on-device en-IN voice,
   *  - wait a moment after a cancel,
   *  - if speech has not started after 3 seconds, retry once with the phone's default en-IN voice. */
  var Voice = {
    ok: 'speechSynthesis' in root && 'SpeechSynthesisUtterance' in root,
    voices: [], token: 0,
    load: function () {
      if (!this.ok) return;
      try { this.voices = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); }); } catch (e) {}
    },
    init: function () {
      if (!this.ok) return;
      var self = this; this.load();
      try { speechSynthesis.onvoiceschanged = function () { self.load(); }; } catch (e) {}
    },
    pick: function () {
      if (!this.voices.length) this.load();
      var vs = this.voices, isIN = function (v) { return /en[-_]IN/i.test(v.lang); }, local = function (v) { return v.localService !== false; };
      return vs.filter(function (v) { return isIN(v) && local(v); })[0] || vs.filter(isIN)[0] ||
        vs.filter(function (v) { return /en[-_]GB/i.test(v.lang) && local(v); })[0] || vs.filter(function (v) { return /^en/i.test(v.lang) && local(v); })[0] || null;
    },
    enabled: function () { return this.ok && S.settings.voice; },
    busy: function () { try { return this.ok && (speechSynthesis.speaking || speechSynthesis.pending); } catch (e) { return false; } },
    warm: function () { this.load(); try { speechSynthesis.resume(); } catch (e) {} },
    lastCancel: 0,
    cancel: function () { this.token++; this.lastCancel = Date.now(); if (this.ok) try { speechSynthesis.cancel(); } catch (e) {} },
    say: function (text, onstart, delay) {            // queued: resolves when finished
      var self = this, speed = root.__speed || 1;
      if (root.__said && self.enabled()) root.__said.push(text);
      return new Promise(function (res) {
        if (!self.enabled()) { res(); return; }
        var since = Date.now() - self.lastCancel;
        if (since < 150) delay = Math.max(delay || 0, 150 - since);      // Android drops speech right after a cancel
        var done = false, wd, st, started = false, retried = false, seq = 0;
        var fin = function () { if (done) return; done = true; clearTimeout(wd); clearTimeout(st); res(); };
        var est = Math.max(900, text.length * 75 / (S.settings.rate || 1)) + 1200;
        wd = setTimeout(fin, (est * 2.2) / speed + (delay || 0));
        if (speed > 1) { if (onstart) onstart(); setTimeout(fin, 200 / speed); return; }   // test mode
        function attempt(useVoice) {
          if (done) return;
          try {
            var u = new SpeechSynthesisUtterance(text), v = useVoice ? self.pick() : null, mine = ++seq;
            if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
            u.rate = S.settings.rate || 1; u.pitch = 1;
            u.onstart = function () { if (mine !== seq) return; started = true; clearTimeout(st); if (onstart) onstart(); };
            u.onend = function () { if (mine === seq) fin(); };
            u.onerror = function () { if (mine === seq) fin(); };
            try { speechSynthesis.resume(); } catch (e) {}
            speechSynthesis.speak(u);
            clearTimeout(st);
            st = setTimeout(function () {                      // never started: try again once, default voice
              if (started || done || retried) return;
              retried = true; try { speechSynthesis.cancel(); } catch (e) {}
              setTimeout(function () { attempt(false); }, 120);
            }, 3000);
          } catch (e) { fin(); }
        }
        if (delay) setTimeout(function () { attempt(true); }, delay); else attempt(true);
      });
    },
    now: function (text) {                         // interrupts whatever is playing
      var wasBusy = this.busy(); this.cancel();
      return this.say(text, null, wasBusy ? 120 : 0);
    },
    seq: function (list, from, onIdx) {          // speak sentences one by one; false if interrupted
      var tok = this.token, self = this;
      return (async function () {
        for (var i = from || 0; i < list.length; i++) {
          if (tok !== self.token) return false;
          if (onIdx) onIdx(i);
          await self.say(list[i]);
        }
        return tok === self.token;
      })();
    }
  };

  var WakeLock = {
    lock: null,
    async on() { try { if (navigator.wakeLock) this.lock = await navigator.wakeLock.request('screen'); } catch (e) {} },
    off() { try { if (this.lock) this.lock.release(); } catch (e) {} this.lock = null; }
  };

  root.Core = {
    get S() { return S; }, load: load, save: save, clone: clone, DEFAULTS: DEFAULTS,
    dateKey: dateKey, parseKey: parseKey, daysBetween: daysBetween, addDays: addDays,
    lib: lib, getEx: getEx, plan: plan, planPosition: planPosition, setPlan: setPlan, setPlanDay: setPlanDay, shiftPlan: shiftPlan,
    sidesOf: sidesOf, dose: dose, planAmount: planAmount, doseText: doseText, spokenDose: spokenDose, period: period,
    buildPlan: buildPlan, sessionFor: sessionFor, buildSteps: buildSteps, estimate: estimate, estimateMinutes: estimateMinutes,
    saveCustom: saveCustom, deleteCustom: deleteCustom, isCustom: isCustom, makeId: makeId, workoutsUsing: workoutsUsing, plansUsing: plansUsing,
    sessions: sessions, streak: streak, basePain: basePain, advice: advice,
    Sound: Sound, Voice: Voice, WakeLock: WakeLock, saveFailed: function () { return saveFailed; }
  };
})(window);
