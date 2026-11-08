/* routine.js — THE DAILY PLAN: which exercises go in which block, and how it progresses.
 *
 * You can also change all of this inside the app (Today tab -> "Edit plan"), without touching this file.
 *
 * blocks[].items[].pick  = a list of exercise ids (from exercises.js).
 *    - one id            -> that exercise every day
 *    - several ids       -> the app rotates through them day by day, so your routine keeps changing
 * blocks[].circuit       = true -> the block is repeated "rounds" times (see levels)
 */
(function (root) {
  root.ROUTINE = {
    lightDayBlocks: ['warmup', 'stability', 'cooldown'],   // the weekly lighter day (no strength circuit)

    rest: { warmup: 5, strength: 15, stability: 5, cooldown: 5 },   // seconds of rest between exercises

    // Progression. You move up a level yourself, when the app says you are ready (see the Progress tab).
    levels: [
      { n: 1, title: 'Level 1 · Weeks 1–2: get started', rounds: 1, repsBonus: 0, holds: 3 },
      { n: 2, title: 'Level 2 · Weeks 3–4: second round', rounds: 2, repsBonus: 0, holds: 3 },
      { n: 3, title: 'Level 3 · Weeks 5–6: more reps', rounds: 2, repsBonus: 2, holds: 4 },
      { n: 4, title: 'Level 4 · Weeks 7–8: harder versions', rounds: 2, repsBonus: 2, holds: 4 },
      { n: 5, title: 'Level 5 · Weeks 9–10: slow and controlled', rounds: 2, repsBonus: 2, holds: 5 },
      { n: 6, title: 'Level 6 · Weeks 11–12: add load', rounds: 2, repsBonus: 2, holds: 5 }
    ],

    blocks: [
      {
        id: 'warmup', title: 'Warm-up', items: [
          { pick: ['cat-cow'] },
          { pick: ['arm-circles', 'overhead-reach'] },
          { pick: ['march'] }
        ]
      },
      {
        id: 'strength', title: 'Strength circuit', circuit: true, items: [
          { pick: ['sit-to-stand', 'wall-sit', 'step-up'] },
          { pick: ['incline-pushup', 'wall-pushup'] },
          { pick: ['glute-bridge', 'donkey-kick'] },
          { pick: ['backpack-row'] },
          { pick: ['reverse-lunge', 'split-squat'] },
          { pick: ['calf-raise'] }
        ]
      },
      {
        id: 'stability', title: 'Back stability', items: [
          { pick: ['curl-up'] },
          { pick: ['side-plank'] },
          { pick: ['bird-dog'] }
        ]
      },
      {
        id: 'cooldown', title: 'Cool-down', items: [
          { pick: ['knee-rolls'] },
          { pick: ['hip-flexor-stretch'] },
          { pick: ['chest-stretch', 'calf-stretch'] },
          { pick: ['childs-pose'] }
        ]
      }
    ]
  };
})(window);
