/* illus-config.js — how each exercise is illustrated.  Plain data: edit freely, no build step.
 *
 * ILLUS.exercises[id]   (id = an exercise id from exercises.js)
 *   view       'side' (default) | 'front'      which viewpoint explains the exercise best
 *   primary    muscles that do the work   \  chest shoulders biceps triceps core back
 *   secondary  muscles that assist        /  glutes quadriceps hamstrings calves
 *   track      (optional) joint the motion arrow follows:  side: haN anN knN sh hip head   front: haL anL head hip
 *   arrow      false = no motion arrow        ghost  false = no end-position outline
 *   equip      'dumbbell' | 'barbell'
 *
 * ILLUS.extra   extra exercises that are not (yet) in exercises.js — shown in gallery.html and ready to copy into
 *               exercises.js. `anim` uses the figure.js side format (see figure.js) or the FRONT format (illus.js).
 */
(function (root) {
  'use strict';
  var F = root.Figure;
  var ex = {};
  function e(id, primary, secondary, more) { ex[id] = Object.assign({ view: 'side', primary: primary, secondary: secondary }, more); }

  /* ---------- exercises of the Morning Workout app ---------- */
  e('cat-cow', ['back', 'core'], ['shoulders']);
  e('arm-circles', ['shoulders'], ['back'], { arrow: true, track: 'haN' });
  e('overhead-reach', ['shoulders'], ['back', 'core']);
  e('march', ['quadriceps', 'core'], ['glutes']);
  e('sit-to-stand', ['quadriceps', 'glutes'], ['hamstrings', 'core'], { track: 'hip' });
  e('wall-sit', ['quadriceps', 'glutes'], ['calves', 'core']);
  e('step-up', ['quadriceps', 'glutes'], ['hamstrings', 'calves']);
  e('incline-pushup', ['chest', 'triceps', 'shoulders'], ['core'], { track: 'sh' });
  e('wall-pushup', ['chest', 'triceps', 'shoulders'], ['core'], { track: 'sh' });
  e('glute-bridge', ['glutes'], ['hamstrings', 'core'], { track: 'hip' });
  e('donkey-kick', ['glutes'], ['hamstrings', 'core'], { track: 'anN' });
  e('backpack-row', ['back'], ['biceps', 'shoulders'], { track: 'haN' });
  e('reverse-lunge', ['quadriceps', 'glutes'], ['hamstrings', 'calves', 'core'], { track: 'hip' });
  e('split-squat', ['quadriceps', 'glutes'], ['hamstrings', 'calves', 'core'], { track: 'hip' });
  e('calf-raise', ['calves'], ['quadriceps']);
  e('curl-up', ['core'], ['shoulders']);
  e('side-plank', ['core'], ['shoulders', 'glutes']);
  e('bird-dog', ['core', 'back', 'glutes'], ['shoulders', 'hamstrings']);
  e('hip-flexor-stretch', ['quadriceps'], ['glutes']);
  e('chest-stretch', ['chest'], ['shoulders']);
  e('calf-stretch', ['calves'], ['hamstrings']);
  e('childs-pose', ['back'], ['glutes', 'shoulders']);

  /* ---------- extra exercises (gallery / ready to add) ---------- */
  function stand(x, extra) {
    var p = { hip: [x, 74.5], t: 180, lN: { to: [x, 136], b: 1 }, lF: { to: [x + 8, 136], b: 1 } };
    for (var k in extra) p[k] = extra[k];
    return p;
  }
  var plank = F.line([40, 133], 19.7), pushDn = F.line([40, 133], 4.4), forearm = F.line([40, 133], 10.5), forearm2 = F.line([40, 133], 10);
  var armsFloor = function (x) { return { aN: { to: [x, 135], b: -1 }, aF: { to: [x - 3, 135], b: -1 } }; };
  function P(base, extra) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in extra) o[k] = extra[k]; return o; }
  var legsPlank = { lN: { to: [40, 133], b: 1 }, lF: { to: [36, 133], b: 1 }, fN: 40, fF: 40 };
  var armsFwd = { aN: [85, 95], aF: [80, 90] };

  var extra = [
    { id: 'squat', name: 'Squat', type: 'reps', tempo: 4, view: 'side', primary: ['quadriceps', 'glutes'], secondary: ['hamstrings', 'core', 'calves'], track: 'hip',
      anim: { poses: [stand(118, armsFwd), P(armsFwd, { hip: [94, 105], t: [144, 136], h: 164, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } })] } },
    { id: 'pushup', name: 'Push-up', type: 'reps', tempo: 4, view: 'side', primary: ['chest', 'triceps', 'shoulders'], secondary: ['core'], track: 'sh',
      anim: { poses: [P(legsPlank, P(armsFloor(140), { hip: plank.hip, t: plank.t, h: plank.t + 22 })), P(legsPlank, P(armsFloor(142), { hip: pushDn.hip, t: pushDn.t, h: pushDn.t + 22 }))] } },
    { id: 'lunge', name: 'Lunge', type: 'reps', tempo: 4, view: 'side', primary: ['quadriceps', 'glutes'], secondary: ['hamstrings', 'calves', 'core'], track: 'hip',
      anim: { poses: [
        { hip: [100, 80], t: 180, aN: [6, 20], aF: [0, 16], lN: { to: [124, 136], b: 1 }, lF: { to: [62, 129], b: 1 }, fF: 45 },
        { hip: [92, 106], t: 180, aN: [6, 20], aF: [0, 16], lN: { to: [124, 136], b: 1 }, lF: { to: [62, 129], b: 1 }, fF: 45 }] } },
    { id: 'plank', name: 'Plank', type: 'hold', secs: 30, view: 'side', primary: ['core'], secondary: ['shoulders', 'glutes', 'quadriceps'], arrow: false,
      anim: { poses: [
        P(legsPlank, { hip: forearm.hip, t: forearm.t, h: forearm.t + 24, aN: [0, 90], aF: [-3, 88] }),
        P(legsPlank, { hip: forearm2.hip, t: forearm2.t, h: forearm2.t + 24, aN: [0, 90], aF: [-3, 88] })] } },
    { id: 'mountain-climber', name: 'Mountain climber', type: 'time', secs: 30, tempo: 1.4, view: 'side', primary: ['core', 'shoulders'], secondary: ['chest', 'triceps', 'quadriceps'], track: 'knN',
      anim: { mode: 'cycle', dynamic: true, poses: (function () {
        var base = P(armsFloor(140), { hip: plank.hip, t: plank.t, h: plank.t + 22, fN: 40, fF: 40 });
        var drive = { to: [102, 134], b: 1 }, ext = { to: [40, 133], b: 1 }, mid = { to: [72, 126], b: 1 };
        return [P(base, { lN: drive, lF: ext }), P(base, { lN: mid, lF: mid }), P(base, { lN: ext, lF: drive }), P(base, { lN: mid, lF: mid }), P(base, { lN: drive, lF: ext })];
      })() } },
    { id: 'burpee', name: 'Burpee', type: 'reps', tempo: 5, view: 'side', primary: ['quadriceps', 'glutes', 'chest'], secondary: ['shoulders', 'triceps', 'core', 'calves'], track: 'hip',
      anim: { mode: 'cycle', poses: [
        stand(118, { aN: [4, 8], aF: [0, 4] }),
        { hip: [92, 106], t: [112, 108], h: 140, aN: { to: [136, 136], b: -1 }, aF: { to: [132, 136], b: -1 }, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } },
        P(legsPlank, P(armsFloor(138), { hip: plank.hip, t: plank.t, h: plank.t + 22 })),
        P(legsPlank, P(armsFloor(140), { hip: pushDn.hip, t: pushDn.t, h: pushDn.t + 22 })),
        P(legsPlank, P(armsFloor(138), { hip: plank.hip, t: plank.t, h: plank.t + 22 })),
        { hip: [92, 106], t: [112, 108], h: 140, aN: { to: [136, 136], b: -1 }, aF: { to: [132, 136], b: -1 }, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } },
        { hip: [118, 46], t: 180, aN: [170, 172], aF: [165, 168], lN: { to: [116, 118], b: 1 }, lF: { to: [126, 112], b: 1 }, fN: 60, fF: 60 },
        stand(118, { aN: [4, 8], aF: [0, 4] })] } },
    { id: 'deadlift', name: 'Deadlift', type: 'reps', tempo: 5, view: 'side', equip: 'barbell', primary: ['hamstrings', 'glutes', 'back'], secondary: ['quadriceps', 'core', 'calves'], track: 'hip',
      anim: { poses: [stand(118, { aN: [4, 4], aF: [2, 2] }),
        { hip: [97, 92], t: [118, 112], h: 150, aN: [0, 0], aF: [-2, -2], lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } }] } },
    /* front view */
    { id: 'bicep-curl', name: 'Bicep curl', type: 'reps', tempo: 4, view: 'front', equip: 'dumbbell', primary: ['biceps'], secondary: ['shoulders', 'core'], track: 'haL',
      anim: { view: 'front', poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [3, 3], lL: { to: [9, 136] } },
        { hip: [130, 74.5], t: 0, h: 0, aL: [6, -158], lL: { to: [9, 136] } }] } },
    { id: 'shoulder-press', name: 'Shoulder press', type: 'reps', tempo: 4, view: 'front', equip: 'dumbbell', primary: ['shoulders', 'triceps'], secondary: ['chest', 'core', 'back'], track: 'haL',
      anim: { view: 'front', poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [74, 182], lL: { to: [9, 136] } },
        { hip: [130, 74.5], t: 0, h: -2, aL: [172, 176], lL: { to: [9, 136] } }] } },
    { id: 'jumping-jacks', name: 'Jumping jacks', type: 'time', secs: 30, tempo: 1.6, view: 'front', primary: ['shoulders', 'calves'], secondary: ['quadriceps', 'glutes', 'core'], track: 'haL',
      anim: { view: 'front', poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [6, 6], lL: { to: [6, 136] } },
        { hip: [130, 69], t: 0, h: 0, aL: [86, 86], lL: { to: [15, 128] } },
        { hip: [130, 77], t: 0, h: 0, aL: [162, 166], lL: { to: [27, 136] } }] } }
  ];

  root.ILLUS = { exercises: ex, extra: extra };
  if (root.Illus) root.Illus.attach();
})(window);
