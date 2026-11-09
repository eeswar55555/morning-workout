/* body.js — builds the low-poly athletic avatar as ONE smooth-skinned mesh (one draw call, no textures).
 *
 * The mesh is generated from lofted rings, weighted to the Mixamo-named skeleton in rig.js.
 * Vertex colours carry the clothing (skin / top / shorts / shoes / hair).
 */
import * as THREE from 'three';
import { createSkeleton, BONE_INDEX as BI } from './rig.js';

const C = h => new THREE.Color(h);
export const PALETTE = {
  skin: C(0xd7a583), top: C(0x33485c), shorts: C(0x1d2733), shoe: C(0xeef2f5), sole: C(0x2dd4bf), hair: C(0x2a2320)
};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

class Builder {
  constructor() { this.pos = []; this.col = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; }

  vert(p, w, c) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
    const ws = w.filter(a => a[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    let sum = 0; ws.forEach(a => { sum += a[1]; });
    for (let i = 0; i < 4; i++) {
      this.si.push(ws[i] ? ws[i][0] : 0);
      this.sw.push(ws[i] ? ws[i][1] / sum : 0);
    }
    return this.n++;
  }

  /* rings: [{c: Vector3 centre, ax: Vector3 axis, f: Vector3 "front" (perpendicular to ax), rx, rz, w: weights, col}]
     The cross-section is an ellipse: rx along (ax x f), rz along f.  Ends are closed with a flat cap. */
  tube(rings, segs) {
    const rs = rings.slice();
    const a = rs[0], b = rs[rs.length - 1];
    rs.unshift({ ...a, rx: a.rx * 0.02, rz: a.rz * 0.02 });
    rs.push({ ...b, rx: b.rx * 0.02, rz: b.rz * 0.02 });
    const base = this.n;
    for (const r of rs) {
      const s = new THREE.Vector3().crossVectors(r.ax, r.f).normalize();
      for (let k = 0; k < segs; k++) {
        const th = (k / segs) * Math.PI * 2;
        const p = r.c.clone().addScaledVector(s, Math.cos(th) * r.rx).addScaledVector(r.f, Math.sin(th) * r.rz);
        this.vert(p, r.w, r.col);
      }
    }
    for (let i = 0; i < rs.length - 1; i++) {
      for (let k = 0; k < segs; k++) {
        const k1 = (k + 1) % segs;
        const A = base + i * segs + k, B = base + i * segs + k1, Cc = base + (i + 1) * segs + k, D = base + (i + 1) * segs + k1;
        this.idx.push(A, Cc, B, B, Cc, D);
      }
    }
  }

  /* ellipsoid whose long axis is `ax` */
  ellipsoid(c, ax, f, half, rx, rz, w, col, segs = 12, rows = 8) {
    const rings = [];
    for (let i = 0; i <= rows; i++) {
      const phi = (i / rows) * Math.PI, t = -Math.cos(phi), s = Math.max(Math.sin(phi), 0.02);
      const colr = typeof col === 'function' ? col(t) : col;
      rings.push({ c: c.clone().addScaledVector(ax, half * t), ax, f, rx: rx * s, rz: rz * s, w, col: colr });
    }
    // plain tube() would add caps; the poles already close the shape, so build without them
    const base = this.n;
    for (const r of rings) {
      const sv = new THREE.Vector3().crossVectors(r.ax, r.f).normalize();
      for (let k = 0; k < segs; k++) {
        const th = (k / segs) * Math.PI * 2;
        this.vert(r.c.clone().addScaledVector(sv, Math.cos(th) * r.rx).addScaledVector(r.f, Math.sin(th) * r.rz), r.w, r.col);
      }
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < segs; k++) {
        const k1 = (k + 1) % segs;
        const A = base + i * segs + k, B = base + i * segs + k1, Cc = base + (i + 1) * segs + k, D = base + (i + 1) * segs + k1;
        this.idx.push(A, Cc, B, B, Cc, D);
      }
    }
  }
}

/* linear profile through keys [[t, ...values]] */
function prof(keys) {
  return t => {
    if (t <= keys[0][0]) return keys[0].slice(1);
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) { const u = (t - a[0]) / (b[0] - a[0]); return a.slice(1).map((v, j) => v + (b[j + 1] - v) * u); }
    }
    return keys[keys.length - 1].slice(1);
  };
}

/* weights blended along a chain of bones ordered along the axis coordinate t */
function chain(t, list) {
  if (t <= list[0][1]) return [[BI[list[0][0]], 1]];
  for (let i = 0; i < list.length - 1; i++) {
    const [na, ta] = list[i], [nb, tb] = list[i + 1];
    if (t <= tb) { const u = sstep(ta, tb, t); return [[BI[na], 1 - u], [BI[nb], u]]; }
  }
  return [[BI[list[list.length - 1][0]], 1]];
}

export function buildBody() {
  const rig = createSkeleton();
  const B = new Builder();
  const UP = V(0, 1, 0), DOWN = V(0, -1, 0), FRONT = V(0, 0, 1);

  /* ---- torso (pelvis -> neck base), axis +Y ---- */
  const torsoP = prof([
    [0.88, 0.140, 0.100, -0.005], [0.96, 0.172, 0.118, -0.008], [1.02, 0.160, 0.108, -0.002],
    [1.10, 0.140, 0.098, 0.004], [1.18, 0.146, 0.104, 0.010], [1.26, 0.166, 0.116, 0.014],
    [1.34, 0.178, 0.116, 0.004], [1.40, 0.170, 0.100, -0.004], [1.45, 0.120, 0.080, -0.006], [1.49, 0.062, 0.058, -0.004]
  ]);
  const TORSO_W = [['Hips', 0.98], ['Spine', 1.04], ['Spine1', 1.16], ['Spine2', 1.28], ['Neck', 1.5]];
  // [y, colour]; a repeated y gives a hard colour edge (shorts | top, top | skin)
  const rows = [[0.88, 'shorts'], [0.92, 'shorts'], [0.96, 'shorts'], [1.0, 'shorts'], [1.0, 'top'], [1.04, 'top'], [1.08, 'top'],
    [1.12, 'top'], [1.16, 'top'], [1.20, 'top'], [1.24, 'top'], [1.28, 'top'], [1.32, 'top'], [1.36, 'top'], [1.40, 'top'],
    [1.40, 'skin'], [1.45, 'skin'], [1.49, 'skin']];
  const torsoRings = rows.map(([y, c]) => {
    const [rx, rz, zc] = torsoP(y);
    return { c: V(0, y, zc), ax: UP, f: FRONT, rx, rz, w: chain(y, TORSO_W), col: PALETTE[c] };
  });
  B.tube(torsoRings, 18);

  /* ---- neck + head ---- */
  const NECK_W = [['Spine2', 1.38], ['Neck', 1.46], ['Head', 1.56]];
  const neckRings = [];
  for (let y = 1.42; y <= 1.58; y += 0.04) neckRings.push({ c: V(0, y, 0.005), ax: UP, f: FRONT, rx: 0.044, rz: 0.046, w: chain(y, NECK_W), col: PALETTE.skin });
  B.tube(neckRings, 10);
  B.ellipsoid(V(0, 1.655, 0.015), UP, FRONT, 0.118, 0.09, 0.105, [[BI.Head, 1]],
    t => (t > 0.45 ? PALETTE.hair : PALETTE.skin), 14, 10);

  /* ---- arms (both sides) ---- */
  const armP = prof([[0.10, 0.058], [0.19, 0.062], [0.34, 0.054], [0.48, 0.046], [0.56, 0.048], [0.68, 0.036], [0.74, 0.030]]);
  for (const [n, sx] of [['Left', 1], ['Right', -1]]) {
    const ax = V(sx, 0, 0);
    const rings = [];
    for (let x = 0.10; x <= 0.74001; x += 0.04) {
      const r = armP(x);
      const wA = sstep(0.12, 0.26, x), wF = sstep(0.43, 0.53, x);
      rings.push({
        c: V(sx * x, 1.41, 0), ax, f: FRONT, rx: r[0], rz: r[0],
        w: [[BI.Spine2, 1 - wA], [BI[n + 'Arm'], wA * (1 - wF)], [BI[n + 'ForeArm'], wA * wF]], col: PALETTE.skin
      });
    }
    B.tube(rings, 10);
    // shoulder cap (deltoid ball), elbow, hand
    B.ellipsoid(V(sx * 0.2, 1.405, 0), V(sx, 0, 0), FRONT, 0.066, 0.064, 0.066, [[BI[n + 'Arm'], 1]], PALETTE.skin, 10, 7);
    B.ellipsoid(V(sx * 0.48, 1.41, 0), V(sx, 0, 0), FRONT, 0.046, 0.044, 0.044, [[BI[n + 'ForeArm'], 0.5], [BI[n + 'Arm'], 0.5]], PALETTE.skin, 10, 6);
    B.ellipsoid(V(sx * 0.795, 1.41, 0), V(sx, 0, 0), FRONT, 0.072, 0.024, 0.044, [[BI[n + 'Hand'], 1]], PALETTE.skin, 10, 6);
  }

  /* ---- legs (both sides) ---- */
  const legP = prof([[0.12, 0.040], [0.20, 0.048], [0.34, 0.063], [0.46, 0.058], [0.54, 0.065], [0.70, 0.082], [0.86, 0.094], [0.97, 0.098]]);
  for (const [n, sx] of [['Left', 1], ['Right', -1]]) {
    const x = 0.095 * sx;
    const rings = [];
    const ys = [];
    for (let y = 0.12; y <= 0.97001; y += 0.04) ys.push(y);
    const HEM = 0.66;
    const push = (y, col, extra = 0) => {
      const r = legP(y)[0] + extra;
      const wH = 1 - sstep(0.88, 0.98, y), wS = 1 - sstep(0.44, 0.54, y), wFt = 1 - sstep(0.10, 0.18, y);
      const leg = wH * (1 - wS), shin = wH * wS;
      rings.push({
        c: V(x, y, 0), ax: DOWN, f: FRONT, rx: r, rz: r,
        w: [[BI.Hips, 1 - wH], [BI[n + 'UpLeg'], leg], [BI[n + 'Leg'], shin * (1 - wFt)], [BI[n + 'Foot'], shin * wFt]], col
      });
    };
    // rings run from the top (y high) to the bottom: ax = DOWN
    const top = ys.slice().reverse();
    let hemDone = false;
    for (const y of top) {
      if (!hemDone && y < HEM) {
        push(HEM, PALETTE.shorts, 0.004); push(HEM, PALETTE.skin, 0); hemDone = true;
      }
      push(y, y > HEM ? PALETTE.shorts : PALETTE.skin, y > HEM ? 0.004 : 0);
    }
    B.tube(rings, 12);
    // knee ball + shoe
    B.ellipsoid(V(x, 0.49, 0.006), UP, FRONT, 0.062, 0.056, 0.058, [[BI[n + 'Leg'], 0.5], [BI[n + 'UpLeg'], 0.5]], PALETTE.skin, 10, 6);
    B.ellipsoid(V(x, 0.052, 0.07), FRONT, V(0, 1, 0), 0.122, 0.047, 0.05, [[BI[n + 'Foot'], 1]],
      t => (t > 0.62 ? PALETTE.sole : PALETTE.shoe), 12, 8);
  }

  /* ---- geometry ---- */
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(B.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(B.sw, 4));
  g.setIndex(B.idx);
  g.computeVertexNormals();
  g.boundingSphere = new THREE.Sphere(V(0, 0.9, 0), 1.9);   // generous: the skinned pose can reach far from the bind pose
  g.boundingBox = new THREE.Box3(V(-1, -0.1, -1), V(1, 2, 1));
  return { geometry: g, ...rig };
}
