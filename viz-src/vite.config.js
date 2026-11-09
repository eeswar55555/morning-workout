import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = p => fileURLToPath(new URL(p, import.meta.url));

/* Builds into ../viz/ :
 *   viewer.js      the lazy-loaded library the app imports  (window.ExerciseViewer)
 *   index.html     a stand-alone gallery for trying exercises
 *   draco/         Draco decoder, fetched only if a Draco-compressed GLB is used
 * Everything is flat (no hashed sub-folders) so the Draco path and the service worker stay simple. */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../viz',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: { viewer: r('src/index.jsx'), index: r('index.html') },
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js', assetFileNames: '[name]-[hash][extname]' }
    }
  }
});
