import { useMemo } from 'react';
import * as THREE from 'three';

/* Mobile-friendly lighting: no shadow maps, no environment map — one hemisphere + a key + a rim light. */
export function Lights() {
  return (
    <>
      <hemisphereLight args={[0xd7e6ff, 0x1a232c, 1.15]} />
      <directionalLight position={[-2.5, 4, 3]} intensity={2.1} color={0xfff4e6} />
      <directionalLight position={[2.5, 2.2, -3]} intensity={1.0} color={0x6fd6ff} />
    </>
  );
}

function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* a soft pool of light on the floor + faint ring: grounds the figure without a shadow pass */
export function Floor() {
  const tex = useMemo(() => radialTexture([[0, 'rgba(120,200,215,0.30)'], [0.55, 'rgba(120,200,215,0.10)'], [1, 'rgba(120,200,215,0)']]), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.35]} renderOrder={-2}>
      <planeGeometry args={[7, 7]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const PROP_COLOR = { furn: 0x4b5a6b, furn2: 0x3a4756, wall: 0x2a3641, mat: 0x2a6f78, post: 0x4b5a6b, wallEdge: 0x4b5a6b };

/* simple boxes for chairs, steps, walls, mats … : props = [{kind, box:[cx,cy,cz, sx,sy,sz]}] */
export function Props({ list }) {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  return (
    <group>
      {(list || []).map((p, i) => (
        <mesh key={i} geometry={geo} position={[p.box[0], p.box[1], p.box[2]]} scale={[p.box[3], p.box[4], p.box[5]]}>
          <meshStandardMaterial color={PROP_COLOR[p.kind] || 0x4b5a6b} roughness={0.9} transparent={p.kind === 'wall'} opacity={p.kind === 'wall' ? 0.55 : 1} />
        </mesh>
      ))}
    </group>
  );
}
