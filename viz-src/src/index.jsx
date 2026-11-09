/* Public API of the 3D exercise viewer.  Loaded lazily by the app:
 *
 *   const V = await import('./viz/viewer.js');
 *   V.init(window.EXERCISE_VIZ);                       // optional — done automatically from the global
 *   if (V.supported() && V.has('squat')) {
 *     const view = V.mount(element, { exercise: 'squat', compact: true });
 *     view.setExercise('pushup'); view.setPaused(true); view.destroy();
 *   }
 */
import { createRoot } from 'react-dom/client';
import { ExerciseViewer } from './ExerciseViewer.jsx';
import { createRegistry } from './registry.js';
import { MODES } from './avatar/muscles.js';
import css from './viewer.css?inline';

let registry = null;
export function init(cfg) { registry = createRegistry(cfg || window.EXERCISE_VIZ); return registry; }
export const getRegistry = () => registry || init();
export const has = id => getRegistry().has(id);
export const list = () => getRegistry().list();

export function supported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!(window.WebGLRenderingContext && c.getContext('webgl'));
  } catch (e) { return false; }
}

function injectCss() {
  if (document.getElementById('xv-css')) return;
  const s = document.createElement('style'); s.id = 'xv-css'; s.textContent = css; document.head.appendChild(s);
}

const store = {
  get() { try { return JSON.parse(localStorage.getItem('xv.prefs') || '{}'); } catch (e) { return {}; } },
  set(p) { try { localStorage.setItem('xv.prefs', JSON.stringify(p)); } catch (e) { /* private mode */ } }
};

export function mount(el, opts = {}) {
  injectCss();
  const reg = getRegistry(), prefs = store.get();
  const state = {
    exercise: opts.exercise,
    mode: MODES.includes(opts.mode) ? opts.mode : MODES.includes(prefs.mode) ? prefs.mode : reg.defaults.view,
    ghost: opts.ghost != null ? !!opts.ghost : prefs.ghost != null ? !!prefs.ghost : !!reg.defaults.ghost,
    paused: !!opts.paused, mirror: !!opts.mirror, speed: opts.speed || 1, compact: !!opts.compact, active: true, dim: false
  };
  const root = createRoot(el);
  const api = { source: null, apiRef: { current: null } };
  const base = opts.base || new URL('../', import.meta.url).href;   // app root (viewer.js lives in <app>/viz/)

  function render() {
    root.render(
      <ExerciseViewer
        registry={reg} exercise={state.exercise} mode={state.mode} ghost={state.ghost} paused={state.paused}
        mirror={state.mirror} speed={state.speed} compact={state.compact} active={state.active} dim={state.dim} base={base} apiRef={api.apiRef}
        onSource={s => { api.source = s; }} onError={opts.onError}
        onChange={p => {
          Object.assign(state, p); render();
          if (p.mode || p.ghost != null) store.set({ mode: state.mode, ghost: state.ghost });
          opts.onChange && opts.onChange(p);
        }}
      />
    );
  }
  render();

  const set = patch => { Object.assign(state, patch); render(); };
  return {
    setExercise: id => set({ exercise: id }),
    setMode: m => set({ mode: m }),
    setGhost: g => set({ ghost: !!g }),
    setPaused: p => set({ paused: !!p }),
    setMirror: m => set({ mirror: !!m }),
    setSpeed: s => set({ speed: s }),
    setActive: a => set({ active: !!a }),     // false stops rendering (hidden tab / exercise without 3D)
    setDim: d => set({ dim: !!d }),           // true fades the muscle glow (rest periods)
    /* freeze at a loop phase 0..1 (null resumes) — handy for screenshots */
    seek: u => { api.apiRef.current && api.apiRef.current.seek(u); },
    /* drive the loop phase (0..1) from the host app every frame, e.g. to stay in sync with a rep counter */
    drive: u => { api.apiRef.current && api.apiRef.current.seek(u); },
    state: () => ({ ...state, source: api.source }),
    destroy: () => root.unmount()
  };
}

if (typeof window !== 'undefined') window.ExerciseViewer = { init, has, list, supported, mount, getRegistry };
