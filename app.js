/* app.js — screens and the workout player. */
(function () {
  'use strict';
  var C = Core, V = C.Voice, SND = C.Sound, S;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  var screen = 'today', RUN = null, deferredInstall = null, openRows = {};

  /* ====================== icons (inline SVG: same look on every phone, follows the theme) ====================== */
  var ICONS = {
    flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
    repeat: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v5h5"/>',
    skip: '<path d="M5 5l10 7-10 7z" fill="currentColor"/><path d="M19 5v14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    volume: '<path d="M4 9.5v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    shuffle: '<path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c1.5 0 2.6-1 3.5-2.3M14 9c.9-1.2 2-2 3-2h4"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    edit: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>',
    down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    warning: '<path d="M12 3.5l10 17.5H2z"/><path d="M12 10v5M12 18h.01"/>',
    check: '<path d="M5 12.5l5 5 9-11"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    prev: '<path d="M19 5L9 12l10 7z" fill="currentColor"/><path d="M5 5v14"/>',
    chev: '<path d="M6 9l6 6 6-6"/>'
  };
  function ico(n, cls) {
    return '<svg class="i ' + (cls || '') + '" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[n] + '</svg>';
  }

  /* ====================== animation loop ====================== */
  var anims = [], lastT = performance.now();
  function frame(now) {
    var dt = Math.min(0.25, (now - lastT) / 1000) * (window.__speed || 1);
    lastT = now;
    anims.slice().forEach(function (f) { f(dt); });
    requestAnimationFrame(frame);
  }
  function addAnim(f) { anims.push(f); return function () { anims = anims.filter(function (x) { return x !== f; }); }; }

  function loopPeriod(ex) { return ex.type === 'reps' || ex.anim.dynamic ? C.period(ex) : 5; }
  function mountDemo(box, ex) {
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'fig'); box.appendChild(svg);
    var fig = Figure.create(svg), clock = 0, cur = null;
    function set(e, mirror) { cur = e; fig.setAnim(e.anim, mirror); }
    set(ex, false);
    var stop = addAnim(function (dt) { clock += dt; fig.show({ u: (clock / loopPeriod(cur)) % 1 }); });
    return { stop: stop, set: set };
  }
  function thumbs(root) {
    $$('.thumb[data-ex]', root).forEach(function (d) {
      if (d.firstChild) return;
      var ex = C.getEx(d.getAttribute('data-ex')); if (!ex) return;
      var svg = document.createElementNS(NS, 'svg'); d.appendChild(svg);
      var fig = Figure.create(svg); fig.setAnim(ex.anim, false);
      fig.show({ pos: ex.anim.poses ? ex.anim.poses.length - 1 : 0, u: 0.25 });
    });
  }

  /* ====================== small UI helpers ====================== */
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }
  function sheet(html, opts) {
    opts = opts || {};
    var bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = '<div class="sheet' + (opts.tall ? ' tall' : '') + '" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    document.body.appendChild(bd);
    var api = { root: bd.firstChild, close: function () { if (api.closed) return; api.closed = true; if (opts.onClose) opts.onClose(); bd.remove(); } };
    bd.addEventListener('click', function (e) { if (e.target === bd && !opts.sticky) api.close(); });
    $$('[data-close]', bd).forEach(function (b) { b.addEventListener('click', api.close); });
    thumbs(bd);
    return api;
  }
  function applyTheme() {
    var t = S.settings.theme, r = document.documentElement;
    if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
    var m = $('meta[name=theme-color]'); if (m) m.setAttribute('content', getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0f1a1f');
  }
  var thumbHtml = function (id) { return '<div class="thumb" data-ex="' + esc(id) + '"></div>'; };

  /* Muscle names come from the exercise library (primaryMuscles / secondaryMuscles); the body zones drive the overlay. */
  var zonesOf = Catalog.zonesOf;
  function muscleList(ex, withSecondary) { return Catalog.muscleNames(ex, withSecondary); }
  var ins = function (ex) { return ex.instructions || {}; };
  var leftRight = Catalog.leftRight;
  /* The optional reading material: muscles, steps, tips, common mistake. Used by the pre-workout
     preview and by the in-workout Instructions sheet, so the two always agree. `entry` (optional) is the
     workout line being done, which may carry its own note ("Lower for three seconds."). */
  function instrHtml(ex, entry) {
    var i = ins(ex), ms = muscleList(ex, true), tips = [];
    if (entry && entry.note) tips.push('<b>In this workout:</b> ' + esc(entry.note));
    if (i.breathing) tips.push('<b>Breathing:</b> ' + esc(i.breathing));
    if (i.easier) tips.push('<b>Easier:</b> ' + esc(i.easier));
    if (i.harder) tips.push('<b>Harder:</b> ' + esc(i.harder));
    return (ms.length ? '<h3>Muscles worked</h3><div class="mchips">' + ms.map(function (m) { return '<span class="chip">' + esc(m) + '</span>'; }).join('') + '</div>' : '') +
      (i.steps ? '<h3>How to do it</h3><ol class="steps">' + i.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : (ex.description ? '<p>' + esc(ex.description) + '</p>' : '')) +
      (tips.length ? '<h3>Tips</h3><ul class="tips">' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' : '') +
      (i.commonMistake ? '<h3>Common mistake</h3><p>' + esc(i.commonMistake) + '</p>' : '');
  }

  /* ====================== navigation ====================== */
  function go(name) {
    screen = name; var v = $('#view');
    $$('#nav button').forEach(function (b) { var on = b.getAttribute('data-go') === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    ({ today: renderToday, library: renderLibrary, progress: renderProgress, settings: renderSettings })[name](v);
    v.scrollTop = 0; thumbs(v);
  }
  function refresh() { var v = $('#view'), st = v.scrollTop; ({ today: renderToday, library: renderLibrary, progress: renderProgress, settings: renderSettings })[screen](v); v.scrollTop = st; thumbs(v); }

  /* ====================== TODAY ====================== */
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function entryOf(plan, id) {
    var found = null;
    plan.blocks.forEach(function (b) { b.items.forEach(function (it) { if (!found && it.id === id) found = it.entry; }); });
    return found;
  }
  function renderToday(v) {
    var key = C.dateKey(), plan = C.buildPlan(key), built = C.buildSteps(plan), mins = Math.max(1, Math.round(C.estimate(built) / 60));
    var adv = C.advice(), done = C.sessions().some(function (h) { return h.date === key; });
    var dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    var nEx = plan.blocks.reduce(function (a, bl) { return a + bl.items.length; }, 0);
    var nRounds = plan.blocks.reduce(function (a, bl) { return Math.max(a, bl.rounds); }, 1);
    var h = '<header class="top"><div><h1>' + greeting() + '</h1><div class="muted">' + esc(dateStr) + '</div></div>' +
      '<div class="chips"><span class="chip">' + ico('flame', 'sm') + C.streak() + ' day' + (C.streak() === 1 ? '' : 's') + '</span><span class="chip">Day ' + plan.day + ' of ' + plan.total + '</span></div></header>';
    if (C.saveFailed()) h += '<div class="warn" role="alert"><b>Progress can\'t be saved.</b> This browser is blocking storage (a private window?). Open the app in a normal Chrome tab.</div>';
    if (plan.rest) {
      h += '<section class="hero empty"><span class="eyebrow">Rest day</span><h2>Take it easy today</h2><p class="muted">' + esc(plan.note || 'Rest is part of the plan. Walk, stretch, drink water and sleep well.') + '</p></section>';
    } else if (!nEx) {
      h += '<section class="hero empty"><h2>Nothing to do today</h2><p class="muted">Every exercise in today\'s workouts is switched off. Turn some back on in the Exercises tab.</p></section>';
    } else {
      h += '<section class="hero"><span class="eyebrow">' + (done ? 'Done today · go again?' : 'Today\'s workout') + '</span>' +
        '<div class="hero-stats"><div><b>' + mins + '</b><span>minutes</span></div><div><b>' + nEx + '</b><span>exercises</span></div><div><b>' + nRounds + '</b><span>' + (nRounds === 1 ? 'round' : 'rounds') + '</span></div></div>' +
        '<button class="btn big" id="start">' + ico('play') + '<span>' + (done ? 'Do it again' : 'Start workout') + '</span></button>' +
        '<p class="hint">It moves on by itself. Pause, skip or go back any time.</p></section>';
    }
    if (plan.note && !plan.rest) h += '<div class="card note"><p>' + esc(plan.note) + '</p></div>';
    if (plan.looped) h += '<div class="card note"><p>You finished <b>' + esc(plan.planName) + '</b>. It starts again from day 1. Choose a different plan in Settings.</p></div>';
    if (deferredInstall) h += '<button class="link" id="installBtn">Install on this phone</button>';
    var pain = S.pain[key];
    h += '<section class="card" aria-labelledby="painQ"><div class="row"><b id="painQ">How is your back this morning?</b><span class="muted small">optional</span></div><div class="painrow" id="pain" role="group" aria-labelledby="painQ">';
    for (var i = 0; i <= 10; i++) h += '<button class="pn' + (pain === i ? ' on' : '') + '" data-p="' + i + '" aria-pressed="' + (pain === i) + '">' + i + '</button>';
    h += '</div><div class="painend small muted"><span>0 · none</span><span>10 · worst</span></div></section>';
    if (nEx) {
      h += '<div class="planhead"><h2>Today\'s plan</h2><span class="muted">about ' + mins + ' min</span></div><p class="muted small planhint">Tap an exercise to read how it is done. You never have to.</p>';
      var seq = 0;
      plan.blocks.forEach(function (b) {
        h += '<section class="card block"><h3 class="bt">' + esc(b.title) + (b.rounds > 1 ? ' <span class="muted">· ' + b.rounds + ' rounds</span>' : '') + '</h3>';
        b.items.forEach(function (it) {
          var ex = C.getEx(it.id), open = !!openRows[ex.id]; seq++;
          h += '<div class="item pv' + (open ? ' open' : '') + '">' + thumbHtml(ex.id) +
            '<button class="meta" data-exp="' + esc(ex.id) + '" aria-expanded="' + open + '" aria-controls="xp-' + esc(ex.id) + '"><span class="mt"><span class="nm">' + seq + '. ' + esc(ex.name) + '</span><span class="muted small">' + esc(C.doseText(ex, it.entry)) + '</span></span>' + ico('chev', 'chev') + '</button>' +
            '<div class="xp" id="xp-' + esc(ex.id) + '"' + (open ? '' : ' hidden') + '>' + instrHtml(ex, it.entry) + '<button class="link" data-open="' + esc(ex.id) + '">Change amount and more</button></div></div>';
        });
        h += '</section>';
      });
    }
    if (adv.repeat || adv.back) h += '<section class="card note"><b>' + (adv.back ? 'Back sore lately?' : 'Ready for the next week?') + '</b><p class="small">' + esc(adv.text) + '</p>' +
      '<button class="btn small alt" id="wkRepeat">' + (adv.back ? 'Go back one week' : 'Repeat last week') + '</button>' +
      (adv.back ? '' : '<button class="btn small" id="wkKeep">Keep going</button>') + '</section>';
    v.innerHTML = h;

    var sb = $('#start'); if (sb) sb.onclick = function () { startWorkout(plan); };
    $$('#pain .pn').forEach(function (b) { b.onclick = function () { var p = +b.getAttribute('data-p'); if (S.pain[key] === p) delete S.pain[key]; else S.pain[key] = p; C.save(); refresh(); }; });
    $$('[data-open]', v).forEach(function (m) { m.onclick = function () { var id = m.getAttribute('data-open'); openDetail(id, entryOf(plan, id)); }; });
    $$('[data-exp]', v).forEach(function (m) {
      m.onclick = function () {
        var id = m.getAttribute('data-exp'), on = !openRows[id], row = m.closest('.item');
        if (on) openRows[id] = 1; else delete openRows[id];
        m.setAttribute('aria-expanded', on); row.classList.toggle('open', on); $('#xp-' + id, row).hidden = !on;
      };
    });
    var wr = $('#wkRepeat'); if (wr) wr.onclick = function () { C.shiftPlan(7); toast('Back one week'); refresh(); };
    var wk = $('#wkKeep'); if (wk) wk.onclick = function () { S.reviewed = key; C.save(); refresh(); };
    var ib = $('#installBtn'); if (ib) ib.onclick = function () { deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; refresh(); }); };
  }

  /* ====================== exercise detail ====================== */
  /* `entry` (optional) = the workout line being shown, which sets the amount and may add a note. */
  function openDetail(id, entry) {
    var ex = C.getEx(id); if (!ex) return;
    var i = ins(ex), demo, h = '<div class="demo" id="demoBox"></div><h2>' + esc(ex.name) + '</h2><div class="muted">' + esc(ex.area || '') + ' · ' + esc(entry ? C.doseText(ex, entry) : ex.difficulty) + '</div>' +
      (ex.description ? '<p class="small">' + esc(ex.description) + '</p>' : '') +
      '<div class="rowbtns"><button class="btn small" id="hear">' + ico('volume') + 'Hear instructions</button></div>' +
      instrHtml(ex, entry) +
      '<div class="warn small">' + ico('warning', 'sm') + ' Stop if this causes sharp pain, or pain, tingling or numbness in your leg.</div>';
    if (entry) {
      var o = S.dose[ex.id] && S.dose[ex.id].n != null ? S.dose[ex.id].n : '';
      h += '<label class="field">Your ' + (ex.type === 'reps' ? 'reps' : 'seconds') + ' (leave empty to follow the plan: ' + C.planAmount(ex, entry) + ')<input type="number" inputmode="numeric" min="1" max="300" id="amt" placeholder="' + C.planAmount(ex, entry) + '" value="' + o + '"></label>';
    }
    h += '<div class="rowbtns"><button class="btn small" data-close>Done</button></div>';
    var sh = sheet(h, { tall: true, onClose: function () { demo && demo.stop(); V.cancel(); } });
    demo = mountDemo($('#demoBox', sh.root), ex);
    $('#hear', sh.root).onclick = function () {
      if (!V.enabled()) { toast('Voice is off. Turn it on in Settings.'); return; }
      V.cancel(); V.seq([ex.name + '.'].concat(i.steps || [], i.breathing ? [i.breathing] : []));
    };
    var amt = $('#amt', sh.root);
    if (amt) amt.onchange = function () {
      var n = parseInt(this.value, 10);
      if (!n || n === C.planAmount(ex, entry)) delete S.dose[ex.id]; else S.dose[ex.id] = { n: Math.max(1, Math.min(300, n)) };
      C.save(); refresh();
    };
  }

  /* ====================== LIBRARY ====================== */
  var libFilter = 'all';
  function renderLibrary(v) {
    var all = C.lib();
    var h = '<header class="top"><div><h1>Exercises</h1><div class="muted">Tap one to watch it. Switch off any you do not want in your workouts.</div></div></header>' +
      '<div class="searchbar">' + ico('search') + '<input id="lq" type="search" placeholder="Search exercises" aria-label="Search exercises" autocomplete="off"></div>' +
      '<div class="filters" role="group" aria-label="Filter">' + [['all', 'All'], ['on', 'In my plan'], ['off', 'Switched off']].map(function (f) { return '<button class="fchip' + (libFilter === f[0] ? ' on' : '') + '" data-f="' + f[0] + '" aria-pressed="' + (libFilter === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="liblist" id="liblist">';
    all.forEach(function (ex) {
      var find = [ex.name, ex.area, ex.category, (ex.tags || []).join(' '), (ex.equipment || []).join(' ')].join(' ').replace(/_/g, ' ').toLowerCase();
      h += '<div class="item lib" data-name="' + esc(find) + '" data-off="' + (S.disabled[ex.id] ? 1 : 0) + '">' + thumbHtml(ex.id) + '<div class="meta" data-open="' + esc(ex.id) + '" role="button" tabindex="0"><div class="nm">' + esc(ex.name) + '</div><div class="muted small">' + esc(ex.area || '') + ' · ' + esc(ex.difficulty) + '</div></div>' +
        '<label class="switch" title="Use in my workouts"><input type="checkbox" data-en="' + esc(ex.id) + '" aria-label="Use ' + esc(ex.name) + ' in my workouts"' + (S.disabled[ex.id] ? '' : ' checked') + '><span></span></label></div>';
    });
    h += '</div><p class="empty muted" id="libEmpty" hidden>No exercises match.</p><p class="muted small">New exercises, workouts and plans are added as JSON in <code>data/</code> — see <code>data/README.md</code>.</p>';
    v.innerHTML = h;
    function applyFilter() {
      var q = ($('#lq').value || '').trim().toLowerCase(), shown = 0;
      $$('#liblist .item').forEach(function (r) {
        var ok = (!q || r.getAttribute('data-name').indexOf(q) >= 0) && (libFilter === 'all' || (libFilter === 'off') === (r.getAttribute('data-off') === '1'));
        r.hidden = !ok; if (ok) shown++;
      });
      $('#libEmpty').hidden = shown > 0;
    }
    $('#lq').oninput = applyFilter;
    $$('.fchip', v).forEach(function (b) { b.onclick = function () { libFilter = b.getAttribute('data-f'); $$('.fchip', v).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); applyFilter(); }; });
    applyFilter();
    $$('[data-open]', v).forEach(function (m) { m.onclick = function () { openDetail(m.getAttribute('data-open')); }; m.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(m.getAttribute('data-open')); } }; });
    $$('[data-en]', v).forEach(function (c) { c.onchange = function () { var id = c.getAttribute('data-en'); if (c.checked) delete S.disabled[id]; else S.disabled[id] = 1; c.closest('.item').setAttribute('data-off', c.checked ? 0 : 1); C.save(); applyFilter(); }; });
  }

  /* ====================== PROGRESS ====================== */
  function renderProgress(v) {
    var ss = C.sessions(), today = C.dateKey(), pos = C.planPosition(today);
    var days = {}; ss.forEach(function (h) { days[h.date] = (days[h.date] || 0) + 1; });
    var totalMin = ss.reduce(function (a, h) { return a + (h.mins || 0); }, 0);
    var wkStart = today; var dow = C.parseKey(today).getDay(); wkStart = C.addDays(today, -((dow + 6) % 7));
    var thisWeek = 0; for (var i = 0; i < 7; i++) if (days[C.addDays(wkStart, i)]) thisWeek++;
    var h = '<header class="top"><div><h1>Progress</h1><div class="muted">Saved on this phone</div></div></header>';
    h += '<div class="stats"><div class="stat"><b>' + C.streak() + '</b><span>day streak</span></div><div class="stat"><b>' + ss.length + '</b><span>workouts</span></div><div class="stat"><b>' + Math.round(totalMin) + '</b><span>minutes</span></div><div class="stat"><b>' + thisWeek + '/7</b><span>this week</span></div></div>';
    h += '<section class="card"><b>This week</b><div class="week">';
    var names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    for (i = 0; i < 7; i++) { var k = C.addDays(wkStart, i); h += '<div class="wd' + (days[k] ? ' done' : '') + (k === today ? ' today' : '') + '"><span>' + names[i] + '</span><i>' + (days[k] ? '✓' : '') + '</i></div>'; }
    h += '</div></section>';
    h += '<section class="card"><b>Last 10 weeks</b><div class="heat">';
    var start10 = C.addDays(wkStart, -63);
    for (var w = 0; w < 10; w++) { h += '<div class="hc">'; for (var d = 0; d < 7; d++) { var kk = C.addDays(start10, w * 7 + d); h += '<i class="' + (kk > today ? 'fut' : days[kk] ? 'on' : '') + '" title="' + kk + '"></i>'; } h += '</div>'; }
    h += '</div></section>';
    // back pain chart
    var pk = Object.keys(S.pain).sort().slice(-21);
    h += '<section class="card"><b>Back pain, mornings</b>';
    if (pk.length < 2) h += '<p class="muted small">Log your back pain on the Today screen each morning to see the trend here.</p>';
    else {
      var W = 300, H = 90, pts = pk.map(function (k, j) { return [10 + j * (W - 20) / (pk.length - 1), H - 10 - S.pain[k] * (H - 20) / 10]; });
      h += '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Back pain trend"><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>' + pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="var(--accent)"/>'; }).join('') + '</svg><div class="muted small">Last ' + pk.length + ' days · lower is better</div>';
    }
    h += '</section>';
    h += '<section class="card"><b>' + esc(pos.plan.name) + '</b><p class="muted small">Day ' + pos.day.day + ' of ' + pos.total + (pos.looped ? ' · repeating' : '') + '</p><p class="small">' + esc(C.advice().text) + '</p><p class="muted small">Change the plan or the current day in Settings.</p></section>';
    // exercise progress
    var rows = C.lib().filter(function (e) { return S.counts[e.id]; }).sort(function (a, b) { return S.counts[b.id] - S.counts[a.id]; });
    h += '<section class="card"><b>Exercises you have done</b>';
    if (!rows.length) h += '<p class="muted small">Finish a workout and your exercises appear here.</p>';
    rows.forEach(function (e) { h += '<div class="prow"><span>' + esc(e.name) + '</span><span class="muted">' + S.counts[e.id] + '×</span></div>'; });
    h += '</section>';
    // history
    h += '<section class="card"><b>History</b>';
    var hist = S.history.slice().reverse().slice(0, 30);
    if (!hist.length) h += '<p class="muted small">No workouts yet. Your first one is waiting on the Today tab.</p>';
    hist.forEach(function (x) {
      var dt = C.parseKey(x.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      h += '<div class="hrow"><div><b>' + esc(dt) + '</b><div class="muted small">' + (x.day ? 'Day ' + x.day : x.level ? 'Level ' + x.level : 'Workout') + ' · ' + Math.round(x.mins || 0) + ' min · ' + (x.done ? x.done.length : 0) + ' exercises' + (x.completed ? '' : ' · ended early') + (x.painAfter != null ? ' · back ' + x.painAfter + '/10' : '') + '</div></div>' +
        (x.form === true ? '<span class="chip tiny ok">good form</span>' : '') + '</div>';
    });
    h += '</section><div class="rowbtns"><button class="ghost" id="exp">' + ico('down') + 'Save a backup</button><button class="ghost" id="imp">' + ico('up') + 'Restore backup</button></div><input type="file" id="impFile" accept="application/json" hidden>';
    v.innerHTML = h;
    $('#exp').onclick = function () {
      var blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'morning-workout-backup-' + C.dateKey() + '.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    };
    $('#imp').onclick = function () { $('#impFile').click(); };
    $('#impFile').onchange = function () {
      var f = this.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () { try { var o = JSON.parse(r.result); if (!o || !o.history) throw 0; localStorage.setItem('morningfit.v1', JSON.stringify(o)); C.load(); S = C.S; toast('Backup restored'); refresh(); } catch (e) { toast('That file is not a valid backup'); } };
      r.readAsText(f);
    };
  }

  /* ====================== SETTINGS ====================== */
  function renderSettings(v) {
    var st = S.settings, pos = C.planPosition(C.dateKey());
    var h = '<header class="top"><div><h1>Settings</h1></div></header>';
    h += '<section class="card"><b>Training plan</b>' +
      '<label class="field">Plan<select id="sPlan">' + Catalog.plans.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === pos.plan.id ? ' selected' : '') + '>' + esc(p.name) + ' (' + p.days.length + ' days)</option>'; }).join('') + '</select></label>' +
      (pos.plan.description ? '<p class="muted small">' + esc(pos.plan.description) + '</p>' : '') +
      '<label class="field">Today is day<input type="number" id="sDay" min="1" max="' + pos.total + '" inputmode="numeric" value="' + pos.day.day + '"></label>' +
      '<p class="muted small">The plan moves on one day at a time. Change the day to repeat a week or to line up with your calendar.</p></section>';
    h += '<section class="card"><b>Voice</b>' +
      '<label class="check"><input type="checkbox" id="sVoice"' + (st.voice ? ' checked' : '') + '> Voice coach: exercise names, countdowns and rep counts</label>' +
      '<p class="muted small">Voice is only a bonus. The workout runs the same with it off, muted or unavailable.</p>' +
      (V.ok ? '' : '<p class="warn small">This browser has no built-in voice. Use Chrome on Android.</p>') +
      '<label class="field">Speaking speed: <b id="rv">' + st.rate.toFixed(2) + '×</b><input type="range" id="sRate" min="0.7" max="1.3" step="0.05" value="' + st.rate + '"></label>' +
      '<label class="field">Short coaching tip before each exercise<select id="sDetail"><option value="auto"' + (st.detail === 'auto' ? ' selected' : '') + '>The first 3 times, then names only</option><option value="full"' + (st.detail === 'full' ? ' selected' : '') + '>Every time</option><option value="short"' + (st.detail === 'short' ? ' selected' : '') + '>Never</option></select></label>' +
      '<button class="ghost" id="sTest">' + ico('volume') + 'Test voice</button></section>';
    h += '<section class="card"><b>Workout</b>' +
      '<label class="field">Rep speed<select id="sPace"><option value="1.25"' + (st.pace === 1.25 ? ' selected' : '') + '>Slower</option><option value="1"' + (st.pace === 1 ? ' selected' : '') + '>Normal</option><option value="0.8"' + (st.pace === 0.8 ? ' selected' : '') + '>Faster</option></select></label>' +
      '<label class="field">Rest between strength exercises: <b id="rr">' + (st.restStrength || 15) + ' s</b><input type="range" id="sRest" min="10" max="30" step="5" value="' + (st.restStrength || 15) + '"></label>' +
      '<label class="field">Usual morning back pain (0–10)<input type="number" id="sBase" min="0" max="10" inputmode="numeric" placeholder="auto" value="' + (st.basePain == null ? '' : st.basePain) + '"></label>' +
      '<label class="check"><input type="checkbox" id="sBeep"' + (st.beep ? ' checked' : '') + '> Beeps for countdowns</label>' +
      '<label class="check"><input type="checkbox" id="sVib"' + (st.vibrate ? ' checked' : '') + '> Vibrate when a set ends</label>' +
      '<label class="field">Exercise character<select id="sFig"><option value="m"' + (st.figure !== 'f' ? ' selected' : '') + '>Male</option><option value="f"' + (st.figure === 'f' ? ' selected' : '') + '>Female</option></select></label>' +
      '<label class="field">Theme<select id="sTheme"><option value="auto"' + (st.theme === 'auto' ? ' selected' : '') + '>Match my phone</option><option value="light"' + (st.theme === 'light' ? ' selected' : '') + '>Light</option><option value="dark"' + (st.theme === 'dark' ? ' selected' : '') + '>Dark</option></select></label></section>';
    h += '<section class="card"><b>Safety</b><p class="small">This is general fitness guidance, not medical advice.</p><button class="ghost" id="sSafety">Read the safety guidance</button></section>';
    h += '<section class="card"><b>Install</b><p class="small">In Chrome on Android: tap ⋮ and choose <b>Add to Home screen</b> (or <b>Install app</b>). It then opens full screen and works with no internet.</p>' +
      (deferredInstall ? '<button class="btn small" id="sInstall">Install now</button>' : '') + '</section>';
    h += '<section class="card"><b>Start over</b><button class="ghost danger" id="sReset">Erase all progress on this phone</button></section>';
    h += '<p class="muted small center">Morning Workout · everything stays on your phone</p>';
    v.innerHTML = h;
    var save = function () { C.save(); };
    $('#sVoice').onchange = function () { st.voice = this.checked; save(); };
    $('#sRate').oninput = function () { st.rate = +this.value; $('#rv').textContent = st.rate.toFixed(2) + '×'; save(); };
    $('#sDetail').onchange = function () { st.detail = this.value; save(); };
    $('#sTest').onclick = function () { SND.unlock(); V.warm(); if (!V.enabled()) toast('Voice is off'); else V.now('Next: chair sit to stand. 3, 2, 1, begin.'); };
    $('#sPace').onchange = function () { st.pace = +this.value; save(); };
    $('#sRest').oninput = function () { st.restStrength = +this.value; $('#rr').textContent = st.restStrength + ' s'; save(); };
    $('#sPlan').onchange = function () { C.setPlan(this.value); toast('Plan changed. Today is day 1.'); refresh(); };
    $('#sDay').onchange = function () { var n = Math.max(1, Math.min(pos.total, parseInt(this.value, 10) || 1)); C.setPlanDay(n); toast('Today is day ' + n); refresh(); };
    $('#sBase').onchange = function () { st.basePain = this.value === '' ? null : Math.max(0, Math.min(10, +this.value)); save(); };
    $('#sBeep').onchange = function () { st.beep = this.checked; save(); };
    $('#sVib').onchange = function () { st.vibrate = this.checked; save(); };
    $('#sFig').onchange = function () { st.figure = this.value; Illus.female = st.figure === 'f'; save(); };
    $('#sTheme').onchange = function () { st.theme = this.value; save(); applyTheme(); };
    $('#sSafety').onclick = function () { openSafety(false); };
    var si = $('#sInstall'); if (si) si.onclick = function () { deferredInstall.prompt(); };
    $('#sReset').onclick = function () { if (confirm('Erase ALL progress and settings on this phone? This cannot be undone.')) { localStorage.removeItem('morningfit.v1'); C.load(); S = C.S; applyTheme(); toast('Everything was reset'); go('today'); } };
    // voices can load late
  }

  /* ====================== SAFETY ====================== */
  function safetyHtml() {
    return '<h2>Before you start</h2>' +
      '<p>This is general fitness guidance. The cause of any back pain has not been assessed, and this app does not diagnose it or promise that exercise will fix it.</p>' +
      '<h3>Stop an exercise if</h3><ul><li>It makes your pain worse.</li><li>You feel pain, tingling or numbness going into a leg.</li><li>You feel sharp, new or lingering pain. Ordinary muscle tiredness is expected.</li></ul>' +
      '<h3>Modify before skipping</h3><ul><li>Use the <b>Easier</b> tip on each exercise.</li><li>Make the movement smaller, or squat to a higher chair.</li><li>Avoid full sit-ups and crunches. The curl-up here is a tiny lift.</li></ul>' +
      '<h3>See a doctor or physiotherapist if</h3><ul><li>Pain has not improved after a few weeks of home care, or it limits your day.</li></ul>' +
      '<h3 class="dangerh">Get urgent medical help straight away for</h3><ul><li>New bladder or bowel problems</li><li>Numbness around the genitals or buttocks</li><li>Pain shooting down both legs, or severe or worsening leg weakness</li><li>Fever, a history of cancer, or back pain after an injury</li></ul>' +
      '<p class="muted small">In India, go to an emergency department.</p>';
  }
  function openSafety(first) {
    var sh = sheet(safetyHtml() + '<div class="rowbtns"><button class="btn" id="ack">' + (first ? 'I understand — let\'s go' : 'Close') + '</button></div>', { tall: true, sticky: first });
    $('#ack', sh.root).onclick = function () { S.ack = true; C.save(); sh.close(); };
  }

  /* ====================== WORKOUT PLAYER ======================
   * Workout-first. An exercise never waits for the user:
   *   get-ready lead-in -> exercise -> rest, then "Next up ... 3-2-1" -> exercise -> ...
   * and it advances by itself. Voice, beeps and vibration are best-effort extras; nothing in here
   * waits for speech to finish, so a muted phone or a failed speech engine changes nothing.
   * Controls: Pause / Resume, Skip, Previous, End (on the pause screen). Instructions are optional. */
  function startWorkout(plan) {
    var built = C.buildSteps(plan);
    if (!built.steps.length) { toast('Nothing to do today.'); return; }
    SND.unlock(); V.warm(); C.WakeLock.on();
    var cum = [], tot = 0;
    built.steps.forEach(function (st) { var ex = built.insts[st.exi].ex; var e = st.kind === 'rest' ? st.secs : st.mode === 'reps' ? st.n * C.period(ex) : st.secs; cum.push(tot); tot += e; });
    RUN = { plan: plan, steps: built.steps, insts: built.insts, i: -1, step: null, paused: false, t: 0, tok: 0, active: 0, clock: 0,
      skipped: {}, done: {}, started: Date.now(), cum: cum, total: tot, lead: false, key: '' };
    buildRunnerDom();
    try { history.pushState({ run: 1 }, ''); } catch (e) {}
    RUN.stopAnim = addAnim(runTick);
    enter(0);
  }

  function buildRunnerDom() {
    var r = document.createElement('div'); r.id = 'runner'; r.className = 'runner';
    r.innerHTML =
      '<div class="rtop"><button class="ic" id="rClose" aria-label="Pause. End workout is on the pause screen">' + ico('close') + '</button><div class="rprog"><div class="rbar" id="rBar"></div></div><button class="ic" id="rMute" aria-label="Voice on or off"></button></div>' +
      '<div class="rblock" id="rBlock"></div>' +
      '<div class="rstage" id="rStage"><button class="rinstr" id="rHow" aria-label="Instructions">' + ico('info', 'sm') + '<span>Instructions</span></button></div>' +
      '<div class="rinfo"><div class="eyebrow" id="rArea"></div><h2 id="rName"></h2><div class="sub" id="rSub"></div>' +
      '<div class="rmain" id="rMain"></div><div class="rcue" id="rCue"></div></div>' +
      '<div class="rctrl"><button class="rc" id="rPrev" aria-label="Previous exercise"><span>' + ico('prev') + '</span><small>Previous</small></button>' +
      '<button class="rc big" id="rPause" aria-label="Pause"><span>' + ico('pause') + '</span><small>Pause</small></button>' +
      '<button class="rc" id="rSkip" aria-label="Skip this exercise"><span>' + ico('skip') + '</span><small>Skip</small></button></div>' +
      '<div class="pauseov" id="rPaused" hidden role="dialog" aria-label="Workout paused"><div>Paused</div><button class="btn" id="rResume">' + ico('play') + 'Resume</button><button class="ghost" id="rEnd">End workout</button></div>';
    document.body.appendChild(r);
    document.body.classList.add('running');
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'fig');
    var stage = $('#rStage', r); stage.insertBefore(svg, stage.firstChild);
    RUN.fig = Figure.create(svg); RUN.fig.label(false);   // the player already names the muscles above the exercise name
    $('#rClose').onclick = function () { pause(); };           // shows the pause screen, which holds End workout
    $('#rMute').onclick = function () { S.settings.voice = !S.settings.voice; C.save(); if (!S.settings.voice) V.cancel(); muteIcon(); };
    $('#rPause').onclick = function () { RUN.paused ? resume() : pause(); };
    $('#rResume').onclick = resume;
    $('#rEnd').onclick = function () { finish(false); };
    $('#rSkip').onclick = skip;
    $('#rPrev').onclick = previous;
    $('#rHow').onclick = openInstructions;
    muteIcon();
  }
  function muteIcon() { var b = $('#rMute'), on = S.settings.voice && V.ok; if (b) { b.innerHTML = ico(on ? 'volume' : 'mute'); b.setAttribute('aria-label', on ? 'Voice on. Tap to mute' : 'Voice off. Tap to turn on'); } }
  function pauseBtn(p) { var b = $('#rPause'); b.firstChild.innerHTML = ico(p ? 'play' : 'pause'); b.lastChild.textContent = p ? 'Resume' : 'Pause'; b.setAttribute('aria-label', p ? 'Resume' : 'Pause'); }
  /* progress ring around the big number */
  var RING = 2 * Math.PI * 52;
  function mkRing() {
    $('#rMain').innerHTML = '<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rt" cx="60" cy="60" r="52"/><circle class="rp" id="rRing" cx="60" cy="60" r="52" transform="rotate(-90 60 60)"/></svg><div class="rnum"><div class="big-num" id="rNum"></div><div class="rlbl" id="rLbl"></div></div></div>';
    RUN.numKey = null; ringTo(0);
  }
  function setMain(num, label) { var k = num + '|' + label; if (RUN.numKey === k) return; RUN.numKey = k; var n = $('#rNum'); if (n) { n.innerHTML = num; $('#rLbl').textContent = label; } }
  function ringTo(f) { var r = $('#rRing'); if (r) r.style.strokeDashoffset = (RING * (1 - Math.max(0, Math.min(1, f)))).toFixed(1); }

  /* ---- state machine ----
   * leadSecs (Skip / Previous): start the transition at its last few seconds, so jumping to another
   * exercise gives a quick "Next up ... 3-2-1" instead of repeating a long rest. */
  function enter(i, leadSecs) {
    var prev = RUN.step;
    // an exercise counts as done once we move forward past it (moving back never marks anything done)
    if (prev && RUN.steps[i] && RUN.steps[i].exi > prev.exi && !RUN.skipped[prev.exi]) RUN.done[prev.exi] = 1;
    RUN.i = i; RUN.step = RUN.steps[i]; RUN.t = 0; RUN.cnt = 99; RUN.reps = 0; RUN.flags = {}; RUN.lead = false; RUN.tok++;
    RUN.clock = 0;
    var st = RUN.step, inst = RUN.insts[st.exi];
    if (leadSecs && st.kind === 'rest') RUN.t = Math.max(0, st.secs - leadSecs);
    renderStep();
    if (st.kind === 'rest') startRest(st, inst, RUN.t > 0); else startWork(st, inst);
  }
  function goNext() { if (RUN.i + 1 >= RUN.steps.length) finish(true); else enter(RUN.i + 1); }

  /* ---- short spoken cues (all optional, none of them is ever waited for) ---- */
  function spokenTip(ex) { var d = S.settings.detail; return !!ins(ex).cue && (d === 'full' || (d === 'auto' && (S.counts[ex.id] || 0) < 3)); }
  function startRest(st, inst, brief) {
    var ex = inst.ex;
    if (brief) V.say(ex.name + '.');
    else if (st.why === 'start') V.say('Let us begin. Stop if you feel sharp pain.');
    else if (st.why === 'between') {
      V.say(st.secs <= 6 ? 'Next: ' + ex.name + '.' : 'Rest. Next up: ' + ex.name + '.');
      if (st.secs >= 8 && spokenTip(ex)) V.say(ins(ex).cue);
    } else if (st.why === 'switch') V.say(leftRight(ex) ? 'Switch sides. Now the ' + st.side + ' side.' : 'Now ' + st.side + '.');
    else V.say('Relax and breathe.');
  }
  function startWork(st, inst) {
    var ex = inst.ex;
    if (st.mode === 'reps') V.say(st.side && st.sideIdx === 0 ? 'Start with ' + (leftRight(ex) ? 'the ' + st.side + ' side' : st.side) + '. Begin.' : 'Begin.');
    else if (st.mode === 'hold') V.say(st.set === 1 && st.side && st.sideIdx === 0 ? 'Start with the ' + st.side + ' side. Hold.' : 'Hold.');
    else V.say(st.side && st.sideIdx === 0 ? 'Start with the ' + st.side + ' side. Begin.' : 'Begin.');
  }

  function runTick(dt) {
    if (!RUN) return;
    var st = RUN.step; if (!st) return;
    var inst = RUN.insts[st.exi], ex = inst.ex;
    if (!RUN.paused) RUN.clock += dt;
    drawStage(st, inst, ex);
    $('#rBar').style.width = Math.min(100, 100 * (RUN.cum[RUN.i] + (st.kind === 'work' && st.mode === 'reps' ? Math.min(RUN.t, st.n * C.period(ex)) : Math.min(RUN.t, st.secs))) / RUN.total) + '%';
    if (RUN.paused) return;
    RUN.t += dt; RUN.active += dt;
    if (st.kind === 'rest') {
      // rest, then the last 3 seconds become "Next up: <exercise>  3-2-1"; the exercise then starts by itself
      var rem = st.secs - RUN.t, n2 = Math.max(0, Math.ceil(rem)), lead = n2 <= 3;
      if (lead !== RUN.lead) { RUN.lead = lead; setTexts(restTexts(st, inst, lead)); }
      if (n2 !== RUN.cnt) {
        RUN.cnt = n2; setMain(n2, lead ? 'starting in' : 'seconds rest');
        if (lead && n2 > 0) { SND.beep(600, 0.08); if (st.why !== 'breathe') V.now(String(n2)); }
      }
      ringTo(RUN.t / st.secs);
      if (rem <= 0) { SND.beep(1000, 0.25, 0.18); SND.buzz(40); goNext(); }
    } else if (st.mode === 'reps') {
      var per = C.period(ex), cyc = Math.floor(RUN.t / per), u = (RUN.t % per) / per, f = ex.anim.down || 0.5;
      var cues = ins(ex).breathCues;
      if (cues && RUN.reps < 2) {
        if (!RUN.flags['a' + RUN.reps] && u >= 0.1 && u < 0.5) { RUN.flags['a' + RUN.reps] = 1; V.now(cues[0]); }
        if (!RUN.flags['b' + RUN.reps] && u >= f + 0.1) { RUN.flags['b' + RUN.reps] = 1; V.now(cues[1]); }
      }
      while (cyc > RUN.reps) {
        RUN.reps++;
        SND.buzz(25);
        if (RUN.reps >= st.n) { V.now(String(RUN.reps)); V.say('Done.'); SND.beep(900, 0.2, 0.16); SND.buzz([60, 40, 60]); goNext(); return; }
        V.now(RUN.reps === st.n - 1 ? RUN.reps + '. Last one.' : (RUN.reps === Math.floor(st.n / 2) && st.n >= 8 ? RUN.reps + '. Halfway.' : String(RUN.reps)));
      }
      setMain(RUN.reps + '<small> / ' + st.n + '</small>', 'reps done'); ringTo(RUN.t / (st.n * per));
    } else {
      var remain = st.secs - RUN.t, nn = Math.max(0, Math.ceil(remain));
      if (nn !== RUN.cnt) {
        RUN.cnt = nn;
        setMain(nn + '<small> s</small>', st.mode === 'hold' ? 'hold it steady' : 'keep going');
        if (nn <= 3 && nn > 0) { V.now(String(nn)); SND.beep(700, 0.08); }
        else if (st.secs >= 20 && nn === Math.round(st.secs / 2) && !RUN.flags.half) { RUN.flags.half = 1; V.now('Halfway.'); }
        else if (st.mode === 'time' && st.secs >= 45 && nn === 30) V.now('Thirty seconds left.');
        else if (st.mode === 'time' && st.secs >= 25 && nn === 10) V.now('Ten seconds.');
      }
      ringTo(RUN.t / st.secs);
      if (remain <= 0) { SND.beep(900, 0.25, 0.16); SND.buzz([60, 40, 60]); V.say(st.mode === 'hold' ? 'Relax.' : 'Good.'); goNext(); }
    }
  }

  function drawStage(st, inst, ex) {
    var mirror = (st.kind === 'work' || st.kind === 'rest') && st.why !== 'between' && (st.sideIdx || 0) === 1;
    var key = ex.id + (mirror ? 'm' : '');
    if (RUN.key !== key) { RUN.key = key; RUN.fig.setAnim(ex.anim, mirror); }
    var n = ex.anim.poses.length, opts;
    if (st.kind === 'work') {
      if (st.mode === 'reps') { var per = C.period(ex), u = (RUN.t % per) / per; if (ex.anim.reverseSide2 && st.sideIdx === 1) u = 1 - u; opts = { u: u }; }
      else if (ex.anim.dynamic) opts = { u: (RUN.t / C.period(ex)) % 1 };
      else { var f = Math.min(1, RUN.t / 1.2); opts = { pos: (0.5 - 0.5 * Math.cos(Math.PI * f)) * (n - 1), u: 0.25 }; }
    } else opts = { u: (RUN.clock / loopPeriod(ex)) % 1 };
    RUN.fig.show(opts);
  }

  /* What the big text says during a transition. In the last 3 seconds ("lead") it turns into
     "Next up: <exercise>" with the 3-2-1 countdown. */
  function restTexts(st, inst, lead) {
    var ex = inst.ex, dose = [];
    if (inst.rounds > 1) dose.push('Round ' + inst.round + ' of ' + inst.rounds);
    dose.push(C.doseText(ex, inst.entry));
    if (st.why === 'start') return lead ? { area: 'First up', title: ex.name, sub: dose.join(' · ') } : { area: '', title: 'Get ready', sub: 'First up: ' + ex.name };
    if (st.why === 'between') return lead ? { area: 'Next up', title: ex.name, sub: dose.join(' · ') } : { area: '', title: 'Rest', sub: 'Next up: ' + ex.name };
    if (st.why === 'switch') return { area: '', title: 'Switch sides', sub: 'Now: ' + (leftRight(ex) ? st.side + ' side' : st.side) };
    return { area: '', title: 'Breathe', sub: ex.name };
  }
  function setTexts(t) { var ar = $('#rArea'); ar.textContent = t.area; ar.classList.toggle('muscle', !!t.muscle); $('#rName').textContent = t.title; $('#rSub').textContent = t.sub; }

  function renderStep() {
    var st = RUN.step, inst = RUN.insts[st.exi], ex = inst.ex, sub = [];
    $('#rBlock').textContent = inst.block.title + ' · exercise ' + (st.exi + 1) + ' of ' + RUN.insts.length;
    if (st.kind === 'rest') {
      RUN.lead = st.secs - RUN.t <= 3;
      setTexts(restTexts(st, inst, RUN.lead));
    } else {
      if (inst.rounds > 1) sub.push('Round ' + inst.round + ' of ' + inst.rounds);
      if (st.side) sub.push(cap(leftRight(ex) ? st.side + ' side' : st.side));
      if (st.sets > 1) sub.push((st.mode === 'hold' ? 'Hold ' : 'Set ') + st.set + ' of ' + st.sets);
      setTexts({ area: muscleList(ex).join(' · '), muscle: true, title: ex.name, sub: sub.join(' · ') });
    }
    mkRing();
    // muscle overlay: tint the working body part while a set runs (the muscle names show above the exercise name)
    var z = st.kind === 'work' ? zonesOf(ex) : [], cls = RUN.fig.svg.classList;
    ['legs', 'torso', 'arms'].forEach(function (k) { cls.toggle('hl-' + k, z.indexOf(k) >= 0); });
    $('#rCue').textContent = st.kind === 'work' ? (ins(ex).cue || ins(ex).breathing || '') : st.why === 'start' ? 'Stop if you feel sharp pain, tingling or numbness.' : '';
    pauseBtn(false);
    RUN.cnt = 99;
  }

  /* Optional reading: pauses the workout while open and resumes when closed (if it was running). */
  function openInstructions() {
    if (!RUN || $('.backdrop')) return;
    var ex = RUN.insts[RUN.step.exi].ex, wasPaused = RUN.paused;
    pause(true);
    sheet('<h2>' + esc(ex.name) + '</h2>' + (wasPaused ? '' : '<p class="muted small">The workout is paused while this is open.</p>') + instrHtml(ex, RUN.insts[RUN.step.exi].entry) +
      '<div class="warn small">' + ico('warning', 'sm') + ' Stop if this causes sharp pain, or pain, tingling or numbness in your leg.</div>' +
      '<div class="rowbtns"><button class="btn" data-close>Back to workout</button></div>',
      { tall: true, onClose: function () { if (!wasPaused && RUN) resume(); } });
  }

  function pause(silent) {
    if (!RUN || RUN.paused) return;
    RUN.paused = true; V.cancel();
    if (!silent) $('#rPaused').hidden = false;
    pauseBtn(true);
  }
  function resume() {
    if (!RUN || !RUN.paused) return;
    RUN.paused = false; $('#rPaused').hidden = true;
    pauseBtn(false);
    SND.unlock();
  }
  function skip() {
    V.cancel(); var st = RUN.step;
    if (st.kind === 'rest') { goNext(); return; }           // skipping a rest = start now
    RUN.skipped[st.exi] = 1;
    var j = RUN.i + 1; while (j < RUN.steps.length && RUN.steps[j].exi <= st.exi) j++;
    if (j >= RUN.steps.length) { finish(true); return; }
    enter(j, 3);
  }
  function previous() {
    V.cancel();
    var st = RUN.step, target = Math.max(0, st.exi - 1), j = 0;   // on the first exercise this restarts it
    while (j < RUN.steps.length && RUN.steps[j].exi !== target) j++;
    delete RUN.skipped[target]; delete RUN.done[target];
    enter(j, 3);
  }

  function teardownRunner() {
    if (RUN && RUN.stopAnim) RUN.stopAnim();
    V.cancel(); C.WakeLock.off();
    var r = $('#runner'); if (r) r.remove();
    document.body.classList.remove('running');
    $$('.backdrop').forEach(function (b) { b.remove(); });
  }
  function finish(completed) {
    var run = RUN; if (!run) return;
    if (completed && !run.skipped[run.step.exi]) run.done[run.step.exi] = 1;
    var doneIds = Object.keys(run.done).map(function (k) { return run.insts[+k].ex.id; });
    var uniq = doneIds.filter(function (x, i) { return doneIds.indexOf(x) === i; });
    var entry = { date: C.dateKey(), ts: Date.now(), planId: run.plan.planId, day: run.plan.day, completed: completed, mins: Math.max(0.1, run.active / 60), done: uniq, skipped: Object.keys(run.skipped).map(function (k) { return run.insts[+k].ex.id; }) };
    teardownRunner(); RUN = null;
    if (!uniq.length && !completed) { go('today'); return; }
    if (completed) { SND.buzz([100, 60, 100]); V.say('Workout complete. Great job. Well done.'); }
    showSummary(entry);
  }

  function showSummary(entry) {
    var v = $('#view'); $('#nav').hidden = true;
    var form = null, extra = null, pain = null;
    var h = '<div class="summary"><div class="badge">' + ico('check') + '</div><h1>' + (entry.completed ? 'Workout complete!' : 'Ended early') + '</h1>' +
      '<p class="muted">' + Math.round(entry.mins) + ' min · ' + entry.done.length + ' exercises</p>' +
      '<ul class="donelist">' + entry.done.map(function (id) { var e = C.getEx(id); return '<li>' + ico('check', 'sm') + esc(e ? e.name : id) + '</li>'; }).join('') + '</ul>';
    if (entry.completed) {
      h += '<section class="card"><b>Did you finish every set with good form?</b><div class="seg" id="qForm" role="group" aria-label="Good form"><button data-v="1">Yes</button><button data-v="0">Not quite</button></div></section>' +
        '<section class="card"><b>Could you have done 2 or more extra reps?</b><div class="seg" id="qExtra" role="group" aria-label="Extra reps"><button data-v="1">Yes</button><button data-v="0">No</button></div></section>' +
        '<section class="card"><b>Back pain right now (0–10)</b><div class="painrow" id="qPain">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return '<button class="pn" data-p="' + i + '">' + i + '</button>'; }).join('') + '</div></section>';
    }
    h += '<div class="rowbtns"><button class="btn" id="sumSave">Save workout</button></div></div>';
    v.innerHTML = h;
    function seg(id, cb) { $$('#' + id + ' button').forEach(function (b) { b.onclick = function () { $$('#' + id + ' button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); cb(b.getAttribute('data-v')); }; }); }
    if (entry.completed) {
      seg('qForm', function (x) { form = x === '1'; }); seg('qExtra', function (x) { extra = x === '1'; });
      $$('#qPain .pn').forEach(function (b) { b.onclick = function () { $$('#qPain .pn').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); pain = +b.getAttribute('data-p'); }; });
    }
    $('#sumSave').onclick = function () {
      entry.form = form; entry.extra = extra; entry.painAfter = pain;
      S.history.push(entry);
      entry.done.forEach(function (id) { S.counts[id] = (S.counts[id] || 0) + 1; });
      C.save(); $('#nav').hidden = false; go('progress'); toast(entry.completed ? 'Saved. See you tomorrow!' : 'Saved');
    };
  }

  /* ====================== boot ====================== */
  function boot() {
    C.load(); S = C.S; V.init(); applyTheme(); Illus.female = S.settings.figure === 'f';
    $$('#nav button').forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-go')); }; });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (screen === 'today' && !RUN) refresh(); });
    window.addEventListener('appinstalled', function () { deferredInstall = null; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (RUN && !RUN.paused) pause(); }
      else if (RUN) C.WakeLock.on();
    });
    // Android back button during a workout: close an open sheet, otherwise pause (the pause screen has End workout)
    window.addEventListener('popstate', function () {
      if (!RUN) return;
      var b = $$('.backdrop').pop();
      if (b) b.click(); else pause();
      try { history.pushState({ run: 1 }, ''); } catch (e) {}
    });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var b = $('.backdrop'); if (b && !b.querySelector('#ack')) b.click(); } });
    go('today');
    requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });
    if (!S.ack) openSafety(true);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      var hadController = !!navigator.serviceWorker.controller, reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadController && !reloaded && !RUN) { reloaded = true; location.reload(); } });
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    window.__app = { go: go, startWorkout: startWorkout, get RUN() { return RUN; }, skip: skip, previous: previous, pause: pause, resume: resume };
  }
  function fail(e) {
    var v = document.getElementById('view');
    v.innerHTML = '<section class="card"><h2>Could not load the workout data</h2><p class="muted">' + esc(e && e.message) + '</p>' +
      '<p class="small">If you opened <code>index.html</code> straight from a folder, serve the folder over http instead (for example <code>npx serve</code>), or open the hosted address.</p>' +
      '<button class="btn small" id="retry">Try again</button></section>';
    document.getElementById('retry').onclick = function () { location.reload(); };
  }
  function start() { Catalog.load().then(boot, fail); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
