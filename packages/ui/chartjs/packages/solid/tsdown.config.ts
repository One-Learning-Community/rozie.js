import { defineConfig } from 'tsdown';
import { solidLeafConfig } from '../../../solid-leaf-build.mjs';

// Two builds (compiled JS + a `solid`-condition JSX build) — see packages/ui/solid-leaf-build.mjs.
export default defineConfig(solidLeafConfig({
  entry: ['src/index.ts', 'src/auto.ts', 'src/Chart.tsx', 'src/Line.tsx', 'src/Bar.tsx', 'src/Pie.tsx', 'src/Doughnut.tsx', 'src/PolarArea.tsx', 'src/Radar.tsx', 'src/Scatter.tsx', 'src/Bubble.tsx'],
  // The generated barrel re-exports both the named component (`Chart`) and its
  // `default`. Opt into rolldown 'named' export mode explicitly so that mix is
  // unambiguous (silences MIXED_EXPORTS; the default lands on `exports.default`
  // for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: [
    'solid-js',
    'solid-js/web',
    '@rozie/runtime-solid',
    'chart.js',
  ],
}));
