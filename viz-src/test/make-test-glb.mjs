/* Makes a Mixamo-LIKE test file (different size, arbitrary bone frames, Draco-compressed mesh) from one of the built-in
 * animations, so the whole GLB path (GLTFLoader + Draco decode + retarget) can be tested without a Mixamo account.
 *   node test/make-test-glb.mjs <exercise-id> <out.glb>        e.g.  squat  ../viz-assets/test/squat.glb */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { RIG, REST } from '../src/avatar/rig.js';
import { compileKeys, bakeClip } from '../src/avatar/solver.js';

const [id = 'squat', out = 'test.glb'] = process.argv.slice(2);
globalThis.window = {};
new Function(fs.readFileSync(new URL('../../viz-config.js', import.meta.url), 'utf8'))();   // sets window.EXERCISE_VIZ via global `window`
const cfg = globalThis.window.EXERCISE_VIZ.exercises.find(e => e.id === id);
if (!cfg || !cfg.animation.keys) throw new Error('need an exercise with animation.keys');
const clip = bakeClip(id, compileKeys(cfg.animation.keys, { smooth: cfg.animation.smooth }), cfg.animation.duration);

/* "Mixamo-like" source rig: 1.1x size, random local rest frames */
const SCALE = 1.1;
const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const restLocal = {}, restWorld = {};
for (const [n, p] of RIG) {
  restLocal[n] = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2));
  restWorld[n] = (p ? restWorld[p].clone() : new THREE.Quaternion()).multiply(restLocal[n]);
}

/* sample the avatar clip -> desired world delta per bone -> source-local rotations */
const times = clip.tracks[0].times, N = times.length;
const avQ = {}; clip.tracks.forEach(t => { if (t.name.endsWith('.quaternion')) avQ[t.name.replace(/^mixamorig|\.quaternion$/g, '')] = t.values; });
const hipsT = clip.tracks.find(t => t.name.endsWith('Hips.position')).values;
const rot = {}; RIG.forEach(([n]) => { rot[n] = []; });
for (let i = 0; i < N; i++) {
  const avWorld = {}, srcWorld = {};
  for (const [n, p] of RIG) {
    const l = new THREE.Quaternion().fromArray(avQ[n], i * 4);
    avWorld[n] = (p ? avWorld[p].clone() : new THREE.Quaternion()).multiply(l);        // avatar rest world = identity, so this IS the delta
    srcWorld[n] = avWorld[n].clone().multiply(restWorld[n]);                              // desired world orientation of the source bone
    const parentW = p ? srcWorld[p] : new THREE.Quaternion();
    const local = parentW.clone().invert().multiply(srcWorld[n]);
    rot[n].push(local.x, local.y, local.z, local.w);
  }
}
const hips = [];
for (let i = 0; i < N; i++) hips.push(hipsT[i * 3] * SCALE, hipsT[i * 3 + 1] * SCALE, hipsT[i * 3 + 2] * SCALE);

/* build the glTF */
const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene();
const nodes = {};
for (const [n, p, pos] of RIG) {
  const pp = p ? REST[p] : [0, 0, 0];
  const node = doc.createNode('mixamorig:' + n)
    .setTranslation([(pos[0] - pp[0]) * SCALE, (pos[1] - pp[1]) * SCALE, (pos[2] - pp[2]) * SCALE])
    .setRotation(restLocal[n].toArray());
  nodes[n] = node;
  if (p) nodes[p].addChild(node); else scene.addChild(node);
}
const anim = doc.createAnimation(id);
const tIn = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buf);
const chan = (node, path, type, arr) => {
  const out = doc.createAccessor().setType(type).setArray(new Float32Array(arr)).setBuffer(buf);
  const s = doc.createAnimationSampler().setInput(tIn).setOutput(out).setInterpolation('LINEAR');
  anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
};
for (const [n] of RIG) chan(nodes[n], 'rotation', 'VEC4', rot[n]);
chan(nodes.Hips, 'translation', 'VEC3', hips);

// a tiny Draco-compressed mesh, so the Draco decoder path is exercised too
const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0, 0.1, 0.1, 0])).setBuffer(buf);
const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 2, 1, 3])).setBuffer(buf);
const mesh = doc.createMesh('tri').addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx));
scene.addChild(doc.createNode('tri').setMesh(mesh).setTranslation([2, 0, 0]));
doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER });

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule()
});
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
await io.write(out, doc);
console.log('wrote', out, fs.statSync(out).size, 'bytes,', N, 'frames');
