/* clips.js — one place that turns an exercise config into a ready-to-play AnimationClip.
 *
 *   animationFile  -> Mixamo GLB (Draco OK), lazy-loaded and retargeted         (animation/retarget.js)
 *   animation.keys -> readable keyframes baked by the solver                      (animation/solver.js)
 *   animation.legacy -> an animation from the app's old 2D library, re-posed in 3D (legacy2d.js)
 *
 * If animationFile fails to load (missing file, offline…) the procedural `animation` is used instead,
 * so an exercise never ends up empty.
 */
import { compileKeys, bakeClip } from './solver.js';
import { legacyToKeys } from './legacy2d.js';

const cache = new Map();

async function loadGLB(url) {
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js')
  ]);
  const draco = new DRACOLoader();
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  try { return await loader.loadAsync(url); } finally { draco.dispose(); }
}

function proceduralClip(ex) {
  const a = ex.animation || {};
  let keys = a.keys, smooth = a.smooth, duration = a.duration || 3, props = ex.props || [];
  if (a.legacy) { const r = legacyToKeys(a.legacy); keys = r.keys; duration = a.duration || r.duration; smooth = 'spline'; props = props.concat(r.props); }
  if (!keys) throw new Error(`exercise "${ex.id}" has no animation (set animationFile or animation.keys)`);
  return { clip: bakeClip(ex.id, compileKeys(keys, { smooth }), duration), props };
}

export function getClip(ex, base) {
  if (cache.has(ex.id)) return cache.get(ex.id);
  const p = (async () => {
    if (ex.animationFile) {
      try {
        const { retargetClip } = await import('./retarget.js');
        const url = new URL(ex.animationFile, base || document.baseURI).href;
        const gltf = await loadGLB(url);
        const clip = gltf.animations[0];
        if (!clip) throw new Error('no animation in file');
        return { clip: retargetClip(gltf.scene, clip, { name: ex.id }), source: 'mixamo', props: ex.props || [] };
      } catch (err) {
        console.warn(`[viz] ${ex.id}: could not use ${ex.animationFile} (${err.message}); using the built-in animation`);
      }
    }
    return { ...proceduralClip(ex), source: 'procedural' };
  })();
  cache.set(ex.id, p);
  p.catch(() => cache.delete(ex.id));
  return p;
}
