import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Avatar } from './scene/Avatar.jsx';
import { CameraRig } from './scene/CameraRig.jsx';
import { Floor, Lights, Props } from './scene/Environment.jsx';
import { MODES, MUSCLE_LABEL, HEAT_CSS } from './avatar/muscles.js';

const MODE_LABEL = { normal: 'Normal', muscles: 'Muscles', combined: 'Combined', heat: 'Heat map' };

/* If the frame rate sags, quietly lower the render resolution (one-way, never below 0.8x). */
function PerfGuard() {
  const setDpr = useThree(s => s.setDpr), dpr = useThree(s => s.viewport.dpr);
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    if (dt > 0.25) return;                      // tab was hidden / first frames
    const a = acc.current; a.t += dt; a.n++;
    if (a.t > 2) {
      const avg = a.t / a.n; a.t = 0; a.n = 0;
      if (avg > 0.024 && dpr > 0.85) setDpr(Math.max(0.8, dpr * 0.8));
    }
  });
  return null;
}

/* renders at most 60 fps even on 120 Hz phones (half the GPU work and battery) */
function Ticker() {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => {
    let id = 0, last = 0;
    const tick = t => { id = requestAnimationFrame(tick); if (t - last >= 15) { last = t; invalidate(); } };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [invalidate]);
  return null;
}

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { this.props.onError && this.props.onError(err); }
  render() { return this.state.err ? <div className="xv-fail">3D preview unavailable</div> : this.props.children; }
}

const Icon = ({ d, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const ICONS = {
  view: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  ghost: <><path d="M5 21V11a7 7 0 0 1 14 0v10l-3.5-2.5L12 21l-3.5-2.5z" /><path d="M9.5 11h.01M14.5 11h.01" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>
};

export function ExerciseViewer({ registry, exercise, mode, ghost, paused, mirror, speed, compact, active = true, dim, base, onChange, onSource, apiRef, onError }) {
  const ex = registry.get(exercise);
  const live = useRef({});
  live.current = { mode, ghost, paused, mirror, speed, dim };
  const orbit = useRef({ az: 0, el: 0, scale: 1 });
  const root = useRef(null);
  const [props3d, setProps3d] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const toastT = useRef(0), loadT = useRef(0);
  const setBusy = useCallback(b => { clearTimeout(loadT.current); if (b) loadT.current = setTimeout(() => setLoading(true), 450); else setLoading(false); }, []);

  const say = useCallback(msg => { setToast(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 1400); }, []);

  /* ---- gestures: one finger rotates, two fingers pinch-zoom, wheel zooms ---- */
  useEffect(() => {
    const el = root.current; if (!el) return;
    const ptrs = new Map(); let pinch = 0;
    const down = e => { if (e.target.closest('.xv-ui')) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); pinch = 0; };
    const move = e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const o = orbit.current, nx = e.clientX, ny = e.clientY;
      if (ptrs.size === 1) {
        o.az -= (nx - p[0]) * 0.008;
        if (!compact) o.el = Math.min(0.9, Math.max(-0.5, o.el + (ny - p[1]) * 0.006));
      }
      p[0] = nx; p[1] = ny;
      if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values()), d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) o.scale = Math.min(1.8, Math.max(0.45, o.scale * (pinch / d)));
        pinch = d;
      }
    };
    const up = e => { ptrs.delete(e.pointerId); pinch = 0; };
    const wheel = e => { e.preventDefault(); const o = orbit.current; o.scale = Math.min(1.8, Math.max(0.45, o.scale * (1 + e.deltaY * 0.0012))); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel);
    };
  }, [compact]);

  const reset = () => { orbit.current = { az: 0, el: 0, scale: 1 }; say('Camera reset'); };
  const nextMode = () => { const m = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; onChange({ mode: m }); say(MODE_LABEL[m]); };
  const toggleGhost = () => { onChange({ ghost: !ghost }); say(ghost ? 'Ghost form off' : 'Ghost form on'); };

  useEffect(() => { orbit.current = { az: 0, el: 0, scale: 1 }; }, [exercise]);

  if (!ex) return null;

  return (
    <div ref={root} className={'xv-root' + (compact ? ' xv-compact' : '')}>
      <Boundary onError={onError}>
        <Canvas
          flat dpr={[1, 1.75]} frameloop={active ? 'demand' : 'never'}
          onCreated={state => { const gl = state.gl; if (window.__XV_TEST) window.__xv = state; gl.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); onError && onError(new Error('WebGL context lost')); }); }}
          camera={{ fov: 34, near: 0.1, far: 40, position: [-3.4, 1.1, 0] }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__XV_TEST }}
          style={{ touchAction: compact ? 'pan-y' : 'none' }}
        >
          <Lights />
          <Floor />
          <Props list={props3d} />
          <Avatar ex={ex} live={live} base={base} apiRef={apiRef} onProps={setProps3d} onLoading={(l, err) => { setBusy(l); if (err) onError && onError(err); }} onSource={onSource} />
          <CameraRig preset={ex.camera} orbit={orbit} />
          <PerfGuard />
          <Ticker />
        </Canvas>
      </Boundary>

      {loading && <div className="xv-loading" aria-live="polite">Loading…</div>}

      {mode !== 'normal' && (
        <div className="xv-legend" aria-label="Muscle legend">
          {mode === 'heat' ? (
            <>
              <div className="xv-heat" style={{ background: HEAT_CSS }} />
              <div className="xv-heatlbl"><span>Low</span><span>Medium</span><span>High</span><span>Max</span></div>
            </>
          ) : (
            <>
              {ex.primary.length > 0 && <div className="xv-row"><i className="p" /><b>Primary</b> {ex.primary.map(m => MUSCLE_LABEL[m]).join(' · ')}</div>}
              {ex.secondary.length > 0 && <div className="xv-row"><i className="s" /><b>Secondary</b> {ex.secondary.map(m => MUSCLE_LABEL[m]).join(' · ')}</div>}
            </>
          )}
        </div>
      )}

      <div className="xv-ui">
        <button className="xv-btn" onClick={nextMode} aria-label={'View: ' + MODE_LABEL[mode] + '. Tap to change'}>
          <Icon d={ICONS.view} /><small>{MODE_LABEL[mode]}</small>
        </button>
        <button className={'xv-btn' + (ghost ? ' on' : '')} onClick={toggleGhost} aria-pressed={!!ghost} aria-label="Ghost form: show ideal posture">
          <Icon d={ICONS.ghost} /><small>Ghost</small>
        </button>
        <button className="xv-btn" onClick={reset} aria-label="Reset camera">
          <Icon d={ICONS.reset} /><small>Reset</small>
        </button>
      </div>
      {toast && <div className="xv-toast" role="status">{toast}</div>}
    </div>
  );
}
