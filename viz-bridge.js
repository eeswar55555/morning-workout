/* viz-bridge.js — connects the app to the 3D viewer (viz/viewer.js) without making the app depend on it.
 *
 * The 3D viewer (React + Three.js, ~330 KB gzipped) is only downloaded the first time a 3D demo is needed.
 * Until it is ready — and whenever it is switched off, unsupported, or fails — the app keeps using the
 * original SVG figure, so nothing ever waits on it and nothing ever breaks because of it.
 */
(function (root) {
  'use strict';
  var st = { p: null, mod: null, failed: false, gl: null };
  var dyn = null;
  try { dyn = new Function('u', 'return import(u)'); } catch (e) { dyn = null; }   // no dynamic import -> SVG only

  function webgl() {
    if (st.gl == null) {
      try { var c = document.createElement('canvas'); st.gl = !!(root.WebGL2RenderingContext && c.getContext('webgl2')) || !!(root.WebGLRenderingContext && c.getContext('webgl')); }
      catch (e) { st.gl = false; }
    }
    return st.gl;
  }
  function configured(id) {
    var cfg = root.EXERCISE_VIZ, list = (cfg && cfg.exercises) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id || (list[i].appIds && list[i].appIds.indexOf(id) >= 0)) return true;
    }
    return false;
  }

  var V = {
    /* the app replaces this with its "3D exercise demos" setting */
    enabled: function () { return true; },
    /* cheap check, no download: is this exercise configured for 3D, and can this device show it? */
    wants: function (id) { return !!dyn && !st.failed && V.enabled() && webgl() && configured(id); },
    /* true once the module is loaded and it really can play this exercise */
    has: function (id) { return !!st.mod && !st.failed && st.mod.has(id); },
    load: function () {
      if (!st.p) {
        st.p = dyn(new URL('viz/viewer.js', document.baseURI).href).then(function (m) {
          var mod = m && (m.has ? m : root.ExerciseViewer);
          if (!mod || !mod.mount) throw new Error('viewer module missing');
          mod.init(root.EXERCISE_VIZ); st.mod = mod; return mod;
        }).catch(function (e) { st.failed = true; if (root.console) console.warn('3D viewer unavailable, using the 2D figure:', e); return null; });
      }
      return st.p;
    },
    /* mounts a viewer inside `container`; resolves to { ctl, host } or null (caller keeps its SVG figure) */
    open: function (container, opts) {
      return V.load().then(function (mod) {
        if (!mod || !container.isConnected) return null;
        if (opts && opts.exercise && !mod.has(opts.exercise)) return null;
        var host = document.createElement('div'); host.className = 'viz-host'; container.appendChild(host);
        var ctl;
        try { ctl = mod.mount(host, opts || {}); } catch (e) { host.remove(); st.failed = true; return null; }
        return { ctl: ctl, host: host };
      });
    }
  };
  root.Viz3D = V;
})(window);
