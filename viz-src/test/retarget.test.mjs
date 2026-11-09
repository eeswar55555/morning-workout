/* Unit test for the Mixamo retargeter: no browser, no GLB file needed.
 * Builds a fake "Mixamo" armature with a different size and arbitrary bone-local rest orientations, animates one bone
 * by a known world-space rotation, retargets, and checks that the avatar reproduces exactly that rotation.
 *   run:  node test/retarget.test.mjs */
import * as THREE from 'three';
import { RIG, PREFIX, REST, createSkeleton } from '../src/avatar/rig.js';
import { retargetClip } from '../src/avatar/retarget.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error('FAIL', msg); } else console.log('ok  ', msg); };
const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
const qNear = (a, b) => Math.abs(a.dot(b)) > 1 - 1e-5;

/* fake source rig: 1.2x taller, random (but fixed) local rest rotations, "mixamorig" prefix (GLTFLoader strips the colon) */
const SCALE = 1.2;
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const src = new THREE.Group(), sb = {};
for (const [n, p, pos] of RIG) {
  const b = new THREE.Bone(); b.name = 'mixamorig' + n;
  const pp = p ? REST[p] : [0, 0, 0];
  b.position.set((pos[0] - pp[0]) * SCALE, (pos[1] - pp[1]) * SCALE, (pos[2] - pp[2]) * SCALE);
  b.quaternion.setFromEuler(new THREE.Euler(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5));   // arbitrary local frame
  (p ? sb[p] : src).add(b); sb[n] = b;
}
src.updateMatrixWorld(true);
const rest = {}; for (const n in sb) rest[n] = sb[n].getWorldQuaternion(new THREE.Quaternion());

/* clip: LeftArm gets world rotation D (70 deg about Z) relative to rest; hips rise by 0.12 m */
const D = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 70 * Math.PI / 180);
const parentRest = rest.Shoulder || rest.LeftShoulder;
const W = D.clone().multiply(rest.LeftArm);
const A = parentRest.clone().invert().multiply(W);        // local animation quaternion that yields world rotation D*rest
const times = [0, 1];
const tracks = [];
for (const n in sb) {
  const q = n === 'LeftArm' ? A : sb[n].quaternion;
  tracks.push(new THREE.QuaternionKeyframeTrack(`mixamorig${n}.quaternion`, times, [...q.toArray(), ...q.toArray()]));
}
const h0 = sb.Hips.position;
tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', times, [h0.x, h0.y, h0.z, h0.x + 0.3, h0.y + 0.12, h0.z + 0.2]));
const clip = new THREE.AnimationClip('t', 1, tracks);

const out = retargetClip(src, clip, { fps: 10, inPlace: true });
ok(out.tracks.length === RIG.length + 1, 'one quaternion track per bone plus hips position');

/* apply to the avatar rig and read back world rotations */
const rig = createSkeleton();
const group = new THREE.Group(); group.add(rig.root);
const mixer = new THREE.AnimationMixer(group);
const act = mixer.clipAction(out); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play(); mixer.setTime(1);
group.updateMatrixWorld(true);

const wq = n => rig.bones[n].getWorldQuaternion(new THREE.Quaternion());
ok(qNear(wq('LeftArm'), D), 'LeftArm world rotation equals the animated world rotation');
ok(qNear(wq('LeftForeArm'), D), 'child bone inherits it (no extra rotation)');
ok(qNear(wq('RightArm'), new THREE.Quaternion()), 'RightArm stays at the T-pose');
ok(qNear(wq('Spine1'), new THREE.Quaternion()) && qNear(wq('LeftUpLeg'), new THREE.Quaternion()), 'untouched bones stay at rest');
const hp = rig.bones.Hips.position;
ok(near(hp.y, REST.Hips[1] + 0.12 * (REST.Hips[1] / (REST.Hips[1] * SCALE)), 1e-3), `hips height is scaled to the avatar (${hp.y.toFixed(3)})`);
ok(near(hp.x, 0) && near(hp.z, 0), 'in-place: no horizontal drift');

console.log(fails ? `\n${fails} FAILED` : '\nall retarget tests passed');
process.exit(fails ? 1 : 0);
