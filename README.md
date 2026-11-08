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
Open the icon → **Start workout**. That's it. The screen stays on, the coach talks you through each move,
counts reps, times holds and tells you when to rest. Pause / Repeat / Skip are the three big buttons.

## What changes day to day
Some slots in the plan hold several exercises (e.g. *sit-to-stand / wall sit / step-up*). The app rotates through
them so your routine keeps changing. Tap **⟳** next to an exercise to swap it, or **Shuffle** to mix the whole day.
One day a week (Sunday by default) is a lighter day: warm-up, back stability, cool-down and a walk.

## Progression (levels 1–6)
Follows your 12-week plan: 1 round → 2 rounds → more reps → harder versions → slower lowering → added load.
The app only suggests moving up after a week with 5+ sessions where you finished every set with good form,
could have done 2+ more reps, and your back was no worse than your usual. It suggests dropping a level after a pain flare.
You answer two quick questions after each workout, and (optionally) log your back pain 0–10 each morning.

## Changing the exercises (3 ways, easiest first)
1. **In the app** — *Today → Edit plan*: reorder, remove, add exercises, give a slot several exercises to rotate.
   *Exercises tab*: switch exercises on/off, change reps/seconds, **Add my own exercise** (pick the picture that looks closest).
2. **`routine.js`** — the plan: which exercises go in warm-up / strength / stability / cool-down, rest times, levels.
3. **`exercises.js`** — the library. Each exercise is one block (name, instructions, breathing, easier version,
   moving picture). Copy an existing block, change the text and the pose numbers. `figure.js` explains the pose format.
After editing, re-upload the folder (Netlify Drop again / `git push`). The phone picks the update up the next time you open the app online.

## Files
| File | Purpose |
| --- | --- |
| `index.html`, `app.css`, `figure.css` | Page and look |
| `app.js` | Screens + the workout player (voice, timers, controls) |
| `core.js` | Plan rotation, progress rules, voice, sound |
| `figure.js` | The moving stick-figure demonstrations |
| `exercises.js` | **Exercise library (edit me)** |
| `routine.js` | **Daily plan and levels (edit me)** |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline + install support |

## Safety
General fitness guidance, not medical advice. Stop if an exercise makes pain worse or sends pain, tingling or numbness into a leg.
Get urgent care for new bladder/bowel problems, numbness around the genitals or buttocks, pain down both legs, severe leg weakness,
fever, a history of cancer, or back pain after an injury. The safety page is in the app (Settings → Safety, and ⚠ during a workout).

## Try it on a computer
Serve the folder over http, e.g. `npx serve app` or `python -m http.server` inside `app`, and open `http://localhost:…` in Chrome.
(Opening `index.html` directly works too, but without offline/install.)
