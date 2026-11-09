import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildBody } from '../avatar/body.js';
import { createSkeleton } from '../avatar/rig.js';
import { createBodyMaterial, createGhostMaterials, muscleLevels, writeMuscleUniforms } from '../avatar/muscles.js';
import { getClip } from '../avatar/clips.js';
import { sampleCurve } from '../registry.js';

/* dumbbells / barbell held in the hands.  Local +Y of a hand points sideways across the palm for a hanging arm
   (outward for both sides), which is exactly the bar axis of a supinated curl, a press or a deadlift. */
const METAL = new THREE.MeshStandardMaterial({ color: 0x9aa7b3, metalness: 0.7, roughness: 0.35 });
const PLATE = new THREE.MeshStandardMaterial({ color: 0x3b4854, metalness: 0.3, roughness: 0.55 });
function cyl(r, h, y, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat); m.position.y = y; return m;
}
function makeEquipment(kind, sx) {
  const g = new THREE.Group();
  g.position.x = sx * 0.055;
  if (kind === 'dumbbell') {
    g.add(cyl(0.013, 0.15, 0, METAL), cyl(0.048, 0.035, 0.07, PLATE), cyl(0.048, 0.035, -0.07, PLATE));
  } else if (kind === 'barbell') {
    g.add(cyl(0.014, 0.8, 0.2, METAL), cyl(0.16, 0.024, 0.5, PLATE), cyl(0.16, 0.024, 0.526, PLATE), cyl(0.16, 0.024, -0.1, PLATE));
  }
  return g;
}

const SHADOW_BONES =['Hips', 'Head', 'LeftFoot', 'RightFoot', 'LeftHand', 'RightHand', 'LeftLeg', 'RightLeg'];

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* The avatar: one skinned mesh + (optional) a see-through twin frozen at the ideal position.
   `live` is a ref holding the latest UI state so nothing here re-renders while the figure animates. */
export function Avatar({ ex, live, base, onProps, onLoading, onSource, apiRef }) {
  const rig = useMemo(() => {
    const body = buildBody();
    const { material, uniforms } = createBodyMaterial();
    const group = new THREE.Group();
    const mesh = new THREE.SkinnedMesh(body.geometry, material);
    mesh.frustumCulled = false;
    mesh.add(body.root);
    group.add(mesh);
    mesh.bind(body.skeleton);

    // ghost twin: its own skeleton, the same geometry; a depth pre-pass keeps overlapping limbs from stacking up
    const gs = createSkeleton();
    const gm = createGhostMaterials();
    const ghost = new THREE.Group();
    const d = new THREE.SkinnedMesh(body.geometry, gm.depth), c = new THREE.SkinnedMesh(body.geometry, gm.color);
    d.frustumCulled = c.frustumCulled = false;
    d.renderOrder = 5; c.renderOrder = 6;
    ghost.add(gs.root, d, c);
    d.bind(gs.skeleton); c.bind(gs.skeleton);
    ghost.visible = false;

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; shadow.renderOrder = -1;

    const root = new THREE.Group();
    root.add(shadow, group, ghost);
    return { root, group, ghost, body, material, uniforms, gs, shadow, gm, mixer: new THREE.AnimationMixer(group), gmixer: new THREE.AnimationMixer(ghost) };
  }, []);

  /* equipment follows the exercise config */
  useEffect(() => {
    const made = [];
    if (ex.equipment) {
      for (const [n, sx] of [['LeftHand', 1], ['RightHand', -1]]) {
        const g = makeEquipment(ex.equipment, sx);
        rig.body.bones[n].add(g); made.push(g);
      }
    }
    return () => made.forEach(g => { g.parent && g.parent.remove(g); g.traverse(o => o.geometry && o.geometry.dispose()); });
  }, [ex, rig]);

  const S = useRef({ vis: 0, bodyMix: 0, action: null, gaction: null, clip: null, t: 0, levels: null, seekU: null });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), box: new THREE.Box3() }), []);

  /* load / switch clip when the exercise changes */
  useEffect(() => {
    let dead = false;
    const s = S.current;
    s.levels = muscleLevels(ex);
    onLoading && onLoading(true);
    getClip(ex, base).then(({ clip, props, source }) => {
      if (dead) return;
      const { mixer, gmixer } = rig;
      const prev = s.action;
      const a = mixer.clipAction(clip);
      a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = ex.speed * (live.current.speed || 1);
      a.setEffectiveWeight(1);
      a.play();
      if (prev && prev !== a) { if (s.seekU != null) prev.stop(); else prev.crossFadeTo(a, 0.35, false); }
      s.action = a; s.clip = clip;
      // ghost = the ideal posture, frozen at the moment of peak effort
      if (s.gaction) s.gaction.stop();
      const ga = gmixer.clipAction(clip);
      ga.reset(); ga.play(); ga.paused = true; ga.time = (ex.ghostAt % 1) * clip.duration;
      gmixer.update(0);
      s.gaction = ga;
      onProps && onProps(props || []);
      onSource && onSource(source);
      onLoading && onLoading(false);
    }).catch(err => { console.error('[viz]', err); onLoading && onLoading(false, err); });
    return () => { dead = true; };
  }, [ex, base, rig]);

  useEffect(() => () => {
    rig.mixer.stopAllAction(); rig.gmixer.stopAllAction();
    rig.body.geometry.dispose(); rig.material.dispose(); rig.gm.depth.dispose(); rig.gm.color.dispose();
  }, [rig]);

  /* test / scrubbing hook */
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { seek: u => { S.current.seekU = u == null ? null : u; if (u == null && S.current.action) S.current.action.paused = false; } };
  }, [apiRef]);

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    const s = S.current, L = live.current, { mixer, gmixer, uniforms, group, ghost } = rig;
    group.scale.x = ghost.scale.x = L.mirror ? -1 : 1;
    ghost.visible = !!L.ghost;
    if (s.action) {
      s.action.timeScale = ex.speed * (L.speed || 1);
      if (s.seekU != null) {            // frozen at an exact phase (screenshots / scrubbing)
        s.action.paused = false; s.action.time = s.seekU * s.clip.duration; mixer.update(0); s.action.paused = true;
      } else {
        s.action.paused = !!L.paused;
        mixer.update(L.paused ? 0 : dt);
      }
    }
    const phase = s.clip && s.action ? ((s.action.time / s.clip.duration) % 1 + 1) % 1 : 0;
    const effort = sampleCurve(ex.effort, phase);

    // view mode -> uniforms
    const mode = L.mode;
    const kv = 1 - Math.exp(-dt * 7);
    s.vis += ((mode === 'normal' ? 0 : L.dim ? 0.12 : 1) - s.vis) * kv;
    s.bodyMix += ((mode === 'muscles' || mode === 'heat' ? 0.88 : 0) - s.bodyMix) * kv;
    uniforms.uBody.value = s.bodyMix;
    if (s.vis > 0.003 || s.wasOn) {
      writeMuscleUniforms(uniforms, ex, s.levels || muscleLevels(ex), mode === 'heat' ? 'heat' : 'act', effort, state.clock.elapsedTime, s.vis);
    }
    s.wasOn = s.vis > 0.003;

    // contact shadow follows the body footprint
    tmp.box.makeEmpty();
    for (const n of SHADOW_BONES) { rig.body.bones[n].getWorldPosition(tmp.v); tmp.v.y = 0; tmp.box.expandByPoint(tmp.v); }
    const c = tmp.box.getCenter(tmp.v), size = tmp.box.getSize(new THREE.Vector3());
    rig.shadow.position.x = c.x; rig.shadow.position.z = c.z;
    rig.shadow.scale.set(size.x + 0.75, size.z + 0.75, 1);
  });

  return <primitive object={rig.root} />;
}
