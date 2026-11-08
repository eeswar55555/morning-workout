/* app.js — screens and the workout player. */
(function () {
  'use strict';
  var C = Core, V = C.Voice, SND = C.Sound, S;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var screen = 'today', RUN = null, deferredInstall = null;

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
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
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

  /* ====================== navigation ====================== */
  function go(name) {
    screen = name; var v = $('#view');
    $$('#nav button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-go') === name); });
    ({ today: renderToday, library: renderLibrary, progress: renderProgress, settings: renderSettings })[name](v);
    v.scrollTop = 0; thumbs(v);
  }
  function refresh() { var v = $('#view'), st = v.scrollTop; ({ today: renderToday, library: renderLibrary, progress: renderProgress, settings: renderSettings })[screen](v); v.scrollTop = st; thumbs(v); }

  /* ====================== TODAY ====================== */
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function renderToday(v) {
    var key = C.dateKey(), plan = C.buildPlan(key), built = C.buildSteps(plan), mins = Math.max(1, Math.round(C.estimate(built) / 60));
    var L = C.level(), adv = C.advice(), done = C.sessions().some(function (h) { return h.date === key; });
    var dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    var h = '<header class="top"><div><h1>' + greeting() + '</h1><div class="muted">' + esc(dateStr) + '</div></div>' +
      '<div class="chips"><span class="chip">🔥 ' + C.streak() + ' day' + (C.streak() === 1 ? '' : 's') + '</span><span class="chip">Level ' + L.n + '</span></div></header>';
    if (deferredInstall) h += '<button class="install" id="installBtn">📲 Install on this phone</button>';
    if (plan.light) h += '<div class="card note"><b>Lighter day today</b><p>Warm-up, back stability and cool-down only. After that, take a gentle 20–30 minute walk.</p><button class="link" id="fullDay">Do the full routine instead</button></div>';
    else if (C.isLightDay(key) && S.plans[key] && S.plans[key].full) h += '<div class="card note"><p>Full routine chosen for your lighter day.</p><button class="link" id="lightDay">Back to the lighter day</button></div>';
    var pain = S.pain[key];
    h += '<section class="card"><div class="row"><b>How is your back this morning?</b><span class="muted small">optional · 0 = none, 10 = worst</span></div><div class="painrow" id="pain">';
    for (var i = 0; i <= 10; i++) h += '<button class="pn' + (pain === i ? ' on' : '') + '" data-p="' + i + '">' + i + '</button>';
    h += '</div></section>';
    h += '<div class="planhead"><h2>Today\'s plan</h2><span class="muted">about ' + mins + ' min</span></div>';
    plan.blocks.forEach(function (b) {
      var rounds = b.circuit ? L.rounds : 1;
      h += '<section class="card block"><div class="bt">' + esc(b.title) + (rounds > 1 ? ' <span class="muted">· ' + rounds + ' rounds</span>' : '') + '</div>';
      b.items.forEach(function (it) {
        var ex = C.getEx(it.id);
        h += '<div class="item">' + thumbHtml(ex.id) + '<div class="meta" data-open="' + esc(ex.id) + '"><div class="nm">' + esc(ex.name) + '</div><div class="muted small">' + esc(C.doseText(ex)) + '</div></div>' +
          (it.options.length > 1 ? '<button class="swap" data-swap="' + esc(it.key) + '" aria-label="Swap exercise" title="Swap for another exercise">⟳</button>' : '') + '</div>';
      });
      h += '</section>';
    });
    h += '<div class="rowbtns"><button class="ghost" id="shuf">🔀 Shuffle</button><button class="ghost" id="editPlan">✏️ Edit plan</button></div>';
    h += '<section class="card"><b>' + esc(L.title) + '</b><p class="small">' + esc(adv.text) + '</p>' +
      (adv.up ? '<button class="btn small" id="lvlUp">Move up to level ' + (S.level + 1) + '</button>' : '') +
      (adv.down ? '<button class="btn small alt" id="lvlDown">Drop back to level ' + (S.level - 1) + '</button>' : '') + '</section>';
    h += '<div class="spacer"></div>';
    h += '<div class="startbar"><button class="btn big" id="start">' + (done ? '▶ Do it again' : '▶ Start workout') + ' · ' + mins + ' min</button></div>';
    v.innerHTML = h;

    $('#start').onclick = function () { startWorkout(plan); };
    $$('#pain .pn').forEach(function (b) { b.onclick = function () { var p = +b.getAttribute('data-p'); if (S.pain[key] === p) delete S.pain[key]; else S.pain[key] = p; C.save(); refresh(); }; });
    $$('[data-swap]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-swap'); var it = null; plan.blocks.forEach(function (bl) { bl.items.forEach(function (i) { if (i.key === k) it = i; }); }); C.swap(key, k, it.options, it.id); refresh(); }; });
    $$('[data-open]').forEach(function (m) { m.onclick = function () { openDetail(m.getAttribute('data-open')); }; });
    $('#shuf').onclick = function () { C.shuffle(key); refresh(); toast('Mixed it up'); };
    $('#editPlan').onclick = openPlanEditor;
    var fd = $('#fullDay'); if (fd) fd.onclick = function () { C.buildPlan(key); S.plans[key].full = true; C.save(); refresh(); };
    var ld = $('#lightDay'); if (ld) ld.onclick = function () { S.plans[key].full = false; C.save(); refresh(); };
    var lu = $('#lvlUp'); if (lu) lu.onclick = function () { S.level++; C.save(); toast('Level ' + S.level + ' — nice work!'); refresh(); };
    var ldn = $('#lvlDown'); if (ldn) ldn.onclick = function () { S.level--; C.save(); refresh(); };
    var ib = $('#installBtn'); if (ib) ib.onclick = function () { deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; refresh(); }); };
  }

  /* ====================== exercise detail ====================== */
  function openDetail(id) {
    var ex = C.getEx(id); if (!ex) return;
    var d = C.dose(ex), ln = C.levelNote(ex), demo;
    var amount = ex.type === 'reps' ? 'Reps' : 'Seconds';
    var base = (S.dose[ex.id] && S.dose[ex.id].n != null) ? S.dose[ex.id].n : (ex.type === 'reps' ? ex.reps : ex.secs);
    var h = '<div class="demo" id="demoBox"></div><h2>' + esc(ex.name) + '</h2><div class="muted">' + esc(ex.area || '') + ' · ' + esc(C.doseText(ex, d)) + '</div>' +
      '<div class="rowbtns"><button class="btn small" id="hear">🔊 Hear instructions</button></div>' +
      '<h3>How to do it</h3><ol class="steps">' + (ex.steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      (ex.breath ? '<p><b>Breathing:</b> ' + esc(ex.breath) + '</p>' : '') +
      (ex.mistake ? '<p><b>Avoid:</b> ' + esc(ex.mistake) + '</p>' : '') +
      (ex.easier ? '<p class="tip"><b>Easier:</b> ' + esc(ex.easier) + '</p>' : '') +
      (ln ? '<p class="tip"><b>At your level:</b> ' + esc(ln) + '</p>' : '') +
      '<div class="warn small">⚠ Stop if this causes sharp pain, or pain, tingling or numbness in your leg.</div>' +
      '<label class="field">Your ' + amount.toLowerCase() + ' (starting amount)<input type="number" inputmode="numeric" min="1" max="120" id="amt" value="' + base + '"></label>' +
      '<div class="rowbtns">' + (ex.isCustom ? '<button class="ghost danger" id="delEx">Delete exercise</button>' : '') + '<button class="btn small" data-close>Done</button></div>';
    var sh = sheet(h, { tall: true, onClose: function () { demo && demo.stop(); V.cancel(); } });
    demo = mountDemo($('#demoBox', sh.root), ex);
    $('#hear', sh.root).onclick = function () {
      if (!V.enabled()) { toast('Voice is off. Turn it on in Settings.'); return; }
      V.cancel(); V.seq([ex.name + '.'].concat(ex.steps || [], ex.breath ? [ex.breath] : []));
    };
    $('#amt', sh.root).onchange = function () {
      var n = Math.max(1, Math.min(120, parseInt(this.value, 10) || 1));
      if (n === (ex.type === 'reps' ? ex.reps : ex.secs)) delete S.dose[ex.id]; else S.dose[ex.id] = { n: n };
      C.save(); refresh();
    };
    var del = $('#delEx', sh.root);
    if (del) del.onclick = function () {
      if (!confirm('Delete "' + ex.name + '"?')) return;
      S.custom = S.custom.filter(function (c) { return c.id !== ex.id; });
      removeFromRoutine(ex.id); C.invalidate(); C.save(); sh.close(); refresh();
    };
  }
  function resetSwaps() { Object.keys(S.plans).forEach(function (k) { S.plans[k].swaps = {}; }); }
  function removeFromRoutine(id) {
    if (!S.routine) S.routine = C.clone(window.ROUTINE);
    S.routine.blocks.forEach(function (b) { b.items.forEach(function (it) { it.pick = it.pick.filter(function (x) { return x !== id; }); }); b.items = b.items.filter(function (it) { return it.pick.length; }); });
  }

  /* ====================== LIBRARY ====================== */
  function renderLibrary(v) {
    var all = C.lib();
    var h = '<header class="top"><div><h1>Exercises</h1><div class="muted">Tap one to watch it. Switch off any you do not want in your plan.</div></div></header>' +
      '<button class="btn" id="addEx">＋ Add my own exercise</button><div class="liblist">';
    all.forEach(function (ex) {
      h += '<div class="item lib">' + thumbHtml(ex.id) + '<div class="meta" data-open="' + esc(ex.id) + '"><div class="nm">' + esc(ex.name) + '</div><div class="muted small">' + esc(ex.area || '') + ' · ' + esc(C.doseText(ex)) + '</div></div>' +
        '<label class="switch" title="Use in my plan"><input type="checkbox" data-en="' + esc(ex.id) + '"' + (S.disabled[ex.id] ? '' : ' checked') + '><span></span></label></div>';
    });
    h += '</div><p class="muted small">New exercises can also be added by editing <code>exercises.js</code> — see README.</p>';
    v.innerHTML = h;
    $('#addEx').onclick = openCustomForm;
    $$('[data-open]', v).forEach(function (m) { m.onclick = function () { openDetail(m.getAttribute('data-open')); }; });
    $$('[data-en]', v).forEach(function (c) { c.onchange = function () { var id = c.getAttribute('data-en'); if (c.checked) delete S.disabled[id]; else S.disabled[id] = 1; C.save(); }; });
  }

  function openCustomForm() {
    var opts = window.EXERCISES.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.name) + '</option>'; }).join('');
    var h = '<h2>Add my own exercise</h2>' +
      '<label class="field">Name<input id="cName" placeholder="e.g. Standing quad stretch" maxlength="60"></label>' +
      '<label class="field">Type<select id="cType"><option value="reps">Reps (counted for you)</option><option value="hold">Hold (timed holds)</option><option value="time">Timed (seconds in total)</option></select></label>' +
      '<label class="field">Amount (reps or seconds)<input id="cAmt" type="number" inputmode="numeric" value="10" min="1" max="120"></label>' +
      '<label class="check"><input type="checkbox" id="cSides"> Do it on both sides</label>' +
      '<label class="field">Which picture looks most like it?<select id="cLooks">' + opts + '</select></label>' +
      '<label class="field">Instructions (one step per line — they are read aloud)<textarea id="cSteps" rows="4" placeholder="Stand tall.&#10;Hold your ankle behind you."></textarea></label>' +
      '<label class="field">Add it to my plan in<select id="cBlock"><option value="">(not now)</option>' + C.routine().blocks.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.title) + '</option>'; }).join('') + '</select></label>' +
      '<div class="rowbtns"><button class="ghost" data-close>Cancel</button><button class="btn small" id="cSave">Save</button></div>';
    var sh = sheet(h, { tall: true });
    $('#cSave', sh.root).onclick = function () {
      var name = $('#cName', sh.root).value.trim();
      if (!name) { toast('Please give it a name'); return; }
      var type = $('#cType', sh.root).value, n = Math.max(1, parseInt($('#cAmt', sh.root).value, 10) || 10);
      var steps = $('#cSteps', sh.root).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var ex = { id: 'my-' + Date.now().toString(36), name: name, type: type, looks: $('#cLooks', sh.root).value, steps: steps.length ? steps : [name + '.'], sides: $('#cSides', sh.root).checked || undefined, tempo: 4 };
      if (type === 'reps') ex.reps = n; else ex.secs = n;
      if (type === 'hold') ex.holds = 2;
      S.custom.push(ex); C.invalidate();
      var bid = $('#cBlock', sh.root).value;
      if (bid) { if (!S.routine) S.routine = C.clone(window.ROUTINE); S.routine.blocks.forEach(function (b) { if (b.id === bid) b.items.push({ pick: [ex.id] }); }); }
      C.save(); sh.close(); toast('Added'); refresh();
    };
  }

  /* ====================== PLAN EDITOR ====================== */
  function openPlanEditor() {
    var sh = sheet('<div id="peBody"></div>', { tall: true, onClose: refresh });
    function draw() {
      var R = S.routine || C.clone(window.ROUTINE), h = '<h2>Edit my plan</h2><p class="muted small">Each line is one slot in your routine. Give a slot several exercises and the app rotates through them day by day, so your workout keeps changing.</p>';
      R.blocks.forEach(function (b, bi) {
        h += '<div class="pe-block"><div class="bt">' + esc(b.title) + '</div>';
        b.items.forEach(function (it, ii) {
          h += '<div class="pe-row"><div class="pe-names">' + it.pick.map(function (id) { var e = C.getEx(id); return esc(e ? e.name : id); }).join(' <span class="muted">/</span> ') +
            (it.pick.length > 1 ? ' <span class="chip tiny">rotates</span>' : '') + '</div>' +
            '<button class="ic" data-up="' + bi + ':' + ii + '" aria-label="Move up">↑</button><button class="ic" data-dn="' + bi + ':' + ii + '" aria-label="Move down">↓</button>' +
            '<button class="ic" data-ed="' + bi + ':' + ii + '" aria-label="Change">✎</button><button class="ic" data-rm="' + bi + ':' + ii + '" aria-label="Remove">✕</button></div>';
        });
        h += '<button class="link" data-add="' + bi + '">＋ Add exercise to ' + esc(b.title.toLowerCase()) + '</button></div>';
      });
      h += '<div class="rowbtns"><button class="ghost" id="peReset">Reset to the original plan</button><button class="btn small" data-close>Done</button></div>';
      $('#peBody', sh.root).innerHTML = h;
      $$('[data-close]', sh.root).forEach(function (b) { b.onclick = sh.close; });
      function ed() { if (!S.routine) S.routine = C.clone(window.ROUTINE); return S.routine; }
      function pos(a) { var p = a.split(':'); return [+p[0], +p[1]]; }
      $$('[data-up]', sh.root).forEach(function (b) { b.onclick = function () { var p = pos(b.getAttribute('data-up')), it = ed().blocks[p[0]].items; if (p[1] > 0) { var t = it[p[1]]; it[p[1]] = it[p[1] - 1]; it[p[1] - 1] = t; C.save(); draw(); } }; });
      $$('[data-dn]', sh.root).forEach(function (b) { b.onclick = function () { var p = pos(b.getAttribute('data-dn')), it = ed().blocks[p[0]].items; if (p[1] < it.length - 1) { var t = it[p[1]]; it[p[1]] = it[p[1] + 1]; it[p[1] + 1] = t; C.save(); draw(); } }; });
      $$('[data-rm]', sh.root).forEach(function (b) { b.onclick = function () { var p = pos(b.getAttribute('data-rm')); ed().blocks[p[0]].items.splice(p[1], 1); resetSwaps(); C.save(); draw(); }; });
      $$('[data-ed]', sh.root).forEach(function (b) { b.onclick = function () { var p = pos(b.getAttribute('data-ed')); pickExercises(ed().blocks[p[0]].items[p[1]].pick, function (list) { if (list.length) ed().blocks[p[0]].items[p[1]].pick = list; else ed().blocks[p[0]].items.splice(p[1], 1); resetSwaps(); C.save(); draw(); }); }; });
      $$('[data-add]', sh.root).forEach(function (b) { b.onclick = function () { var bi = +b.getAttribute('data-add'); pickExercises([], function (list) { if (list.length) { ed().blocks[bi].items.push({ pick: list }); resetSwaps(); C.save(); draw(); } }); }; });
      $('#peReset', sh.root).onclick = function () { if (confirm('Go back to the original plan?')) { S.routine = null; resetSwaps(); C.save(); draw(); } };
    }
    draw();
  }
  function pickExercises(current, done) {
    var h = '<h2>Choose exercises</h2><p class="muted small">Tick one for a fixed exercise, or several to rotate between them.</p><div class="pick">';
    C.lib().forEach(function (e) {
      h += '<label class="item lib">' + thumbHtml(e.id) + '<div class="meta"><div class="nm">' + esc(e.name) + '</div><div class="muted small">' + esc(e.area || '') + '</div></div><span class="switch"><input type="checkbox" value="' + esc(e.id) + '"' + (current.indexOf(e.id) >= 0 ? ' checked' : '') + '><span></span></span></label>';
    });
    h += '</div><div class="rowbtns"><button class="ghost" data-close>Cancel</button><button class="btn small" id="pkOk">Save</button></div>';
    var sh = sheet(h, { tall: true });
    $('#pkOk', sh.root).onclick = function () { var list = $$('input:checked', sh.root).map(function (i) { return i.value; }); sh.close(); done(list); };
  }

  /* ====================== PROGRESS ====================== */
  function renderProgress(v) {
    var ss = C.sessions(), today = C.dateKey(), L = C.level();
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
    h += '<section class="card"><b>' + esc(L.title) + '</b><p class="small">' + esc(C.advice().text) + '</p><label class="field">Your level<select id="lvlSel">' + C.routine().levels.map(function (l) { return '<option value="' + l.n + '"' + (l.n === S.level ? ' selected' : '') + '>' + esc(l.title) + '</option>'; }).join('') + '</select></label></section>';
    // exercise progress
    var rows = C.lib().filter(function (e) { return S.counts[e.id]; }).sort(function (a, b) { return S.counts[b.id] - S.counts[a.id]; });
    h += '<section class="card"><b>Exercises you have done</b>';
    if (!rows.length) h += '<p class="muted small">Finish a workout and your exercises appear here.</p>';
    rows.forEach(function (e) { h += '<div class="prow"><span>' + esc(e.name) + '</span><span class="muted">' + S.counts[e.id] + '× · now ' + esc(C.doseText(e)) + '</span></div>'; });
    h += '</section>';
    // history
    h += '<section class="card"><b>History</b>';
    var hist = S.history.slice().reverse().slice(0, 30);
    if (!hist.length) h += '<p class="muted small">No workouts yet. Your first one is waiting on the Today tab.</p>';
    hist.forEach(function (x) {
      var dt = C.parseKey(x.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      h += '<div class="hrow"><div><b>' + esc(dt) + '</b><div class="muted small">Level ' + x.level + ' · ' + Math.round(x.mins || 0) + ' min · ' + (x.done ? x.done.length : 0) + ' exercises' + (x.completed ? '' : ' · ended early') + (x.painAfter != null ? ' · back ' + x.painAfter + '/10' : '') + '</div></div>' +
        (x.form === true ? '<span class="chip tiny ok">good form</span>' : '') + '</div>';
    });
    h += '</section><div class="rowbtns"><button class="ghost" id="exp">⬇ Save a backup</button><button class="ghost" id="imp">⬆ Restore backup</button></div><input type="file" id="impFile" accept="application/json" hidden>';
    v.innerHTML = h;
    $('#lvlSel').onchange = function () { S.level = +this.value; C.save(); refresh(); };
    $('#exp').onclick = function () {
      var blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'morning-workout-backup-' + C.dateKey() + '.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    };
    $('#imp').onclick = function () { $('#impFile').click(); };
    $('#impFile').onchange = function () {
      var f = this.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () { try { var o = JSON.parse(r.result); if (!o || !o.history) throw 0; localStorage.setItem('morningfit.v1', JSON.stringify(o)); C.load(); S = C.S; C.invalidate(); toast('Backup restored'); refresh(); } catch (e) { toast('That file is not a valid backup'); } };
      r.readAsText(f);
    };
  }

  /* ====================== SETTINGS ====================== */
  function renderSettings(v) {
    var st = S.settings;
    var h = '<header class="top"><div><h1>Settings</h1></div></header>';
    h += '<section class="card"><b>Voice</b>' +
      '<label class="check"><input type="checkbox" id="sVoice"' + (st.voice ? ' checked' : '') + '> Speak instructions and count reps</label>' +
      (V.ok ? '' : '<p class="warn small">This browser has no built-in voice. Use Chrome on Android.</p>') +
      '<label class="field">Speaking speed: <b id="rv">' + st.rate.toFixed(2) + '×</b><input type="range" id="sRate" min="0.7" max="1.3" step="0.05" value="' + st.rate + '"></label>' +
      '<label class="field">How much to explain<select id="sDetail"><option value="auto"' + (st.detail === 'auto' ? ' selected' : '') + '>Full the first 3 times, then short</option><option value="full"' + (st.detail === 'full' ? ' selected' : '') + '>Always full</option><option value="short"' + (st.detail === 'short' ? ' selected' : '') + '>Always short</option></select></label>' +
      '<button class="ghost" id="sTest">🔊 Test voice</button></section>';
    h += '<section class="card"><b>Workout</b>' +
      '<label class="field">Rep speed<select id="sPace"><option value="1.25"' + (st.pace === 1.25 ? ' selected' : '') + '>Slower</option><option value="1"' + (st.pace === 1 ? ' selected' : '') + '>Normal</option><option value="0.8"' + (st.pace === 0.8 ? ' selected' : '') + '>Faster</option></select></label>' +
      '<label class="field">Rest between strength exercises: <b id="rr">' + (st.restStrength || 15) + ' s</b><input type="range" id="sRest" min="10" max="30" step="5" value="' + (st.restStrength || 15) + '"></label>' +
      '<label class="field">Lighter day of the week<select id="sLight">' + DAYS.map(function (d, i) { return '<option value="' + i + '"' + (+st.lightDay === i ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">Usual morning back pain (0–10)<input type="number" id="sBase" min="0" max="10" inputmode="numeric" placeholder="auto" value="' + (st.basePain == null ? '' : st.basePain) + '"></label>' +
      '<label class="check"><input type="checkbox" id="sBeep"' + (st.beep ? ' checked' : '') + '> Beeps for countdowns</label>' +
      '<label class="check"><input type="checkbox" id="sVib"' + (st.vibrate ? ' checked' : '') + '> Vibrate when a set ends</label>' +
      '<label class="field">Theme<select id="sTheme"><option value="auto"' + (st.theme === 'auto' ? ' selected' : '') + '>Match my phone</option><option value="light"' + (st.theme === 'light' ? ' selected' : '') + '>Light</option><option value="dark"' + (st.theme === 'dark' ? ' selected' : '') + '>Dark</option></select></label></section>';
    h += '<section class="card"><b>Safety</b><p class="small">This is general fitness guidance, not medical advice.</p><button class="ghost" id="sSafety">Read the safety guidance</button></section>';
    h += '<section class="card"><b>Install</b><p class="small">In Chrome on Android: tap ⋮ and choose <b>Add to Home screen</b> (or <b>Install app</b>). It then opens full screen and works with no internet.</p>' +
      (deferredInstall ? '<button class="btn small" id="sInstall">📲 Install now</button>' : '') + '</section>';
    h += '<section class="card"><b>Start over</b><button class="ghost danger" id="sReset">Erase all progress on this phone</button></section>';
    h += '<p class="muted small center">Morning Workout · everything stays on your phone</p>';
    v.innerHTML = h;
    var save = function () { C.save(); };
    $('#sVoice').onchange = function () { st.voice = this.checked; save(); };
    $('#sRate').oninput = function () { st.rate = +this.value; $('#rv').textContent = st.rate.toFixed(2) + '×'; save(); };
    $('#sDetail').onchange = function () { st.detail = this.value; save(); };
    $('#sTest').onclick = function () { SND.unlock(); V.warm(); if (!V.enabled()) toast('Voice is off'); else V.now('Good morning. Let us get moving. Chair sit to stand. Eight reps.'); };
    $('#sPace').onchange = function () { st.pace = +this.value; save(); };
    $('#sRest').oninput = function () { st.restStrength = +this.value; $('#rr').textContent = st.restStrength + ' s'; save(); };
    $('#sLight').onchange = function () { st.lightDay = +this.value; save(); };
    $('#sBase').onchange = function () { st.basePain = this.value === '' ? null : Math.max(0, Math.min(10, +this.value)); save(); };
    $('#sBeep').onchange = function () { st.beep = this.checked; save(); };
    $('#sVib').onchange = function () { st.vibrate = this.checked; save(); };
    $('#sTheme').onchange = function () { st.theme = this.value; save(); applyTheme(); };
    $('#sSafety').onclick = function () { openSafety(false); };
    var si = $('#sInstall'); if (si) si.onclick = function () { deferredInstall.prompt(); };
    $('#sReset').onclick = function () { if (confirm('Erase ALL workouts, settings and custom exercises on this phone? This cannot be undone.')) { localStorage.removeItem('morningfit.v1'); C.load(); S = C.S; C.invalidate(); applyTheme(); toast('Everything was reset'); go('today'); } };
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

  /* ====================== WORKOUT PLAYER ====================== */
  function startWorkout(plan) {
    var built = C.buildSteps(plan);
    if (!built.steps.length) { toast('Nothing in the plan. Add exercises first.'); return; }
    SND.unlock(); V.warm(); C.WakeLock.on();
    var cum = [], tot = 0;
    built.steps.forEach(function (st) { var ex = built.insts[st.exi].ex; var e = st.kind === 'intro' ? 14 : st.kind === 'rest' ? st.secs : st.mode === 'reps' ? st.n * C.period(ex) : st.secs; cum.push(tot); tot += e; });
    RUN = { plan: plan, steps: built.steps, insts: built.insts, i: -1, step: null, paused: false, t: 0, tok: 0, active: 0, clock: 0,
      skipped: {}, done: {}, started: Date.now(), cum: cum, total: tot, firstIntro: true, phase: null, key: '' };
    buildRunnerDom();
    try { history.pushState({ run: 1 }, ''); } catch (e) {}
    RUN.stopAnim = addAnim(runTick);
    enter(0);
  }

  function buildRunnerDom() {
    var r = document.createElement('div'); r.id = 'runner'; r.className = 'runner';
    r.innerHTML =
      '<div class="rtop"><button class="ic" id="rClose" aria-label="Stop workout">✕</button><div class="rprog"><div class="rbar" id="rBar"></div></div><button class="ic" id="rMute" aria-label="Voice on or off"></button></div>' +
      '<div class="rblock" id="rBlock"></div>' +
      '<div class="rstage" id="rStage"></div>' +
      '<div class="rinfo"><h2 id="rName"></h2><div class="sub" id="rSub"></div>' +
      '<div class="rscroll" id="rScroll"><div class="rmain" id="rMain"></div><ol class="rsteps" id="rSteps"></ol><div class="rcue" id="rCue"></div>' +
      '<button class="btn small" id="rGo" hidden></button></div></div>' +
      '<div class="rctrl"><button class="rc" id="rRepeat" aria-label="Repeat this exercise"><span>⟲</span><small>Repeat</small></button>' +
      '<button class="rc big" id="rPause" aria-label="Pause"><span>⏸</span><small>Pause</small></button>' +
      '<button class="rc" id="rSkip" aria-label="Skip this exercise"><span>⏭</span><small>Skip</small></button></div>' +
      '<div class="rlinks"><button class="link" id="rHow">How to do it</button><button class="link" id="rSafe">⚠ Safety</button></div>' +
      '<div class="pauseov" id="rPaused" hidden><div>Paused</div><button class="btn" id="rResume">▶ Resume</button><button class="ghost" id="rEnd">End workout</button></div>';
    document.body.appendChild(r);
    document.body.classList.add('running');
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'fig'); $('#rStage', r).appendChild(svg);
    RUN.fig = Figure.create(svg);
    $('#rClose').onclick = function () { pause(true); askStop(); };
    $('#rMute').onclick = function () { S.settings.voice = !S.settings.voice; C.save(); if (!S.settings.voice) V.cancel(); muteIcon(); if (RUN.step && RUN.step.kind === 'intro') enter(RUN.i); };
    $('#rPause').onclick = function () { RUN.paused ? resume() : pause(); };
    $('#rResume').onclick = resume;
    $('#rEnd').onclick = askStop;
    $('#rSkip').onclick = skip;
    $('#rRepeat').onclick = repeat;
    $('#rGo').onclick = function () { if (RUN.step.kind === 'intro' && RUN.phase !== 'count') { V.cancel(); beginCount(); } };
    $('#rHow').onclick = function () { pause(); var ex = RUN.insts[RUN.step.exi].ex; var sh = sheet('<h2>' + esc(ex.name) + '</h2><ol class="steps">' + ex.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol><p><b>Breathing:</b> ' + esc(ex.breath || '') + '</p>' + (ex.mistake ? '<p><b>Avoid:</b> ' + esc(ex.mistake) + '</p>' : '') + (ex.easier ? '<p class="tip"><b>Easier:</b> ' + esc(ex.easier) + '</p>' : '') + '<div class="rowbtns"><button class="btn small" data-close>Back to workout</button></div>', { tall: true, onClose: function () { /* stays paused */ } }); };
    $('#rSafe').onclick = function () { pause(); sheet(safetyHtml() + '<div class="rowbtns"><button class="btn small" data-close>Back to workout</button></div>', { tall: true }); };
    muteIcon();
  }
  function muteIcon() { var b = $('#rMute'); if (b) b.textContent = S.settings.voice && V.ok ? '🔊' : '🔇'; }

  function exName(i) { return RUN.insts[i].ex.name; }

  /* ---- build the spoken script for an exercise ---- */
  function introScript(inst, first) {
    var ex = inst.ex, d = C.dose(ex), st = S.settings, out = [], offset = 0;
    var full = st.detail === 'full' || (st.detail === 'auto' && (S.counts[ex.id] || 0) < 3);
    if (first) { out.push('Let us begin. If you feel sharp pain, tingling or numbness, stop and rest.'); }
    var head = (inst.rounds > 1 ? 'Round ' + inst.round + ' of ' + inst.rounds + '. ' : '') + ex.name + '. ' + C.spokenDose(ex, d) + '.';
    out.push(head);
    offset = out.length;
    if (full) {
      ex.steps.forEach(function (s) { out.push(s); });
      if (ex.breath) out.push(ex.breath);
      var ln = C.levelNote(ex); if (ln) out.push('At your level: ' + ln);
    } else if (ex.cue) out.push(ex.cue);
    out.push('Get ready.');
    return { list: out, offset: offset, full: full, nSteps: full ? ex.steps.length : 0 };
  }

  /* ---- state machine ---- */
  function enter(i) {
    var prev = RUN.step;
    if (prev && RUN.steps[i] && RUN.steps[i].exi !== prev.exi && !RUN.skipped[prev.exi]) RUN.done[prev.exi] = 1;
    RUN.i = i; RUN.step = RUN.steps[i]; RUN.t = 0; RUN.cnt = 99; RUN.reps = 0; RUN.flags = {}; RUN.phase = null; RUN.tok++;
    RUN.clock = 0;
    var st = RUN.step, inst = RUN.insts[st.exi];
    renderStep();
    if (st.kind === 'intro') startIntro(inst);
    else if (st.kind === 'rest') startRest(st, inst);
    else startWork(st, inst);
  }
  function goNext() { if (RUN.i + 1 >= RUN.steps.length) finish(true); else enter(RUN.i + 1); }

  function startIntro(inst) {
    var sc = RUN.script = introScript(inst, RUN.firstIntro);
    RUN.firstIntro = false;
    RUN.speakFrom = 0;
    renderSteps(sc);
    if (V.enabled()) { RUN.phase = 'speak'; speakIntro(); }
    else { RUN.phase = 'wait'; $('#rGo').hidden = false; $('#rGo').textContent = "I'm ready — start"; }
    if (V.enabled()) { $('#rGo').hidden = false; $('#rGo').textContent = 'Skip instructions'; }
  }
  function speakIntro() {
    var tok = RUN.tok, sc = RUN.script;
    V.seq(sc.list, RUN.speakFrom, function (i) {
      RUN.speakFrom = i;
      var li = $$('#rSteps li'); li.forEach(function (x) { x.classList.remove('now'); });
      var idx = i - sc.offset; if (sc.full && idx >= 0 && li[idx]) { li[idx].classList.add('now'); li[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }).then(function (ok) { if (ok && tok === RUN.tok && !RUN.paused && RUN.phase === 'speak') beginCount(); });
  }
  function beginCount() { RUN.phase = 'count'; RUN.t = 0; RUN.cnt = 99; $('#rGo').hidden = true; $('#rSteps').hidden = true; $$('#rSteps li').forEach(function (x) { x.classList.remove('now'); }); }

  function startRest(st, inst) {
    if (st.why === 'between') V.say(st.secs <= 6 ? 'Next: ' + inst.ex.name + '.' : 'Rest. Next up: ' + inst.ex.name + '.');
    else if (st.why === 'switch') {
      var ex = inst.ex;
      V.say(ex.sides === true ? 'Switch sides. Now the ' + st.side + ' side.' : 'Now ' + st.side + '.');
    } else V.say('Relax and breathe.');
  }
  function startWork(st, inst) {
    var ex = inst.ex;
    if (st.mode === 'reps') V.say(st.side && st.sideIdx === 0 ? 'Start with ' + (ex.sides === true ? 'the ' + st.side + ' side' : st.side) + '. Go.' : 'Go.');
    else if (st.mode === 'hold') V.say(st.set === 1 && st.side && st.sideIdx === 0 ? 'Start with the ' + st.side + ' side. Hold.' : 'Hold.');
    else V.say(st.side && st.sideIdx === 0 ? 'Start with the ' + st.side + ' side. Go.' : 'Go.');
  }

  function runTick(dt) {
    if (!RUN) return;
    var st = RUN.step; if (!st) return;
    var inst = RUN.insts[st.exi], ex = inst.ex;
    if (!RUN.paused) RUN.clock += dt;
    drawStage(st, inst, ex);
    $('#rBar').style.width = Math.min(100, 100 * (RUN.cum[RUN.i] + (st.kind === 'work' && st.mode === 'reps' ? Math.min(RUN.t, st.n * C.period(ex)) : st.kind === 'rest' || st.kind === 'work' ? Math.min(RUN.t, st.secs) : 0)) / RUN.total) + '%';
    if (RUN.paused) return;
    RUN.t += dt; RUN.active += dt;
    var main = $('#rMain');
    if (st.kind === 'intro') {
      if (RUN.phase === 'count') {
        var left = 3 - RUN.t, n = Math.ceil(left);
        if (n !== RUN.cnt && n > 0) { RUN.cnt = n; SND.beep(700, 0.1); main.innerHTML = '<div class="big-num">' + n + '</div><div class="muted">get ready</div>'; }
        if (left <= 0) { main.innerHTML = ''; SND.beep(1000, 0.25, 0.18); goNext(); }
      }
    } else if (st.kind === 'rest') {
      var rem = st.secs - RUN.t, n2 = Math.max(0, Math.ceil(rem));
      if (n2 !== RUN.cnt) { RUN.cnt = n2; main.innerHTML = '<div class="big-num">' + n2 + '</div><div class="muted">seconds rest</div>'; if (n2 <= 3 && n2 > 0) SND.beep(600, 0.08); }
      if (rem <= 0) goNext();
    } else if (st.mode === 'reps') {
      var per = C.period(ex), cyc = Math.floor(RUN.t / per), u = (RUN.t % per) / per, f = ex.anim.down || 0.5;
      var cues = ex.breathCue;
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
      main.innerHTML = '<div class="big-num">' + RUN.reps + '<small> / ' + st.n + '</small></div><div class="muted">reps done</div>';
    } else {
      var remain = st.secs - RUN.t, nn = Math.max(0, Math.ceil(remain));
      if (nn !== RUN.cnt) {
        RUN.cnt = nn;
        main.innerHTML = '<div class="big-num">' + nn + '<small> s</small></div><div class="muted">' + (st.mode === 'hold' ? 'hold' + (st.sets > 1 ? ' ' + st.set + ' of ' + st.sets : '') : 'keep going') + '</div>';
        if (nn <= 3 && nn > 0) { V.now(String(nn)); SND.beep(700, 0.08); }
        else if (st.secs >= 20 && nn === Math.round(st.secs / 2) && !RUN.flags.half) { RUN.flags.half = 1; V.now('Halfway.'); }
        else if (st.mode === 'time' && st.secs >= 45 && nn === 30) V.now('Thirty seconds left.');
        else if (st.mode === 'time' && st.secs >= 25 && nn === 10) V.now('Ten seconds.');
      }
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

  function renderStep() {
    var st = RUN.step, inst = RUN.insts[st.exi], ex = inst.ex, d = C.dose(ex);
    $('#rBlock').textContent = inst.block.title + ' · exercise ' + (st.exi + 1) + ' of ' + RUN.insts.length;
    var title = ex.name, sub = [];
    if (st.kind === 'rest') {
      title = st.why === 'between' ? 'Rest' : st.why === 'switch' ? 'Switch sides' : 'Breathe';
      sub.push(st.why === 'between' ? 'Next up: ' + ex.name : st.why === 'switch' ? 'Now: ' + (ex.sides === true ? st.side + ' side' : st.side) : ex.name);
    } else {
      if (inst.rounds > 1) sub.push('Round ' + inst.round + ' of ' + inst.rounds);
      if (st.kind === 'work' && st.side) sub.push(cap(ex.sides === true ? st.side + ' side' : st.side));
      if (st.kind === 'intro') sub.push(C.doseText(ex, d));
      if (st.kind === 'work' && st.mode === 'hold' && st.sets > 1) sub.push('Hold ' + st.set + ' of ' + st.sets);
    }
    $('#rName').textContent = title; $('#rSub').textContent = sub.join(' · ');
    $('#rMain').innerHTML = '';
    $('#rSteps').hidden = st.kind !== 'intro';
    $('#rGo').hidden = true;
    $('#rCue').textContent = st.kind === 'work' ? (ex.cue || ex.breath || '') : '';
    if (st.kind !== 'intro') $('#rSteps').innerHTML = '';
    var pb = $('#rPause'); pb.firstChild.textContent = '⏸'; pb.lastChild.textContent = 'Pause';
    RUN.cnt = 99;
  }
  function renderSteps(sc) {
    var ex = RUN.insts[RUN.step.exi].ex;
    $('#rSteps').innerHTML = ex.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      (ex.breath ? '<li class="aux">' + esc(ex.breath) + '</li>' : '');
    // map spoken indexes: steps then breath
    $('#rCue').textContent = ex.cue || '';
  }

  function pause(silent) {
    if (!RUN || RUN.paused) return;
    RUN.paused = true; V.cancel();
    if (!silent) $('#rPaused').hidden = false;
    var pb = $('#rPause'); pb.firstChild.textContent = '▶'; pb.lastChild.textContent = 'Resume';
  }
  function resume() {
    if (!RUN || !RUN.paused) return;
    RUN.paused = false; $('#rPaused').hidden = true;
    var pb = $('#rPause'); pb.firstChild.textContent = '⏸'; pb.lastChild.textContent = 'Pause';
    SND.unlock();
    if (RUN.step.kind === 'intro' && RUN.phase === 'speak') speakIntro();
  }
  function skip() {
    V.cancel(); var st = RUN.step;
    if (st.kind === 'rest') { goNext(); return; }
    RUN.skipped[st.exi] = 1;
    var j = RUN.i + 1; while (j < RUN.steps.length && RUN.steps[j].exi <= st.exi) j++;
    if (j >= RUN.steps.length) { finish(true); return; }
    enter(j);
  }
  function repeat() {
    V.cancel(); var st = RUN.step, exi = st.kind === 'rest' && st.why === 'between' ? Math.max(0, st.exi - 1) : st.exi, j = 0;
    while (j < RUN.steps.length && !(RUN.steps[j].exi === exi && RUN.steps[j].kind === 'work')) j++;
    delete RUN.skipped[exi]; delete RUN.done[exi];
    enter(Math.min(j, RUN.steps.length - 1));
    if (RUN.paused) resume();
  }
  function askStop() {
    var sh = sheet('<h2>End the workout?</h2><p>Exercises you finished are saved to your progress.</p><div class="rowbtns"><button class="btn" id="kg">Keep going</button><button class="ghost danger" id="es">End workout</button></div>', { sticky: true });
    $('#kg', sh.root).onclick = function () { sh.close(); resume(); };
    $('#es', sh.root).onclick = function () { sh.close(); finish(false); };
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
    var entry = { date: C.dateKey(), ts: Date.now(), level: S.level, light: run.plan.light, completed: completed, mins: Math.max(0.1, run.active / 60), done: uniq, skipped: Object.keys(run.skipped).map(function (k) { return run.insts[+k].ex.id; }) };
    teardownRunner(); RUN = null;
    if (!uniq.length && !completed) { go('today'); return; }
    if (completed) { SND.buzz([100, 60, 100]); V.say('Workout complete. Great job. Well done.'); }
    showSummary(entry);
  }

  function showSummary(entry) {
    var v = $('#view'); $('#nav').hidden = true;
    var form = null, extra = null, pain = null;
    var h = '<div class="summary"><div class="trophy">' + (entry.completed ? '🎉' : '👍') + '</div><h1>' + (entry.completed ? 'Workout complete!' : 'Ended early') + '</h1>' +
      '<p class="muted">' + Math.round(entry.mins) + ' min · ' + entry.done.length + ' exercises</p>';
    if (entry.completed) {
      h += '<section class="card"><b>Did you finish every set with good form?</b><div class="seg" id="qForm"><button data-v="1">Yes</button><button data-v="0">Not quite</button></div></section>' +
        '<section class="card"><b>Could you have done 2 or more extra reps?</b><div class="seg" id="qExtra"><button data-v="1">Yes</button><button data-v="0">No</button></div></section>' +
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
    C.load(); S = C.S; V.init(); applyTheme();
    $$('#nav button').forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-go')); }; });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (screen === 'today' && !RUN) refresh(); });
    window.addEventListener('appinstalled', function () { deferredInstall = null; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (RUN && !RUN.paused) pause(); }
      else if (RUN) C.WakeLock.on();
    });
    window.addEventListener('popstate', function () { if (RUN) { pause(); if (!$('.backdrop')) askStop(); try { history.pushState({ run: 1 }, ''); } catch (e) {} } });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var b = $('.backdrop'); if (b && !b.querySelector('#ack')) b.click(); } });
    go('today');
    requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });
    if (!S.ack) openSafety(true);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
    window.__app = { go: go, startWorkout: startWorkout, get RUN() { return RUN; }, skip: skip, pause: pause, resume: resume };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
