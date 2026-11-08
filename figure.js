/* figure.js — a tiny "mannequin" animation engine (no libraries, works offline).
 *
 * A figure is drawn from a side view, facing right. Each exercise has an `anim`
 * made of a few key poses; the engine blends between them.
 *
 * Pose fields (angles in degrees: 0 = straight down, 90 = right, 180 = up, 270/-90 = left)
 *   hip : [x, y]            hip position (ground is y = 140)
 *   t   : angle | [lo, hi]  hip -> shoulder direction (two numbers = curved spine)
 *   h   : angle             neck direction (default = along the torso)
 *   aN, aF : near / far arm   -> [upperArm, foreArm] angles   OR  {to:[x,y], b:+1|-1}  (hand target)
 *   lN, lF : near / far leg   -> [thigh, shin] angles         OR  {to:[x,y], b:+1|-1}  (ankle target)
 *   fN, fF : foot angle (default 90 = flat on the floor, 40 = on tiptoe)
 *   b = which way the elbow / knee bends (+1 = forward for a leg pointing down, -1 = backward)
 */
(function (root) {
  'use strict';

  var G = 140, VW = 260, VH = 176;   // view box is 260 x 176, starting 16 above y=0
  var LEN = { lo: 20, hi: 22, ua: 22, fa: 20, th: 32, sh: 30, ft: 11, hd: 13 };
  var rad = function (d) { return d * Math.PI / 180; };
  var dir = function (a) { return [Math.sin(rad(a)), Math.cos(rad(a))]; };
  var mv = function (p, a, l) { var d = dir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };
  var ang = function (p, q) { return Math.atan2(q[0] - p[0], q[1] - p[1]) * 180 / Math.PI; };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var NS = 'http://www.w3.org/2000/svg';

  /* two-bone inverse kinematics: returns [joint, end] */
  function ik(S, T, l1, l2, bend) {
    var dx = T[0] - S[0], dy = T[1] - S[1];
    var d = Math.hypot(dx, dy) || 1e-6;
    var dd = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    var ux = dx / d, uy = dy / d;
    var a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
    var h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var b = bend || 1;
    return [
      [S[0] + ux * a + uy * b * h, S[1] + uy * a - ux * b * h],
      [S[0] + ux * dd, S[1] + uy * dd]
    ];
  }

  function limb(root, spec, l1, l2) {
    if (Array.isArray(spec)) {
      var j = mv(root, spec[0], l1);
      return [j, mv(j, spec[1], l2)];
    }
    return ik(root, spec.to, l1, l2, spec.b);
  }

  function tArr(t) { return Array.isArray(t) ? t : [t, t]; }

  /* turn one pose into joint positions */
  function solve(p) {
    var tt = tArr(p.t);
    var hip = p.hip;
    var mid = mv(hip, tt[0], LEN.lo);
    var sh = mv(mid, tt[1], LEN.hi);
    var head = mv(sh, p.h != null ? p.h : tt[1], LEN.hd);
    var aN = limb(sh, p.aN, LEN.ua, LEN.fa), aF = limb(sh, p.aF || p.aN, LEN.ua, LEN.fa);
    var lN = limb(hip, p.lN, LEN.th, LEN.sh), lF = limb(hip, p.lF || p.lN, LEN.th, LEN.sh);
    var fN = p.fN != null ? p.fN : 90, fF = p.fF != null ? p.fF : 90;
    return {
      hip: hip, mid: mid, sh: sh, head: head,
      elN: aN[0], haN: aN[1], elF: aF[0], haF: aF[1],
      knN: lN[0], anN: lN[1], knF: lF[0], anF: lF[1],
      toN: mv(lN[1], fN, LEN.ft), toF: mv(lF[1], fF, LEN.ft)
    };
  }

  /* make every pose of an anim use the same kind of spec per limb (angles vs targets) */
  function prepare(anim) {
    if (anim._ready || anim.custom) { anim._ready = true; return anim; }
    var poses = anim.poses;
    ['aN', 'aF', 'lN', 'lF'].forEach(function (k) {
      var isArm = k[0] === 'a';
      var kinds = poses.map(function (p) { var s = p[k] || (k[1] === 'F' ? p[k[0] + 'N'] : null); return Array.isArray(s) ? 'fk' : 'ik'; });
      var mixed = kinds.indexOf('fk') >= 0 && kinds.indexOf('ik') >= 0;
      if (!mixed) return;
      var prev = null;
      poses.forEach(function (p) {
        var s = p[k] || p[k[0] + 'N'];
        if (Array.isArray(s)) { prev = s; return; }
        var j = solve(p);
        var root = isArm ? j.sh : j.hip;
        var joint = j[(isArm ? 'el' : 'kn') + k[1]], end = j[(isArm ? 'ha' : 'an') + k[1]];
        var a1 = ang(root, joint), a2 = ang(joint, end);
        if (prev) { a1 += 360 * Math.round((prev[0] - a1) / 360); a2 += 360 * Math.round((prev[1] - a2) / 360); }
        p[k] = [a1, a2];
        prev = p[k];
      });
    });
    anim._ready = true;
    return anim;
  }

  function mixLimb(a, b, u) {
    if (Array.isArray(a)) return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    return { to: [lerp(a.to[0], b.to[0], u), lerp(a.to[1], b.to[1], u)], b: a.b };
  }
  function mixPose(A, B, u) {
    var ta = tArr(A.t), tb = tArr(B.t);
    var r = {
      hip: [lerp(A.hip[0], B.hip[0], u), lerp(A.hip[1], B.hip[1], u)],
      t: [lerp(ta[0], tb[0], u), lerp(ta[1], tb[1], u)],
      h: lerp(A.h != null ? A.h : ta[1], B.h != null ? B.h : tb[1], u),
      fN: lerp(A.fN != null ? A.fN : 90, B.fN != null ? B.fN : 90, u),
      fF: lerp(A.fF != null ? A.fF : 90, B.fF != null ? B.fF : 90, u)
    };
    ['aN', 'aF', 'lN', 'lF'].forEach(function (k) {
      var a = A[k] || A[k[0] + 'N'], b = B[k] || B[k[0] + 'N'];
      r[k] = mixLimb(a, b, u);
    });
    return r;
  }

  /* position along the pose list (0 .. n-1) -> blended pose */
  function poseAt(anim, pos) {
    prepare(anim);
    var P = anim.poses, n = P.length;
    pos = Math.min(Math.max(pos, 0), n - 1);
    var i = Math.min(Math.floor(pos), n - 2);
    if (n === 1) return P[0];
    return mixPose(P[i], P[i + 1], pos - i);
  }

  /* cycle fraction u (0..1) -> position along the pose list */
  function cyclePos(anim, u) {
    var n = anim.poses ? anim.poses.length : 2;
    u = ((u % 1) + 1) % 1;
    if (anim.mode === 'cycle') return u * (n - 1);
    var f = anim.down || 0.5;                       // share of the rep spent going to the last pose
    var s = u < f ? u / f : (1 - u) / (1 - f);
    s = 0.5 - 0.5 * Math.cos(Math.PI * s);          // ease in and out
    return s * (n - 1);
  }

  /* ---------- props (furniture) ---------- */
  var props = {
    chair: function (x, seatY, back) {          // back: x of the backrest, seat extends to the right of it
      return [
        { t: 'rect', x: x, y: seatY, w: 42, h: 4, c: 'furn' },
        { t: 'rect', x: x, y: seatY - 46, w: 4, h: 50, c: 'furn' },
        { t: 'rect', x: x + 3, y: seatY + 4, w: 4, h: G - seatY - 4, c: 'furn2' },
        { t: 'rect', x: x + 35, y: seatY + 4, w: 4, h: G - seatY - 4, c: 'furn2' }
      ];
    },
    wallLeft: function (x) { return [{ t: 'rect', x: x - 600, y: -300, w: 600, h: G + 300, c: 'wall' }, { t: 'line', x1: x, y1: -300, x2: x, y2: G, c: 'wallEdge' }]; },
    wallRight: function (x) { return [{ t: 'rect', x: x, y: -300, w: 600, h: G + 300, c: 'wall' }, { t: 'line', x1: x, y1: -300, x2: x, y2: G, c: 'wallEdge' }]; },
    table: function (x, y, w) { return [{ t: 'rect', x: x, y: y, w: w, h: 5, c: 'furn' }, { t: 'rect', x: x + w - 8, y: y + 5, w: 5, h: G - y - 5, c: 'furn2' }, { t: 'rect', x: x + 3, y: y + 5, w: 5, h: G - y - 5, c: 'furn2' }]; },
    step: function (x, y, w) { return [{ t: 'rect', x: x, y: y, w: w, h: G - y, c: 'furn' }]; },
    mat: function (x1, x2) { return [{ t: 'rect', x: x1, y: G - 1, w: x2 - x1, h: 4, c: 'mat' }]; },
    post: function (x) { return [{ t: 'rect', x: x, y: 8, w: 9, h: G - 8, c: 'furn' }]; },
    towel: function (x1, x2) { return [{ t: 'rect', x: x1, y: G - 2, w: x2 - x1, h: 4, c: 'mat' }]; }
  };

  /* ---------- helpers for common body shapes ---------- */
  /* a straight body line (plank / push-up): feet at `ankle`, rising `theta` degrees toward the head */
  function line(ankle, theta) {
    var L = LEN.th + LEN.sh, r = rad(theta);
    return { hip: [ankle[0] + L * Math.cos(r), ankle[1] - L * Math.sin(r)], t: 90 + theta };
  }

  /* ---------- drawing ---------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var f1 = function (n) { return Math.round(n * 10) / 10; };
  var pt = function (p) { return f1(p[0]) + ' ' + f1(p[1]); };

  function create(svg) {
    svg.setAttribute('viewBox', '0 -16 ' + VW + ' ' + VH);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.innerHTML = '';
    var world = el('g', {}, svg);
    var back = el('g', {}, world);      // floor + furniture
    var body = el('g', {}, world);
    var cur = { anim: null, mirror: false };

    var E = {};
    function mk(name, cls, w) { E[name] = el('path', { class: 'limb ' + cls, 'stroke-width': w, fill: 'none' }, body); }
    mk('legF', 'pants far', 10); mk('footF', 'shoe far', 7); mk('armF', 'shirt far', 8);
    mk('spine', 'shirt', 14);
    E.hipDot = el('circle', { r: 7, class: 'fill-pants' }, body);
    mk('legN', 'pants', 10); mk('footN', 'shoe', 7);
    E.head = el('circle', { r: 9, class: 'fill-skin' }, body);
    mk('armN', 'shirt', 8);
    E.handF = el('circle', { r: 4.2, class: 'fill-skin far-skin' }, body);
    E.handN = el('circle', { r: 4.2, class: 'fill-skin' }, body);
    E.bag = el('g', { style: 'display:none' }, body);
    el('rect', { x: -8, y: 2, width: 16, height: 20, rx: 4, class: 'fill-bag' }, E.bag);
    el('rect', { x: -5, y: 6, width: 10, height: 6, rx: 2, class: 'fill-bag2' }, E.bag);
    E.custom = el('g', {}, body);

    function setAnim(anim, mirror) {
      cur.anim = anim; cur.mirror = !!mirror;
      world.setAttribute('transform', mirror ? 'translate(' + VW + ',0) scale(-1,1)' : '');
      back.innerHTML = '';
      el('rect', { x: -600, y: G + 3.5, width: VW + 1200, height: 200, class: 'floor' }, back);
      el('line', { x1: -600, y1: G + 3.5, x2: VW + 600, y2: G + 3.5, class: 'floorLine' }, back);
      ((anim && anim.props) || []).forEach(function (s) {
        if (s.t === 'rect') el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: s.c === 'mat' ? 2 : 1, class: 'pr-' + s.c }, back);
        else if (s.t === 'line') el('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, class: 'pr-' + s.c }, back);
        else if (s.t === 'text') { var t = el('text', { x: s.x, y: s.y, class: 'pr-label', 'text-anchor': 'middle' }, back); t.textContent = s.s; if (mirror) t.setAttribute('transform', 'translate(' + (2 * s.x) + ',0) scale(-1,1)'); }
      });
      var custom = anim && anim.custom;
      E.custom.innerHTML = '';
      ['legF', 'footF', 'armF', 'spine', 'hipDot', 'legN', 'footN', 'head', 'armN', 'handF', 'handN'].forEach(function (k) { E[k].style.display = custom ? 'none' : ''; });
      E.bag.style.display = 'none';
    }

    /* draw: opts = { u: cycle fraction } or { pos: position along poses } */
    function show(opts) {
      var anim = cur.anim; if (!anim) return;
      if (anim.custom) { anim.custom(E.custom, opts.u != null ? opts.u : 0.25, el); return; }
      var pos = opts.pos != null ? opts.pos : cyclePos(anim, opts.u || 0);
      var j = solve(poseAt(anim, pos));
      E.legF.setAttribute('d', 'M' + pt(j.hip) + 'L' + pt(j.knF) + 'L' + pt(j.anF));
      E.footF.setAttribute('d', 'M' + pt(j.anF) + 'L' + pt(j.toF));
      E.armF.setAttribute('d', 'M' + pt(j.sh) + 'L' + pt(j.elF) + 'L' + pt(j.haF));
      E.spine.setAttribute('d', 'M' + pt(j.hip) + 'L' + pt(j.mid) + 'L' + pt(j.sh));
      E.hipDot.setAttribute('cx', j.hip[0]); E.hipDot.setAttribute('cy', j.hip[1]);
      E.legN.setAttribute('d', 'M' + pt(j.hip) + 'L' + pt(j.knN) + 'L' + pt(j.anN));
      E.footN.setAttribute('d', 'M' + pt(j.anN) + 'L' + pt(j.toN));
      E.head.setAttribute('cx', j.head[0]); E.head.setAttribute('cy', j.head[1]);
      E.armN.setAttribute('d', 'M' + pt(j.sh) + 'L' + pt(j.elN) + 'L' + pt(j.haN));
      E.handF.setAttribute('cx', j.haF[0]); E.handF.setAttribute('cy', j.haF[1]);
      E.handN.setAttribute('cx', j.haN[0]); E.handN.setAttribute('cy', j.haN[1]);
      if (anim.bag) {
        E.bag.style.display = '';
        E.bag.setAttribute('transform', 'translate(' + f1(j.haN[0]) + ',' + f1(j.haN[1]) + ')');
      }
    }
    return { svg: svg, setAnim: setAnim, show: show };
  }

  root.Figure = { create: create, solve: solve, poseAt: poseAt, cyclePos: cyclePos, prepare: prepare, props: props, line: line, G: G, VW: VW, VH: VH, LEN: LEN };
})(window);
