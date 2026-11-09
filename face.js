/* face.js — face-only illustrations (pure SVG, no libraries) for facial exercises.
 *
 * The body character cannot show a jaw or a cheek, so facial exercises are drawn as a front-view face and neck.
 * An exercise opts in with a `face` entry in animations.js:
 *
 *   jaw_jut: { face: { to: { fwd: 1 }, caption: 'Lower jaw forward' } }
 *
 * The face moves from `from` (default: relaxed) to `to` as the effort goes 0 -> 1, and back. Each value is 0..1
 * (puff, smile and slide go -1..1):
 *   jaw      mouth open               slide   lower jaw sideways (+ = the person's right)     fwd    lower jaw pushed forward
 *   puff     cheeks: + puffed out, - sucked in (hollow)                                        smile  mouth corners: + up, - down
 *   wide     mouth stretched wide ("eee")       pucker  lips pushed forward ("ooo")            tongue tongue stuck out
 *   brow     eyebrows raised                    squeeze eyes screwed shut                      eyeWide eyes opened wide
 *   pitch    head tilted back (chin lifted)     down    mouth corners pulled down              neck   neck tendons tense
 * The muscles named in the exercise (primaryMuscles / secondaryMuscles: jaw, cheeks, lips, forehead, eyes, neck)
 * are tinted like on the body character, and grow brighter towards the end position.
 */
(function (root) {
  'use strict';
  var CX = 130, PRIMARY_OP = [0.14, 0.40], SECOND_OP = [0.06, 0.17];
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var r1 = function (n) { return Math.round(n * 10) / 10; };

  /* closed smooth path through points (Catmull-Rom -> cubic Bezier) */
  function closed(p) {
    var n = p.length, d = 'M' + r1(p[0][0]) + ' ' + r1(p[0][1]);
    for (var i = 0; i < n; i++) {
      var a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n], e = p[(i + 2) % n];
      d += 'C' + r1(b[0] + (c[0] - a[0]) / 6) + ' ' + r1(b[1] + (c[1] - a[1]) / 6) + ' ' + r1(c[0] - (e[0] - b[0]) / 6) + ' ' + r1(c[1] - (e[1] - b[1]) / 6) + ' ' + r1(c[0]) + ' ' + r1(c[1]);
    }
    return d + 'Z';
  }

  function init(g, el, spec, ex, thumb) {
    var S = { e: {}, reg: {} }, E = S.e;
    var svg = g.ownerSVGElement;
    if (svg) svg.setAttribute('viewBox', '0 -30 260 176');
    if (g.parentNode) g.parentNode.removeAttribute('transform');
    // body: neck and shoulders (do not tilt with the head)
    E.neck = el('path', { class: 'sk f', d: 'M' + (CX - 18) + ' 90L' + (CX - 20) + ' 140L' + (CX + 20) + ' 140L' + (CX + 18) + ' 90Z' }, g);
    E.tense = [-1, 1].map(function (s) { return el('path', { fill: 'none', 'stroke-linecap': 'round', style: 'stroke:var(--skin);stroke-width:2.2' }, g); });
    el('path', { class: 'tee', d: 'M46 160C50 138 84 130 ' + (CX - 20) + ' 126L' + (CX + 20) + ' 126C176 130 210 138 214 160Z' }, g);
    E.cap = el('text', { x: CX, y: 141, 'text-anchor': 'middle', style: 'fill:#fff;font:600 8px system-ui,sans-serif;opacity:.92' }, g);
    // head group (tilts back for "pitch")
    E.head = el('g', {}, g);
    E.earL = el('ellipse', { class: 'ear', cx: CX - 45, cy: 56, rx: 5, ry: 9 }, E.head);
    E.earR = el('ellipse', { class: 'ear', cx: CX + 45, cy: 56, rx: 5, ry: 9 }, E.head);
    E.shade = el('ellipse', { class: 'shd', cx: CX, cy: 116, rx: 22, ry: 4 }, E.head);
    E.face = el('path', { class: 'sk' }, E.head);
    E.cheekHi = [-1, 1].map(function () { return el('ellipse', { class: 'hil' }, E.head); });
    E.cheekSh = [-1, 1].map(function () { return el('ellipse', { style: 'fill:var(--skin-f)' }, E.head); });
    // muscle tints (only the muscles this exercise works)
    var P = ex.primaryMuscles || [], Sd = ex.secondaryMuscles || [];
    ['jaw', 'cheeks', 'lips', 'forehead', 'eyes', 'neck'].forEach(function (m) {
      var lvl = P.indexOf(m) >= 0 ? 0 : Sd.indexOf(m) >= 0 ? 1 : -1;
      if (lvl < 0) return;
      var parent = m === 'neck' ? g : E.head, n = (m === 'forehead' || m === 'lips') ? 1 : 2;
      S.reg[m] = { lvl: lvl, els: [] };
      for (var i = 0; i < n; i++) S.reg[m].els.push(el('ellipse', { style: 'fill:var(--' + (lvl ? 'mus2' : 'mus') + ');opacity:0', 'pointer-events': 'none' }, parent));
    });
    E.browL = el('path', { fill: 'none', 'stroke-linecap': 'round', style: 'stroke:var(--hair);stroke-width:3' }, E.head);
    E.browR = el('path', { fill: 'none', 'stroke-linecap': 'round', style: 'stroke:var(--hair);stroke-width:3' }, E.head);
    E.eyeW = [0, 1].map(function () { return el('ellipse', { style: 'fill:#fff;stroke:var(--skin-f);stroke-width:.8' }, E.head); });
    E.eyeP = [0, 1].map(function () { return el('circle', { class: 'eye' }, E.head); });
    E.nose = el('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: 'stroke:var(--skin-f);stroke-width:1.8' }, E.head);
    E.tongue = el('ellipse', { style: 'fill:#e57f8c' }, E.head);
    E.lips = el('path', { class: 'lip', style: 'stroke:#b86b66;stroke-width:.8;stroke-linejoin:round' }, E.head);
    E.inside = el('path', { style: 'fill:#3b1c22' }, E.head);
    E.seam = el('path', { fill: 'none', style: 'stroke:#8f4a4a;stroke-width:1;stroke-linecap:round' }, E.head);
    el('path', { class: 'hair', d: 'M82 42C76-2 98-16 130-16C162-16 184-2 178 42C172 22 160 8 130 8C100 8 88 22 82 42Z' }, E.head);
    S.thumb = thumb;
    return S;
  }

  function draw(S, spec, ex, e, sgn) {
    var from = spec.from || {}, to = spec.to || {}, E = S.e;
    var F = function (k) { return lerp(from[k] || 0, to[k] || 0, e); };
    var open = F('jaw'), slide = F('slide') * sgn, fwd = F('fwd'), puff = F('puff'), smile = F('smile'), wide = F('wide'), pucker = F('pucker'),
      tongue = F('tongue'), brow = F('brow'), sq = F('squeeze'), ew = F('eyeWide'), pitch = F('pitch'), down = F('down'), tense = F('neck');

    // outline: right side top -> chin, then mirrored back up the left side
    var dJ = open * 15 + fwd * 5, sx = -slide * 9, chinW = fwd * 3;
    var cheek = 42 + puff * 12, up = 44.5 + puff * 4, jaw = 34 + chinW + Math.min(0, puff) * 2;
    var R = [[0, 0, 0], [30, 5, 0], [42, 28, 0], [up, 52, 0], [cheek, 76, 0], [jaw, 96 + dJ * 0.7, 0.55], [19 + chinW, 108 + dJ * 0.95, 0.9], [0, 113 + dJ, 1]];
    var pts = R.map(function (p) { return [CX + p[0] + p[2] * sx, p[1]]; });
    for (var i = R.length - 2; i >= 1; i--) pts.push([CX - R[i][0] + R[i][2] * sx, R[i][1]]);
    E.face.setAttribute('d', closed(pts));
    E.shade.setAttribute('cy', 113 + dJ + 1); E.shade.setAttribute('style', 'opacity:' + r1(pitch * 0.25));

    // cheeks
    var cs = [-1, 1];
    cs.forEach(function (s, k) {
      E.cheekHi[k].setAttribute('cx', CX + s * (33 + puff * 6)); E.cheekHi[k].setAttribute('cy', 72 - Math.max(0, smile) * 7);
      E.cheekHi[k].setAttribute('rx', 9 + Math.max(0, puff) * 3); E.cheekHi[k].setAttribute('ry', 7); E.cheekHi[k].setAttribute('style', 'opacity:' + r1(0.35 + Math.max(0, smile) * 0.3 + Math.max(0, puff) * 0.2));
      E.cheekSh[k].setAttribute('cx', CX + s * 28); E.cheekSh[k].setAttribute('cy', 84); E.cheekSh[k].setAttribute('rx', 10); E.cheekSh[k].setAttribute('ry', 14);
      E.cheekSh[k].setAttribute('transform', 'rotate(' + (s * -16) + ' ' + (CX + s * 28) + ' 84)'); E.cheekSh[k].setAttribute('style', 'fill:var(--skin-f);opacity:' + r1(Math.max(0, -puff) * 0.85));
    });

    // brows and eyes
    var by = 40 - brow * 13 + sq * 3;
    [[100, 124, E.browL], [136, 160, E.browR]].forEach(function (b, k) {
      var o = k ? -1 : 1, y = by + (k ? 0 : 0);
      b[2].setAttribute('d', 'M' + b[0] + ' ' + r1(y + 2 + sq * 1.5) + 'Q' + (b[0] + 12) + ' ' + r1(y - 3 - brow * 3 - sq * 1.5) + ' ' + b[1] + ' ' + r1(y + 1 + (o ? 0 : 0) + sq));
    });
    var oh = Math.max(0.6, 4.4 * (1 - 0.88 * sq + 0.7 * ew - Math.max(0, smile) * 0.22));
    [CX - 18, CX + 18].forEach(function (x, k) {
      E.eyeW[k].setAttribute('cx', x); E.eyeW[k].setAttribute('cy', 55); E.eyeW[k].setAttribute('rx', 7); E.eyeW[k].setAttribute('ry', r1(oh));
      E.eyeP[k].setAttribute('cx', x); E.eyeP[k].setAttribute('cy', 55); E.eyeP[k].setAttribute('r', r1(Math.min(2.8, oh * 0.9)));
    });
    E.nose.setAttribute('d', 'M' + CX + ' 56L' + (CX - 3) + ' 76Q' + CX + ' 80 ' + (CX + 3) + ' 76');

    // mouth
    var uy = 93 + pucker * 1, ly = uy + open * 13 + 1 + fwd * 1, lt = 2.8 + pucker * 3.4 + wide * 0.2;
    var hw = Math.max(5.5, 15 + smile * 7 + wide * 9 - pucker * 9.5 - open * 1.5), cy = uy + 1 + open * 5 - smile * 5 + down * 8;
    var cl = [CX - hw, cy], cr = [CX + hw, cy], top = uy - lt, bot = ly + lt + (down ? down * 2 : 0);
    var qt = 2 * top - cy, qb = 2 * bot - cy;
    E.lips.setAttribute('d', 'M' + r1(cl[0]) + ' ' + r1(cy) + 'Q' + CX + ' ' + r1(qt) + ' ' + r1(cr[0]) + ' ' + r1(cy) + 'Q' + CX + ' ' + r1(qb) + ' ' + r1(cl[0]) + ' ' + r1(cy) + 'Z');
    if (open > 0.12 || pucker > 0.5) {
      var iu = uy - 0.5, il = Math.max(iu + 1, ly) + (pucker > 0.5 ? 1.5 : 0), ihw = hw - 2.5;
      E.inside.setAttribute('d', 'M' + r1(CX - ihw) + ' ' + r1(cy) + 'Q' + CX + ' ' + r1(2 * (iu - (pucker > 0.5 ? 1.2 : 0)) - cy) + ' ' + r1(CX + ihw) + ' ' + r1(cy) + 'Q' + CX + ' ' + r1(2 * il - cy) + ' ' + r1(CX - ihw) + ' ' + r1(cy) + 'Z');
      E.inside.setAttribute('style', 'fill:#3b1c22;opacity:' + r1(Math.min(1, Math.max(open * 3, pucker > 0.5 ? (pucker - 0.5) * 2 : 0))));
      E.seam.setAttribute('d', '');
    } else {
      E.inside.setAttribute('style', 'opacity:0');
      E.seam.setAttribute('d', 'M' + r1(cl[0] + 1) + ' ' + r1(cy) + 'Q' + CX + ' ' + r1(2 * (uy + 0.6) - cy + smile * 4) + ' ' + r1(cr[0] - 1) + ' ' + r1(cy));
    }
    E.tongue.setAttribute('cx', CX); E.tongue.setAttribute('cy', r1(ly + lt + tongue * 8));
    E.tongue.setAttribute('rx', 8); E.tongue.setAttribute('ry', r1(Math.max(0.1, tongue * 11)));

    // neck tendons
    E.tense.forEach(function (t, k) {
      var s = k ? 1 : -1, y0 = 113 + dJ;
      t.setAttribute('d', 'M' + (CX + s * 9) + ' ' + r1(y0 + 2) + 'Q' + (CX + s * 14) + ' ' + r1(y0 + 18) + ' ' + (CX + s * 12) + ' 140');
      t.setAttribute('style', 'stroke:var(--skin);stroke-width:2.2;opacity:' + r1(tense * 0.95));
    });
    // head tilt back: squash the face a little and lift it
    var py = 1 - 0.17 * pitch;
    E.head.setAttribute('transform', 'translate(0 ' + r1(-5 * pitch) + ') translate(' + CX + ' 60) scale(1 ' + r1(py) + ') translate(' + (-CX) + ' -60)');

    // muscle tints
    var geo = {
      jaw: [[CX - 28 + sx * 0.5, 94 + dJ * 0.7, 8, 11, 18], [CX + 28 + sx * 0.5, 94 + dJ * 0.7, 8, 11, -18]],
      cheeks: [[CX - (34 + puff * 8), 72, 11, 9, 0], [CX + (34 + puff * 8), 72, 11, 9, 0]],
      lips: [[CX, (uy + ly) / 2 + 1, hw + 7, 10 + open * 5, 0]],
      forehead: [[CX, 21 - brow * 5, 31, 10, 0]],
      eyes: [[CX - 18, 55, 12, 7, 0], [CX + 18, 55, 12, 7, 0]],
      neck: [[CX - 11, 122, 7, 15, 6], [CX + 11, 122, 7, 15, -6]]
    };
    Object.keys(S.reg).forEach(function (m) {
      var r = S.reg[m], op = r.lvl ? SECOND_OP : PRIMARY_OP, o = r1(lerp(op[0], op[1], Math.max(e, 0.15)));
      r.els.forEach(function (x, i) {
        var g = geo[m][i];
        x.setAttribute('cx', r1(g[0])); x.setAttribute('cy', r1(g[1])); x.setAttribute('rx', g[2]); x.setAttribute('ry', g[3]);
        x.setAttribute('transform', g[4] ? 'rotate(' + g[4] + ' ' + r1(g[0]) + ' ' + r1(g[1]) + ')' : '');
        x.style.opacity = o;
      });
    });
    E.cap.textContent = S.thumb ? '' : (spec.caption || '');
  }

  /* Build the anim object the illustration engine understands (see illus.js: custom drawings). */
  function build(spec, ex) {
    return {
      poses: [{}, {}], face: true, noFloor: true, dynamic: !!spec.dynamic, down: spec.down, _cfg: {}, _ex: ex,
      custom: function (g, u, el, pos, mirror) {
        if (!g._face || !g.firstChild) {
          g.innerHTML = '';
          var svg = g.ownerSVGElement, thumb = !!(svg && svg.parentNode && /(^|\s)thumb(\s|$)/.test(svg.parentNode.className || ''));
          g._face = init(g, el, spec, ex, thumb);
        }
        draw(g._face, spec, ex, Math.min(1, Math.max(0, pos == null ? 0.25 : pos)), mirror ? -1 : 1);
      }
    };
  }

  root.Face = { build: build };
})(window);
