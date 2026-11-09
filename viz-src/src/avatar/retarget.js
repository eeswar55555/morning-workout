/* retarget.js — plays Mixamo clips on the procedural avatar.
 *
 * Mixamo characters differ in bone orientation and proportions, so a clip can't be copied track-for-track.
 * Instead we re-solve it in world space: for every frame, take how far each source bone has rotated away from
 * its rest orientation (in world axes), and apply the same world rotation to the avatar's T-pose.
 * The result is baked once at load time into an ordinary AnimationClip on the avatar's bones (30 fps).
 *
 * Works with Mixamo "Without skin" downloads converted to GLB (only the armature + clip is needed).
 */
import * as THREE from 'three';
import { RIG, PREFIX, REST, baseName } from './rig.js';

export function retargetClip(srcRoot, srcClip, { fps = 30, inPlace = true, name } = {}) {
  const src = {};
  srcRoot.traverse(o => { if (o.isBone || /^mixamorig/i.test(o.name)) src[baseName(o.name)] = o; });
  if (!src.Hips) throw new Error('retarget: no Hips bone found — is this a Mixamo rig?');

  srcRoot.updateMatrixWorld(true);
  const restQ = {}, tmpQ = new THREE.Quaternion();
  for (const n in src) restQ[n] = src[n].getWorldQuaternion(new THREE.Quaternion());
  const restHip = src.Hips.getWorldPosition(new THREE.Vector3());
  // scale source motion to the avatar's size (hip height ratio)
  const k = REST.Hips[1] / Math.max(1e-4, restHip.y);

  const mixer = new THREE.AnimationMixer(srcRoot);
  const action = mixer.clipAction(srcClip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();   // t = duration must evaluate the LAST frame, not wrap to 0

  const dur = srcClip.duration, N = Math.max(2, Math.round(dur * fps));
  const times = [], qs = {}, hip = [];
  RIG.forEach(([n]) => { qs[n] = []; });
  const worldQ = {};
  const p = new THREE.Vector3();

  for (let f = 0; f <= N; f++) {
    const t = Math.min(dur, (f / N) * dur);
    mixer.setTime(t);
    srcRoot.updateMatrixWorld(true);
    times.push(t);
    for (const [n, parent] of RIG) {
      let wq;
      if (src[n]) {
        src[n].getWorldQuaternion(tmpQ);
        wq = tmpQ.clone().multiply(restQ[n].clone().invert());   // world delta; the avatar rest pose has identity world rotations
      } else {
        wq = parent ? worldQ[parent].clone() : new THREE.Quaternion();
      }
      worldQ[n] = wq;
      const local = parent ? worldQ[parent].clone().invert().multiply(wq) : wq.clone();
      qs[n].push(local.x, local.y, local.z, local.w);
    }
    src.Hips.getWorldPosition(p);
    hip.push(inPlace ? 0 : (p.x - restHip.x) * k, REST.Hips[1] + (p.y - restHip.y) * k, inPlace ? 0 : (p.z - restHip.z) * k);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(srcRoot);

  const tracks = [new THREE.VectorKeyframeTrack(PREFIX + 'Hips.position', times, hip)];
  RIG.forEach(([n]) => {
    const a = qs[n];
    for (let i = 4; i < a.length; i += 4) {
      if (a[i] * a[i - 4] + a[i + 1] * a[i - 3] + a[i + 2] * a[i - 2] + a[i + 3] * a[i - 1] < 0) { a[i] *= -1; a[i + 1] *= -1; a[i + 2] *= -1; a[i + 3] *= -1; }
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(PREFIX + n + '.quaternion', times, a));
  });
  return new THREE.AnimationClip(name || srcClip.name || 'clip', dur, tracks);
}
