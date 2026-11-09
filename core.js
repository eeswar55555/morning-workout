/* core.js — data, planning, progress rules, voice and sound. No screens in here. */
(function (root) {
  'use strict';
  var KEY = 'morningfit.v1';

  var DEFAULTS = {
    v: 1, start: null, level: 1, ack: false,
    settings: { voice: true, rate: 1, voiceName: '', beep: true, vibrate: true, detail: 'auto', pace: 1, restStrength: 0, lightDay: 0, theme: 'auto', basePain: null },
    disabled: {}, custom: [], routine: null, dose: {}, history: [], pain: {}, plans: {}, counts: {}
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
    var cutoff = addDays(dateKey(), -30);
    Object.keys(S.plans || {}).forEach(function (k) { if (k < cutoff) delete S.plans[k]; });
    return S;
  }
  var saveFailed = false;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); saveFailed = false; } catch (e) { saveFailed = true; } }

  /* ---------- exercise library ---------- */
  var _map = null;
  function resolveCustom(c) {
    var src = root.EXERCISES.filter(function (e) { return e.id === c.looks; })[0] || root.EXERCISES[0];
    return Object.assign({}, c, { anim: src.anim, isCustom: true, area: c.area || 'My exercise', breath: c.breath || 'Breathe steadily.', tempo: c.tempo || 4 });
  }
  function lib() { return root.EXERCISES.concat((S.custom || []).map(resolveCustom)); }
  function invalidate() { _map = null; }
  function exMap() { if (!_map) { _map = {}; lib().forEach(function (e) { _map[e.id] = e; }); } return _map; }
  function getEx(id) { return exMap()[id]; }
  function routine() { return S.routine || root.ROUTINE; }
  function level() {
    var L = routine().levels || root.ROUTINE.levels;
    return L.filter(function (l) { return l.n === S.level; })[0] || L[0];
  }
  function maxLevel() { var L = routine().levels; return L[L.length - 1].n; }

  function sidesOf(ex) { return ex.sides === true ? ['right', 'left'] : (Array.isArray(ex.sides) ? ex.sides : null); }
  function dose(ex) {
    var o = S.dose[ex.id] || {}, L = level();
    var d = { type: ex.type, sides: sidesOf(ex) };
    if (ex.type === 'reps') d.reps = (o.n != null ? o.n : ex.reps || 8) + (ex.scale === false ? 0 : (L.repsBonus || 0));
    else {
      d.secs = o.n != null ? o.n : (ex.secs || 20);
      d.holds = ex.type === 'hold' ? (ex.holds === 'level' ? L.holds : (ex.holds || 1)) : 1;
    }
    return d;
  }
  function doseText(ex, d) {
    d = d || dose(ex);
    var sd = d.sides ? (ex.sides === true ? ' each side' : ' each way') : '';
    if (d.type === 'reps') return d.reps + ' reps' + sd;
    if (d.type === 'hold') return d.holds + ' × ' + d.secs + ' s hold' + sd;
    return d.secs + ' s' + sd;
  }
  function spokenDose(ex, d) {
    d = d || dose(ex);
    var sd = d.sides ? (ex.sides === true ? ' on each side' : ' in each direction') : '';
    if (d.type === 'reps') return d.reps + ' reps' + sd;
    if (d.type === 'hold') return 'Hold for ' + d.secs + ' seconds, ' + d.holds + ' times' + sd;
    return d.secs + ' seconds' + sd;
  }
  function levelNote(ex) {
    var n = ex.levelNotes; if (!n) return '';
    var best = 0;
    for (var k in n) if (+k <= S.level && +k > best) best = +k;
    return best ? n[best] : '';
  }
  function period(ex) { return Math.max(1, (ex.tempo || 4) * (S.settings.pace || 1)); }

  /* ---------- the daily plan (rotates so it keeps changing) ---------- */
  function isLightDay(key) { return parseKey(key).getDay() === +S.settings.lightDay; }
  function mod(a, n) { return ((a % n) + n) % n; }

  function buildPlan(key) {
    var R = routine();
    var ps = S.plans[key] || (S.plans[key] = { shuffle: 0, swaps: {}, full: false });
    var light = isLightDay(key) && !ps.full;
    var dayNum = daysBetween(S.start, key), used = {}, idx = 0, blocks = [];
    R.blocks.forEach(function (b) {
      if (light && R.lightDayBlocks.indexOf(b.id) < 0) return;
      var items = [];
      b.items.forEach(function (it, i) {
        idx++;
        var opts = it.pick.filter(function (id) { return exMap()[id] && !S.disabled[id]; });
        if (!opts.length) return;
        var k = b.id + ':' + i, id = ps.swaps[k];
        if (!id || opts.indexOf(id) < 0) {
          id = null;
          var start = mod(dayNum + ps.shuffle + idx, opts.length);
          for (var t = 0; t < opts.length; t++) { var c = opts[(start + t) % opts.length]; if (!used[c]) { id = c; break; } }
          if (!id) id = opts[start];
        }
        used[id] = 1;
        items.push({ key: k, id: id, options: opts });
      });
      if (items.length) blocks.push({ id: b.id, title: b.title, circuit: !!b.circuit, items: items });
    });
    return { date: key, light: light, blocks: blocks };
  }
  function shuffle(key) { var ps = S.plans[key] || (S.plans[key] = { shuffle: 0, swaps: {}, full: false }); ps.shuffle += 1; ps.swaps = {}; save(); }
  function swap(key, itemKey, opts, cur) {
    var ps = S.plans[key] || (S.plans[key] = { shuffle: 0, swaps: {}, full: false });
    ps.swaps[itemKey] = opts[(opts.indexOf(cur) + 1) % opts.length]; save();
  }

  /* ---------- turn a plan into the ordered list of steps the player runs ---------- */
  /* There is no instruction step any more: every exercise starts straight from a short transition
     ("Next: X, starting in 3-2-1"). Instructions are optional and live in a bottom sheet. */
  var DEFAULT_REST = 8, SWITCH_REST = 6, BREATHE_REST = 3, START_LEAD = 6;
  function buildSteps(plan) {
    var R = routine(), L = level(), insts = [], steps = [];
    plan.blocks.forEach(function (b) {
      var rounds = b.circuit ? L.rounds : 1;
      for (var r = 1; r <= rounds; r++) b.items.forEach(function (it) { insts.push({ block: b, ex: getEx(it.id), round: r, rounds: rounds }); });
    });
    insts.forEach(function (inst, i) {
      var ex = inst.ex, d = dose(ex), prev = insts[i - 1];
      if (prev) {
        var secs = prev.block.id !== inst.block.id ? 10 :
          (inst.block.id === 'strength' && S.settings.restStrength ? S.settings.restStrength : (R.rest && R.rest[inst.block.id] != null ? R.rest[inst.block.id] : DEFAULT_REST));
        steps.push({ kind: 'rest', why: 'between', secs: secs, exi: i });
      } else steps.push({ kind: 'rest', why: 'start', secs: START_LEAD, exi: i });
      var sides = d.sides || [null];
      if (d.type === 'reps') {
        sides.forEach(function (sd, si) {
          if (si > 0) steps.push({ kind: 'rest', why: 'switch', secs: SWITCH_REST, exi: i, sideIdx: si, side: sd });
          steps.push({ kind: 'work', mode: 'reps', n: d.reps, side: sd, sideIdx: si, exi: i });
        });
      } else {
        sides.forEach(function (sd, si) {
          if (si > 0) steps.push({ kind: 'rest', why: 'switch', secs: SWITCH_REST, exi: i, sideIdx: si, side: sd });
          for (var h = 1; h <= d.holds; h++) {
            if (h > 1) steps.push({ kind: 'rest', why: 'breathe', secs: BREATHE_REST, exi: i, sideIdx: si, side: sd });
            steps.push({ kind: 'work', mode: d.type, secs: d.secs, side: sd, sideIdx: si, set: h, sets: d.holds, exi: i });
          }
        });
      }
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
  /* "move up only after a full week where every set was finished with good form, you could have done
      2+ more reps, and back pain was no worse than your baseline" */
  function advice() {
    var today = dateKey(), from = addDays(today, -6);
    var wk = sessions().filter(function (h) { return !h.light && h.level === S.level && h.date >= from && h.date <= today; });
    var base = basePain(), out = { up: false, down: false, text: '', count: wk.length };
    var lastFlare = Object.keys(S.pain).sort().slice(-1).map(function (k) { return { k: k, v: S.pain[k] }; })[0];
    if (lastFlare && base != null && lastFlare.v >= base + 3 && lastFlare.k >= addDays(today, -2)) {
      out.down = S.level > 1;
      out.text = 'Your back was much sorer than usual recently. If it flared up, drop back one level for a week.';
      return out;
    }
    if (S.level >= maxLevel()) { out.text = 'You are on the top level. Keep it up!'; return out; }
    var form = wk.every(function (h) { return h.form === true; }), extra = wk.every(function (h) { return h.extra === true; });
    var painOk = Object.keys(S.pain).filter(function (k) { return k >= from; }).every(function (k) { return base == null || S.pain[k] <= base; });
    if (wk.length >= 5 && form && extra && painOk) { out.up = true; out.text = 'Great week. Every set felt good and you had reps in reserve. You are ready for level ' + (S.level + 1) + '.'; }
    else out.text = 'Move up after a week of 5 or more sessions where you finish every set with good form, could do 2+ more reps, and your back is no worse than usual. This week: ' + wk.length + ' of 5 sessions.';
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
    lib: lib, invalidate: invalidate, exMap: exMap, getEx: getEx, routine: routine, level: level, maxLevel: maxLevel,
    sidesOf: sidesOf, dose: dose, doseText: doseText, spokenDose: spokenDose, levelNote: levelNote, period: period,
    isLightDay: isLightDay, buildPlan: buildPlan, shuffle: shuffle, swap: swap, buildSteps: buildSteps, estimate: estimate,
    sessions: sessions, streak: streak, basePain: basePain, advice: advice,
    Sound: Sound, Voice: Voice, WakeLock: WakeLock, saveFailed: function () { return saveFailed; }
  };
})(window);
