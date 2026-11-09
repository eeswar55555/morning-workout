/* muscles.js — muscle activation overlay, drawn in the avatar's own shader.
 *
 * Each muscle is one or two soft ellipsoids defined in the avatar's bind pose ("body space": metres, T-pose,
 * x mirrored).  The fragment shader evaluates them against the interpolated bind-pose position, so the glow
 * sticks to the skin as the avatar moves — with no extra meshes, no z-fighting and no extra draw calls.
 * Per-frame the CPU only writes ~16 intensities and colours.
 */
import * as THREE from 'three';

export const MUSCLES = ['chest', 'shoulders', 'biceps', 'triceps', 'core', 'back', 'glutes', 'quadriceps', 'hamstrings', 'calves'];
export const MUSCLE_LABEL = {
  chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', core: 'Core', back: 'Back',
  glutes: 'Glutes', quadriceps: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves'
};
/* friendly aliases so configs can say "front deltoids", "abs", "quads" … */
export const MUSCLE_ALIAS = {
  chest: 'chest', pecs: 'chest', pectorals: 'chest',
  shoulders: 'shoulders', deltoids: 'shoulders', 'front deltoids': 'shoulders', 'front delts': 'shoulders', delts: 'shoulders',
  biceps: 'biceps', triceps: 'triceps', core: 'core', abs: 'core', abdominals: 'core', obliques: 'core',
  back: 'back', lats: 'back', traps: 'back', 'upper back': 'back', 'lower back': 'back',
  glutes: 'glutes', butt: 'glutes', quadriceps: 'quadriceps', quads: 'quadriceps', thighs: 'quadriceps',
  hamstrings: 'hamstrings', hams: 'hamstrings', calves: 'calves', calf: 'calves'
};
export const normMuscle = m => MUSCLE_ALIAS[String(m).toLowerCase().trim()] || null;

/* [muscle, cx, cy, cz, rx, ry, rz] — right half only (x is mirrored with abs) */
const REGIONS = [
  ['chest', 0.085, 1.30, 0.125, 0.095, 0.065, 0.065],
  ['shoulders', 0.205, 1.41, 0.0, 0.08, 0.085, 0.085],
  ['biceps', 0.335, 1.41, 0.045, 0.11, 0.05, 0.045],
  ['triceps', 0.335, 1.41, -0.045, 0.11, 0.05, 0.045],
  ['core', 0.0, 1.12, 0.10, 0.085, 0.125, 0.065],
  ['core', 0.15, 1.12, 0.0, 0.04, 0.10, 0.09],
  ['back', 0.10, 1.25, -0.115, 0.095, 0.13, 0.07],
  ['back', 0.05, 1.40, -0.085, 0.075, 0.065, 0.06],
  ['back', 0.0, 1.08, -0.10, 0.085, 0.07, 0.06],
  ['glutes', 0.075, 0.985, -0.095, 0.09, 0.08, 0.075],
  ['quadriceps', 0.095, 0.70, 0.075, 0.062, 0.215, 0.06],
  ['hamstrings', 0.095, 0.70, -0.075, 0.062, 0.215, 0.06],
  ['calves', 0.095, 0.30, -0.055, 0.052, 0.13, 0.05]
];
export const NR = 16;
const REGION_MUSCLE = REGIONS.map(r => MUSCLES.indexOf(r[0]));

export const MODES = ['normal', 'muscles', 'combined', 'heat'];

const GLSL_HEAD = /* glsl */`
#define NR ${NR}
uniform vec3 uRegC[NR];
uniform vec3 uRegR[NR];
uniform vec3 uRegCol[NR];
uniform float uRegI[NR];
uniform float uBody;
uniform vec3 uBodyCol;
uniform float uBindScale;
uniform vec3 uBindOff;
uniform float uRim;
varying vec3 vBind;
`;

/* Creates the avatar material (and its uniform handles) */
export function createBodyMaterial({ bindScale = 1, bindOffset = [0, 0, 0] } = {}) {
  const u = {
    uRegC: { value: new Float32Array(NR * 3) }, uRegR: { value: new Float32Array(NR * 3).fill(1) },
    uRegCol: { value: new Float32Array(NR * 3) }, uRegI: { value: new Float32Array(NR) },
    uBody: { value: 0 }, uBodyCol: { value: new THREE.Color(0x56657a) },
    uBindScale: { value: bindScale }, uBindOff: { value: new THREE.Vector3(...bindOffset) }, uRim: { value: 0.22 }
  };
  REGIONS.forEach((r, i) => {
    u.uRegC.value.set([r[1], r[2], r[3]], i * 3);
    u.uRegR.value.set([r[4], r[5], r[6]], i * 3);
  });

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vBind = (position - uBindOff) * uBindScale;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_HEAD)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        vec3 qb = vec3(abs(vBind.x), vBind.y, vBind.z);
        vec3 mAcc = vec3(0.0); float mSum = 0.0;
        for (int i = 0; i < NR; i++) {
          float d = length((qb - uRegC[i]) / uRegR[i]);
          float m = pow(1.0 - smoothstep(0.12, 1.0, d), 1.35) * uRegI[i];
          mAcc += uRegCol[i] * m; mSum += m;
        }
        vec3 mCol = mAcc / max(mSum, 1e-4);
        float mA = clamp(mSum, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uBodyCol, uBody);
        diffuseColor.rgb = mix(diffuseColor.rgb, mCol, mA * 0.62);`)
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
        totalEmissiveRadiance += mCol * mA * 0.9;
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += vec3(0.55, 0.85, 1.0) * fres * uRim;`);
  };
  mat.customProgramCacheKey = () => 'xv-body-1';
  return { material: mat, uniforms: u };
}

/* ghost = hologram-like see-through twin: a depth pre-pass (so limbs don't double up) + a fresnel colour pass */
export function createGhostMaterials() {
  const depth = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const color = new THREE.MeshBasicMaterial({ color: 0x9fb0c2, transparent: true, opacity: 0.2, depthWrite: false });
  color.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vN; varying vec3 vV;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 gN = normalize(normalMatrix * objectNormal);
        vN = gN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vV = -mvPosition.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n varying vec3 vN; varying vec3 vV;')
      .replace('#include <opaque_fragment>', `float gf = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 1.8);
        gl_FragColor = vec4(diffuseColor.rgb * (0.65 + 0.8 * gf), diffuseColor.a * (0.55 + 0.9 * gf));`);
  };
  color.customProgramCacheKey = () => 'xv-ghost-1';
  return { depth, color };
}

/* ---------- colours ---------- */
const PRIMARY = new THREE.Color(0xff2d3a), SECONDARY = new THREE.Color(0xffa31a);
const HEAT = [[0, 0x2f6bff], [0.34, 0x24d27a], [0.66, 0xffd21f], [1, 0xff2a2a]].map(([t, h]) => [t, new THREE.Color(h)]);
export function heatColor(v, out = new THREE.Color()) {
  v = Math.min(1, Math.max(0, v));
  for (let i = 0; i < HEAT.length - 1; i++) {
    const a = HEAT[i], b = HEAT[i + 1];
    if (v <= b[0]) return out.copy(a[1]).lerp(b[1], (v - a[0]) / (b[0] - a[0]));
  }
  return out.copy(HEAT[HEAT.length - 1][1]);
}
export const HEAT_CSS = 'linear-gradient(90deg,#2f6bff,#24d27a 34%,#ffd21f 66%,#ff2a2a)';

/* Activation level of every muscle for an exercise: primary 0.92, secondary 0.5, others 0.08 (heat map base).
   `activation` in the config can override single muscles with a 0..1 number. */
export function muscleLevels(ex) {
  const lv = {}; MUSCLES.forEach(m => { lv[m] = 0.08; });
  (ex.secondary || []).forEach(m => { lv[m] = 0.5; });
  (ex.primary || []).forEach(m => { lv[m] = 0.92; });
  if (ex.activation) for (const k in ex.activation) { const m = normMuscle(k); if (m) lv[m] = ex.activation[k]; }
  return lv;
}

/* Writes the shader uniforms for one frame.
   vis: 0..1 how strongly the muscle layer is shown (animated by the caller when switching view modes)
   mode: 'muscles' | 'combined' | 'heat'; effort: 0..1; t: seconds (for the pulse) */
const _c = new THREE.Color();
export function writeMuscleUniforms(u, ex, levels, mode, effort, t, vis) {
  const I = u.uRegI.value, C = u.uRegCol.value;
  const prim = new Set(ex.primary || []), sec = new Set(ex.secondary || []);
  const pulseP = 1 + 0.22 * Math.sin(t * 2 * Math.PI * 1.7);   // strong, quick
  const pulseS = 1 + 0.10 * Math.sin(t * 2 * Math.PI * 0.9);   // soft, slow
  for (let i = 0; i < NR; i++) {
    if (i >= REGIONS.length) { I[i] = 0; continue; }
    const m = MUSCLES[REGION_MUSCLE[i]];
    let level = 0;
    if (mode === 'heat') {
      heatColor(levels[m], _c);
      level = 0.55 + 0.45 * Math.min(1, levels[m] * (0.7 + 0.3 * effort) + 0.1);
    } else if (prim.has(m)) {
      _c.copy(PRIMARY);
      level = (0.34 + 0.76 * effort) * pulseP;
    } else if (sec.has(m)) {
      _c.copy(SECONDARY);
      level = (0.12 + 0.36 * effort) * pulseS;
    }
    I[i] = Math.min(1.25, level) * vis;
    C[i * 3] = _c.r; C[i * 3 + 1] = _c.g; C[i * 3 + 2] = _c.b;
  }
}
