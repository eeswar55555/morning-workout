/* rig.js — the avatar skeleton.
 *
 * Bone names follow the Mixamo convention (`mixamorigHips`, `mixamorigLeftArm` …) so that
 * Mixamo animation clips bind to this rig by name (see retarget.js).
 *
 * World: metres, Y up, avatar faces +Z, its LEFT side is +X.  T-pose, every bone's rest rotation is identity,
 * so a bone's local rotation equals its rotation relative to its parent in world axes.
 */
import * as THREE from 'three';

export const PREFIX = 'mixamorig';

const side = (n, sx) => {
  const S = (x, y, z) => [x * sx, y, z];
  return [
    [n + 'Shoulder', 'Spine2', S(0.03, 1.41, 0)],
    [n + 'Arm', n + 'Shoulder', S(0.19, 1.41, 0)],
    [n + 'ForeArm', n + 'Arm', S(0.48, 1.41, 0)],
    [n + 'Hand', n + 'ForeArm', S(0.74, 1.41, 0)],
    [n + 'HandEnd', n + 'Hand', S(0.84, 1.41, 0)],
    [n + 'UpLeg', 'Hips', S(0.095, 0.92, 0)],
    [n + 'Leg', n + 'UpLeg', S(0.095, 0.49, 0)],
    [n + 'Foot', n + 'Leg', S(0.095, 0.08, 0)],
    [n + 'ToeBase', n + 'Foot', S(0.095, 0.04, 0.13)],
    [n + 'ToeEnd', n + 'ToeBase', S(0.095, 0.02, 0.2)]
  ];
};

/* [name, parent, world rest position] — parents always come before children */
export const RIG = [
  ['Hips', null, [0, 0.98, 0]],
  ['Spine', 'Hips', [0, 1.04, 0]],
  ['Spine1', 'Spine', [0, 1.16, 0]],
  ['Spine2', 'Spine1', [0, 1.28, 0]],
  ['Neck', 'Spine2', [0, 1.46, 0.005]],
  ['Head', 'Neck', [0, 1.55, 0.01]],
  ['HeadTop_End', 'Head', [0, 1.76, 0.01]],
  ...side('Left', 1),
  ...side('Right', -1)
];

export const REST = Object.fromEntries(RIG.map(([n, , p]) => [n, p]));
export const BONE_NAMES = RIG.map(r => r[0]);
export const BONE_INDEX = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));

export const len = (a, b) => Math.hypot(REST[a][0] - REST[b][0], REST[a][1] - REST[b][1], REST[a][2] - REST[b][2]);
export const LEN = {
  arm: len('LeftArm', 'LeftForeArm'), fore: len('LeftForeArm', 'LeftHand'),
  thigh: len('LeftUpLeg', 'LeftLeg'), shin: len('LeftLeg', 'LeftFoot')
};

export function createSkeleton() {
  const bones = {}, list = [];
  for (const [n, p, pos] of RIG) {
    const b = new THREE.Bone();
    b.name = PREFIX + n;
    const pp = p ? REST[p] : [0, 0, 0];
    b.position.set(pos[0] - pp[0], pos[1] - pp[1], pos[2] - pp[2]);
    if (p) bones[p].add(b);
    bones[n] = b; list.push(b);
  }
  bones.Hips.updateMatrixWorld(true);            // the skeleton's inverse bind matrices are taken from the rest pose
  return { bones, list, root: bones.Hips, skeleton: new THREE.Skeleton(list) };
}

/* strip any Mixamo prefix: "mixamorig:Hips" / "mixamorigHips" / "Hips" -> "Hips" */
export const baseName = n => String(n).replace(/^mixamorig:?/i, '');
