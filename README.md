# Morning Workout (installable phone app)

A guided morning routine: animated demos, spoken instructions, rep counting, timers, rest breaks and progress tracking.
It is a **PWA** — a web page you "Add to Home screen". After the first open it works **offline**. All your data stays on your phone.

## Put it on your phone (one time, ~5 minutes)

The app must be hosted at an `https://` address once (phones only allow install + offline + voice features on https).
Pick **one**:

**Easiest — Netlify Drop (no code, no git)**
1. On your computer open <https://app.netlify.com/drop> and sign in (free).
2. Drag this whole `app` folder onto the page. You get an address like `https://something.netlify.app`.
3. Open that address in **Chrome on your Android phone**.

**GitHub Pages (if you have a personal GitHub account)**
1. Create a new public repository, upload the contents of this `app` folder to it.
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open `https://<your-name>.github.io/<repo>/` on your phone.

**Install it**
- In Chrome tap **⋮ → Add to Home screen** (or **Install app**). An icon appears on your home screen.
- Open it once while online. From then on it opens instantly, even without internet.
- Tap **Settings → Test voice** to confirm you can hear the coach (turn the media volume up, not on silent).

## Every morning
Open the icon → **Start workout**. That's it. The screen stays on and the workout runs by itself:
exercise → rest → **"Next up: Push ups, 3-2-1"** → next exercise, with no taps needed.

- **Nothing blocks the workout.** There is no instruction screen. Every exercise starts straight away with its
  animation, name and timer or rep count. The working muscles are tinted in lime on the illustrated character and named above the exercise name.
- **Instructions are optional.** Tap **Instructions** on the animation (or an exercise in the plan before you start) to
  see muscles, steps, tips and the common mistake. Opening it pauses the workout and closing it carries on.
- **Controls:** Previous · Pause/Resume · Skip. The top-left ✕ (and the phone's back button) pauses and shows
  **End workout** — no confirmation pop-ups. Previous goes back one exercise (on the first one it restarts it).
- **Voice is a bonus.** It says short things ("Next: Chair sit to stand", "3, 2, 1, Begin", rep counts). If speech fails,
  is blocked or muted, the on-screen countdown, beeps and vibration still run the workout identically.
- **Preview first:** the Today screen lists the whole session in order (1, 2, 3…); tap any row to expand its instructions.
- Rest lengths come from the workouts (`restSeconds`), and Settings → *rest between strength exercises* overrides them for strength
  workouts. The last 3 seconds of every rest become the "Next up … 3-2-1" lead-in.

## What changes day to day
Today's session is **day N of your training plan** (Settings → *Training plan* picks the plan and lets you change the current day).
The plan moves on one day at a time. It can hold workout days (one workout, or several done one after another, e.g. warm-up,
strength, stability, cool-down), **rest days** and notes. After the last day it starts again. Variety comes from the plan pointing at
different workouts on different days. The bundled *Morning full-body · 12 weeks* plan alternates three strength circuits and makes
day 7 of each week a lighter day. Workout Studio > Exercises can switch exercises off; they are skipped in every workout.

## Progression
Progression is data, not code: a plan's later days simply point at harder workouts. *Morning full-body · 12 weeks* follows the six
stages of the original routine (one round → second round → more reps → harder versions → slower lowering → added load), two weeks each.
The plan advances daily by itself. At the start of each new week the app checks the last 7 days: with 5 or more sessions finished with good
form, 2+ reps in reserve and back pain no worse than usual it says "great week"; otherwise it offers **Repeat last week**, and after a
pain flare **Go back one week**. You answer two quick questions after each workout, and (optionally) log your back pain 0–10 each morning.

## Workout Studio: make your own workouts and plans
The **Studio** tab is where you build things, with forms and pickers (never JSON):
- **Workouts:** *New workout* (from scratch, or from any existing workout as a template). Pick exercises from a searchable, filterable
  list, set reps or seconds and sets with steppers, **drag the handle to reorder** (or use the arrow keys), duplicate or remove rows,
  optionally add rounds and rest. Preview, start now, edit, duplicate or delete from the ⋯ menu.
- **Plans:** *New plan*: choose the length (7–90 days or any number), then **Auto-fill** (training days per week + the workouts to rotate)
  or tap any day to pick one or several workouts, or a rest day. The timeline is shown week by week; a week can be copied to all weeks.
  *Use this plan* starts it today.
- **Exercises:** the full library with search and filters, plus *New exercise* (name, reps / timed / hold, muscles, body area,
  steps, and which existing picture it should borrow).
Built-in workouts, plans and exercises are read-only; **Customize** or **Duplicate** gives you your own editable copy. Your own items are
stored on the phone, separately from the built-in content (and are included in *Progress > Save a backup*).

## Changing or adding built-in content
Built-in content is JSON in `data/` (for developers and AIs; people use the Studio): the **exercise library** (`exercises/`), **workouts** (`workouts/`) and **training plans** (`plans/`).
Each level only references the one below by id, so an exercise is defined once and reused everywhere. To add content, write a pack
(or ask any AI to return one that matches `data/schema/fitness.schema.json`), list it in `data/index.json` and run
`npm run validate`. **See `data/README.md`** for the three shapes, examples, patterns and an AI prompt.
After editing, re-upload the folder (Netlify Drop again / `git push`). The phone picks the update up the next time you open the app online.

## Files
| File | Purpose |
| --- | --- |
| `index.html`, `app.css`, `figure.css` | Page and look |
| `app.js` | Screens + the workout player (voice, timers, controls) |
| `core.js` | Today's session from the plan, progress rules, voice, sound |
| `catalog.js` | Loads `data/`, merges your own items, joins exercises with their illustrations |
| `studio.js` | Workout Studio: builders for workouts, plans and exercises |
| `face.js` | Front-view face drawings for facial exercises |
| `data/` | **Content (edit me):** `index.json`, `exercises/`, `workouts/`, `plans/`, `schema/types.ts`, `schema/fitness.schema.json`, `README.md` |
| `scripts/validate-data.js` | `npm run validate`: checks every content pack |
| `animations.js` | Poses and options of each exercise's moving picture (optional per exercise) |
| `illus.js`, `figure.css` | **The illustrated character** (pure SVG, ~15 KB): drawing, colours |
| `figure.js` | Pose engine (joint solver + animation timing). Its original stick figure remains only as a fallback |
| `gallery.html` | Preview of every exercise illustration |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline + install support |

## Exercise illustrations
Each exercise is shown by a clean vector athlete (Settings → *Exercise character*: male or female) that loops the movement from the
best fixed viewpoint — **side** for most exercises, **front** for arm and jumping moves. The working muscles (from `primaryMuscles` / `secondaryMuscles` in the library) are tinted lime
(strong = main muscles, soft = helpers, brightest at the end position), a faint outline shows the end position, a dotted arrow shows
the path of the most-moving joint and a small label lists the targets. It is plain SVG: no download beyond the 15 KB script,
sharp at any screen density, about 80 SVG nodes and < 1 ms of JavaScript per frame.

To change the viewpoint or arrow edit the exercise's entry in `animations.js` (`cfg`: `view`, `track`, `arrow`, `equip`); to change what is highlighted edit the
muscles in its JSON. An exercise with no entry in `animations.js` still works and shows a neutral placeholder; new side-view pictures only need poses in
the `figure.js` format, front-view poses are described at the top of `illus.js`. Open `gallery.html` to preview everything.

## Safety
General fitness guidance, not medical advice. Stop if an exercise makes pain worse or sends pain, tingling or numbness into a leg.
Get urgent care for new bladder/bowel problems, numbness around the genitals or buttocks, pain down both legs, severe leg weakness,
fever, a history of cancer, or back pain after an injury. The safety page is in the app (Settings → Safety, and ⚠ during a workout).

## Try it on a computer
Serve the folder over http, e.g. `npx serve app` or `python -m http.server` inside `app`, and open `http://localhost:…` in Chrome.
(Opening `index.html` straight from the folder no longer works: the content is loaded as JSON files, which browsers only allow over http.)
