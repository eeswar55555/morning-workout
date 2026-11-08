/* exercises.js — THE EXERCISE LIBRARY.
 *
 * This is the file to edit when you want different exercises. (You can also add
 * your own exercises inside the app: Library tab -> "Add my own exercise".)
 *
 * Each exercise looks like this:
 *
 *   {
 *     id: 'sit-to-stand',            // unique short name, no spaces
 *     name: 'Chair sit-to-stand',    // shown and spoken
 *     area: 'Thighs · glutes',       // muscles worked (shown in the app)
 *     type: 'reps',                  // 'reps' | 'hold' | 'time'
 *     reps: 8,                       // reps  -> counted for you, level adds more reps
 *     // secs: 30,                   // hold / time -> seconds per hold (or total)
 *     // holds: 'level',             // hold  -> how many holds ('level' = grows with your level)
 *     // sides: true,                // do it on both sides (or ['forward','backward'])
 *     tempo: 4,                      // seconds per rep (or per animation loop)
 *     steps: ['...', '...'],         // the spoken, step-by-step instructions
 *     breath: '...',                 // breathing advice
 *     breathCue: ['...', '...'],     // short cues spoken during the first two reps
 *     mistake: '...',                // most common mistake
 *     easier: '...',                 // beginner modification
 *     levelNotes: { 4: '...' },      // extra tip once you reach that level
 *     anim: { ... }                  // the moving picture (see below)
 *   }
 *
 * The moving picture: `anim.poses` is a list of key poses the figure moves between
 * (see figure.js for what a pose contains). The easiest way to add an exercise is to copy
 * an existing one and tweak the numbers, or to reuse a picture:  anim: 'sit-to-stand'.
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

  var up = F.line([105, 129], 52), dn = F.line([105, 129], 38);       // incline push-up body lines
  var wup = F.line([124, 136], 70), wdn = F.line([124, 136], 57);     // wall push-up body lines

  var LIST = [

    /* =================== WARM-UP =================== */
    {
      id: 'cat-cow', name: 'Cat-cow', area: 'Spine · back mobility',
      type: 'reps', reps: 8, tempo: 5,
      steps: ['Get on your hands and knees. Hands under your shoulders, knees under your hips.',
        'Slowly round your back up toward the ceiling and tuck your chin.',
        'Then slowly let your belly sink and look gently forward.',
        'Move only as far as feels comfortable.'],
      breath: 'Breathe out as you round your back, and in as your belly sinks.',
      breathCue: ['Breathe out, round your back', 'Breathe in, belly down, look forward'],
      mistake: 'Do not force the end of the movement, and keep your arms straight.',
      easier: 'Make the movement smaller. Put a folded towel under your knees.',
      anim: {
        props: P.mat(40, 190),
        poses: [all4({ t: [130, 80], h: 70 }), all4({ t: [80, 125], h: 135 })]
      }
    },
    {
      id: 'arm-circles', name: 'Arm circles', area: 'Shoulders · upper back',
      type: 'reps', reps: 10, sides: ['forward', 'backward'], tempo: 3,
      steps: ['Stand tall with your feet hip-width apart.',
        'Hold your arms out and draw big, smooth circles.',
        'Keep your neck relaxed and shoulders away from your ears.',
        'After the first set, reverse the direction.'],
      breath: 'Breathe steadily. Do not hold your breath.',
      mistake: 'Do not shrug your shoulders up to your ears.',
      easier: 'Make the circles smaller.',
      anim: {
        mode: 'cycle', reverseSide2: true,
        poses: [0, 90, 180, 270, 360].map(function (a) { return stand(118, { aN: [a, a], aF: [a - 14, a - 14] }); })
      }
    },
    {
      id: 'overhead-reach', name: 'Overhead reach', area: 'Shoulders · upper back · posture',
      type: 'reps', reps: 8, tempo: 5,
      steps: ['Stand tall, feet hip-width apart, arms by your sides.',
        'Slowly raise both arms forward and up over your head.',
        'Reach gently toward the ceiling. Keep your ribs down and do not arch your back.',
        'Lower your arms slowly back down.'],
      breath: 'Breathe in as you reach up, and out as you lower.',
      breathCue: ['Breathe in, reach up tall', 'Breathe out, arms down'],
      mistake: 'Do not lean back or lift your ribs.',
      easier: 'Raise your arms only as high as is comfortable.',
      anim: { poses: [stand(118, { aN: [3, 3], aF: [-8, -8] }), stand(118, { aN: [177, 177], aF: [168, 168] })] }
    },
    {
      id: 'march', name: 'March in place', area: 'Whole body · warm-up',
      type: 'time', secs: 60, tempo: 1.6,
      steps: ['Stand tall.', 'March on the spot, lifting your knees to a comfortable height.',
        'Swing your arms naturally, opposite arm to leg.'],
      breath: 'Breathe easily and stay relaxed.',
      mistake: 'Do not lean back or slump forward.',
      easier: 'Lift your knees lower, or hold on to a chair.',
      anim: {
        dynamic: true,
        poses: [
          { hip: [118, 74.5], t: 180, lN: [85, -5], lF: [0, 0], fN: 60, aN: [-35, -20], aF: [55, 80] },
          { hip: [118, 74.5], t: 180, lN: [0, 0], lF: [85, -5], fF: 60, aN: [55, 80], aF: [-35, -20] }
        ]
      }
    },

    /* =================== STRENGTH =================== */
    {
      id: 'sit-to-stand', name: 'Chair sit-to-stand', area: 'Thighs · glutes',
      type: 'reps', reps: 8, tempo: 4,
      steps: ['Sit near the front edge of a sturdy chair, feet hip-width apart, arms stretched forward.',
        'Lean slightly forward from your hips.',
        'Push through your heels and stand all the way up tall.',
        'Sit back down slowly and with control.'],
      breath: 'Breathe out as you stand, and in as you sit.',
      breathCue: ['Breathe out, stand tall', 'Breathe in, sit back slowly'],
      cue: 'Sit back, knees over toes, stand tall.',
      mistake: 'Do not let your knees fall inward, and do not flop into the chair.',
      easier: 'Use a higher seat, or push off your thighs with your hands.',
      levelNotes: { 4: 'Use a lower seat.', 6: 'Hold your backpack against your chest.' },
      anim: {
        props: P.chair(82, 114),
        poses: [
          { hip: [98, 108], t: 172, aN: [85, 95], aF: [80, 90], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } },
          { hip: [110, 100], t: 140, aN: [85, 95], aF: [80, 90], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } },
          { hip: [121, 75], t: 180, aN: [85, 95], aF: [80, 90], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } }
        ]
      }
    },
    {
      id: 'wall-sit', name: 'Wall sit', area: 'Thighs · glutes',
      type: 'hold', secs: 20, holds: 2,
      steps: ['Stand with your back flat against a wall, feet a step forward.',
        'Slide down until your knees are bent a little, like a shallow chair sit.',
        'Keep your whole back against the wall and hold.',
        'Slide back up to finish.'],
      breath: 'Keep breathing steadily. Do not hold your breath.',
      mistake: 'Keep your knees over your ankles, not past your toes.',
      easier: 'Do not slide down as far.',
      levelNotes: { 5: 'Slide a little lower.' },
      anim: {
        props: P.wallLeft(100),
        poses: [
          { hip: [110, 75], t: 180, aN: [80, 90], aF: [75, 85], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } },
          { hip: [108, 94], t: 180, aN: [80, 90], aF: [75, 85], lN: { to: [128, 136], b: 1 }, lF: { to: [134, 136], b: 1 } }
        ]
      }
    },
    {
      id: 'step-up', name: 'Low step-up', area: 'Thighs · glutes · balance',
      type: 'reps', reps: 6, sides: true, tempo: 4,
      steps: ['Stand facing a low, sturdy step, such as the bottom stair. Hold a rail or wall if you need to.',
        'Place one whole foot on the step.',
        'Push through that heel and stand up tall on the step.',
        'Lower back down slowly, then repeat. After the set, switch legs.'],
      breath: 'Breathe out as you step up, and in as you step down.',
      mistake: 'Do not push off the back foot. Drive through the heel on the step.',
      easier: 'Use a lower step and hold on to a rail.',
      anim: {
        props: P.step(130, 118, 55),
        poses: [
          { hip: [112, 75], t: 180, aN: [20, 10], aF: [10, 0], lN: { to: [118, 136], b: 1 }, lF: { to: [108, 136], b: 1 } },
          { hip: [124, 78], t: 170, aN: [30, 20], aF: [20, 10], lN: { to: [142, 114], b: 1 }, lF: { to: [108, 136], b: 1 } },
          { hip: [140, 52], t: 180, aN: [20, 10], aF: [10, 0], lN: { to: [142, 114], b: 1 }, lF: { to: [132, 114], b: 1 } }
        ]
      }
    },
    {
      id: 'incline-pushup', name: 'Incline push-up', area: 'Chest · shoulders · triceps',
      type: 'reps', reps: 6, tempo: 4,
      steps: ['Place your hands on a sturdy table or counter, a little wider than your shoulders.',
        'Walk your feet back until your body is one straight line from head to heels.',
        'Bend your elbows and lower your chest toward the table for two seconds.',
        'Push back up, keeping your body straight.'],
      breath: 'Breathe in as you lower, and out as you push up.',
      breathCue: ['Breathe in, lower your chest slowly', 'Breathe out, press up'],
      cue: 'Straight line from head to heels, lower for two seconds.',
      mistake: 'Do not let your hips sag or your head drop.',
      easier: 'Use a higher surface, or do wall push-ups.',
      levelNotes: { 4: 'Use a lower surface, such as a sturdy chair seat.', 5: 'Lower for three seconds.' },
      anim: {
        props: P.table(176, 90, 50),
        poses: [
          { hip: up.hip, t: up.t, aN: { to: [182, 86], b: -1 }, aF: { to: [178, 86], b: -1 }, lN: { to: [105, 129], b: 1 }, lF: { to: [101, 129], b: 1 }, fN: 50, fF: 50 },
          { hip: dn.hip, t: dn.t, aN: { to: [182, 86], b: -1 }, aF: { to: [178, 86], b: -1 }, lN: { to: [105, 129], b: 1 }, lF: { to: [101, 129], b: 1 }, fN: 50, fF: 50 }
        ]
      }
    },
    {
      id: 'wall-pushup', name: 'Wall push-up', area: 'Chest · shoulders · triceps',
      type: 'reps', reps: 8, tempo: 4,
      steps: ['Stand about an arm and a half from a wall, feet hip-width apart.',
        'Put your hands on the wall at chest height, a little wider than your shoulders.',
        'Bend your elbows and lean your chest toward the wall.',
        'Push back to the start, keeping your body in one straight line.'],
      breath: 'Breathe in as you lean in, and out as you push away.',
      breathCue: ['Breathe in, lean toward the wall', 'Breathe out, push away'],
      mistake: 'Do not stick your bottom out or let your hips sag.',
      easier: 'Stand closer to the wall.',
      harder: 'Step your feet further back, or use a table instead.',
      anim: {
        props: P.wallRight(196),
        poses: [
          { hip: wup.hip, t: wup.t, aN: { to: [192, 64], b: -1 }, aF: { to: [190, 62], b: -1 }, lN: { to: [124, 136], b: 1 }, lF: { to: [120, 136], b: 1 } },
          { hip: wdn.hip, t: wdn.t, aN: { to: [192, 64], b: -1 }, aF: { to: [190, 62], b: -1 }, lN: { to: [124, 136], b: 1 }, lF: { to: [120, 136], b: 1 } }
        ]
      }
    },
    {
      id: 'glute-bridge', name: 'Glute bridge', area: 'Glutes · hamstrings',
      type: 'reps', reps: 10, tempo: 4,
      steps: ['Lie on your back with your knees bent and feet flat, hip-width apart. Arms by your sides.',
        'Squeeze your glutes and lift your hips until your shoulders, hips and knees make a straight line.',
        'Squeeze at the top, keeping your ribs down.',
        'Lower slowly back to the floor.'],
      breath: 'Breathe out as you lift, and in as you lower.',
      breathCue: ['Breathe out, lift your hips', 'Breathe in, lower slowly'],
      cue: 'Ribs down, squeeze the glutes, do not arch your back.',
      mistake: 'Do not arch your lower back or push up onto your toes.',
      easier: 'Lift your hips only part of the way.',
      levelNotes: { 4: 'Hold the top position for three seconds.' },
      anim: {
        props: P.mat(30, 190),
        poses: [
          lying({ lN: { to: [138, 136], b: 1 }, lF: { to: [144, 136], b: 1 } }),
          lying({ hip: [101.9, 115.3], t: 292, h: 275, lN: { to: [138, 136], b: 1 }, lF: { to: [144, 136], b: 1 } })
        ]
      }
    },
    {
      id: 'donkey-kick', name: 'Donkey kick', area: 'Glutes · hamstrings',
      type: 'reps', reps: 8, sides: true, tempo: 4,
      steps: ['Get on your hands and knees, hands under your shoulders, knees under your hips.',
        'Keep your back flat and your tummy gently tight.',
        'Keep your knee bent and lift one foot up toward the ceiling.',
        'Stop when your thigh is level with your back. Lower slowly. After the set, switch legs.'],
      breath: 'Breathe out as you lift, and in as you lower.',
      mistake: 'Do not swing your leg high, arch your back or twist your hips.',
      easier: 'Lift your leg only a little off the floor.',
      anim: {
        props: P.mat(40, 190),
        poses: [
          all4({ lN: [0, 270], fN: 270 }),
          all4({ lN: [-105, 170], fN: 235 })
        ]
      }
    },
    {
      id: 'backpack-row', name: 'Backpack row', area: 'Upper back · biceps',
      type: 'reps', reps: 8, sides: true, tempo: 4,
      steps: ['Hold a backpack with some weight in one hand. Rest your other hand on a chair or counter.',
        'Bend your knees slightly and hinge forward from your hips, with a flat back.',
        'Let the bag hang down, then pull your elbow up toward your hip.',
        'Lower the bag slowly. Finish all reps, then switch sides.'],
      breath: 'Breathe out as you pull, and in as you lower.',
      breathCue: ['Breathe out, pull your elbow to your hip', 'Breathe in, lower slowly'],
      cue: 'Hinge from the hips, back flat, elbow to hip.',
      mistake: 'Do not round your back or twist your body.',
      easier: 'Use a lighter bag, or no weight at all.',
      levelNotes: { 5: 'Lower the bag for three seconds.', 6: 'Put more weight in the bag.' },
      anim: {
        bag: true,
        props: P.table(150, 96, 60),
        poses: [
          { hip: [84, 86], t: 115, h: 120, aN: [0, 0], aF: { to: [156, 92], b: -1 }, lN: { to: [112, 136], b: 1 }, lF: { to: [122, 136], b: 1 } },
          { hip: [84, 86], t: 115, h: 120, aN: [-72, 5], aF: { to: [156, 92], b: -1 }, lN: { to: [112, 136], b: 1 }, lF: { to: [122, 136], b: 1 } }
        ]
      }
    },
    {
      id: 'reverse-lunge', name: 'Reverse lunge', area: 'Thighs · glutes · balance',
      type: 'reps', reps: 6, sides: true, tempo: 4,
      steps: ['Stand beside a wall with one hand resting on it, feet together.',
        'Step one foot back and lower until both knees are bent, the front knee above your ankle.',
        'Keep your body upright.',
        'Push through your front heel to stand. Finish one side, then switch.'],
      breath: 'Breathe in as you step back, and out as you stand.',
      breathCue: ['Breathe in, step back and lower', 'Breathe out, push up'],
      cue: 'Step back, front knee over the ankle.',
      mistake: 'Do not let your front knee travel past your toes, and do not lean forward.',
      easier: 'Take a smaller step back, or do the split squat instead.',
      levelNotes: { 4: 'Do it without the wall for support.' },
      anim: {
        props: P.wallRight(162),
        poses: [
          { hip: [127, 75], t: 180, aN: [5, 5], aF: { to: [157.5, 60], b: -1 }, lN: { to: [120, 136], b: 1 }, lF: { to: [140, 136], b: 1 } },
          { hip: [116, 96], t: 180, aN: [5, 5], aF: { to: [157.5, 60], b: -1 }, lN: { to: [86, 129], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 50 }
        ]
      }
    },
    {
      id: 'split-squat', name: 'Split squat', area: 'Thighs · glutes · balance',
      type: 'reps', reps: 6, sides: true, tempo: 4,
      steps: ['Stand with one foot a big step in front of the other. Hold a wall or chair if you need.',
        'Keep your body upright, back heel lifted.',
        'Bend both knees and lower straight down.',
        'Push through the front heel to rise. Finish one side, then switch the front foot.'],
      breath: 'Breathe in as you lower, and out as you rise.',
      breathCue: ['Breathe in, lower straight down', 'Breathe out, push up'],
      mistake: 'Do not lean forward or let your front knee collapse inward.',
      easier: 'Shorten the stance and lower only a little.',
      anim: {
        poses: [
          { hip: [112, 82], t: 180, aN: [60, 80], aF: [55, 75], lN: { to: [84, 129], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 50 },
          { hip: [112, 98], t: 180, aN: [60, 80], aF: [55, 75], lN: { to: [84, 129], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 50 }
        ]
      }
    },
    {
      id: 'calf-raise', name: 'Calf raise', area: 'Calves · ankles',
      type: 'reps', reps: 10, tempo: 3,
      steps: ['Stand tall with your fingertips on a wall for balance, feet hip-width apart.',
        'Rise up onto the balls of your feet as high as you can.',
        'Pause for a moment at the top.',
        'Lower your heels slowly back down.'],
      breath: 'Breathe out as you rise, and in as you lower.',
      mistake: 'Do not roll your ankles outward. Rise straight up.',
      easier: 'Hold the wall firmly with your whole hand.',
      levelNotes: { 5: 'Lower your heels for three seconds.' },
      anim: {
        props: P.wallRight(150),
        poses: [
          { hip: [118, 74.5], t: 180, aN: [5, 5], aF: { to: [146, 56], b: -1 }, lN: { to: [118, 136], b: 1 }, lF: { to: [126, 136], b: 1 } },
          { hip: [122, 66], t: 180, aN: [5, 5], aF: { to: [146, 56], b: -1 }, lN: { to: [122.7, 127], b: 1 }, lF: { to: [130.7, 127], b: 1 }, fN: 35, fF: 35 }
        ]
      }
    },

    /* =================== BACK STABILITY ("Big 3") =================== */
    {
      id: 'curl-up', name: 'Modified curl-up', area: 'Abdomen',
      type: 'hold', secs: 10, holds: 'level',
      steps: ['Lie on your back with one knee bent and the other leg straight.',
        'Slide both hands, palms down, under the curve of your lower back.',
        'Gently lift just your head and shoulders a little off the floor. Keep your neck long.',
        'Hold, keep breathing, then lower. This is not a sit-up.'],
      breath: 'Breathe normally. Do not hold your breath.',
      cue: 'Lift head and shoulders just clear. This is not a sit-up.',
      mistake: 'Do not pull on your neck, and do not flatten your lower back.',
      easier: 'Lift only a tiny amount, or just tighten your tummy.',
      anim: {
        props: P.mat(30, 190),
        poses: [
          lying({ lN: { to: [138, 136], b: 1 }, lF: [90, 90], fF: 180 }),
          lying({ t: [270, 255], h: 245, aN: [100, 100], aF: [100, 100], lN: { to: [138, 136], b: 1 }, lF: [90, 90], fF: 180 })
        ]
      }
    },
    {
      id: 'side-plank', name: 'Side plank on your knees', area: 'Sides of the trunk · hips',
      type: 'hold', secs: 10, holds: 'level', sides: true,
      steps: ['Lie on your side with your knees bent. Rest on your forearm, elbow right under your shoulder.',
        'Lift your hips so your shoulders, hips and knees make one straight line.',
        'Hold, breathing steadily.',
        'Lower gently, rest, then switch sides.'],
      breath: 'Breathe steadily. Do not hold your breath.',
      cue: 'Hips and shoulders in one line.',
      mistake: 'Do not let your hips sag, or roll forward or backward.',
      easier: 'Lift your hips only a little, and rest longer between holds.',
      anim: {
        props: P.mat(40, 200),
        poses: [
          { hip: [117.2, 131], t: 116.5, h: 116.5, aN: { to: [172, 136], b: -1 }, aF: [180, 180], lN: [275, 270], fN: 270, fF: 270 },
          { hip: [114.6, 124.6], t: 107, h: 107, aN: { to: [172, 136], b: -1 }, aF: [180, 180], lN: [287, 270], fN: 270, fF: 270 }
        ]
      }
    },
    {
      id: 'bird-dog', name: 'Bird dog', area: 'Back · glutes · core',
      type: 'hold', secs: 10, holds: 'level', sides: true,
      steps: ['Get on your hands and knees, hands under your shoulders, knees under your hips, back flat.',
        'Slowly reach one arm forward and the opposite leg straight back.',
        'Keep your hips level. Do not let your back sag or twist.',
        'Hold, then return and swap sides.'],
      breath: 'Breathe steadily. Do not hold your breath.',
      cue: 'Reach long, do not let the hips twist or the back sag.',
      mistake: 'Do not let your hips tilt or your lower back sag.',
      easier: 'Lift only the arm, or only the leg.',
      anim: {
        props: P.mat(30, 200),
        poses: [
          all4(),
          all4({ aN: [88, 92], h: 95, lF: [-92, -92], fF: 270 })
        ]
      }
    },

    /* =================== COOL-DOWN =================== */
    {
      id: 'knee-rolls', name: 'Lying knee rolls', area: 'Lower back · hips',
      type: 'reps', reps: 10, tempo: 5,
      steps: ['Lie on your back with your knees bent and together, feet flat on the floor.',
        'Let both knees slowly roll to one side, only as far as is comfortable.',
        'Bring them back to the middle, then roll to the other side.',
        'Keep your shoulders flat and move slowly.'],
      breath: 'Breathe slowly and let your body relax.',
      mistake: 'Do not force your knees down to the floor.',
      easier: 'Use a smaller range.',
      anim: {
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
      }
    },
    {
      id: 'hip-flexor-stretch', name: 'Half-kneeling hip-flexor stretch', area: 'Front of the hips',
      type: 'time', secs: 30, sides: true,
      steps: ['Kneel on one knee on a folded towel, with your other foot flat on the floor in front.',
        'Tuck your pelvis slightly, like tilting your belt buckle up toward your chin.',
        'Gently shift your weight forward until you feel a stretch at the front of the back hip.',
        'Hold and breathe slowly. Do not arch your back.'],
      breath: 'Breathe slowly and deeply while you hold.',
      mistake: 'Do not arch your lower back to get more stretch.',
      easier: 'Hold on to a chair for balance and shift forward only a little.',
      anim: {
        props: P.towel(50, 120),
        poses: [
          { hip: [103, 102], t: 180, aN: [5, 5], lN: { to: [65, 132], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 270 },
          { hip: [113, 106], t: 180, aN: [5, 5], lN: { to: [65, 132], b: 1 }, lF: { to: [140, 136], b: 1 }, fN: 270 }
        ]
      }
    },
    {
      id: 'chest-stretch', name: 'Doorway chest stretch', area: 'Chest · front of the shoulders',
      type: 'time', secs: 30,
      steps: ['Stand in a doorway. Rest your forearm on the door frame, elbow at shoulder height.',
        'Step one foot forward and gently lean through the doorway.',
        'You should feel a mild stretch across your chest. Keep your ribs down.',
        'Hold and breathe. It should never hurt.'],
      breath: 'Breathe slowly and deeply while you hold.',
      mistake: 'Do not push into pain or arch your back.',
      easier: 'Lean in only a little.',
      anim: {
        props: P.post(118),
        poses: [
          { hip: [96, 74.5], t: 180, aN: { to: [117, 40], b: -1 }, aF: { to: [119, 36], b: -1 }, lN: { to: [104, 136], b: 1 }, lF: { to: [112, 136], b: 1 } },
          { hip: [126, 76], t: 170, aN: { to: [117, 40], b: -1 }, aF: { to: [119, 36], b: -1 }, lN: { to: [104, 136], b: 1 }, lF: { to: [116, 136], b: 1 } }
        ]
      }
    },
    {
      id: 'calf-stretch', name: 'Wall calf stretch', area: 'Calves',
      type: 'time', secs: 30, sides: true,
      steps: ['Stand facing a wall with your hands on it at chest height.',
        'Step one foot back, keeping the leg straight and the heel on the floor.',
        'Bend your front knee and lean toward the wall until you feel your calf stretch.',
        'Hold and breathe slowly.'],
      breath: 'Breathe slowly and deeply while you hold.',
      mistake: 'Keep the back heel down.',
      easier: 'Step the back foot in a little.',
      anim: {
        props: P.wallRight(160),
        poses: [
          { hip: [108, 78], t: 180, aN: { to: [156, 56], b: -1 }, aF: { to: [156, 54], b: -1 }, lN: { to: [82, 136], b: 1 }, lF: { to: [128, 136], b: 1 } },
          { hip: [116, 84], t: 140, aN: { to: [156, 56], b: -1 }, aF: { to: [156, 54], b: -1 }, lN: { to: [82, 136], b: 1 }, lF: { to: [128, 136], b: 1 } }
        ]
      }
    },
    {
      id: 'childs-pose', name: "Child's pose", area: 'Back · hips',
      type: 'time', secs: 30,
      steps: ['Start on your hands and knees. Knees about hip-width apart, or wider if that is more comfortable.',
        'Slowly sit your hips back toward your heels.',
        'Rest your arms forward on the floor and let your head relax down.',
        'Breathe slowly into your back. Come up slowly when you finish.'],
      breath: 'Breathe slowly into your lower back.',
      cue: 'Sit back slowly and relax.',
      mistake: 'Do not force your hips down. Stop if it pinches your knees.',
      easier: 'Place a pillow between your hips and heels, or under your chest. Skip it if bending forward makes your back or knees hurt.',
      anim: {
        props: P.mat(30, 200),
        poses: [
          { hip: [100, 104], t: 104, h: 100, aN: { to: [146, 136], b: 1 }, aF: { to: [140, 136], b: 1 }, lN: { to: [66, 134], b: 1 }, lF: { to: [66, 134], b: 1 }, fN: 270, fF: 270 },
          { hip: [72, 112], t: [85, 75], h: 85, aN: { to: [168, 136], b: 1 }, aF: { to: [160, 136], b: 1 }, lN: { to: [66, 134], b: 1 }, lF: { to: [66, 134], b: 1 }, fN: 270, fF: 270 }
        ]
      }
    }
  ];

  root.EXERCISES = LIST;
})(window);
