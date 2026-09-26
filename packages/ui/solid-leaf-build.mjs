// Shared tsdown build for every @rozie-ui/*-solid leaf.
//
// A Solid component library can't ship its JSX as `dist/*.mjs`: that isn't JavaScript, so a
// consumer's bundler fails on it unless its Solid plugin is pointed at node_modules `.mjs`
// files (vite-plugin-solid only transforms `.[mc]?[jt]sx`). Every leaf therefore builds twice,
// in the standard Solid-library shape:
//
//   1. `dist/<entry>.{mjs,cjs,d.mts}` — compiled by babel-preset-solid (DOM output), exported as
//      `import` / `require`. Any bundler can consume it with no Solid plugin at all.
//   2. `dist/source/<entry>.jsx` — the same modules with JSX preserved, exported under the
//      `solid` condition. vite-plugin-solid and SolidStart resolve `solid` first and compile it
//      for their own mode (DOM, SSR, hydration), which a precompiled DOM build can't serve.
//
// Usage in a leaf's tsdown.config.ts (keep `entry` / `external` literal — family codegens
// patch them in place):
//
//   export default defineConfig(solidLeafConfig({ entry: [...], external: [...] }));
//
// Babel is resolved from the LEAF (`process.cwd()` is the leaf when tsdown runs), whose
// package.json declares @babel/core, @babel/preset-typescript and babel-preset-solid.
// babel-preset-solid is pinned to the 1.8 line (`~1.8.22`) on purpose: the compiled output
// imports helpers from `solid-js/web`, and the leaves' peer range is `solid-js ^1.8`. The 1.9
// preset emits `setStyleProperty`, which no 1.8 release exports; the 1.8 preset's helpers exist
// in both 1.8 and 1.9. Raise the preset only together with the peer floor.
import { createRequire } from 'node:module';
import { join } from 'node:path';

function solidBabel() {
  const require = createRequire(join(process.cwd(), 'package.json'));
  const babel = require('@babel/core');
  const presets = [
    [require('@babel/preset-typescript'), { onlyRemoveTypeImports: true }],
    [require('babel-preset-solid'), { generate: 'dom', hydratable: false }],
  ];
  return {
    name: 'rozie:solid-leaf-babel',
    transform: {
      filter: { id: /\.[jt]sx$/ },
      async handler(code, id) {
        if (id.includes('/node_modules/')) return null;
        const out = await babel.transformAsync(code, {
          filename: id,
          babelrc: false,
          configFile: false,
          presets,
          sourceMaps: true,
        });
        return out && { code: out.code, map: out.map };
      },
    },
  };
}

/** @param {import('tsdown').UserConfig} base the leaf's own options (entry, external, …) */
export function solidLeafConfig(base) {
  const plugins = base.plugins ?? [];
  return [
    {
      ...base,
      format: ['esm', 'cjs'],
      dts: true,
      clean: true,
      plugins: [...plugins, solidBabel()],
    },
    {
      ...base,
      format: ['esm'],
      dts: false,
      clean: false,
      outDir: 'dist/source',
      outExtensions: () => ({ js: '.jsx' }),
      plugins,
    },
  ];
}

/**
 * Add the `solid` condition (→ `./dist/source/<entry>.jsx`) to every export whose `import`
 * is a compiled `./dist/*.mjs`, keeping `types` first. For the family codegens that rebuild a
 * Solid leaf's `exports` map (chartjs, codemirror) — without it a regen drops the condition.
 */
export function withSolidCondition(exports) {
  const out = {};
  for (const [key, value] of Object.entries(exports)) {
    if (!value || typeof value !== 'object' || typeof value.import !== 'string' || !/^\.\/dist\/.*\.mjs$/.test(value.import)) {
      out[key] = value;
      continue;
    }
    const { types, solid: _drop, ...rest } = value;
    const solid = value.import.replace(/^\.\/dist\//, './dist/source/').replace(/\.mjs$/, '.jsx');
    out[key] = types !== undefined ? { types, solid, ...rest } : { solid, ...rest };
  }
  return out;
}
