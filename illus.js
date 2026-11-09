/* illus.js — the illustrated exercise character (pure SVG, no libraries, ~15 KB, works offline).
 *
 * It replaces the old stick figure: Figure.create(svg) now draws a clean flat-vector athlete with smooth tapered
 * limbs, clothes, shoes, hair and soft shading. Poses still come from figure.js (side view) or from the "front"
 * format below, so every exercise in exercises.js keeps working and new ones are only data.
 *
 * What is drawn, per exercise (configured in illus-config.js):
 *   - the character, looping continuously, from a SIDE or FRONT viewpoint
 *   - the working muscles tinted in an accent colour (primary strong, secondary soft); the tint swells towards the
 *     end position of the movement
 *   - a faint outline of the END position, and a dashed arrow showing the path of the most-moving joint
 *   - a one-line "Targets: …" label
 *
 * FRONT pose format (angles in degrees, 0 = hanging straight down, 90 = out to the side, 180 = straight up,
 * positive = away from the body midline; the right side mirrors the left automatically):
 *   { hip: [x, y], t: lean, h: head tilt, aL: [upperArm, foreArm], aR: [..] (default = mirror of aL),
 *     lL: [thigh, shin] | { to: [outwardOffset, ankleY] }, lR: (default = mirror of lL) }
 */
(function (root) {
  'use strict';
  var F = root.Figure;
  if (!F) return;

  var NS = 'http://www.w3.org/2000/svg', LEN = F.LEN, D = 180 / Math.PI, FLOOR = 140.6, VW = 260;
  var PRIMARY_OP = [0.30, 0.68], SECOND_OP = [0.12, 0.27];

  /* ---------------------------------------------------------------- tiny helpers */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var ps = function (p) { return r1(p[0]) + ' ' + r1(p[1]); };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var rad = function (d) { return d * Math.PI / 180; };
  var dirA = function (a) { return [Math.sin(rad(a)), Math.cos(rad(a))]; };      // 0 = down, 90 = right (screen)

  /* closed smooth path through points (Catmull-Rom -> cubic Bezier) */
  function closed(pts) {
    var n = pts.length, d = 'M' + ps(pts[0]);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += 'C' + ps([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + ' ' +
        ps([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + ' ' + ps(p2);
    }
    return d + 'Z';
  }
  function opened(pts) {
    var n = pts.length, d = 'M' + ps(pts[0]);
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      d += 'C' + ps([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + ' ' +
        ps([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + ' ' + ps(p2);
    }
    return d;
  }
  function circle(c, r) { return 'M' + ps([c[0] - r, c[1]]) + 'a' + r1(r) + ' ' + r1(r) + ' 0 1 0 ' + r1(2 * r) + ' 0a' + r1(r) + ' ' + r1(r) + ' 0 1 0 ' + r1(-2 * r) + ' 0Z'; }

  /* a centre line: at(t) -> point, tan(t) -> unit tangent */
  function line(A, B) {
    var dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
    return { at: function (t) { return [A[0] + dx * t, A[1] + dy * t]; }, tan: function () { return u; } };
  }
  function quad(A, M, B) {            // passes through M at t = .5
    var C = [2 * M[0] - (A[0] + B[0]) / 2, 2 * M[1] - (A[1] + B[1]) / 2];
    return {
      at: function (t) { var s = 1 - t; return [s * s * A[0] + 2 * s * t * C[0] + t * t * B[0], s * s * A[1] + 2 * s * t * C[1] + t * t * B[1]]; },
      tan: function (t) { var x = 2 * (1 - t) * (C[0] - A[0]) + 2 * t * (B[0] - C[0]), y = 2 * (1 - t) * (C[1] - A[1]) + 2 * t * (B[1] - C[1]), l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
    };
  }
  /* radius profile: [[t, front, back], ...] -> function(t) -> [front, back] */
  function prof(tbl) {
    return function (t) {
      if (t <= tbl[0][0]) return [tbl[0][1], tbl[0][2]];
      for (var i = 0; i < tbl.length - 1; i++) {
        var a = tbl[i], b = tbl[i + 1];
        if (t <= b[0]) { var u = (t - a[0]) / (b[0] - a[0]); u = u * u * (3 - 2 * u); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
      }
      var z = tbl[tbl.length - 1]; return [z[1], z[2]];
    };
  }

  /* outline of a tapered limb / torso segment between t = ta and tb */
  function tube(curve, pr, ta, tb, grow, o) {
    o = o || {};
    var N = o.n || 7, fr = [], bk = [], a0, a1, i, t, p, tg, nx, r;
    for (i = 0; i <= N; i++) {
      t = ta + (tb - ta) * i / N; p = curve.at(t); tg = curve.tan(t);
      nx = o.flip ? [-tg[1], tg[0]] : [tg[1], -tg[0]];
      r = pr(t);
      fr.push([p[0] + nx[0] * (r[0] + grow), p[1] + nx[1] * (r[0] + grow)]);
      bk.push([p[0] - nx[0] * (r[1] + grow), p[1] - nx[1] * (r[1] + grow)]);
      if (i === 0) a0 = { p: p, tg: tg, nx: nx, r: r };
      if (i === N) a1 = { p: p, tg: tg, nx: nx, r: r };
    }
    function cap(pts, a, sg, from, to) {
      var rc = (a.r[0] + a.r[1]) / 2 + grow, k, ph, c, s;
      for (k = 0; k < 3; k++) {
        ph = rad(from + (to - from) * k / 2); c = Math.cos(ph); s = Math.sin(ph);
        pts.push([a.p[0] + a.nx[0] * c * ((c >= 0 ? a.r[0] : a.r[1]) + grow) + a.tg[0] * sg * s * rc * 0.97,
          a.p[1] + a.nx[1] * c * ((c >= 0 ? a.r[0] : a.r[1]) + grow) + a.tg[1] * sg * s * rc * 0.97]);
      }
    }
    var pts = fr.slice();
    if (!o.flat1) cap(pts, a1, 1, 38, 142);
    for (i = N; i >= 0; i--) pts.push(bk[i]);
    if (!o.flat0) cap(pts, a0, -1, 142, 38);
    return pts;
  }
  /* a lens-shaped patch on the front (side = 1) or back (-1) of a limb: muscle bellies and soft shading */
  function band(curve, pr, ta, tb, side, inK, outK, flip) {
    var N = 6, out = [], inn = [], i, u, t, p, tg, nx, r, env, ri;
    for (i = 0; i <= N; i++) {
      u = i / N; t = ta + (tb - ta) * u; p = curve.at(t); tg = curve.tan(t);
      nx = flip ? [-tg[1], tg[0]] : [tg[1], -tg[0]];
      r = pr(t)[side > 0 ? 0 : 1]; env = Math.pow(Math.sin(Math.PI * u), 0.4);
      var o = side * r * (inK + (outK - inK) * env); ri = side * r * inK;
      out.push([p[0] + nx[0] * o, p[1] + nx[1] * o]);
      if (i > 0 && i < N) inn.push([p[0] + nx[0] * ri, p[1] + nx[1] * ri]);
    }
    return closed(out.concat(inn.reverse()));
  }

  /* ---------------------------------------------------------------- body profiles (side view) */
  var P_THIGH = prof([[0, 7.2, 7.0], [0.25, 7.7, 7.3], [0.6, 6.3, 5.9], [1, 4.7, 4.6]]);
  var P_SHIN = prof([[0, 4.7, 4.6], [0.3, 4.9, 5.9], [0.62, 4.2, 4.9], [1, 3.1, 3.2]]);
  var P_UARM = prof([[0, 4.9, 4.8], [0.3, 4.6, 4.4], [1, 3.7, 3.7]]);
  var P_FARM = prof([[0, 3.8, 3.7], [0.3, 4.0, 3.6], [1, 2.7, 2.7]]);
  var P_TORSO = prof([[0, 7.2, 8.2], [0.12, 8.0, 9.6], [0.3, 6.9, 6.3], [0.55, 8.0, 6.6], [0.8, 8.8, 7.0], [1, 6.4, 6.4]]);
  var P_NECK = prof([[0, 3.5, 3.7], [1, 3.2, 3.4]]);
  /* front view (symmetrical) */
  var Q_THIGH = prof([[0, 7.4, 7.4], [0.3, 7.2, 7.2], [0.65, 5.8, 5.8], [1, 4.6, 4.6]]);
  var Q_SHIN = prof([[0, 4.6, 4.6], [0.3, 5.2, 5.2], [0.65, 4.2, 4.2], [1, 3.1, 3.1]]);

  var MUSCLE_NAME = { chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', core: 'Core', back: 'Back', glutes: 'Glutes',
    quadriceps: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves' };

  /* ---------------------------------------------------------------- shoe (shared) */
  var SHOE = [[-5.4, -4.4], [4, -4.7], [12.8, -4.5], [15.4, -2.5], [13, 0.3], [7.4, 2.0], [2.8, 4.4], [-0.6, 4.8], [-3.9, 5.3], [-5.9, 1.2]];
  function shoe(A, toe, flip) {
    var ux = toe[0] - A[0], uy = toe[1] - A[1], l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    var vx = uy, vy = -ux, s = flip ? -1 : 1;
    var pts = SHOE.map(function (q) { return [A[0] + ux * q[0] + vx * q[1] * s, A[1] + uy * q[0] + vy * q[1] * s]; });
    return { d: closed(pts), sole: 'M' + ps([A[0] + ux * -5.2 + vx * -3.3 * s, A[1] + uy * -5.2 + vy * -3.3 * s]) + 'L' + ps([A[0] + ux * 14.4 + vx * -3.3 * s, A[1] + uy * 14.4 + vy * -3.3 * s]) };
  }

  /* ---------------------------------------------------------------- SIDE rig */
  function SideRig(g, o) {
    o = o || {};
    var flat = !!o.flat, lite = !!o.lite, E = {}, self = this;
    function path(name, cls, parent) { E[name] = el('path', { class: cls }, parent || g); return E[name]; }
    var hairP = 'M-9 1C-10-7-4-11.2 3-10.4C7.5-9.8 10-6.6 9.4-3.4C7-5.6 4-6.2 1-5.8C-1.5-5.4-3.4-3.2-3.8 0.6C-4 3-5.5 5-7.5 6C-9 5-9.4 3-9 1Z';
    var headP = 'M-8-2C-8-9-3-10 2-9.6C7-9 9.5-5 9.3-1C9.2 3 8 6.5 4.5 8.6C1 10-4 9.5-7 6C-8 4-8.3 1-8-2Z';

    function limbSet(side, far) {                       // legs
      var k = far ? 'F' : 'N', c = far ? ' f' : '';
      path('thigh' + k, flat ? 'gh' : 'sk' + c); if (!flat && !far && !lite) { path('thighS' + k, 'shd'); path('thighH' + k, 'hil'); }
      path('shin' + k, flat ? 'gh' : 'sk' + c); if (!flat && !far && !lite) { path('shinS' + k, 'shd'); path('shinH' + k, 'hil'); }
      if (!flat) { path('shortsL' + k, 'sh' + c); path('shoe' + k, 'shoe' + c); el('path', { class: 'sole' + c }, g); E['sole' + k] = g.lastChild; }
      else path('shoe' + k, 'gh');
    }
    function armSet(far) {
      var k = far ? 'F' : 'N', c = far ? ' f' : '';
      path('uarm' + k, flat ? 'gh' : 'sk' + c); if (!flat && !far && !lite) { path('uarmS' + k, 'shd'); path('uarmH' + k, 'hil'); }
      path('farm' + k, flat ? 'gh' : 'sk' + c); if (!flat && !far && !lite) { path('farmS' + k, 'shd'); }
      if (!flat) path('sleeve' + k, 'tee' + c);
      path('hand' + k, flat ? 'gh' : 'sk' + c);
    }

    if (!flat && !lite) E.shadow = el('ellipse', { class: 'shadow', cy: FLOOR + 0.3, ry: 3.3 }, g);
    limbSet(0, true); armSet(true);
    path('torso', flat ? 'gh' : 'tee'); if (!flat && !lite) { path('torsoS', 'shd'); path('torsoH', 'hil'); }
    if (!flat) path('pelvis', 'sh');
    path('neck', flat ? 'gh' : 'sk');
    E.head = el('g', {}, g);
    if (flat) el('path', { class: 'gh', d: headP }, E.head); else {
      el('path', { class: 'hair', d: 'M-7-4C-14-5-17 3-14 11C-12 6-9 3-6-1Z', 'data-pony': 1, style: 'display:none' }, E.head);
      el('path', { class: 'sk', d: headP }, E.head);
      el('path', { class: 'nose', d: 'M9.1-1.6L11.9 2.3L8.9 3.1Z' }, E.head);
      el('path', { class: 'hair', d: hairP }, E.head);
      el('circle', { class: 'ear', cx: -1.6, cy: 1.8, r: 2.1 }, E.head);
      el('circle', { class: 'eye', cx: 4.7, cy: -0.5, r: 0.95 }, E.head);
    }
    if (!flat && !o.nomus) { E.musF = el('g', { class: 'mus far' }, g); }
    limbSet(0, false);
    armSet(false);
    if (!flat) { E.equip = el('g', {}, g); E.bag = el('g', { style: 'display:none' }, g); el('rect', { x: -8, y: 2, width: 16, height: 20, rx: 5, class: 'bag' }, E.bag); el('rect', { x: -5, y: 6, width: 10, height: 6, rx: 2, class: 'bag2' }, E.bag); }
    if (!flat && !o.nomus) E.musN = el('g', { class: 'mus near' }, g);

    /* muscle patches — created for the muscles an exercise targets */
    var muscles = [];
    this.setMuscles = function (prim, sec) {
      if (!E.musN) return;
      E.musN.innerHTML = ''; E.musF.innerHTML = ''; muscles = [];
      function add(m, level) {
        ['N', 'F'].forEach(function (k) {
          muscles.push({ m: m, k: k, level: level, e: el('path', { class: 'm' + level }, k === 'N' ? E.musN : E.musF) });
        });
      }
      (sec || []).forEach(function (m) { add(m, 's'); });
      (prim || []).forEach(function (m) { add(m, 'p'); });
    };
    this.setMuscleOpacity = function (e) {
      var op = { p: lerp(PRIMARY_OP[0], PRIMARY_OP[1], e), s: lerp(SECOND_OP[0], SECOND_OP[1], e) };
      for (var i = 0; i < muscles.length; i++) muscles[i].e.style.opacity = muscles[i].k === 'F' ? op[muscles[i].level] * 0.65 : op[muscles[i].level];
    };

    this.hasPony = false;
    this.setStyle = function (female) { var p = E.head && E.head.querySelector('[data-pony]'); if (p) p.style.display = female ? '' : 'none'; };

    this.draw = function (j, a) {
      var hip = j.hip, mid = j.mid, sh = j.sh, torso = quad(hip, mid, sh);
      var legs = [['F', j.knF, j.anF, j.toF], ['N', j.knN, j.anN, j.toN]], arms = [['F', j.elF, j.haF], ['N', j.elN, j.haN]], i, k, L, thigh, shin;
      var xs = [j.anN[0], j.anF[0], hip[0]];
      if (E.shadow) { var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, w = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 2 + 26; E.shadow.setAttribute('cx', r1(cx)); E.shadow.setAttribute('rx', r1(w)); }
      /* legs */
      for (i = 0; i < 2; i++) {
        L = legs[i]; k = L[0]; thigh = line(hip, L[1]); shin = line(L[1], L[2]);
        E['thigh' + k].setAttribute('d', closed(tube(thigh, P_THIGH, 0, 1, 0)));
        E['shin' + k].setAttribute('d', closed(tube(shin, P_SHIN, 0, 1, 0)));
        if (E['thighS' + k]) {
          E['thighS' + k].setAttribute('d', band(thigh, P_THIGH, 0.08, 0.97, -1, 0.1, 0.98));
          E['thighH' + k].setAttribute('d', band(thigh, P_THIGH, 0.12, 0.86, 1, 0.28, 0.66));
          E['shinS' + k].setAttribute('d', band(shin, P_SHIN, 0.05, 0.97, -1, 0.1, 0.98));
          E['shinH' + k].setAttribute('d', band(shin, P_SHIN, 0.1, 0.8, 1, 0.3, 0.62));
        }
        if (E['shortsL' + k]) E['shortsL' + k].setAttribute('d', closed(tube(thigh, P_THIGH, -0.04, 0.6, 1.1, { flat1: true })));
        var sd = shoe(L[2], L[3]);
        E['shoe' + k].setAttribute('d', sd.d); if (E['sole' + k]) E['sole' + k].setAttribute('d', sd.sole);
      }
      /* torso */
      E.torso.setAttribute('d', closed(tube(torso, P_TORSO, 0, 1, o.flat ? 0 : 0.5, { flip: true, n: 9 })));
      if (E.torsoS) {
        E.torsoS.setAttribute('d', band(torso, P_TORSO, 0.2, 0.98, -1, 0.05, 1.02, true));
        E.torsoH.setAttribute('d', band(torso, P_TORSO, 0.45, 0.92, 1, 0.3, 0.7, true));
      }
      if (E.pelvis) E.pelvis.setAttribute('d', closed(tube(torso, P_TORSO, -0.03, 0.33, 1.0, { flip: true, flat1: true, n: 5 })));
      /* neck + head */
      var hd = j.head, nv = [hd[0] - sh[0], hd[1] - sh[1]];
      E.neck.setAttribute('d', closed(tube(line([sh[0] + nv[0] * 0.05, sh[1] + nv[1] * 0.05], [hd[0] - nv[0] * 0.1, hd[1] - nv[1] * 0.1]), P_NECK, 0, 1, 0, { n: 3 })));
      E.head.setAttribute('transform', 'translate(' + r1(hd[0]) + ' ' + r1(hd[1]) + ') rotate(' + r1(Math.atan2(nv[0], -nv[1]) * D) + ')');
      /* arms */
      for (i = 0; i < 2; i++) {
        var A = arms[i], kk = A[0], up = line(sh, A[1]), fo = line(A[1], A[2]);
        E['uarm' + kk].setAttribute('d', closed(tube(up, P_UARM, 0, 1, 0)));
        E['farm' + kk].setAttribute('d', closed(tube(fo, P_FARM, 0, 1, 0)));
        if (E['uarmS' + kk]) {
          E['uarmS' + kk].setAttribute('d', band(up, P_UARM, 0.05, 0.97, -1, 0.1, 0.98));
          E['uarmH' + kk].setAttribute('d', band(up, P_UARM, 0.12, 0.85, 1, 0.3, 0.64));
          E['farmS' + kk].setAttribute('d', band(fo, P_FARM, 0.05, 0.97, -1, 0.1, 0.98));
        }
        if (E['sleeve' + kk]) E['sleeve' + kk].setAttribute('d', closed(tube(up, P_UARM, -0.06, 0.5, 0.9, { flat1: true, n: 4 })));
        var fd = [A[2][0] - A[1][0], A[2][1] - A[1][1]], fl = Math.hypot(fd[0], fd[1]) || 1;
        E['hand' + kk].setAttribute('d', circle([A[2][0] + fd[0] / fl * 1.6, A[2][1] + fd[1] / fl * 1.6], 3.5));
      }
      if (E.bag) { E.bag.style.display = a && a.bag ? '' : 'none'; if (a && a.bag) E.bag.setAttribute('transform', 'translate(' + r1(j.haN[0]) + ',' + r1(j.haN[1]) + ')'); }
      /* equipment seen from the side: plates are discs */
      this.equipSide(j, a);
      /* muscles */
      for (i = 0; i < muscles.length; i++) {
        var mu = muscles[i], jn = mu.k === 'N';
        mu.e.setAttribute('d', sideMuscle(mu.m, torso, hip, j.sh, jn ? j.knN : j.knF, jn ? j.anN : j.anF, jn ? j.elN : j.elF, jn ? j.haN : j.haF));
      }
    };
    var eqKey = '';
    this.equipSide = function (j, a) {
      if (!E.equip) return;
      var kind = a && a.equip, key = kind || '';
      if (key !== eqKey) {
        eqKey = key; E.equip.innerHTML = '';
        if (kind === 'dumbbell') { E.eq1 = el('circle', { r: 5.2, class: 'plate' }, E.equip); el('circle', { r: 1.6, class: 'plate2' }, E.equip); E.eq2 = null; }
        else if (kind === 'barbell') { E.eq1 = el('circle', { r: 13.5, class: 'plate' }, E.equip); el('circle', { r: 3.2, class: 'plate2' }, E.equip); }
      }
      if (kind) for (var i = 0; i < E.equip.childNodes.length; i++) { E.equip.childNodes[i].setAttribute('cx', r1(j.haN[0])); E.equip.childNodes[i].setAttribute('cy', r1(j.haN[1])); }
    };
  }

  /* muscle patch shapes (side view) */
  function sideMuscle(m, torso, hip, sh, kn, an, el_, ha) {
    switch (m) {
      case 'quadriceps': return band(line(hip, kn), P_THIGH, 0.1, 0.94, 1, -0.02, 0.8);
      case 'hamstrings': return band(line(hip, kn), P_THIGH, 0.12, 0.94, -1, -0.02, 0.8);
      case 'calves': return band(line(kn, an), P_SHIN, 0.1, 0.74, -1, -0.02, 0.86);
      case 'glutes': return band(torso, P_TORSO, 0.0, 0.28, -1, -0.05, 0.74, true);
      case 'core': return band(torso, P_TORSO, 0.12, 0.5, 1, -0.05, 0.8, true);
      case 'chest': return band(torso, P_TORSO, 0.56, 0.92, 1, -0.05, 0.84, true);
      case 'back': return band(torso, P_TORSO, 0.4, 0.96, -1, -0.05, 0.84, true);
      case 'shoulders': return circle([sh[0] + (el_[0] - sh[0]) * 0.13, sh[1] + (el_[1] - sh[1]) * 0.13], 4.6);
      case 'biceps': return band(line(sh, el_), P_UARM, 0.18, 0.9, 1, -0.05, 0.8);
      case 'triceps': return band(line(sh, el_), P_UARM, 0.16, 0.9, -1, -0.05, 0.8);
    }
    return 'M0 0';
  }

  /* ---------------------------------------------------------------- FRONT rig */
  function ik2(S, T, l1, l2, bend) {
    var dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 1e-6;
    var dd = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01), ux = dx / d, uy = dy / d;
    var a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [[S[0] + ux * a + uy * bend * h, S[1] + uy * a - ux * bend * h], [S[0] + ux * dd, S[1] + uy * dd]];
  }
  function limbF(root, spec, sg, l1, l2, cx, outward) {   // sg: -1 viewer-left, +1 viewer-right
    if (Array.isArray(spec)) {
      var a = dirA(spec[0]), b = dirA(spec[1]);
      var j = [root[0] + sg * a[0] * l1, root[1] + a[1] * l1];
      return [j, [j[0] + sg * b[0] * l2, j[1] + b[1] * l2]];
    }
    var T = [cx + sg * spec.to[0], spec.to[1]], r1_ = ik2(root, T, l1, l2, 1), r2_ = ik2(root, T, l1, l2, -1);
    return (r1_[0][0] - root[0]) * sg > (r2_[0][0] - root[0]) * sg ? r1_ : r2_;   // knee bulges outward
  }
  function mixAny(a, b, u) {
    if (typeof a === 'number') return lerp(a, b, u);
    if (Array.isArray(a)) return a.map(function (v, i) { return mixAny(v, b[i], u); });
    if (a && typeof a === 'object') { var o = {}; for (var k in a) o[k] = b && b[k] !== undefined ? mixAny(a[k], b[k], u) : a[k]; return o; }
    return a;
  }
  function frontPose(anim, pos) {
    var P = anim.poses, n = P.length;
    pos = Math.min(Math.max(pos, 0), n - 1);
    if (n === 1) return P[0];
    var i = Math.min(Math.floor(pos), n - 2);
    return mixAny(P[i], P[i + 1], pos - i);
  }
  function solveFront(p) {
    var H = p.hip, r = rad(p.t || 0), up = [Math.sin(r), -Math.cos(r)], sd = [Math.cos(r), Math.sin(r)];
    var S0 = [H[0] + up[0] * (LEN.lo + LEN.hi - 2), H[1] + up[1] * (LEN.lo + LEN.hi - 2)];
    var sL = [S0[0] - sd[0] * 15, S0[1] - sd[1] * 15], sR = [S0[0] + sd[0] * 15, S0[1] + sd[1] * 15];
    var hr = r + rad(p.h || 0), head = [S0[0] + Math.sin(hr) * 19, S0[1] - Math.cos(hr) * 19];
    var hL = [H[0] - sd[0] * 7, H[1] - sd[1] * 7], hR = [H[0] + sd[0] * 7, H[1] + sd[1] * 7];
    var aL = p.aL || p.aR, aR = p.aR || p.aL, lL = p.lL || p.lR, lR = p.lR || p.lL;
    var A1 = limbF(sL, aL, -1, LEN.ua, LEN.fa, H[0]), A2 = limbF(sR, aR, 1, LEN.ua, LEN.fa, H[0]);
    var L1 = limbF(hL, lL, -1, LEN.th, LEN.sh, H[0]), L2 = limbF(hR, lR, 1, LEN.th, LEN.sh, H[0]);
    return { hip: H, S0: S0, sL: sL, sR: sR, head: head, hL: hL, hR: hR, elL: A1[0], haL: A1[1], elR: A2[0], haR: A2[1], knL: L1[0], anL: L1[1], knR: L2[0], anR: L2[1], roll: p.t || 0, hr: hr };
  }

  function FrontRig(g, o) {
    o = o || {};
    var flat = !!o.flat, lite = !!o.lite, E = {};
    function path(name, cls) { E[name] = el('path', { class: cls }, g); return E[name]; }
    if (!flat && !lite) E.shadow = el('ellipse', { class: 'shadow', cy: FLOOR + 0.3, ry: 3.3 }, g);
    ['L', 'R'].forEach(function (k) {
      path('thigh' + k, flat ? 'gh' : 'sk'); path('shin' + k, flat ? 'gh' : 'sk');
      if (!flat) { path('shorts' + k, 'sh'); path('shoe' + k, 'shoe'); path('sole' + k, 'sole'); } else path('shoe' + k, 'gh');
    });
    path('torso', flat ? 'gh' : 'tee'); if (!flat && !lite) path('torsoH', 'hil');
    if (!flat) path('pelvis', 'sh');
    path('neck', flat ? 'gh' : 'sk');
    ['L', 'R'].forEach(function (k) {
      path('uarm' + k, flat ? 'gh' : 'sk'); path('farm' + k, flat ? 'gh' : 'sk');
      if (!flat) path('sleeve' + k, 'tee'); path('hand' + k, flat ? 'gh' : 'sk');
    });
    E.head = el('g', {}, g);
    if (flat) el('circle', { class: 'gh', r: 9.3 }, E.head); else {
      el('path', { class: 'hair', 'data-pony': 1, style: 'display:none', d: 'M-9.6-4C-13.6 4-12.4 15-8.4 19C-7 11-7.6 3-8.4-1ZM9.6-4C13.6 4 12.4 15 8.4 19C7 11 7.6 3 8.4-1Z' }, E.head);
      el('circle', { class: 'ear', cx: -9.2, cy: 0.5, r: 2.2 }, E.head); el('circle', { class: 'ear', cx: 9.2, cy: 0.5, r: 2.2 }, E.head);
      el('path', { class: 'sk', d: 'M-8.6-1C-8.6-8-4-10.4 0-10.4C4-10.4 8.6-8 8.6-1C8.6 4 6.4 9 0 10.2C-6.4 9-8.6 4-8.6-1Z' }, E.head);
      el('path', { class: 'hair', d: 'M-9.2 0C-10.6-8-5-12.2 0-12.2C5-12.2 10.6-8 9.2 0C8.6-3.6 5.4-6.4 0-6.4C-5.4-6.4-8.6-3.6-9.2 0Z' }, E.head);
      el('circle', { class: 'eye', cx: -3.3, cy: -0.6, r: 0.95 }, E.head); el('circle', { class: 'eye', cx: 3.3, cy: -0.6, r: 0.95 }, E.head);
      el('path', { class: 'mouth', d: 'M-2.2 4.6Q0 6.2 2.2 4.6' }, E.head);
    }
    if (!flat && !o.nomus) E.mus = el('g', { class: 'mus near' }, g);
    if (!flat) E.equip = el('g', {}, g);

    var muscles = [];
    this.setMuscles = function (prim, sec) {
      if (!E.mus) return; E.mus.innerHTML = ''; muscles = [];
      var seen = { chest: 1, shoulders: 1, biceps: 1, core: 1, quadriceps: 1, calves: 1 };
      (sec || []).forEach(function (m) { if (seen[m]) muscles.push({ m: m, e: el('path', { class: 'ms' }, E.mus) }); });
      (prim || []).forEach(function (m) { if (seen[m]) muscles.push({ m: m, e: el('path', { class: 'mp' }, E.mus) }); });
    };
    this.setMuscleOpacity = function (e) {
      var op = { mp: lerp(PRIMARY_OP[0], PRIMARY_OP[1], e), ms: lerp(SECOND_OP[0], SECOND_OP[1], e) };
      for (var i = 0; i < muscles.length; i++) muscles[i].e.style.opacity = op[muscles[i].e.getAttribute('class')];
    };
    this.setStyle = function (female) { var p = E.head && E.head.querySelector('[data-pony]'); if (p) p.style.display = female ? '' : 'none'; };

    this.draw = function (j, a) {
      var H = j.hip, r = rad(j.roll), up = [Math.sin(r), -Math.cos(r)], sd = [Math.cos(r), Math.sin(r)];
      function at(x, y) { return [H[0] + sd[0] * x + up[0] * y, H[1] + sd[1] * x + up[1] * y]; }     // x lateral (+ viewer-right), y up from hip
      var xs = [j.anL[0], j.anR[0], H[0]];
      if (E.shadow) { var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, w = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 2 + 24; E.shadow.setAttribute('cx', r1(cx)); E.shadow.setAttribute('rx', r1(w)); }
      var sides = [['L', -1], ['R', 1]];
      sides.forEach(function (S) {
        var k = S[0], sg = S[1], hp = k === 'L' ? j.hL : j.hR, kn = j['kn' + k], an = j['an' + k];
        var th = line(hp, kn), sn = line(kn, an);
        E['thigh' + k].setAttribute('d', closed(tube(th, Q_THIGH, 0, 1, 0)));
        E['shin' + k].setAttribute('d', closed(tube(sn, Q_SHIN, 0, 1, 0)));
        if (E['shorts' + k]) E['shorts' + k].setAttribute('d', closed(tube(th, Q_THIGH, -0.05, 0.6, 1.1, { flat1: true })));
        var sol = E['sole' + k];
        var ax = an[0], ay = an[1];
        if (E['shoe' + k]) {
          var sw = 5.4;
          E['shoe' + k].setAttribute('d', 'M' + ps([ax - sw, ay + 1]) + 'C' + ps([ax - sw - 1, ay - 3]) + ' ' + ps([ax - 2, ay - 4.4]) + ' ' + ps([ax + 1, ay - 4.2]) + 'C' + ps([ax + 4, ay - 4]) + ' ' + ps([ax + sw + 1, ay - 3]) + ' ' + ps([ax + sw, ay + 1.4]) + 'C' + ps([ax + sw, ay + 4.6]) + ' ' + ps([ax + 3, ay + 5.4]) + ' ' + ps([ax, ay + 5.4]) + 'C' + ps([ax - 3, ay + 5.4]) + ' ' + ps([ax - sw, ay + 4.6]) + ' ' + ps([ax - sw, ay + 1]) + 'Z');
          if (sol) sol.setAttribute('d', 'M' + ps([ax - sw + 0.4, ay + 4.4]) + 'Q' + ps([ax, ay + 6.3]) + ' ' + ps([ax + sw - 0.4, ay + 4.4]));
        }
        var sh = k === 'L' ? j.sL : j.sR, el2 = j['el' + k], ha = j['ha' + k];
        var up_ = line(sh, el2), fo = line(el2, ha);
        E['uarm' + k].setAttribute('d', closed(tube(up_, P_UARM, 0, 1, 0)));
        E['farm' + k].setAttribute('d', closed(tube(fo, P_FARM, 0, 1, 0)));
        if (E['sleeve' + k]) E['sleeve' + k].setAttribute('d', closed(tube(up_, P_UARM, -0.1, 0.5, 0.9, { flat1: true, n: 4 })));
        var fd = [ha[0] - el2[0], ha[1] - el2[1]], fl = Math.hypot(fd[0], fd[1]) || 1;
        E['hand' + k].setAttribute('d', circle([ha[0] + fd[0] / fl * 1.6, ha[1] + fd[1] / fl * 1.6], 3.6));
      });
      /* torso outline (x lateral, y up from the hip) */
      var T = [[11.2, -1], [10.4, 7], [9.4, 17], [11.4, 27], [14, 35.5], [15.4, 39.5], [10, 42], [5.4, 43], [-5.4, 43], [-10, 42], [-15.4, 39.5], [-14, 35.5], [-11.4, 27], [-9.4, 17], [-10.4, 7], [-11.2, -1], [-7, -5], [0, -6], [7, -5]];
      E.torso.setAttribute('d', closed(T.map(function (q) { return at(q[0], q[1]); })));
      if (E.torsoH) E.torsoH.setAttribute('d', closed([[-9, 30], [-3, 36], [3, 36], [9, 30], [4, 22], [-4, 22]].map(function (q) { return at(q[0], q[1]); })));
      if (E.pelvis) E.pelvis.setAttribute('d', closed([[11.8, 12], [11.8, 4], [12, -4], [7, -8], [0, -9], [-7, -8], [-12, -4], [-11.8, 4], [-11.8, 12], [-6, 13.4], [0, 13.8], [6, 13.4]].map(function (q) { return at(q[0], q[1]); })));
      var sc = at(0, 41), hd = j.head;
      E.neck.setAttribute('d', closed(tube(line(sc, [hd[0] - Math.sin(j.hr) * 3, hd[1] + Math.cos(j.hr) * 3]), prof([[0, 4.2, 4.2], [1, 3.6, 3.6]]), 0, 1, 0, { n: 3 })));
      E.head.setAttribute('transform', 'translate(' + r1(hd[0]) + ' ' + r1(hd[1]) + ') rotate(' + r1(j.hr * D) + ')');
      /* muscles */
      muscles.forEach(function (mu) {
        var m = mu.m, d = 'M0 0';
        function both(fn) { return fn('L') + fn('R'); }
        if (m === 'chest') d = [-1, 1].map(function (sg) { return closed([[sg * 1.2, 24], [sg * 7, 22.5], [sg * 12.5, 26], [sg * 13, 31], [sg * 8, 35], [sg * 2, 33.5]].map(function (q) { return at(q[0], q[1]); })); }).join('');
        else if (m === 'core') d = closed([[-5.6, 6], [0, 4.4], [5.6, 6], [6.6, 16], [5, 25], [0, 26.5], [-5, 25], [-6.6, 16]].map(function (q) { return at(q[0], q[1]); }));
        else if (m === 'shoulders') d = circle(j.sL, 5.5) + circle(j.sR, 5.5);
        else if (m === 'biceps') d = both(function (k) { var s = k === 'L' ? j.sL : j.sR; return band(line(s, j['el' + k]), P_UARM, 0.16, 0.9, 1, -0.55, 0.62); });
        else if (m === 'quadriceps') d = both(function (k) { var s = k === 'L' ? j.hL : j.hR; return band(line(s, j['kn' + k]), Q_THIGH, 0.08, 0.94, 1, -0.55, 0.62); });
        else if (m === 'calves') d = both(function (k) { return band(line(j['kn' + k], j['an' + k]), Q_SHIN, 0.1, 0.8, 1, -0.5, 0.58); });
        mu.e.setAttribute('d', d);
      });
      if (E.equip) {
        var kind = a && a.equip;
        if (E.eqKind !== kind) {
          E.eqKind = kind; E.equip.innerHTML = '';
          if (kind) ['L', 'R'].forEach(function (k) { E['bar' + k] = el('path', { class: 'bar' }, E.equip); E['pl' + k] = el('path', { class: 'plate' }, E.equip); });
        }
        if (kind) ['L', 'R'].forEach(function (k) {
          var h = j['ha' + k], w = 7.4;
          E['bar' + k].setAttribute('d', 'M' + ps([h[0] - w, h[1]]) + 'L' + ps([h[0] + w, h[1]]));
          E['pl' + k].setAttribute('d', 'M' + ps([h[0] - w - 1.2, h[1] - 4]) + 'h2.6v8h-2.6Z M' + ps([h[0] + w - 1.4, h[1] - 4]) + 'h2.6v8h-2.6Z');
        });
      }
    };
  }

  /* ---------------------------------------------------------------- props (furniture) */
  function drawProps(parent, anim, mirror) {
    ((anim && anim.props) || []).forEach(function (s) {
      if (s.t === 'rect') {
        var cls = 'pr-' + s.c, rx = s.c === 'mat' ? 3 : s.c === 'wall' ? 0 : 1.6;
        el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: rx, class: cls }, parent);
        if (s.c === 'furn' && s.w >= 30 && s.h <= 6) el('rect', { x: s.x + 1.5, y: s.y + 0.8, width: s.w - 3, height: 1.2, rx: 0.6, class: 'pr-hi' }, parent);
      } else if (s.t === 'line') el('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, class: 'pr-' + s.c }, parent);
      else if (s.t === 'text') { var t = el('text', { x: s.x, y: s.y, class: 'pr-label', 'text-anchor': 'middle' }, parent); t.textContent = s.s; if (mirror) t.setAttribute('transform', 'translate(' + (2 * s.x) + ',0) scale(-1,1)'); }
    });
  }

  /* ---------------------------------------------------------------- per-exercise configuration */
  function cfgFor(anim) { return (anim && anim._cfg) || {}; }
  function exFor(anim) { return anim && anim._ex; }

  function jointsAt(anim, pos, front) { return front ? solveFront(frontPose(anim, pos)) : F.solve(F.poseAt(anim, pos)); }

  /* ---------------------------------------------------------------- create(svg) — same interface as the old Figure.create */
  function create(svg) {
    var lite = !!(svg.parentNode && /(^|\s)thumb(\s|$)/.test(svg.parentNode.className || ''));
    svg.setAttribute('viewBox', '0 -16 ' + VW + ' 176');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.innerHTML = '';
    var world = el('g', {}, svg), back = el('g', {}, world), gGhost = el('g', { class: 'ghost' }, world), gTrail = el('g', {}, world), gBody = el('g', {}, world);
    var gCustom = el('g', {}, world);
    var label = lite ? null : el('text', { class: 'lbl', x: 12, y: 154 }, svg);
    var cur = { anim: null, mirror: false, rig: null, ghost: null, front: false, n: 1, cycle: false, labelOn: true, vb: { x: 0, y: -16, w: VW, h: 176 } };

    /* zoom the view to the movement: bounds of every joint over the loop, never smaller than the figure needs */
    function fit(anim) {
      var minX = 1e9, maxX = -1e9, minY = 1e9, K = 20, i, k, j, p;
      for (i = 0; i <= K; i++) {
        j = jointsAt(anim, F.cyclePos(anim, i / K), cur.front);
        for (k in j) { p = j[k]; if (p && p.length === 2 && typeof p[0] === 'number') { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); } }
      }
      var mg = lite ? 9 : 18; minX -= mg; maxX += mg; minY -= lite ? 6 : 10;
      var w = Math.max(lite ? 120 : 168, maxX - minX, (FLOOR - minY) / 0.5885);
      var s = w / VW, h = w * 176 / VW, bottom = FLOOR + 15 * s;
      cur.vb = { x: (minX + maxX) / 2 - w / 2, y: bottom - h, w: w, h: h };
      svg.setAttribute('viewBox', r1(cur.vb.x) + ' ' + r1(cur.vb.y) + ' ' + r1(w) + ' ' + r1(h));
    }


    function setLabel() {
      if (!label) return;
      var c = cfgFor(cur.anim), names = (c.primary || []).map(function (m) { return MUSCLE_NAME[m] || m; });
      label.textContent = '';
      if (!names.length || !cur.labelOn) return;
      var dot = el('tspan', { class: 'lbld' }, label); dot.textContent = '● ';
      var t = el('tspan', {}, label); t.textContent = 'Targets: ' + names.join(' · ');
    }

    function setAnim(anim, mirror) {
      cur.anim = anim; cur.mirror = !!mirror;
      back.innerHTML = ''; gGhost.innerHTML = ''; gTrail.innerHTML = ''; gBody.innerHTML = ''; gCustom.innerHTML = '';
      el('rect', { x: -600, y: FLOOR, width: VW + 1200, height: 200, class: 'floor' }, back);
      el('rect', { x: -600, y: FLOOR, width: VW + 1200, height: 2.4, class: 'floorEdge' }, back);
      drawProps(back, anim, mirror);
      var c = cfgFor(anim), ex = exFor(anim);
      if (anim && anim.custom) { cur.rig = null; return; }
      F.prepare(anim);
      cur.front = (c.view || anim.view) === 'front';
      cur.n = anim.poses.length;
      cur.cycle = anim.mode === 'cycle';
      cur.o = { bag: anim.bag, equip: c.equip };
      fit(anim);
      var vb = cur.vb;
      world.setAttribute('transform', mirror ? 'translate(' + r1(2 * vb.x + vb.w) + ',0) scale(-1,1)' : '');
      if (label) { var ls = vb.w / VW; label.setAttribute('x', r1(vb.x + 11 * ls)); label.setAttribute('y', r1(vb.y + vb.h - 5.5 * ls)); label.style.fontSize = r1(7.4 * ls) + 'px'; }
      var Rig = cur.front ? FrontRig : SideRig;
      cur.rig = new Rig(gBody, { lite: lite });
      cur.rig.setStyle(root.Illus && root.Illus.female);
      if (!lite) cur.rig.setMuscles(c.primary, c.secondary);
      cur.ghostOn = false;
      if (!lite) {
        var isReps = !ex || ex.type === 'reps';
        if (c.ghost !== false && isReps && !cur.cycle && cur.n > 1 && root.Illus && root.Illus.showEnd) {
          cur.ghost = new Rig(gGhost, { flat: true });
          cur.ghost.draw(jointsAt(anim, cur.n - 1, cur.front), cur.o);
          cur.ghostOn = true;
        }
        buildTrail(anim, c);
      }
      setLabel();
    }

    /* dashed path of the joint that travels furthest, with an arrow in the direction of the effort */
    function buildTrail(anim, c) {
      var K = 48, keys = cur.front ? ['haL', 'anL', 'head', 'hip'] : ['haN', 'anN', 'knN', 'sh', 'hip', 'head'];
      var best = null, bestLen = 0, paths = {};
      keys.forEach(function (k) { paths[k] = []; });
      for (var i = 0; i <= K; i++) {
        var u = i / K, j = jointsAt(anim, F.cyclePos(anim, u), cur.front);
        keys.forEach(function (k) { paths[k].push(j[k].slice()); });
      }
      var want = c.track && paths[c.track] ? [c.track] : keys;
      want.forEach(function (k) {
        var L = 0, p = paths[k];
        for (var i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (L > bestLen * 1.15) { bestLen = L; best = k; }
      });
      if (!best || bestLen < 18 || c.arrow === false) return;
      var P = paths[best], half = anim.mode === 'cycle' ? P : P.slice(0, Math.round(K * (anim.down || 0.5)) + 1);
      el('path', { class: 'trail', d: opened(half.filter(function (_, i) { return i % 2 === 0 || i === half.length - 1; })) }, gTrail);
      var k0 = Math.max(1, Math.round((half.length - 1) * 0.55)), a = half[k0 - 1], b = half[Math.min(half.length - 1, k0 + 1)], p = half[k0];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      var tip = [p[0] + dx * 3.4, p[1] + dy * 3.4], s1 = [p[0] - dx * 1.8 - dy * 3.2, p[1] - dy * 1.8 + dx * 3.2], s2 = [p[0] - dx * 1.8 + dy * 3.2, p[1] - dy * 1.8 - dx * 3.2];
      el('path', { class: 'arrow', d: 'M' + ps(tip) + 'L' + ps(s1) + 'L' + ps(s2) + 'Z' }, gTrail);
    }

    /* opts = { u: cycle fraction } or { pos: position along the poses } */
    function show(opts) {
      var anim = cur.anim; if (!anim) return;
      if (anim.custom) { anim.custom(gCustom, opts.u != null ? opts.u : 0.25, el); return; }
      var pos = opts.pos != null ? opts.pos : F.cyclePos(anim, opts.u || 0);
      var j = jointsAt(anim, pos, cur.front);
      cur.rig.draw(j, cur.o);
      if (!lite) cur.rig.setMuscleOpacity(cur.n > 1 ? Math.min(1, Math.max(0, pos / (cur.n - 1))) : 1);
    }
    return {
      svg: svg, setAnim: setAnim, show: show,
      label: function (on) { cur.labelOn = !!on; setLabel(); }
    };
  }

  /* ---------------------------------------------------------------- hook everything up */
  var Illus = { create: create, female: false, showEnd: true, solveFront: solveFront };
  root.Illus = Illus;
  F.create = create;

  /* attach per-exercise config (illus-config.js) to the animation objects of exercises.js */
  Illus.attach = function () {
    var cfg = (root.ILLUS && root.ILLUS.exercises) || {};
    (root.EXERCISES || []).forEach(function (ex) {
      if (ex.anim && typeof ex.anim === 'object') { ex.anim._cfg = cfg[ex.id] || {}; ex.anim._ex = ex; }
    });
    ((root.ILLUS && root.ILLUS.extra) || []).forEach(function (ex) { ex.anim._cfg = ex; ex.anim._ex = ex; });
    return cfg;
  };
  Illus.attach();
})(window);
