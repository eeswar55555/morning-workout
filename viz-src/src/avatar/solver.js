/* solver.js — turns readable keyframes into skeleton rotations, and bakes them into AnimationClips.
 *
 * A keyframe describes WHERE the body parts are (world metres, avatar faces +Z, its left is +X, Y up):
 *   {
 *     t:       0..1   // time inside the loop (first key must be 0; the loop returns to key 0 at t = 1)
 *     hips:    [x, y, z]          // hip joint position
 *     hipsRot: [pitch, yaw, roll] // degrees. pitch > 0 leans the whole torso forward (toward +Z)
 *     spine:   [pitch, yaw, roll] // extra bend of the chest relative to the hips (cat/cow, round back …)
 *     head:    [pitch, yaw, roll] // relative to the chest (pitch < 0 looks up)
 *     arms / legs: limb spec used for BOTH sides (x is mirrored for the right side)
 *     armL, armR, legL, legR: override one side
 *     feet / footL / footR: [pitch, yaw] degrees (pitch > 0 points the toes down)
 *   }
 * A limb spec is either
 *   { to: [x, y, z], pole: [x, y, z] }                 inverse kinematics: hand/ankle goes to `to`;
 *                                                       `pole` is the direction the elbow / knee points toward
 *   { dir: [x, y, z], bend: degrees, pole: [x, y, z] } forward kinematics: upper arm/thigh points along `dir`,
 *                                                       the elbow / knee flexes `bend` degrees (away from `pole`)
 * Keys after the first only need to list what changes — everything else is inherited from the previous key.
 */
import * as THREE from 'three';
import { LEN, RIG, PREFIX, REST, createSkeleton } from './rig.js';

const D2R = Math.PI / 180;
const FIELDS = ['hips', 'hipsRot', 'spine', 'head'];
const LIMBS = ['armL', 'armR', 'legL', 'legR'];

const mirrorX = a => a && [-a[0], a[1], a[2]];
const mirrorLimb = s => {
  if (!s) return s;
  const o = { ...s };
  if (o.to) o.to = mirrorX(o.to);
  if (o.dir) o.dir = mirrorX(o.dir);
  if (o.pole) o.pole = mirrorX(o.pole);
  return o;
};

/* ---------- compile: sparse keys -> dense numeric vectors ---------- */
export function compileKeys(keys, opts = {}) {
  if (!keys || !keys.length) throw new Error('animation.keys is empty');
  const full = [];
  let prev = null;
  keys.forEach((k, i) => {
    const cur = prev ? JSON.parse(JSON.stringify(prev)) : { hips: [0, 0.98, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], feet: { L: [0, 0], R: [0, 0] }, limbs: {} };
    cur.t = k.t != null ? k.t : i / keys.length;
    FIELDS.forEach(f => { if (k[f]) cur[f] = k[f].slice(); });
    ['arm', 'leg'].forEach(g => {
      if (k[g + 's']) { cur.limbs[g + 'L'] = k[g + 's']; cur.limbs[g + 'R'] = mirrorLimb(k[g + 's']); }
      if (k[g + 'L']) cur.limbs[g + 'L'] = k[g + 'L'];
      if (k[g + 'R']) cur.limbs[g + 'R'] = k[g + 'R'];
    });
    if (k.feet) { cur.feet.L = k.feet.slice(); cur.feet.R = [k.feet[0], -k.feet[1]]; }
    if (k.footL) cur.feet.L = k.footL.slice();
    if (k.footR) cur.feet.R = k.footR.slice();
    full.push(cur); prev = cur;
  });
  if (full[0].t !== 0) full[0].t = 0;
  LIMBS.forEach(l => { if (!full[0].limbs[l]) throw new Error('animation: first key needs ' + l); });

  const types = {};
  LIMBS.forEach(l => {
    const spec = full[0].limbs[l];
    types[l] = spec.to ? 'ik' : 'fk';
    full.forEach(f => {
      const s = f.limbs[l];
      if ((s.to ? 'ik' : 'fk') !== types[l]) throw new Error('animation: limb ' + l + ' mixes "to" and "dir" between keys');
    });
  });

  const vec = f => {
    const v = [...f.hips, ...f.hipsRot, ...f.spine, ...f.head];
    LIMBS.forEach(l => {
      const s = f.limbs[l], pole = s.pole || (l[0] === 'a' ? [0, 0, -1] : [0, 0, 1]);
      if (types[l] === 'ik') v.push(...s.to, ...pole); else v.push(...s.dir, s.bend || 0, ...pole);
    });
    v.push(...f.feet.L, ...f.feet.R);
    return v;
  };
  return { times: full.map(f => f.t), vecs: full.map(vec), types, spline: opts.smooth === 'spline' };
}

/* ---------- sample the loop at u (0..1) ---------- */
function sampleVec(c, u) {
  const { times, vecs, spline } = c, n = vecs.length;
  u = ((u % 1) + 1) % 1;
  let i = n - 1;
  for (let k = 0; k < n; k++) { if (times[k] <= u) i = k; else break; }
  const j = (i + 1) % n;
  const time = k => times[((k % n) + n) % n] + Math.floor(k / n);   // periodic key times
  const t0 = time(i), t1 = time(i + 1);
  const f = t1 > t0 ? (u - t0) / (t1 - t0) : 0;
  const a = vecs[i], b = vecs[j], out = new Array(a.length);
  if (!spline) {
    const s = 0.5 - 0.5 * Math.cos(Math.PI * f);
    for (let k = 0; k < a.length; k++) out[k] = a[k] + (b[k] - a[k]) * s;
  } else {
    const h = vecs[(i - 1 + n) % n], e = vecs[(j + 1) % n];
    const th = time(i - 1), te = time(i + 2);
    const dt = t1 - t0, f2 = f * f, f3 = f2 * f;
    const h00 = 2 * f3 - 3 * f2 + 1, h10 = f3 - 2 * f2 + f, h01 = -2 * f3 + 3 * f2, h11 = f3 - f2;
    for (let k = 0; k < a.length; k++) {
      const m0 = (b[k] - h[k]) / ((t1 - th) || 1) * dt, m1 = (e[k] - a[k]) / ((te - t0) || 1) * dt;
      out[k] = h00 * a[k] + h10 * m0 + h01 * b[k] + h11 * m1;
    }
  }
  return out;
}

function unflatten(v, types) {
  let p = 0;
  const take = n => { const r = v.slice(p, p + n); p += n; return r; };
  const o = { hips: take(3), hipsRot: take(3), spine: take(3), head: take(3), limbs: {}, feet: {} };
  LIMBS.forEach(l => {
    if (types[l] === 'ik') { const to = take(3), pole = take(3); o.limbs[l] = { to, pole }; }
    else { const dir = take(3), bend = take(1)[0], pole = take(3); o.limbs[l] = { dir, bend, pole }; }
  });
  o.feet.L = take(2); o.feet.R = take(2);
  return o;
}

/* ---------- the solver: pose -> bone rotations ---------- */
const _v = () => new THREE.Vector3();
const EUL = new THREE.Euler(), QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), M4 = new THREE.Matrix4();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

function perp(v, axis, fallback) {
  const p = v.clone().addScaledVector(axis, -v.dot(axis));
  if (p.lengthSq() < 1e-6) { p.copy(fallback).addScaledVector(axis, -fallback.dot(axis)); if (p.lengthSq() < 1e-6) p.copy(Z).addScaledVector(axis, -Z.dot(axis)); }
  return p.normalize();
}
const basisQ = (d, f, out) => {
  const z = new THREE.Vector3().crossVectors(d, f).normalize();
  return out.setFromRotationMatrix(M4.makeBasis(d, f, z));
};
/* rotation that takes rest frame (d0, f0) to (d, f) */
function frameQ(d0, f0, d, f, out) {
  basisQ(d0, f0, QA); basisQ(d, f, out);
  return out.multiply(QA.invert());
}

export class Solver {
  constructor(rig) {
    this.rig = rig; this.b = rig.bones;
    this.d0 = { Left: X.clone(), Right: X.clone().negate() };
  }

  apply(p) {
    const b = this.b;
    b.Hips.position.set(p.hips[0], p.hips[1], p.hips[2]);
    const set = (bone, r, s = 1) => { EUL.set(r[0] * D2R * s, r[1] * D2R * s, r[2] * D2R * s, 'YXZ'); bone.quaternion.setFromEuler(EUL); };
    set(b.Hips, p.hipsRot);
    set(b.Spine, p.spine, 1 / 3); set(b.Spine1, p.spine, 1 / 3); set(b.Spine2, p.spine, 1 / 3);
    set(b.Neck, p.head, 0.4); set(b.Head, p.head, 0.6);
    ['LeftShoulder', 'RightShoulder', 'LeftHand', 'RightHand'].forEach(n => b[n].quaternion.identity());
    b.Hips.updateMatrixWorld(true);

    ['Left', 'Right'].forEach(side => {
      const k = side[0];
      this.limb(side, 'arm', p.limbs['arm' + k], p.feet[k]);
      this.limb(side, 'leg', p.limbs['leg' + k], p.feet[k]);
    });
  }

  limb(side, kind, spec, foot) {
    const b = this.b, isArm = kind === 'arm';
    const root = b[side + (isArm ? 'Arm' : 'UpLeg')], mid = b[side + (isArm ? 'ForeArm' : 'Leg')], end = b[side + (isArm ? 'Hand' : 'Foot')];
    const l1 = isArm ? LEN.arm : LEN.thigh, l2 = isArm ? LEN.fore : LEN.shin;
    const S = root.getWorldPosition(_v());
    const pole = new THREE.Vector3(...spec.pole);
    let d1, d2, pp;
    if (spec.to) {
      const T = new THREE.Vector3(...spec.to), dv = T.clone().sub(S);
      const dist = Math.max(1e-4, dv.length()), u = dv.clone().divideScalar(dist);
      const dd = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.002);
      const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      pp = perp(pole, u, isArm ? Z.clone().negate() : Z);
      const m = S.clone().addScaledVector(u, a).addScaledVector(pp, h);
      d1 = m.clone().sub(S).normalize();
      d2 = S.clone().addScaledVector(u, dd).sub(m).normalize();
    } else {
      d1 = new THREE.Vector3(...spec.dir).normalize();
      pp = perp(pole, d1, isArm ? Z.clone().negate() : Z);
      const th = (spec.bend || 0) * D2R;
      d2 = d1.clone().multiplyScalar(Math.cos(th)).addScaledVector(pp, -Math.sin(th)).normalize();
    }
    const front = isArm ? pp.clone().negate() : pp;          // anterior side of the limb (biceps / quadriceps)
    const d0 = isArm ? this.d0[side] : Y.clone().negate();
    const qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
    frameQ(d0, Z, d1, perp(front, d1, Z), qU);
    frameQ(d0, Z, d2, perp(front, d2, Z), qL);
    const parentQ = root.parent.getWorldQuaternion(new THREE.Quaternion());
    root.quaternion.copy(parentQ).invert().multiply(qU);
    mid.quaternion.copy(qU).invert().multiply(qL);
    if (isArm) { end.quaternion.identity(); }
    else {
      // foot: pitch about world X (toes down > 0), then yaw about world Y
      EUL.set(foot[0] * D2R, foot[1] * D2R, 0, 'YXZ');
      const qF = new THREE.Quaternion().setFromEuler(EUL);
      end.quaternion.copy(qL).invert().multiply(qF);
    }
    root.updateMatrixWorld(true);
  }
}

/* ---------- bake keyframes -> AnimationClip ---------- */
export function bakeClip(name, compiled, duration, fps = 30) {
  const rig = createSkeleton();
  rig.root.updateMatrixWorld(true);
  const solver = new Solver(rig);
  const N = Math.max(8, Math.round(duration * fps));
  const times = [], qs = {}, hipPos = [];
  RIG.forEach(([n]) => { qs[n] = []; });
  for (let f = 0; f <= N; f++) {
    const u = f / N;
    solver.apply(unflatten(sampleVec(compiled, u), compiled.types));
    times.push(u * duration);
    RIG.forEach(([n]) => { const q = rig.bones[n].quaternion; qs[n].push(q.x, q.y, q.z, q.w); });
    hipPos.push(rig.bones.Hips.position.x, rig.bones.Hips.position.y, rig.bones.Hips.position.z);
  }
  const tracks = [new THREE.VectorKeyframeTrack(PREFIX + 'Hips.position', times, hipPos)];
  RIG.forEach(([n]) => {
    const arr = qs[n];
    for (let i = 4; i < arr.length; i += 4) {   // keep consecutive quaternions in one hemisphere
      if (arr[i] * arr[i - 4] + arr[i + 1] * arr[i - 3] + arr[i + 2] * arr[i - 2] + arr[i + 3] * arr[i - 1] < 0) { arr[i] *= -1; arr[i + 1] *= -1; arr[i + 2] *= -1; arr[i + 3] *= -1; }
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(PREFIX + n + '.quaternion', times, arr));
  });
  return new THREE.AnimationClip(name, duration, tracks);
}

/* one static pose from a compiled animation (used for thumbnails / tests) */
export function poseAtU(compiled, solver, u) { solver.apply(unflatten(sampleVec(compiled, u), compiled.types)); }
export { REST };
