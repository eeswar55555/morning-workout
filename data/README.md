# Workout content (data/)

Everything the app teaches and schedules is plain JSON in this folder. Three levels, each one only **references** the one below by id:

```
Exercise library      →   Workouts                  →   Training plans
"what a move is"          "a list of moves + amounts"    "which workouts happen on which day"
exercises/*.json          workouts/*.json                plans/*.json
push_up                   beginner_full_body_01          beginner_30_day_plan
                          (push_up × 10, plank × 30 s)   (day 1 → beginner_full_body_01, day 7 → rest)
```

- **Define things once.** A workout never copies exercise details, it says `"exerciseId": "push_up"`.
- **No week- or level-specific code.** Progressive overload is just a plan whose later days point at harder workouts.
- **Any mix in one file.** A file is a *pack*: `{ "schemaVersion": 1, "exercises": [...], "workouts": [...], "plans": [...] }`, every list optional.
- The contract is [`schema/types.ts`](schema/types.ts) (TypeScript) and [`schema/fitness.schema.json`](schema/fitness.schema.json) (JSON Schema, for AI output).

## Add something (3 steps)

1. **Write or generate a pack** (see the AI prompt below) and save it, e.g. `data/workouts/legs.json`.
2. **List it** in [`index.json`](index.json) under `files`. (That one line is also what makes it work offline.)
3. **Check it:** `npm run validate` (or `node scripts/validate-data.js`). It checks the structure against the schema, that every `exerciseId` / `workoutId` exists, that reps exercises have `repetitions` and time/hold exercises have `durationSeconds`, that plan days run 1..N, and that ids are unique. Fix what it reports, then reload the app.

To make a new plan the default for new users change `defaultPlanId` in `index.json`. Anyone can switch plans in the app under *Settings → Training plan*.

## The three shapes

**Exercise** (library) — defined exactly once:

```json
{
  "id": "push_up",
  "name": "Push up",
  "description": "Classic push up from your toes or knees.",
  "type": "reps",
  "primaryMuscles": ["chest", "triceps"],
  "secondaryMuscles": ["shoulders", "core"],
  "difficulty": "beginner",
  "instructions": { "steps": ["Start in a high plank.", "Lower your chest.", "Press back up."] }
}
```

`type` is `reps` (counted), `time` (keep moving for N seconds, e.g. jumping jacks) or `hold` (stay still for N seconds, e.g. plank, stretches).
Optional: `category`, `bodyRegion`, `equipment` (e.g. `["dumbbell"]`), `tags`, `caloriesPerMinute`, `sides` (`["right","left"]`: done on each side), `tempoSeconds`, and inside `instructions`: `breathing`, `breathCues`, `cue`, `commonMistake`, `easier`, `harder`.

**Workout** — a list of entries; each entry references an exercise:

```json
{
  "id": "beginner_full_body_01",
  "name": "Beginner Full Body 01",
  "rounds": 2,
  "restSeconds": 20,
  "exercises": [
    { "exerciseId": "jumping_jack", "durationSeconds": 30 },
    { "exerciseId": "push_up", "repetitions": 10 },
    { "exerciseId": "plank", "durationSeconds": 30, "sets": 2, "note": "Squeeze your glutes." }
  ]
}
```

An entry uses `repetitions` for `reps` exercises and `durationSeconds` for `time` / `hold` exercises (per side if the exercise has `sides`). `sets` repeats it back to back (default 1). `restSeconds` on an entry or workout is the rest after each set (the player never rests less than 3 s; default 8). `rounds` repeats the whole list (a circuit). Optional: `description`, `difficulty`, `category`, `tags`, `estimatedMinutes`.
The setting *rest between strength exercises* overrides the workout default for workouts with `"category": "strength"`.

**Training plan** — a numbered sequence of days:

```json
{
  "id": "beginner_30_day_plan",
  "name": "30 Day Beginner Plan",
  "days": [
    { "day": 1, "workoutId": "beginner_full_body_01" },
    { "day": 2, "workoutId": "recovery_day_01" },
    { "day": 3, "workoutIds": ["warmup_a", "beginner_full_body_02", "cooldown_a"], "note": "Walk for 10 minutes afterwards." },
    { "day": 7, "type": "rest" }
  ]
}
```

A workout day has `workoutId` (one) **or** `workoutIds` (several, done one after another, so a warm-up or cool-down is defined once and reused). A rest day is `{ "day": N, "type": "rest" }`. `note` is shown on that day. Days run 1..N in order. Day 1 is the day the user starts the plan; after the last day it starts again.

## Patterns

- **Progression:** write the harder version as another workout (`strength_week_1`, `strength_week_5`, …) and point later days at it. Nothing else changes. See `plans/morning-12-week.json`.
- **Variation:** alternate workouts across days (A/B/C). **Recovery:** a gentle workout (`recovery_day_01`). **Rest:** `type: "rest"`.
- **Your own variants:** add a new exercise (`incline_push_up`) instead of adding flags to an existing one.

## Ask an AI to add or verify content

1. **Build the brief:** `npm run ai-brief` writes `ai-brief.md` (instructions + JSON Schema + an index of every existing id; ~7k tokens).
   For a **review** use `npm run ai-brief -- --full --task verify --out ai-brief-full.md` (also contains the complete current JSON; ~36k tokens).
2. **Give it to any AI** (Claude, GPT, Gemini...): attach or paste the file, then write your request at the bottom, e.g. "ADD 10 hip mobility exercises, one 20 minute workout and a 4-week plan". The instructions inside tell it the rules, the output format and the quality checklist ([`AI_INSTRUCTIONS.md`](AI_INSTRUCTIONS.md)).
3. **Save its whole reply** to a file (for example `answer.txt`) and run `npm run import -- answer.txt --dry`, then without `--dry`.
   The importer finds the JSON in the reply, checks everything on a temporary copy (schema, references, reps vs seconds, day numbers...), and only then merges it: an item with an existing id **replaces** it in place (how fixes from a review land), new items go to `exercises/ai-additions.json`, `workouts/ai-additions.json` and `plans/ai-additions.json` (created and listed in `index.json` automatically). If anything is wrong nothing is changed and you get a list to paste back to the AI.
4. Try it in the app, then commit and push. New exercises show a placeholder picture until one is assigned in `../animations.js` (the AI's notes suggest which existing picture looks closest).

Content you create inside the app (Workout Studio) is saved on the phone, not in these files. The AI workflow is for built-in content that ships with the app.

## Illustrations (optional)

Pictures are not part of the data. Any exercise works with no picture (a neutral placeholder is shown). To give one a picture, add an entry to [`../animations.js`](../animations.js) whose key is the exercise id, or reuse another picture with `{ like: 'other_exercise_id' }`. Body exercises use poses for the character; **facial exercises** use `{ face: { to: { jaw: 0.8 } } }`, a front-view face drawn by [`../face.js`](../face.js) (the values you can use are listed at the top of that file). The muscles tinted on the character come from `primaryMuscles` / `secondaryMuscles`. Open `gallery.html` to preview, `npm run validate` lists exercises without a picture.

## Evolving the schema

New optional fields are safe: add them to `types.ts` and `fitness.schema.json`, and old data stays valid. The app ignores fields it does not know. A breaking change would bump `schemaVersion` and come with a converter.
