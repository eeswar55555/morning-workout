/* legacy2d.js — lets the 3D avatar perform the side-view animations of the app's original 2D figure library
 * (window.Figure + window.EXERCISES).  Each 2D pose is solved with the old engine, then re-expressed as a 3D
 * keyframe (hip position, torso/neck angles, limb directions).  Furniture rectangles become simple 3D props.
 *
 * The 2D view faces right, the avatar faces +Z, so 2D x -> world z, and the "near" limb is the avatar's right.
 */
const S = 0.0135;          // metres per 2D unit  (matches the 62-unit leg ~ 0.84 m)
const LIFT = 0.026;        // the 2D ankle floats 4 units above the floor line; the avatar's ankle is 0.08 m up
const D = 180 / Math.PI;

function lookup(id) {
  const list = window.EXERCISES || [];
  for (const e of list) if (e.id === id) return e;
  return null;
}

export function legacyAvailable(id) {
  const ex = lookup(id);
  return !!(window.Figure && ex && ex.anim && !ex.anim.custom && ex.anim.poses);
}

const ang = (a, b) => Math.atan2(b[0] - a[0], a[1] - b[1]) * D;     // angle from "up", positive toward the facing direction
const dir3 = (a, b) => { const x = b[0] - a[0], y = -(b[1] - a[1]), l = Math.hypot(x, y) || 1; return [0, y / l, x / l]; };   // [x, y(up), z(forward)]

/* limb directions -> {dir, bend, pole} in the sagittal plane */
function fk(root, joint, end, defaultPole) {
  const d1 = dir3(root, joint), d2 = dir3(joint, end);
  const cos = Math.min(1, Math.max(-1, d1[1] * d2[1] + d1[2] * d2[2]));
  const th = Math.acos(cos);
  let pole = defaultPole;
  if (th > 0.05) {
    // d2 = d1 cos - pp sin   ->  pp = (d1 cos - d2) / sin
    const px = [0, (d1[1] * cos - d2[1]) / Math.sin(th), (d1[2] * cos - d2[2]) / Math.sin(th)];
    pole = px;
  }
  return { dir: d1, bend: th * D, pole };
}

export function legacyToKeys(id) {
  const ex = lookup(id), F = window.Figure;
  if (!ex || !F) throw new Error('legacy animation "' + id + '" not available');
  const anim = ex.anim, K = 24;
  F.prepare(anim);
  const poses = [], frames = [];
  for (let i = 0; i < K; i++) { const p = F.poseAt(anim, F.cyclePos(anim, i / K)); poses.push(p); frames.push(F.solve(p)); }
  const xc = frames.reduce((a, j) => a + j.hip[0], 0) / K;

  const keys = frames.map((j, i) => {
    const p1 = ang(j.hip, j.mid), p2 = ang(j.mid, j.sh), ph = ang(j.sh, j.head);
    const hj = [(j.hip[0] - xc) * S, (140 - j.hip[1]) * S + LIFT];
    const r = p1 / D;
    const footPitch = a => 90 - a;
    // 2D hip = the avatar's hip joint; the Hips bone sits 6 cm above it along the torso
    const hips = [0, hj[1] + 0.06 * Math.cos(r), hj[0] + 0.06 * Math.sin(r)];
    const fN = poses[i].fN != null ? poses[i].fN : 90, fF = poses[i].fF != null ? poses[i].fF : 90;
    return {
      t: i / K,
      hips: [hips[0], hips[1], hips[2]],
      hipsRot: [p1, 0, 0],
      spine: [p2 - p1, 0, 0],
      head: [ph - p2, 0, 0],
      armR: fk(j.sh, j.elN, j.haN, [0, 0, -1]), armL: fk(j.sh, j.elF, j.haF, [0, 0, -1]),
      legR: fk(j.hip, j.knN, j.anN, [0, 0, 1]), legL: fk(j.hip, j.knF, j.anF, [0, 0, 1]),
      footR: [footPitch(fN), 0], footL: [footPitch(fF), 0]
    };
  });

  /* limb x positions (near limb = right = -x) are baked into the dir (x = 0); the avatar's own shoulder width handles the spread */
  const props = [];
  (anim.props || []).forEach(s => {
    if (s.t !== 'rect') return;
    const z0 = (s.x - xc) * S, z1 = (s.x + s.w - xc) * S, y1 = (140 - s.y) * S, y0 = (140 - s.y - s.h) * S;
    const depth = s.c === 'wall' ? 3 : s.c === 'mat' ? 0.8 : 0.5;
    // box: [centre x, y, z, size x, y, z]
    props.push({ kind: s.c, box: [0, (y0 + y1) / 2, (z0 + z1) / 2, depth, Math.abs(y1 - y0), Math.abs(z1 - z0)] });
  });
  return { keys, duration: ex.tempo ? Math.max(2, ex.tempo) : 4, props };
}
