/* Stand-alone gallery (viz/index.html): pick any configured exercise and look at it full screen. */
import { mount, list, supported, init } from './index.jsx';

const q = new URLSearchParams(location.search);
const host = document.getElementById('stage'), bar = document.getElementById('picker');

if (!supported()) {
  host.textContent = 'This browser cannot run WebGL.';
} else {
  init(window.EXERCISE_VIZ);
  const items = list();
  let current = (items.find(e => e.id === q.get('ex')) || items[0] || {}).id;
  const view = mount(host, { exercise: current, mode: q.get('view') || undefined, ghost: q.has('ghost') ? q.get('ghost') !== '0' : undefined, mirror: q.get('mirror') === '1', base: new URL('../', location.href).href });
  const freeze = () => { if (q.has('t')) setTimeout(() => view.seek(parseFloat(q.get('t'))), 400); };
  freeze();

  const draw = () => {
    bar.innerHTML = '';
    items.forEach(e => {
      const b = document.createElement('button');
      b.textContent = e.name; b.className = e.id === current ? 'on' : '';
      b.onclick = () => { current = e.id; view.setExercise(e.id); history.replaceState(null, '', '?ex=' + e.id); draw(); freeze(); };
      bar.appendChild(b);
    });
    const on = bar.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  };
  draw();
  window.__view = view;
}
