/* animations.js — how each exercise MOVES. Pure presentation; everything else about an exercise lives in data/exercises/*.json.
 *
 * ANIMATIONS[exerciseId] = {
 *   poses: [...]        key poses the figure moves between (side format: see figure.js; front format: see illus.js)
 *   props: ...          optional scenery: P.mat / P.chair / P.table / P.wallLeft / P.wallRight / P.step / P.post / P.towel
 *   mode: 'cycle'       optional: loop through the poses instead of down-and-back
 *   dynamic: true       optional: keep animating during timed exercises
 *   cfg: {              optional drawing options
 *     view: 'front'       viewpoint (default 'side')        track: joint the motion arrow follows (hip, sh, haN, anN, knN, haL ...)
 *     arrow: false        hide the motion arrow             ghost: false  hide the end-position outline        equip: 'dumbbell' | 'barbell'
 *   }
 * }
 * or { like: 'other_exercise_id' } to reuse another exercise's picture.
 *
 * The muscles that get tinted come from primaryMuscles / secondaryMuscles in the exercise library, not from here.
 * An exercise with no entry here still works: the app shows a neutral placeholder. To add a picture, add an entry whose
 * key is the exercise id (an existing entry to copy is the easiest start), then preview it in gallery.html.
 */
(function (root) {
  'use strict';
  var F = root.Figure, P = F.props;

  /* ---------- reusable body positions ---------- */
  function stand(x, extra) {            // standing, feet flat, legs straight
    var p = { hip: [x, 74.5], t: 180, lN: { to: [x, 136], b: 1 }, lF: { to: [x + 8, 136], b: 1 } };
    for (var k in extra) p[k] = extra[k];
    return p;
  }
  function all4(extra) {                // on hands and knees ("tabletop")
    var p = { hip: [100, 104], t: 104, h: 100, aN: { to: [141, 136], b: -1 }, aF: { to: [134, 136], b: -1 },
      lN: { to: [70, 136], b: 1 }, lF: { to: [64, 136], b: 1 }, fN: 270, fF: 270 };
    for (var k in extra) p[k] = extra[k];
    return p;
  }
  function lying(extra) {               // on your back, head to the left
    var p = { hip: [102, 131], t: 270, h: 270, aN: [95, 95], aF: [95, 95] };
    for (var k in extra) p[k] = extra[k];
    return p;
  }
  function mix(base, extra) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in extra) o[k] = extra[k]; return o; }

  var up = F.line([105, 129], 52), dn = F.line([105, 129], 38);       // incline push-up body lines
  var wup = F.line([124, 136], 70), wdn = F.line([124, 136], 57);     // wall push-up body lines
  var plank = F.line([40, 133], 19.7), pushDn = F.line([40, 133], 4.4), forearm = F.line([40, 133], 10.5), forearm2 = F.line([40, 133], 10);
  var armsFloor = function (x) { return { aN: { to: [x, 135], b: -1 }, aF: { to: [x - 3, 135], b: -1 } }; };
  var legsPlank = { lN: { to: [40, 133], b: 1 }, lF: { to: [36, 133], b: 1 }, fN: 40, fF: 40 };
  var armsFwd = { aN: [85, 95], aF: [80, 90] };

  var LIST = {
    /* =================== WARM-UP =================== */
    cat_cow: {
      props: P.mat(40, 190),
      poses: [all4({ t: [130, 80], h: 70 }), all4({ t: [80, 125], h: 135 })]
    },
    arm_circles: {
      cfg: { arrow: true, track: 'haN' },
      mode: 'cycle', reverseSide2: true,
      poses: [0, 90, 180, 270, 360].map(function (a) { return stand(118, { aN: [a, a], aF: [a - 14, a - 14] }); })
    },
    overhead_reach: { poses: [stand(118, { aN: [3, 3], aF: [-8, -8] }), stand(118, { aN: [177, 177], aF: [168, 168] })] },
    march_in_place: {
      dynamic: true,
      poses: [
        { hip: [118, 74.5], t: 180, lN: [85, -5], lF: [0, 0], fN: 60, aN: [-35, -20], aF: [55, 80] },
        { hip: [118, 74.5], t: 180, lN: [0, 0], lF: [85, -5], fF: 60, aN: [55, 80], aF: [-35, -20] }
      ]
    },

    /* =================== STRENGTH =================== */
    sit_to_stand: {
      cfg: { track: 'hip' },
      props: P.chair(82, 114),
      poses: [
        { hip: [98, 108], t: 172, aN: [85, 95], aF: [80, 90], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } },
        { hip: [110, 100], t: 140, aN: [85, 95], aF: [80, 90], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } },
        { hip: [121, 75], t: 180, aN: [85, 95], aF: [80, 90], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } }
      ]
    },
    wall_sit: {
      props: P.wallLeft(100),
      poses: [
        { hip: [110, 75], t: 180, aN: [80, 90], aF: [75, 85], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } },
        { hip: [108, 94], t: 180, aN: [80, 90], aF: [75, 85], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } }
      ]
    },
    step_up: {
      props: P.step(130, 118, 55),
      poses: [
        { hip: [112, 75], t: 180, aN: [20, 10], aF: [10, 0], lN: { to: [118, 136], b: 1 }, lF: { to: [108, 136], b: 1 } },
        { hip: [124, 78], t: 170, aN: [30, 20], aF: [20, 10], lN: { to: [142, 114], b: 1 }, lF: { to: [108, 136], b: 1 } },
        { hip: [140, 52], t: 180, aN: [20, 10], aF: [10, 0], lN: { to: [142, 114], b: 1 }, lF: { to: [132, 114], b: 1 } }
      ]
    },
    incline_push_up: {
      cfg: { track: 'sh' },
      props: P.table(176, 90, 50),
      poses: [
        { hip: up.hip, t: up.t, aN: { to: [182, 86], b: -1 }, aF: { to: [178, 86], b: -1 }, lN: { to: [105, 129], b: 1 }, lF: { to: [101, 129], b: 1 }, fN: 50, fF: 50 },
        { hip: dn.hip, t: dn.t, aN: { to: [182, 86], b: -1 }, aF: { to: [178, 86], b: -1 }, lN: { to: [105, 129], b: 1 }, lF: { to: [101, 129], b: 1 }, fN: 50, fF: 50 }
      ]
    },
    wall_push_up: {
      cfg: { track: 'sh' },
      props: P.wallRight(196),
      poses: [
        { hip: wup.hip, t: wup.t, aN: { to: [192, 64], b: -1 }, aF: { to: [190, 62], b: -1 }, lN: { to: [124, 136], b: 1 }, lF: { to: [120, 136], b: 1 } },
        { hip: wdn.hip, t: wdn.t, aN: { to: [192, 64], b: -1 }, aF: { to: [190, 62], b: -1 }, lN: { to: [124, 136], b: 1 }, lF: { to: [120, 136], b: 1 } }
      ]
    },
    glute_bridge: {
      cfg: { track: 'hip' },
      props: P.mat(30, 190),
      poses: [
        lying({ lN: { to: [138, 136], b: 1 }, lF: { to: [144, 136], b: 1 } }),
        lying({ hip: [101.9, 115.3], t: 292, h: 275, lN: { to: [138, 136], b: 1 }, lF: { to: [144, 136], b: 1 } })
      ]
    },
    donkey_kick: {
      cfg: { track: 'anN' },
      props: P.mat(40, 190),
      poses: [
        all4({ lN: [0, 270], fN: 270 }),
        all4({ lN: [-105, 170], fN: 235 })
      ]
    },
    backpack_row: {
      cfg: { track: 'haN' },
      bag: true,
      props: P.table(150, 96, 60),
      poses: [
        { hip: [84, 86], t: 115, h: 120, aN: [0, 0], aF: { to: [156, 92], b: -1 }, lN: { to: [112, 136], b: 1 }, lF: { to: [122, 136], b: 1 } },
        { hip: [84, 86], t: 115, h: 120, aN: [-72, 5], aF: { to: [156, 92], b: -1 }, lN: { to: [112, 136], b: 1 }, lF: { to: [122, 136], b: 1 } }
      ]
    },
    reverse_lunge: {
      cfg: { track: 'hip' },
      props: P.wallRight(162),
      poses: [
        { hip: [127, 75], t: 180, aN: [5, 5], aF: { to: [157.5, 60], b: -1 }, lN: { to: [120, 136], b: 1 }, lF: { to: [140, 136], b: 1 } },
        { hip: [116, 96], t: 180, aN: [5, 5], aF: { to: [157.5, 60], b: -1 }, lN: { to: [86, 129], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 50 }
      ]
    },
    split_squat: {
      cfg: { track: 'hip' },
      poses: [
        { hip: [112, 82], t: 180, aN: [60, 80], aF: [55, 75], lN: { to: [84, 129], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 50 },
        { hip: [112, 98], t: 180, aN: [60, 80], aF: [55, 75], lN: { to: [84, 129], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 50 }
      ]
    },
    calf_raise: {
      props: P.wallRight(150),
      poses: [
        { hip: [118, 74.5], t: 180, aN: [5, 5], aF: { to: [146, 56], b: -1 }, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } },
        { hip: [122, 66], t: 180, aN: [5, 5], aF: { to: [146, 56], b: -1 }, lN: { to: [122.7, 127], b: 1 }, lF: { to: [130.7, 127], b: 1 }, fN: 35, fF: 35 }
      ]
    },

    /* =================== BACK STABILITY ("Big 3") =================== */
    curl_up: {
      props: P.mat(30, 190),
      poses: [
        lying({ lN: { to: [138, 136], b: 1 }, lF: [90, 90], fF: 180 }),
        lying({ t: [270, 255], h: 245, aN: [100, 100], aF: [100, 100], lN: { to: [138, 136], b: 1 }, lF: [90, 90], fF: 180 })
      ]
    },
    side_plank: {
      props: P.mat(40, 200),
      poses: [
        { hip: [117.2, 131], t: 116.5, h: 116.5, aN: { to: [172, 136], b: -1 }, aF: [180, 180], lN: [275, 270], fN: 270, fF: 270 },
        { hip: [114.6, 124.6], t: 107, h: 107, aN: { to: [172, 136], b: -1 }, aF: [180, 180], lN: [287, 270], fN: 270, fF: 270 }
      ]
    },
    bird_dog: {
      props: P.mat(30, 200),
      poses: [
        all4(),
        all4({ aN: [88, 92], h: 95, lF: [-92, -92], fF: 270 })
      ]
    },

    /* =================== COOL-DOWN =================== */
    knee_rolls: {
      mode: 'cycle', poses: [{}, {}],
      custom: function (g, u, el) {
        if (!g._b) {
          g._b = {};
          var b = g._b;
          b.mat = el('rect', { x: 20, y: 18, width: 220, height: 118, rx: 10, class: 'pr-mat' }, g);
          b.torso = el('line', { x1: 74, y1: 80, x2: 112, y2: 80, 'stroke-width': 26, class: 'limb shirt' }, g);
          b.armT = el('line', { x1: 80, y1: 63, x2: 112, y2: 63, 'stroke-width': 7, class: 'limb shirt far' }, g);
          b.armB = el('line', { x1: 80, y1: 97, x2: 112, y2: 97, 'stroke-width': 7, class: 'limb shirt far' }, g);
          b.hips = el('ellipse', { cx: 112, cy: 80, rx: 11, ry: 14, class: 'fill-pants' }, g);
          b.th1 = el('line', { 'stroke-width': 10, class: 'limb pants far' }, g);
          b.th2 = el('line', { 'stroke-width': 10, class: 'limb pants' }, g);
          b.sh1 = el('line', { 'stroke-width': 9, class: 'limb pants far' }, g);
          b.sh2 = el('line', { 'stroke-width': 9, class: 'limb pants' }, g);
          b.head = el('circle', { cx: 56, cy: 80, r: 10, class: 'fill-skin' }, g);
          var t = el('text', { x: 130, y: 150, class: 'pr-label', 'text-anchor': 'middle' }, g); t.textContent = 'seen from above';
        }
        var b = g._b, s = 24 * Math.sin(u * 2 * Math.PI);
        function set(l, x1, y1, x2, y2) { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); }
        set(b.th1, 112, 74, 142, 74 + s); set(b.th2, 112, 86, 142, 86 + s);
        set(b.sh1, 142, 74 + s, 166, 74 + s * 0.15); set(b.sh2, 142, 86 + s, 166, 86 + s * 0.15);
      }
    },
    hip_flexor_stretch: {
      props: P.towel(50, 120),
      poses: [
        { hip: [103, 102], t: 180, aN: [5, 5], lN: { to: [65, 132], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 270 },
        { hip: [113, 106], t: 180, aN: [5, 5], lN: { to: [65, 132], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 270 }
      ]
    },
    chest_stretch: {
      props: P.post(118),
      poses: [
        { hip: [96, 74.5], t: 180, aN: { to: [117, 40], b: -1 }, aF: { to: [119, 36], b: -1 }, lN: { to: [104, 136], b: 1 }, lF: { to: [112, 136], b: 1 } },
        { hip: [126, 76], t: 170, aN: { to: [117, 40], b: -1 }, aF: { to: [119, 36], b: -1 }, lN: { to: [104, 136], b: 1 }, lF: { to: [116, 136], b: 1 } }
      ]
    },
    calf_stretch: {
      props: P.wallRight(160),
      poses: [
        { hip: [108, 78], t: 180, aN: { to: [156, 56], b: -1 }, aF: { to: [156, 54], b: -1 }, lN: { to: [82, 136], b: 1 }, lF: { to: [128, 136], b: 1 } },
        { hip: [116, 84], t: 140, aN: { to: [156, 56], b: -1 }, aF: { to: [156, 54], b: -1 }, lN: { to: [82, 136], b: 1 }, lF: { to: [128, 136], b: 1 } }
      ]
    },
    childs_pose: {
      props: P.mat(30, 200),
      poses: [
        { hip: [100, 104], t: 104, h: 100, aN: { to: [146, 136], b: 1 }, aF: { to: [140, 136], b: 1 }, lN: { to: [66, 134], b: 1 }, lF: { to: [66, 134], b: 1 }, fN: 270, fF: 270 },
        { hip: [72, 112], t: [85, 75], h: 85, aN: { to: [168, 136], b: 1 }, aF: { to: [160, 136], b: 1 }, lN: { to: [66, 134], b: 1 }, lF: { to: [66, 134], b: 1 }, fN: 270, fF: 270 }
      ]
    },

    /* =================== MORE ILLUSTRATIONS (side + front views) =================== */
    squat: {
      cfg: { track: 'hip' },
      poses: [stand(118, armsFwd), mix(armsFwd, { hip: [94, 105], t: [144, 136], h: 164, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } })]
    },
    push_up: {
      cfg: { track: 'sh' },
      poses: [mix(legsPlank, mix(armsFloor(140), { hip: plank.hip, t: plank.t, h: plank.t + 22 })), mix(legsPlank, mix(armsFloor(142), { hip: pushDn.hip, t: pushDn.t, h: pushDn.t + 22 }))]
    },
    lunge: {
      cfg: { track: 'hip' },
      poses: [
        { hip: [100, 80], t: 180, aN: [6, 20], aF: [0, 16], lN: { to: [124, 136], b: 1 }, lF: { to: [62, 129], b: 1 }, fF: 45 },
        { hip: [92, 106], t: 180, aN: [6, 20], aF: [0, 16], lN: { to: [124, 136], b: 1 }, lF: { to: [62, 129], b: 1 }, fF: 45 }]
    },
    plank: {
      cfg: { arrow: false },
      poses: [
        mix(legsPlank, { hip: forearm.hip, t: forearm.t, h: forearm.t + 24, aN: [0, 90], aF: [-3, 88] }),
        mix(legsPlank, { hip: forearm2.hip, t: forearm2.t, h: forearm2.t + 24, aN: [0, 90], aF: [-3, 88] })]
    },
    mountain_climber: {
      cfg: { track: 'knN' },
      mode: 'cycle', dynamic: true,
      poses: (function () {
        var base = mix(armsFloor(140), { hip: plank.hip, t: plank.t, h: plank.t + 22, fN: 40, fF: 40 });
        var drive = { to: [102, 134], b: 1 }, ext = { to: [40, 133], b: 1 }, mid = { to: [72, 126], b: 1 };
        return [mix(base, { lN: drive, lF: ext }), mix(base, { lN: mid, lF: mid }), mix(base, { lN: ext, lF: drive }), mix(base, { lN: mid, lF: mid }), mix(base, { lN: drive, lF: ext })];
      })()
    },
    burpee: {
      cfg: { track: 'hip' },
      mode: 'cycle',
      poses: [
        stand(118, { aN: [4, 8], aF: [0, 4] }),
        { hip: [92, 106], t: [112, 108], h: 140, aN: { to: [136, 136], b: -1 }, aF: { to: [132, 136], b: -1 }, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } },
        mix(legsPlank, mix(armsFloor(138), { hip: plank.hip, t: plank.t, h: plank.t + 22 })),
        mix(legsPlank, mix(armsFloor(140), { hip: pushDn.hip, t: pushDn.t, h: pushDn.t + 22 })),
        mix(legsPlank, mix(armsFloor(138), { hip: plank.hip, t: plank.t, h: plank.t + 22 })),
        { hip: [92, 106], t: [112, 108], h: 140, aN: { to: [136, 136], b: -1 }, aF: { to: [132, 136], b: -1 }, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } },
        { hip: [118, 46], t: 180, aN: [170, 172], aF: [165, 168], lN: { to: [116, 118], b: 1 }, lF: { to: [126, 112], b: 1 }, fN: 60, fF: 60 },
        stand(118, { aN: [4, 8], aF: [0, 4] })]
    },
    deadlift: {
      cfg: { track: 'hip', equip: 'barbell' },
      poses: [stand(118, { aN: [4, 4], aF: [2, 2] }),
        { hip: [97, 92], t: [118, 112], h: 150, aN: [0, 0], aF: [-2, -2], lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } }]
    },
    /* front view: angles in degrees, see the top of illus.js */
    bicep_curl: {
      cfg: { view: 'front', track: 'haL', equip: 'dumbbell' },
      view: 'front',
      poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [3, 3], lL: { to: [9, 136] } },
        { hip: [130, 74.5], t: 0, h: 0, aL: [6, -158], lL: { to: [9, 136] } }]
    },
    shoulder_press: {
      cfg: { view: 'front', track: 'haL', equip: 'dumbbell' },
      view: 'front',
      poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [74, 182], lL: { to: [9, 136] } },
        { hip: [130, 74.5], t: 0, h: -2, aL: [172, 176], lL: { to: [9, 136] } }]
    },
    jumping_jack: {
      cfg: { view: 'front', track: 'haL' },
      view: 'front',
      poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [6, 6], lL: { to: [6, 136] } },
        { hip: [130, 69], t: 0, h: 0, aL: [86, 86], lL: { to: [15, 128] } },
        { hip: [130, 77], t: 0, h: 0, aL: [162, 166], lL: { to: [27, 136] } }]
    },

    /* =================== FACE (front-view face, drawn by face.js; see the notes there) =================== */
    jaw_jut: { face: { to: { fwd: 1, neck: 0.5 }, caption: 'Lower jaw forward' } },
    fish_face: { face: { to: { puff: -1, pucker: 0.5 }, caption: 'Suck cheeks in' } },
    cheek_puff: { face: { to: { puff: 1 }, caption: 'Puff cheeks out' } },
    smile_cheek_lift: { face: { to: { smile: 1 }, caption: 'Smile, lift cheeks' } },
    jaw_drop: { face: { to: { jaw: 0.8 } } },
    jaw_side_slide: { face: { to: { slide: 1, jaw: 0.18 } } },
    chin_lift_pucker: { face: { to: { pitch: 0.45, pucker: 0.85 }, caption: 'Gentle lip pucker' } },
    platysma_pull: { face: { to: { down: 1, neck: 1, jaw: 0.12 }, caption: 'Pull corners down' } },
    vowel_shapes: { face: { dynamic: true, from: { pucker: 1, jaw: 0.4 }, to: { wide: 1, smile: 0.6, jaw: 0.15 } } },
    brow_raise: { face: { to: { brow: 1, eyeWide: 0.4 } } },
    eye_squeeze: { face: { from: { eyeWide: 0.25 }, to: { squeeze: 0.45 }, caption: 'Close gently' } },
    lion_face: { face: { to: { jaw: 0.85, tongue: 1, eyeWide: 0.8, brow: 0.4 } } },
    tongue_posture: { face: { to: { neck: 0.22 }, caption: 'Tongue on the roof of the mouth' } },
    tongue_press: { face: { to: { neck: 0.4 }, caption: 'Press tongue to the palate' } },
    slow_chew: { face: { dynamic: true, from: { jaw: 0.06 }, to: { jaw: 0.32 }, caption: 'Chew slowly' } },
    chin_resistance: { face: { to: { jaw: 0.28, neck: 0.35 }, caption: 'Open against a light hand' } },

    /* =================== NECK, BACK AND SPINE =================== */
    chin_tuck: {
      poses: [stand(118, { aN: [3, 3], aF: [-6, -6], h: 162 }), stand(118, { aN: [3, 3], aF: [-6, -6], h: 182 })]
    },
    neck_forward_stretch: {
      poses: [stand(118, { aN: [3, 3], aF: [-6, -6] }), stand(118, { aN: [3, 3], aF: [-6, -6], h: 128 })]
    },
    neck_side_stretch: {
      cfg: { view: 'front' }, view: 'front',
      poses: [{ hip: [130, 74.5], t: 0, h: 0, aL: [4, 4], lL: { to: [9, 136] } }, { hip: [130, 74.5], t: 0, h: 26, aL: [4, 4], lL: { to: [9, 136] } }]
    },
    scapular_squeeze: {
      poses: [stand(118, { aN: [12, 98], aF: [6, 92] }), stand(118, { aN: [-30, 64], aF: [-34, 60] })]
    },
    wall_angel: {
      cfg: { view: 'front', track: 'haL' }, view: 'front',
      props: [{ t: 'rect', x: -300, y: -100, w: 860, h: 240, c: 'wall' }],
      poses: [{ hip: [130, 74.5], t: 0, h: 0, aL: [82, 182], lL: { to: [9, 136] } }, { hip: [130, 74.5], t: 0, h: 0, aL: [172, 176], lL: { to: [9, 136] } }]
    },
    standing_back_extension: {
      cfg: { track: 'sh' },
      poses: [stand(118, { aN: [-18, 150], aF: [-18, 150] }), stand(121, { t: 193, aN: [-18, 150], aF: [-18, 150] })]
    },
    knee_to_chest: {
      props: P.mat(30, 190),
      poses: [
        lying({ lN: { to: [138, 136], b: 1 }, lF: { to: [144, 136], b: 1 } }),
        lying({ lN: [201, 77], lF: { to: [144, 136], b: 1 }, aN: { to: [100, 106], b: -1 }, aF: { to: [98, 108], b: -1 } })
      ]
    },
    pelvic_tilt: {
      props: P.mat(30, 190),
      poses: [
        lying({ t: [262, 272], lN: { to: [138, 136], b: 1 }, lF: { to: [144, 136], b: 1 } }),
        lying({ t: [270, 270], hip: [102, 130], lN: { to: [138, 136], b: 1 }, lF: { to: [144, 136], b: 1 } })
      ]
    },
    cobra_stretch: {
      props: P.mat(20, 200),
      poses: [
        { hip: [100, 131], t: 94, h: 100, aN: { to: [146, 136], b: -1 }, aF: { to: [140, 136], b: -1 }, lN: { to: [40, 133], b: 1 }, lF: { to: [38, 133], b: 1 }, fN: 40, fF: 40 },
        { hip: [100, 131], t: [100, 128], h: 150, aN: { to: [146, 136], b: -1 }, aF: { to: [140, 136], b: -1 }, lN: { to: [40, 133], b: 1 }, lF: { to: [38, 133], b: 1 }, fN: 40, fF: 40 }
      ]
    },
    superman: {
      props: P.mat(20, 200),
      poses: [
        { hip: [100, 131], t: 93, h: 93, aN: [96, 96], aF: [94, 94], lN: { to: [40, 133], b: 1 }, lF: { to: [38, 133], b: 1 }, fN: 40, fF: 40 },
        { hip: [100, 129], t: [97, 106], h: 104, aN: [118, 108], aF: [94, 94], lN: { to: [40, 133], b: 1 }, lF: { to: [44, 118], b: 1 }, fN: 40, fF: 40 }
      ]
    },
    dead_bug: {
      cfg: { track: 'haN' },
      props: P.mat(20, 200),
      poses: [
        lying({ aN: [180, 180], aF: [175, 175], lN: [205, 95], lF: [200, 92], fN: 180, fF: 180 }),
        lying({ aN: [250, 255], aF: [175, 175], lN: [205, 95], lF: [92, 88], fN: 180, fF: 90 })
      ]
    },
    hamstring_stretch: {
      cfg: { track: 'haN' },
      props: P.mat(30, 200),
      poses: [
        { hip: [78, 118], t: 185, h: 175, aN: [70, 20], aF: [64, 16], lN: { to: [168, 136], b: 1 }, lF: { to: [62, 136], b: 1 } },
        { hip: [82, 118], t: [158, 148], h: 138, aN: { to: [150, 128], b: -1 }, aF: { to: [146, 130], b: -1 }, lN: { to: [168, 136], b: 1 }, lF: { to: [62, 136], b: 1 } }
      ]
    },
    lateral_raise: {
      cfg: { view: 'front', track: 'haL', equip: 'dumbbell' },
      view: 'front',
      poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [8, 8], lL: { to: [9, 136] } },
        { hip: [130, 74.5], t: 0, h: 0, aL: [92, 88], lL: { to: [9, 136] } }
      ]
    },
    bent_over_row: {
      cfg: { track: 'haN', equip: 'dumbbell' },
      poses: [
        { hip: [100, 86], t: 115, h: 120, aN: [4, 4], aF: [0, 0], lN: { to: [118, 136], b: 1 }, lF: { to: [128, 136], b: 1 } },
        { hip: [100, 86], t: 115, h: 120, aN: [-72, 8], aF: [-68, 6], lN: { to: [118, 136], b: 1 }, lF: { to: [128, 136], b: 1 } }
      ]
    },
    tricep_dip: {
      cfg: { track: 'hip' },
      props: P.chair(42, 110),
      poses: [
        { hip: [106, 96], t: 175, aN: { to: [80, 110], b: -1 }, aF: { to: [76, 110], b: -1 }, lN: { to: [150, 136], b: 1 }, lF: { to: [160, 136], b: 1 } },
        { hip: [106, 114], t: 175, aN: { to: [80, 110], b: -1 }, aF: { to: [76, 110], b: -1 }, lN: { to: [150, 136], b: 1 }, lF: { to: [160, 136], b: 1 } }
      ]
    },
    jump_squat: {
      cfg: { track: 'hip' },
      mode: 'cycle',
      poses: [
        stand(118, armsFwd),
        mix(armsFwd, { hip: [94, 105], t: [144, 136], h: 164, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } }),
        { hip: [118, 46], t: 180, aN: [170, 172], aF: [165, 168], lN: { to: [116, 118], b: 1 }, lF: { to: [126, 112], b: 1 }, fN: 60, fF: 60 },
        stand(118, armsFwd)
      ]
    },
    quad_stretch: {
      cfg: { track: 'anN' },
      props: P.wallRight(168),
      poses: [
        { hip: [118, 74.5], t: 180, aN: { to: [164, 56], b: -1 }, aF: [20, 20], lN: { to: [118, 136], b: 1 }, lF: { to: [128, 136], b: 1 } },
        { hip: [118, 74.5], t: 180, aN: { to: [164, 56], b: -1 }, aF: { to: [96, 92], b: 1 }, lN: { to: [118, 136], b: 1 }, lF: [200, 90], fF: 270 }
      ]
    },
    side_lunge: {
      cfg: { view: 'front', track: 'hip' },
      view: 'front',
      poses: [
        { hip: [130, 74.5], t: 0, h: 0, aL: [12, 12], lL: { to: [10, 136] } },
        { hip: [108, 92], t: 10, h: 4, aL: [30, 44], aR: [6, 8], lL: { to: [50, 136] }, lR: { to: [12, 136] } }
      ]
    },

    /* =================== LOOKS-LIKE: reuse another exercise's picture =================== */
    crunch: { like: 'curl_up' },
    high_knees: { like: 'march_in_place' },
    butt_kicks: { like: 'high_knees' },
    bicycle_crunch: { like: 'crunch' },
    flutter_kick: { like: 'dead_bug' },
    leg_raise: { like: 'dead_bug' }
  };

  root.ANIMATIONS = LIST;
})(window);
