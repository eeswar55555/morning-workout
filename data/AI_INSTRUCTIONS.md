# Instructions for an AI: add or verify workout content

You are helping maintain the content of **Morning Workout**, a mobile fitness app (a voice-guided workout player with animated demos).
All of the app's built-in content is JSON in three levels. Each level only **references** the one below it by id:

```
Exercise library  →  Workouts  →  Training plans
exercise            list of      day-by-day schedule of
(one move, once)    exercise     workouts and rest days
                    entries
```

You will be given (a) the JSON Schema, (b) an index of everything that already exists, and optionally (c) the full current JSON.
Your answer is machine-read: it is merged into the app by a script that validates it. Follow the format exactly.

## Tasks

**ADD** – create new exercises, workouts and/or plans (a request will say what).
**VERIFY** – review existing content for mistakes and fix what is wrong. Return **only the items you changed**, as complete objects with the **same id** (they replace the originals). Do not return unchanged items.

## Output format (strict)

1. **One** fenced ```json block containing a single JSON object, a *content pack*:
   `{ "schemaVersion": 1, "exercises": [...], "workouts": [...], "plans": [...] }` (each list optional; omit empty lists).
2. After it, a short **Notes** section in plain text: what you added/changed and why, anything you are unsure about, and, for each *new* exercise, which existing exercise's picture looks closest (the app can only animate exercises that have a picture; new ones show a placeholder until one is assigned). Facial exercises use a face illustration.
3. No other JSON, no comments inside the JSON, no trailing commas. Do not wrap the JSON in anything but the one fence.

## Hard rules (the validator rejects violations)

- **Ids:** lowercase snake_case, `^[a-z0-9]+(_[a-z0-9]+)*$` (e.g. `push_up`, `beginner_full_body_01`). Unique within their kind.
- **Reuse before inventing.** Check the index. If an exercise/workout already exists, reference its id; never create a near-duplicate with a different id. To change an existing item (VERIFY) keep its id.
- **Never copy exercise data into a workout.** Workout entries reference `exerciseId` only. Every `exerciseId` must exist (in the index or in your own `exercises` list). Every plan `workoutId` must exist likewise.
- **Allowed fields only.** Unknown fields are rejected. Do not invent muscles, difficulties, types or regions: use the lists below.
- **Exercise `type`:** `reps` (counted), `time` (keep moving for N seconds, e.g. jumping jacks), `hold` (stay still for N seconds, e.g. plank, stretches).
- **Workout entry amounts must match the type:** a `reps` exercise uses `repetitions` (integer ≥ 1) and never `durationSeconds`; `time`/`hold` exercises use `durationSeconds` (integer ≥ 1) and never `repetitions`. Amounts are **per side** if the exercise has `sides`.
- **Plan days** run `1..N` in order with no gaps. A workout day has `workoutId` (one) **or** `workoutIds` (several, done one after another); a rest day is `{ "day": N, "type": "rest" }` with no workout fields. Day 1 is the day the user starts; after day N the plan repeats.
- `description` and `name` are required on exercises/workouts/plans as in the schema; `instructions.steps` needs at least one step.

## Vocabulary

- `difficulty`: `beginner` | `intermediate` | `advanced`
- `primaryMuscles` / `secondaryMuscles`: `chest, shoulders, biceps, triceps, forearms, back, lower_back, core, glutes, quadriceps, hamstrings, calves, hip_flexors, neck, jaw, cheeks, lips, forehead, eyes` (`neck, jaw, cheeks, lips, forehead, eyes` are for neck and face exercises)
- `bodyRegion`: `upper_body` | `lower_body` | `core` | `full_body` | `neck` | `face`
- `category` (exercise) and `category` (workout) are free text; use existing values when possible (exercises: strength, cardio, core, mobility, stretching, balance, posture, facial; workouts: warmup, strength, core, cardio, cooldown, recovery, full_body, mobility, facial). A workout with `"category": "strength"` uses the user's "rest between strength exercises" setting.
- `equipment`: free text list, e.g. `["dumbbell"]`, `["chair","wall"]`; omit for bodyweight. `tags`: free text snake_case list.

## How the app uses the data (so you write the right thing)

- Instructions are **spoken aloud** by a voice coach and shown as steps: write short imperative sentences (about 6 to 16 words), plain text, no markdown, no emoji, no numbering. 3 to 5 steps. `cue` = one short coaching phrase. `breathCues` = exactly two short phrases: [on the effort, on the return] (only for rep exercises with a clear in/out phase). `commonMistake` and `easier` are one sentence each; add `harder` only if useful.
- `tempoSeconds`: seconds per repetition (typically 2 to 6; slow controlled moves 4 to 5) or per animation loop for `time` exercises (1 to 3).
- Workout `restSeconds` is the rest after each set (the player never rests less than 3 s; default 8). Typical: warm-up and stretching 5; strength circuits 15 to 30; cardio intervals 10 to 20. `rounds` repeats the whole list (a circuit). Use `sets` on an entry for back-to-back repeats (e.g. holds: 3 sets of 10 s).
- A workout is meant to be done in one go: roughly 5 to 30 minutes. Order sensibly: warm-up or mobility first, harder compound moves early, core or stretches last. Alternate muscle groups; do not stack the same muscles back to back unless intended.
- **Progression is data:** a plan gets harder by pointing later days at harder workouts (more reps, more rounds, harder variations). Do not add week-specific fields. Include rest or recovery days appropriately (usually 1 per 3 to 6 training days for beginners).
- Use the workout `description` for the purpose of the workout in one sentence.

## Quality checklist (apply to everything you write, and for VERIFY to everything you review)

1. **Correctness:** the steps describe the real movement safely and in the right order; muscles listed are the ones actually working (primary = main movers, secondary = helpers); `type` fits the movement (a stretch is `hold`, a plank is `hold`, marching is `time`).
2. **Safety:** no dangerous cues (e.g. hyperextending the neck or spine, locking joints, bouncing stretches). Add a `commonMistake` that prevents the typical injury, and an `easier` option for anything demanding. The app's primary audience includes people with **non-specific low back pain**: flag moves that are commonly aggravating (full sit-ups, loaded spinal flexion, deep back extension) and prefer back-friendly alternatives; never diagnose or give medical claims. For jaw, neck and facial moves add "stop if it hurts or the jaw clicks painfully" style cautions, and **never promise results** (e.g. do not claim a facial exercise "slims the face" or "sharpens the jawline"; say it "works the muscles of…").
3. **Difficulty and amounts are realistic** for the stated level (beginner reps 6 to 15, holds 10 to 30 s; avoid advanced moves in beginner workouts).
4. **No duplicates or near-duplicates** of existing ids or names; consistent naming style (sentence case: "Push up" is fine, follow the existing names).
5. **Consistency:** wording style and level of detail match the existing items; every reference resolves; sides, tempo and breathing fields are present where they make sense.
6. **Plans:** sensible weekly structure, a real progression, rest days, and a day count that matches the plan's name (a "30 Day" plan has exactly 30 days).

## Before you answer, check

- The JSON parses; no field outside the schema; every id matches the pattern and every reference exists.
- Rep exercises have only `repetitions`; time/hold exercises have only `durationSeconds`; plan days are exactly `1..N`.
- In VERIFY mode you returned only changed items, each with its original id and all required fields (complete objects, not diffs).

## Mini examples

Exercise:
```json
{ "id": "glute_kickback", "name": "Glute kickback", "description": "Standing kick back with a straight leg.", "type": "reps",
  "primaryMuscles": ["glutes"], "secondaryMuscles": ["hamstrings"], "difficulty": "beginner", "category": "strength", "bodyRegion": "lower_body",
  "equipment": ["wall"], "sides": ["right", "left"], "tempoSeconds": 4,
  "instructions": { "steps": ["Hold a wall for balance.", "Keep your back straight.", "Kick one leg straight back.", "Lower with control, then repeat."],
    "commonMistake": "Do not arch your lower back or swing the leg.", "easier": "Kick back only a little." } }
```
Workout and plan:
```json
{ "id": "legs_01", "name": "Legs 01", "rounds": 2, "restSeconds": 20, "category": "strength",
  "exercises": [ { "exerciseId": "squat", "repetitions": 12 }, { "exerciseId": "glute_kickback", "repetitions": 10 }, { "exerciseId": "wall_sit", "durationSeconds": 20, "sets": 2 } ] }
```
```json
{ "id": "legs_week", "name": "Legs week", "days": [ { "day": 1, "workoutId": "legs_01" }, { "day": 2, "type": "rest" }, { "day": 3, "workoutIds": ["warmup_a", "legs_01", "cooldown_a"], "note": "Walk for 10 minutes afterwards." } ] }
```
