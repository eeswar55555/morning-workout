/* Shrinks a Mixamo animation (or character) GLB for the web.
 *   node scripts/optimize-glb.mjs <in.glb> <out.glb>
 * - keeps only the rotation tracks of the bones the avatar uses (no fingers, no scale tracks) + hips translation
 * - removes duplicate / unused data, resamples redundant keyframes
 * - Draco-compresses any mesh (a "with skin" character); animation-only files have no mesh and stay tiny
 * Mixamo downloads FBX: convert first, e.g.  npx fbx2gltf --binary --input walk.fbx --output walk.glb   (or Blender) */
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { RIG } from '../src/avatar/rig.js';

const [inp, outp] = process.argv.slice(2);
if (!inp || !outp) { console.error('usage: node scripts/optimize-glb.mjs <in.glb> <out.glb>'); process.exit(1); }

const keep = new Set(RIG.map(r => r[0]));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule()
});
const doc = await io.read(inp);

let dropped = 0, kept = 0;
for (const anim of doc.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    const name = ((ch.getTargetNode() || {}).getName?.() || '').replace(/^mixamorig:?/i, '');
    const path = ch.getTargetPath();
    if (!keep.has(name) || path === 'scale' || (path === 'translation' && name !== 'Hips')) { ch.dispose(); dropped++; } else kept++;
  }
}
const steps = [resample(), prune(), dedup()];
if (doc.getRoot().listMeshes().length) steps.push(draco({ method: 'edgebreaker' }));
await doc.transform(...steps);
await io.write(outp, doc);
console.log(`${inp} (${fs.statSync(inp).size} B) -> ${outp} (${fs.statSync(outp).size} B); channels kept ${kept}, dropped ${dropped}`);
