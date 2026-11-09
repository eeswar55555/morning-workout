/**
 * Morning Workout – content schema (version 1)
 *
 * Three levels, each one only REFERENCES the level below it by id:
 *
 *   Exercise library  →  Workout definitions  →  Training plans
 *   (what a move is)     (a list of moves with    (which workouts happen
 *                         amounts: reps / time)    on which day)
 *
 * Content lives in "packs": JSON files shaped like `ContentPack`, listed in data/index.json.
 * A pack may hold any mix of exercises, workouts and plans, so an AI can return one JSON
 * document and it can be dropped in as-is. Ids must be unique within their kind (exercise / workout / plan) across all packs.
 *
 * Rules of thumb that keep the data future-proof:
 *  - Every field marked `?` is optional. New optional fields can be added at any time without
 *    touching existing data; the app ignores fields it does not know.
 *  - Never copy exercise data into a workout. Use `exerciseId`.
 *  - Never put week-specific logic anywhere. Progression is just a plan that points at harder workouts.
 *
 * The JSON Schema in fitness.schema.json mirrors these types (give it to an AI as the output format).
 * `npm run validate` checks all packs against it, plus references (see scripts/validate-data.js).
 */

export const SCHEMA_VERSION = 1;

/** snake_case identifier, e.g. "push_up", "beginner_full_body_01". Unique across all packs. */
export type Id = string;

/* ───────────────────────── shared vocabulary ───────────────────────── */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/** Muscles the app can name (and tint on the illustrated character). */
export type Muscle =
  | 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'back' | 'lower_back' | 'core' | 'glutes' | 'quadriceps' | 'hamstrings' | 'calves' | 'hip_flexors'
  | 'neck' | 'jaw' | 'cheeks' | 'lips' | 'forehead' | 'eyes';

export type BodyRegion = 'upper_body' | 'lower_body' | 'core' | 'full_body' | 'neck' | 'face';

/**
 * How an exercise is measured:
 *  - "reps": counted repetitions (push up, squat)            → entries use `repetitions`
 *  - "time": keep moving for a number of seconds (jacks)    → entries use `durationSeconds`
 *  - "hold": stay still for a number of seconds (plank)     → entries use `durationSeconds`
 */
export type ExerciseType = 'reps' | 'time' | 'hold';

/* ───────────────────────── LEVEL 1 · exercise library ───────────────────────── */

export interface ExerciseInstructions {
  /** Spoken and shown, one short sentence each. */
  steps: string[];
  breathing?: string;
  /** Two short cues spoken during the first reps: [on the effort, on the return]. */
  breathCues?: [string, string];
  /** One short coaching tip spoken before the exercise. */
  cue?: string;
  commonMistake?: string;
  /** A way to make it easier / harder. */
  easier?: string;
  harder?: string;
}

/** A single exercise, defined exactly once. */
export interface Exercise {
  id: Id;
  name: string;
  description: string;
  type: ExerciseType;
  primaryMuscles: Muscle[];
  secondaryMuscles?: Muscle[];
  difficulty: Difficulty;

  /* optional metadata: filter, search, generate */
  /** Free text, e.g. "strength", "cardio", "core", "mobility", "stretching", "balance". */
  category?: string;
  bodyRegion?: BodyRegion;
  /** Everything needed beyond the floor: ["dumbbell"], ["chair", "wall"]. Empty / missing = bodyweight. */
  equipment?: string[];
  tags?: string[];
  /** Approximate energy use for an average adult. Reserved for calorie estimates. */
  caloriesPerMinute?: number;

  /** Done on each side / each way: ["right", "left"] or ["forward", "backward"]. */
  sides?: string[];
  /** Seconds per repetition (reps) or per animation loop (time). Default 4. */
  tempoSeconds?: number;
  instructions?: ExerciseInstructions;
}

/* ───────────────────────── LEVEL 2 · workout definitions ───────────────────────── */

/** One line of a workout: an exercise from the library plus how much of it. */
export interface WorkoutEntry {
  exerciseId: Id;
  /** For exercises of type "reps". Per side if the exercise has `sides`. */
  repetitions?: number;
  /** For exercises of type "time" or "hold". Per side if the exercise has `sides`. */
  durationSeconds?: number;
  /** How many times to do it back-to-back (default 1). Typical for holds: 3 × 10 s. */
  sets?: number;
  /** Rest after each set of this entry, before whatever comes next. Overrides the workout default (the player never rests less than 3 s). */
  restSeconds?: number;
  /** A tip shown with this entry, e.g. "Lower for three seconds." */
  note?: string;
}

export interface Workout {
  id: Id;
  name: string;
  description?: string;
  /** The exercises, in order. */
  exercises: WorkoutEntry[];
  /** Repeat the whole list this many times (circuit). Default 1. */
  rounds?: number;
  /** Default rest after each set (default 8). */
  restSeconds?: number;

  /* optional metadata */
  difficulty?: Difficulty;
  /** Free text, e.g. "warmup", "strength", "core", "cardio", "cooldown", "recovery", "full_body".
   *  Note: the user setting "rest between strength exercises" applies to category "strength". */
  category?: string;
  tags?: string[];
  /** Overrides the computed duration shown in the app. */
  estimatedMinutes?: number;
}

/* ───────────────────────── LEVEL 3 · training plans ───────────────────────── */

interface PlanDayBase {
  /** 1-based day number inside the plan. Days run 1..N without gaps. */
  day: number;
  /** Shown on that day, e.g. "Take a 20 minute walk afterwards." */
  note?: string;
}

/** A training day: one workout, or several done one after another (warm-up → main → cool-down). */
export type WorkoutDay = PlanDayBase & { type?: 'workout' } & (
  | { workoutId: Id; workoutIds?: never }
  | { workoutIds: Id[]; workoutId?: never }
);

/** A day off. */
export interface RestDay extends PlanDayBase {
  type: 'rest';
}

export type PlanDay = WorkoutDay | RestDay;

/** A sequence of days. Progressive overload = later days point at harder workouts. */
export interface TrainingPlan {
  id: Id;
  name: string;
  description?: string;
  days: PlanDay[];

  /* optional metadata */
  difficulty?: Difficulty;
  /** e.g. "lose_weight", "build_strength", "mobility". Free text. */
  goal?: string;
  tags?: string[];
}

/* ───────────────────────── packaging ───────────────────────── */

/** One content file. Any mix of the three kinds is allowed. */
export interface ContentPack {
  schemaVersion: typeof SCHEMA_VERSION;
  exercises?: Exercise[];
  workouts?: Workout[];
  plans?: TrainingPlan[];
}

/** data/index.json – which packs the app loads, and which plan a new user starts on. */
export interface CatalogIndex {
  schemaVersion: typeof SCHEMA_VERSION;
  defaultPlanId: Id;
  /** Paths relative to data/. Later packs can not redefine an id (it is an error). */
  files: string[];
}
