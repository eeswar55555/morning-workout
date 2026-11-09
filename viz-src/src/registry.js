/* registry.js — validates the exercise configuration (viz-config.js) and fills in defaults. */
import { normMuscle } from './avatar/muscles.js';
import { legacyAvailable } from './avatar/legacy2d.js';

const DEFAULT_CAMERA = { position: [-3.4, 1.1, 0], target: [0, 0.85, 0], zoom: 1, extent: 1.5 };
const DEFAULT_EFFORT = [[0, 0.2], [0.5, 1], [1, 0.2]];

const muscles = list => (list || []).map(m => {
  const n = normMuscle(m);
  if (!n) console.warn('[viz] unknown muscle "' + m + '"');
  return n;
}).filter(Boolean);

export function createRegistry(cfg) {
  cfg = cfg || {};
  const cameras = cfg.cameras || {};
  const defaults = Object.assign({ view: 'combined', ghost: false, animationSpeed: 1 }, cfg.defaults);
  const byId = new Map(), alias = new Map();

  const resolveCamera = c => {
    const preset = typeof c === 'string' ? cameras[c] : c;
    if (!preset) { if (c) console.warn('[viz] unknown camera preset "' + c + '"'); return { ...DEFAULT_CAMERA }; }
    return { ...DEFAULT_CAMERA, ...preset };
  };

  (cfg.exercises || []).forEach(raw => {
    if (!raw.id) { console.warn('[viz] exercise without id skipped'); return; }
    const ex = {
      id: raw.id, name: raw.name || raw.id,
      animationFile: raw.animationFile || null,
      animation: raw.animation || null,
      camera: resolveCamera(raw.cameraPreset),
      primary: muscles(raw.primaryMuscles), secondary: muscles(raw.secondaryMuscles),
      activation: raw.activation || null,
      speed: raw.animationSpeed != null ? raw.animationSpeed : defaults.animationSpeed,
      effort: raw.effort || DEFAULT_EFFORT,
      ghostAt: raw.ghostAt != null ? raw.ghostAt : null,
      props: raw.props || [], equipment: raw.equipment || null,
      appIds: raw.appIds || []
    };
    if (ex.ghostAt == null) {   // default: the moment of peak effort
      let best = 0, bv = -1;
      ex.effort.forEach(([t, v]) => { if (v > bv) { bv = v; best = t; } });
      ex.ghostAt = best;
    }
    byId.set(ex.id, ex);
    ex.appIds.forEach(a => alias.set(a, ex));
    alias.set(ex.id, ex);
  });

  const usable = ex => {
    if (ex.animationFile) return true;
    const a = ex.animation;
    if (!a) return false;
    if (a.legacy) return legacyAvailable(a.legacy);
    return !!a.keys;
  };

  return {
    defaults,
    list: () => Array.from(byId.values()),
    get: id => alias.get(id) || null,
    has: id => { const ex = alias.get(id); return !!ex && usable(ex); }
  };
}

/* effort curve (list of [phase, level]) sampled at phase 0..1 with smooth interpolation; wraps around */
export function sampleCurve(pts, u) {
  u = ((u % 1) + 1) % 1;
  const n = pts.length;
  if (n === 1) return pts[0][1];
  let i = n - 1;
  for (let k = 0; k < n; k++) { if (pts[k][0] <= u) i = k; else break; }
  const a = pts[i], b = pts[(i + 1) % n];
  const t0 = a[0], t1 = (i + 1) % n === 0 ? b[0] + 1 : b[0];
  const uu = u < t0 ? u + 1 : u;
  const f = t1 > t0 ? (uu - t0) / (t1 - t0) : 0;
  const s = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, f)));
  return a[1] + (b[1] - a[1]) * s;
}
