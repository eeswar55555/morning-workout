import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Smoothly flies the camera to the exercise's preset ({position, target, zoom}) and layers the user's orbit/pinch on top.
   orbit = ref { az, el, scale } in radians / multiplier; the preset distance is widened on narrow (portrait) screens
   so the whole body stays in view. */
export function CameraRig({ preset, orbit }) {
  const { camera, size } = useThree();
  const cur = useRef(null);
  const tmp = useRef({ t: new THREE.Vector3(), o: new THREE.Vector3() });

  // lift the picture ~7% so the legend / controls at the bottom never sit on the feet
  useEffect(() => {
    camera.setViewOffset(size.width, size.height, 0, size.height * 0.07, size.width, size.height);
    return () => camera.clearViewOffset();
  }, [camera, size.width, size.height]);

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05);
    const aspect = size.width / Math.max(1, size.height), half = Math.tan(camera.fov * D2R / 2);
    const { t, o } = tmp.current;
    t.fromArray(preset.target);
    o.fromArray(preset.position).sub(t);
    let r = o.length();
    const az0 = Math.atan2(o.x, o.z), el0 = Math.asin(clamp(o.y / r, -1, 1));
    // zoom > 1 moves in; the distance never drops below what is needed to keep the whole subject in frame
    const fitW = ((preset.extent || 1.2) / 2) / (half * aspect);
    const fitH = ((preset.height || 1.9) / 2) / half;
    r = Math.max(r / (preset.zoom || 1), fitW, fitH);

    const g = {
      r: r * orbit.current.scale, az: az0 + orbit.current.az, el: clamp(el0 + orbit.current.el, -0.25, 1.45),
      tx: t.x, ty: t.y, tz: t.z
    };
    if (!cur.current) cur.current = { ...g };
    const c = cur.current, k = 1 - Math.exp(-dt * 5);
    let da = g.az - c.az; da = Math.atan2(Math.sin(da), Math.cos(da));   // shortest way round
    c.az += da * k; c.el += (g.el - c.el) * k; c.r += (g.r - c.r) * k;
    c.tx += (g.tx - c.tx) * k; c.ty += (g.ty - c.ty) * k; c.tz += (g.tz - c.tz) * k;

    const ce = Math.cos(c.el);
    camera.position.set(c.tx + c.r * ce * Math.sin(c.az), c.ty + c.r * Math.sin(c.el), c.tz + c.r * ce * Math.cos(c.az));
    camera.lookAt(c.tx, c.ty, c.tz);
  });
  return null;
}
