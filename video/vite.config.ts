import {defineConfig} from 'vite';
import motionCanvasModule from '@motion-canvas/vite-plugin';

// Пакет экспортирует плагин как default внутри CJS-обёртки.
const motionCanvas =
  (motionCanvasModule as unknown as {default?: typeof motionCanvasModule}).default ?? motionCanvasModule;

export default defineConfig({
  plugins: [motionCanvas({project: './src/project.ts', output: './output'})],
  build: {target: 'esnext'},
  esbuild: {target: 'esnext'},
  optimizeDeps: {esbuildOptions: {target: 'esnext'}},
});
