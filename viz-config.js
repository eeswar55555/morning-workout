/* viz-config.js — THE 3D EXERCISE CONFIGURATION.  Edit this file to add or change exercises; no build step needed.
 *
 * Every exercise is plain data:
 *   id               unique name
 *   name             shown in the gallery
 *   appIds           (optional) ids used by the Morning Workout app that should show this animation
 *   animationFile    (optional) Mixamo animation as GLB, e.g. 'viz-assets/anims/squat.glb'. It is lazy-loaded and
 *                    retargeted onto the avatar. If it is missing or fails, `animation` below is used instead.
 *   animation        built-in animation (works offline, 0 KB of assets):
 *                      { duration: seconds per loop, keys: [ ...keyframes ] }          see src/avatar/solver.js
 *                      { legacy: 'id-in-exercises.js' }                                the app's old 2D animation, re-posed in 3D
 *   cameraPreset     name from `cameras` below, or an inline { position, target, zoom }
 *   primaryMuscles / secondaryMuscles   chest shoulders biceps triceps core back glutes quadriceps hamstrings calves
 *   animationSpeed   playback speed multiplier (default 1)
 *   effort           how hard the muscles work during the loop: [[phase 0..1, level 0..1], ...]
 *                    glow strength follows it (effort phase = bright, recovery = dim)
 *   ghostAt          loop phase (0..1) shown by "Ghost form" (default: the moment of peak effort)
 *   activation       (optional) heat-map override, e.g. { chest: 1, core: 0.4 }
 *   equipment        (optional) 'dumbbell' | 'barbell'
 *
 * Avatar conventions for keyframes: metres, Y up, the avatar faces +Z, its left side is +X.
 */
window.EXERCISE_VIZ = {
  defaults: { view: 'combined', ghost: false, animationSpeed: 1 },

  /* camera presets: position (camera), target (look-at), zoom (>1 moves in), extent/height (metres that must stay in frame) */
  cameras: {
    side:        { position: [-3.6, 1.0, 0],    target: [0, 0.9, 0],      zoom: 1, extent: 1.5, height: 2.15 },
    angledSide:  { position: [-3.0, 1.25, 1.8], target: [0, 0.9, 0],      zoom: 1, extent: 1.6, height: 2.15 },
    front:       { position: [0, 1.2, 3.8],     target: [0, 0.95, 0],     zoom: 1, extent: 1.7, height: 2.25 },
    frontSide45: { position: [-2.3, 1.35, 2.5], target: [0, 0.3, -0.5],   zoom: 1, extent: 1.5, height: 0.9 },
    floor:       { position: [-3.4, 0.8, -0.2],  target: [0, 0.38, 0],      zoom: 1, extent: 1.9, height: 1.0 },
    plankSide:   { position: [-4.2, 0.65, -0.55], target: [0, 0.38, -0.55], zoom: 1, extent: 1.9, height: 1.0 },
    topFront45:  { position: [-1.9, 3.2, 2.3],  target: [0, 0.25, -0.5],  zoom: 1, extent: 1.5, height: 1.0 },
    wideFront45: { position: [-3.3, 1.7, 3.6],  target: [0, 0.75, 0],     zoom: 1, extent: 2.1, height: 1.9 }
  },

  exercises: [
    {
      id: 'squat', name: 'Squat',
      cameraPreset: 'side',
      primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'core', 'calves'],
      effort: [[0, 0.2], [0.5, 1], [1, 0.2]],
      animation: {
        duration: 3.4,
        keys: [
          { t: 0, hips: [0, 0.975, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { dir: [-0.12, -0.05, 1], bend: 6, pole: [0, -1, 0] },
            legs: { to: [0.15, 0.08, 0], pole: [0.12, 0, 1] }, feet: [0, 8] },
          { t: 0.5, hips: [0, 0.56, -0.33], hipsRot: [36, 0, 0], spine: [8, 0, 0], head: [-28, 0, 0] }
        ]
      }
    },
    {
      id: 'pushup', name: 'Push-up',
      cameraPreset: 'frontSide45',
      primaryMuscles: ['chest', 'triceps', 'shoulders'], secondaryMuscles: ['core'],
      effort: [[0, 0.3], [0.5, 1], [1, 0.3]],
      animation: {
        duration: 3.2,
        keys: [
          { t: 0, hips: [0, 0.43, -0.405], hipsRot: [70, 0, 0], spine: [0, 0, 0], head: [-22, 0, 0],
            arms: { to: [0.23, 0.045, 0.02], pole: [0.5, 0.2, -1] },
            legs: { to: [0.09, 0.125, -1.25], pole: [0, -1, 0.1] }, feet: [72, 0] },
          { t: 0.5, hips: [0, 0.186, -0.352], hipsRot: [86, 0, 0], head: [-12, 0, 0] }
        ]
      }
    },
    {
      id: 'lunge', name: 'Lunge',
      cameraPreset: 'angledSide',
      primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'calves', 'core'],
      effort: [[0, 0.2], [0.5, 1], [1, 0.2]],
      animation: {
        duration: 3.6,
        keys: [
          { t: 0, hips: [0, 0.88, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { dir: [0.28, -1, 0.1], bend: 14, pole: [0, 0, -1] },
            legL: { to: [0.12, 0.08, 0.36], pole: [0, 0, 1] }, legR: { to: [-0.12, 0.15, -0.38], pole: [0, -0.5, 1] },
            footL: [0, 4], footR: [50, -4] },
          { t: 0.5, hips: [0, 0.55, -0.07] }
        ]
      }
    },
    {
      id: 'plank', name: 'Plank',
      cameraPreset: 'plankSide',
      primaryMuscles: ['core'], secondaryMuscles: ['shoulders', 'glutes', 'quadriceps'],
      effort: [[0, 0.85], [0.5, 1], [1, 0.85]],
      animation: {
        duration: 4,
        keys: [
          { t: 0, hips: [0, 0.27, -0.424], hipsRot: [80.6, 0, 0], spine: [0, 0, 0], head: [-20, 0, 0],
            arms: { dir: [0, -1, 0], bend: 90, pole: [0, 0, -1] },
            legs: { to: [0.09, 0.125, -1.312], pole: [0, -1, 0.1] }, feet: [75, 0] },
          { t: 0.5, hips: [0, 0.278, -0.424], hipsRot: [80.2, 0, 0], head: [-21, 0, 0] }
        ]
      }
    },
    {
      id: 'mountain-climber', name: 'Mountain climber',
      cameraPreset: 'topFront45',
      primaryMuscles: ['core', 'shoulders'], secondaryMuscles: ['chest', 'triceps', 'quadriceps'],
      effort: [[0, 0.8], [0.25, 1], [0.5, 0.8], [0.75, 1]],
      animation: {
        duration: 1.5, smooth: 'spline',
        keys: [
          { t: 0, hips: [0, 0.43, -0.405], hipsRot: [70, 0, 0], spine: [0, 0, 0], head: [-25, 0, 0],
            arms: { to: [0.23, 0.045, 0.02], pole: [0.5, 0.2, -1] },
            legL: { to: [0.1, 0.12, -0.43], pole: [0, 0.1, 1] }, legR: { to: [-0.09, 0.125, -1.25], pole: [0, -1, 0.1] },
            feet: [72, 0] },
          { t: 0.25, hips: [0, 0.45, -0.405], legL: { to: [0.1, 0.2, -0.85], pole: [0, -0.5, 0.8] }, legR: { to: [-0.1, 0.2, -0.85], pole: [0, -0.5, 0.8] } },
          { t: 0.5, hips: [0, 0.43, -0.405], legL: { to: [0.09, 0.125, -1.25], pole: [0, -1, 0.1] }, legR: { to: [-0.1, 0.12, -0.43], pole: [0, 0.1, 1] } },
          { t: 0.75, hips: [0, 0.45, -0.405], legL: { to: [0.1, 0.2, -0.85], pole: [0, -0.5, 0.8] }, legR: { to: [-0.1, 0.2, -0.85], pole: [0, -0.5, 0.8] } }
        ]
      }
    },
    {
      id: 'burpee', name: 'Burpee',
      cameraPreset: 'wideFront45',
      primaryMuscles: ['quadriceps', 'glutes', 'chest'], secondaryMuscles: ['shoulders', 'triceps', 'core', 'calves'],
      effort: [[0, 0.3], [0.14, 0.6], [0.37, 1], [0.58, 0.6], [0.72, 1], [1, 0.3]],
      animation: {
        duration: 5,
        keys: [
          { t: 0, hips: [0, 0.975, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { to: [0.2, 0.88, 0.04], pole: [0, 0, -1] },
            legs: { to: [0.12, 0.08, 0], pole: [0.1, 0, 1] }, feet: [0, 6] },
          { t: 0.14, hips: [0, 0.46, -0.3], hipsRot: [70, 0, 0], spine: [6, 0, 0], head: [-38, 0, 0],
            arms: { to: [0.2, 0.04, 0.22], pole: [0.2, 0.3, -1] }, legs: { to: [0.14, 0.08, 0.0], pole: [0.1, 0, 1] } },
          { t: 0.26, hips: [0, 0.43, -0.205], hipsRot: [70, 0, 0], spine: [0, 0, 0], head: [-22, 0, 0],
            arms: { to: [0.23, 0.04, 0.2], pole: [0.5, 0.2, -1] }, legs: { to: [0.09, 0.125, -1.05], pole: [0, -1, 0.1] }, feet: [72, 0] },
          { t: 0.37, hips: [0, 0.186, -0.152], hipsRot: [86, 0, 0], head: [-12, 0, 0] },
          { t: 0.48, hips: [0, 0.43, -0.205], hipsRot: [70, 0, 0], head: [-22, 0, 0] },
          { t: 0.58, hips: [0, 0.46, -0.3], hipsRot: [70, 0, 0], spine: [6, 0, 0], head: [-38, 0, 0],
            arms: { to: [0.2, 0.04, 0.22], pole: [0.2, 0.3, -1] }, legs: { to: [0.14, 0.08, 0.0], pole: [0.1, 0, 1] }, feet: [6, 0] },
          { t: 0.72, hips: [0, 1.22, 0], hipsRot: [0, 0, 0], spine: [-4, 0, 0], head: [-6, 0, 0],
            arms: { to: [0.2, 2.1, 0.08], pole: [0, -0.3, -1] }, legs: { to: [0.1, 0.3, 0], pole: [0.1, 0, 1] }, feet: [20, 0] },
          { t: 0.86, hips: [0, 0.92, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { to: [0.22, 0.8, 0.05], pole: [0, 0, -1] },
            legs: { to: [0.14, 0.08, 0], pole: [0.15, 0, 1] }, feet: [0, 8] }
        ]
      }
    },
    {
      id: 'jumping-jacks', name: 'Jumping jacks',
      cameraPreset: 'front',
      primaryMuscles: ['shoulders', 'quadriceps'], secondaryMuscles: ['calves', 'glutes', 'core'],
      effort: [[0, 0.5], [0.5, 1], [1, 0.5]],
      animation: {
        duration: 1.5, smooth: 'spline',
        keys: [
          { t: 0, hips: [0, 0.975, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { dir: [0.12, -1, 0], bend: 4, pole: [0, 0, -1] },
            legs: { to: [0.08, 0.08, 0], pole: [0.05, 0, 1] }, feet: [0, 3] },
          { t: 0.25, hips: [0, 1.0, 0], arms: { dir: [0.95, 0.35, 0], bend: 4, pole: [0, 0, -1] },
            legs: { to: [0.2, 0.17, 0], pole: [0.2, 0, 1] }, feet: [18, 12] },
          { t: 0.5, hips: [0, 0.94, 0], arms: { dir: [0.28, 1, 0], bend: 6, pole: [0, 0, -1] },
            legs: { to: [0.3, 0.08, 0], pole: [0.4, 0, 1] }, feet: [0, 25] },
          { t: 0.75, hips: [0, 1.0, 0], arms: { dir: [0.95, 0.35, 0], bend: 4, pole: [0, 0, -1] },
            legs: { to: [0.2, 0.17, 0], pole: [0.2, 0, 1] }, feet: [18, 12] }
        ]
      }
    },
    {
      id: 'bicep-curl', name: 'Bicep curl',
      cameraPreset: 'front', equipment: 'dumbbell',
      primaryMuscles: ['biceps'], secondaryMuscles: ['shoulders', 'core'],
      effort: [[0, 0.25], [0.5, 1], [1, 0.25]],
      animation: {
        duration: 3.4,
        keys: [
          { t: 0, hips: [0, 0.975, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { dir: [0.1, -1, 0.04], bend: 4, pole: [0, 0, -1] },
            legs: { to: [0.13, 0.08, 0], pole: [0.1, 0, 1] }, feet: [0, 8] },
          { t: 0.5, arms: { dir: [0.1, -1, 0.04], bend: 148, pole: [0, 0, -1] } }
        ]
      }
    },
    {
      id: 'shoulder-press', name: 'Shoulder press',
      cameraPreset: 'front', equipment: 'dumbbell',
      primaryMuscles: ['shoulders', 'triceps'], secondaryMuscles: ['chest', 'core', 'back'],
      effort: [[0, 0.3], [0.5, 1], [1, 0.3]],
      animation: {
        duration: 3.4,
        keys: [
          { t: 0, hips: [0, 0.975, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { dir: [0.95, -0.3, 0], bend: 92, pole: [0, -1, 0.05] },
            legs: { to: [0.13, 0.08, 0], pole: [0.1, 0, 1] }, feet: [0, 8] },
          { t: 0.5, spine: [-2, 0, 0], arms: { dir: [0.14, 1, 0], bend: 6, pole: [0, -1, 0.05] } }
        ]
      }
    },
    {
      id: 'deadlift', name: 'Deadlift',
      cameraPreset: 'angledSide', equipment: 'barbell',
      primaryMuscles: ['hamstrings', 'glutes', 'back'], secondaryMuscles: ['quadriceps', 'core', 'calves'],
      effort: [[0, 0.35], [0.5, 1], [1, 0.35]],
      animation: {
        duration: 4,
        keys: [
          { t: 0, hips: [0, 0.975, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0],
            arms: { dir: [0.1, -1, 0.1], bend: 0, pole: [0, 0, -1] },
            legs: { to: [0.12, 0.08, 0], pole: [0.1, 0, 1] }, feet: [0, 8] },
          { t: 0.5, hips: [0, 0.74, -0.28], hipsRot: [62, 0, 0], spine: [4, 0, 0], head: [-34, 0, 0] }
        ]
      }
    },

    /* ---------- the Morning Workout app's own exercises: the old 2D side-view animation, re-posed in 3D ---------- */
    { id: 'cat-cow', name: 'Cat-cow', cameraPreset: 'floor', animation: { legacy: 'cat-cow' }, primaryMuscles: ['back', 'core'], secondaryMuscles: ['shoulders'] },
    { id: 'arm-circles', name: 'Arm circles', cameraPreset: 'front', animation: { legacy: 'arm-circles' }, primaryMuscles: ['shoulders'], secondaryMuscles: ['back'] },
    { id: 'overhead-reach', name: 'Overhead reach', cameraPreset: 'side', animation: { legacy: 'overhead-reach' }, primaryMuscles: ['shoulders'], secondaryMuscles: ['back', 'core'] },
    { id: 'march', name: 'March in place', cameraPreset: 'side', animation: { legacy: 'march' }, primaryMuscles: ['quadriceps', 'core'], secondaryMuscles: ['glutes', 'shoulders'] },
    { id: 'sit-to-stand', name: 'Chair sit-to-stand', cameraPreset: 'side', animation: { legacy: 'sit-to-stand' }, primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'core'] },
    { id: 'wall-sit', name: 'Wall sit', cameraPreset: 'side', animation: { legacy: 'wall-sit' }, primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['calves', 'core'], effort: [[0, 0.7], [0.5, 1], [1, 0.7]] },
    { id: 'incline-pushup', name: 'Incline push-up', cameraPreset: 'side', animation: { legacy: 'incline-pushup' }, primaryMuscles: ['chest', 'triceps', 'shoulders'], secondaryMuscles: ['core'] },
    { id: 'wall-pushup', name: 'Wall push-up', cameraPreset: 'side', animation: { legacy: 'wall-pushup' }, primaryMuscles: ['chest', 'triceps', 'shoulders'], secondaryMuscles: ['core'] },
    { id: 'glute-bridge', name: 'Glute bridge', cameraPreset: 'floor', animation: { legacy: 'glute-bridge' }, primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'core'] },
    { id: 'donkey-kick', name: 'Donkey kick', cameraPreset: 'floor', animation: { legacy: 'donkey-kick' }, primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'core'] },
    { id: 'backpack-row', name: 'Backpack row', cameraPreset: 'side', animation: { legacy: 'backpack-row' }, primaryMuscles: ['back'], secondaryMuscles: ['biceps', 'shoulders'] },
    { id: 'reverse-lunge', name: 'Reverse lunge', cameraPreset: 'side', animation: { legacy: 'reverse-lunge' }, primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'calves', 'core'] },
    { id: 'split-squat', name: 'Split squat', cameraPreset: 'side', animation: { legacy: 'split-squat' }, primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'calves', 'core'] },
    { id: 'step-up', name: 'Low step-up', cameraPreset: 'side', animation: { legacy: 'step-up' }, primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'calves'] },
    { id: 'calf-raise', name: 'Calf raise', cameraPreset: 'side', animation: { legacy: 'calf-raise' }, primaryMuscles: ['calves'], secondaryMuscles: ['quadriceps'] },
    { id: 'curl-up', name: 'Modified curl-up', cameraPreset: 'floor', animation: { legacy: 'curl-up' }, primaryMuscles: ['core'], secondaryMuscles: ['shoulders'], effort: [[0, 0.7], [0.5, 1], [1, 0.7]] },
    { id: 'side-plank', name: 'Side plank on your knees', cameraPreset: 'floor', animation: { legacy: 'side-plank' }, primaryMuscles: ['core'], secondaryMuscles: ['shoulders', 'glutes'], effort: [[0, 0.7], [0.5, 1], [1, 0.7]] },
    { id: 'bird-dog', name: 'Bird dog', cameraPreset: 'floor', animation: { legacy: 'bird-dog' }, primaryMuscles: ['core', 'back', 'glutes'], secondaryMuscles: ['shoulders', 'hamstrings'], effort: [[0, 0.7], [0.5, 1], [1, 0.7]] },
    { id: 'hip-flexor-stretch', name: 'Half-kneeling hip-flexor stretch', cameraPreset: 'floor', animation: { legacy: 'hip-flexor-stretch' }, primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes'], effort: [[0, 0.5], [0.5, 0.8], [1, 0.5]] },
    { id: 'chest-stretch', name: 'Doorway chest stretch', cameraPreset: 'side', animation: { legacy: 'chest-stretch' }, primaryMuscles: ['chest'], secondaryMuscles: ['shoulders'], effort: [[0, 0.5], [0.5, 0.8], [1, 0.5]] },
    { id: 'calf-stretch', name: 'Wall calf stretch', cameraPreset: 'side', animation: { legacy: 'calf-stretch' }, primaryMuscles: ['calves'], secondaryMuscles: ['hamstrings'], effort: [[0, 0.5], [0.5, 0.8], [1, 0.5]] },
    { id: 'childs-pose', name: "Child's pose", cameraPreset: 'floor', animation: { legacy: 'childs-pose' }, primaryMuscles: ['back'], secondaryMuscles: ['glutes', 'shoulders'], effort: [[0, 0.4], [0.5, 0.7], [1, 0.4]] }
  ]
};
