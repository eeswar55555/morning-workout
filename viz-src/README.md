# 3D exercise viewer

A premium-style 3D exercise demo that runs entirely in the browser (GitHub Pages friendly, no backend).
React + React Three Fiber + Three.js, built with Vite into `../viz/`, loaded lazily by the app.

```
app/
  viz-config.js        <- THE CONFIG. Add / change exercises here (plain JS, no build step)
  viz-bridge.js        <- tiny loader used by app.js: downloads the viewer on demand, falls back to the 2D figure
  viz/                 <- build output (commit this): viewer.js + chunks + index.html (stand-alone gallery)
  viz-assets/anims/    <- put Mixamo .glb files here (optional)
  viz-src/             <- source code (this folder)
```

Open `viz/index.html` (served over http) for a full-screen gallery of every configured exercise.

## What you get

* **Avatar** – a low-poly athletic humanoid generated in code: one smooth-skinned mesh, vertex colours, **no textures,
  0 KB of model files**. Its skeleton uses Mixamo bone names, so Mixamo clips play on it.
* **Animations** – every exercise loops continuously. Three sources (see below): Mixamo GLB, readable keyframes, or the
  app's old 2D animations re-posed in 3D.
* **Per-exercise camera** – each exercise names a camera preset (`position`, `target`, `zoom`); switching exercise
  flies the camera there smoothly. Touch: one finger rotates, two fingers pinch-zoom, wheel zooms on desktop, a
  **Reset** button flies back to the preset. Portrait phones automatically pull the camera back so the whole body fits.
* **Muscles** – ten regions (chest, shoulders, biceps, triceps, core, back, glutes, quadriceps, hamstrings, calves).
  Primary = red glow with a strong pulse, secondary = amber with a soft pulse. Glow brightens in the effort phase of the
  loop and dims in recovery.
* **View modes** – *Normal*, *Muscles* (neutral anatomy body + glow), *Combined* (default), *Heat map*
  (blue → green → yellow → red). One tap on the eye button cycles them; the choice is remembered.
* **Ghost form** – a faint see-through twin frozen at the ideal position (default: the moment of peak effort), so you can
  compare posture and range of motion against the moving avatar.

## Add an exercise (config only)

Edit `../viz-config.js`:

```js
{
  id: 'goblet-squat',
  name: 'Goblet squat',
  appIds: ['my-app-exercise-id'],          // optional: show it for these exercise ids in the app
  animationFile: 'viz-assets/anims/goblet-squat.glb',   // optional Mixamo clip (falls back to `animation` if missing)
  cameraPreset: 'side',                    // a name from `cameras`, or inline { position, target, zoom }
  primaryMuscles: ['quadriceps', 'glutes'],
  secondaryMuscles: ['hamstrings', 'core'],
  animationSpeed: 1,
  effort: [[0, 0.2], [0.5, 1], [1, 0.2]],  // [loop phase, effort 0..1] – drives the glow
  ghostAt: 0.5,                            // optional, loop phase shown by Ghost form
  equipment: 'dumbbell',                   // optional: 'dumbbell' | 'barbell'
  animation: { duration: 3.4, keys: [ /* built-in keyframes, see below */ ] }
}
```

Muscle names accept aliases (`quads`, `abs`, `lats`, `front deltoids`, `pecs` …).
Push the file and the app picks it up; **no rebuild is needed** unless you change the viewer's code.

### Animation source 1 – Mixamo GLB (`animationFile`)

1. On mixamo.com pick the animation (use **In Place** if offered), download **FBX, Without Skin, 30 fps**.
2. Convert to GLB: `npx fbx2gltf --binary --input squat.fbx --output squat.glb` (or import/export in Blender).
3. Optimise: `npm run glb:optimize -- squat.glb ../viz-assets/anims/squat.glb`
   (keeps only the bones the avatar uses, drops scale/finger tracks, Draco-compresses meshes if present).
4. Set `animationFile: 'viz-assets/anims/squat.glb'`.

The clip is **retargeted at load time** onto the avatar (world-space delta per bone, hip height scaled), so any Mixamo
character/skeleton works. Draco decoding and `GLTFLoader` are fetched only when such a file is actually used.

> Mixamo files need an Adobe login and were not available in the environment where this was built, so the GLB path is
> verified with a synthetic Mixamo-style file instead (different size, arbitrary bone frames, Draco mesh):
> `npm test` checks the retargeter numerically and `npm run glb:test -- squat ../viz-assets/test/squat.glb` makes a test
> file you can load in the gallery. Please try one real Mixamo clip and eyeball it. Also check Adobe's Mixamo terms
> before committing the raw files to a public repo.

### Animation source 2 – built-in keyframes (`animation.keys`)

No files, works offline. Each key says *where the body parts are* (metres, Y up, avatar faces +Z, left side is +X):

```js
{ t: 0.5,                         // time in the loop (0..1); the loop returns to the first key
  hips: [0, 0.56, -0.33],         // hip position
  hipsRot: [36, 0, 0],            // pitch (+ leans forward) / yaw / roll, degrees
  spine: [8, 0, 0], head: [-28, 0, 0],
  arms:  { to: [0.23, 0.045, 0.02], pole: [0.5, 0.2, -1] },   // IK: hand goes to `to`, elbow points toward `pole`
  legs:  { to: [0.15, 0.08, 0],     pole: [0.12, 0, 1] },     // IK: ankle goes to `to`, knee points toward `pole`
  // or FK: { dir: [0, -1, 0], bend: 90, pole: [0, 0, -1] }   upper arm/thigh direction + elbow/knee flexion
  feet: [0, 8] }                  // [pitch (+ toes down), yaw]
```

`arms` / `legs` / `feet` apply to both sides (mirrored); `armL`, `armR`, `legL`, `legR`, `footL`, `footR` override one
side. Keys after the first only list what changes. `smooth: 'spline'` gives continuous motion (jacks, climbers); the
default eases in and out of every key. A limb must use IK (`to`) or FK (`dir`) consistently across keys.

### Animation source 3 – the app's 2D library (`animation: { legacy: 'id' }`)

Re-poses an entry of `exercises.js` in 3D (furniture rectangles become boxes). All 22 convertible exercises of the
Morning Workout app are configured this way; *Lying knee rolls* (a top-down custom drawing) keeps the 2D figure.

## Build

```
cd app/viz-src
npm install
npm run build          # writes ../viz/  (commit it)
npm test               # retargeter unit test
```

## Performance (measured on the built bundle)

| | |
|---|---|
| Draw calls | 5 (avatar, ghost depth + colour, contact shadow, floor), plus one per prop box / dumbbell part when an exercise has them |
| Triangles | ≈ 13 k, one skinned mesh, 1 skeleton (ghost has its own skeleton, shares the geometry) |
| Textures / model files | none (vertex colours); muscle glow is evaluated in the avatar's own shader, no overlay meshes |
| Lighting | 1 hemisphere + 2 directional lights, no shadow maps, no environment map, no post-processing |
| Frame rate | capped at 60 fps (even on 120 Hz screens); render resolution 1–1.75× and lowered automatically if frames take > 24 ms |
| Download | ≈ 330 KB gzipped, **only when the first 3D demo opens**; the app works without it (2D figure fallback) |
| Culling | the skinned mesh gets a fixed generous bounding sphere (Three's culling stays on) |

Muscle regions are soft ellipsoids defined in the avatar's bind pose and drawn in the fragment shader instead of
separate overlay meshes: they follow the skin exactly, cannot z-fight and cost no extra draw calls.
