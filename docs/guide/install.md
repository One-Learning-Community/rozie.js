# Install

## Requirements

- Node 20 or newer
- A package manager (pnpm, npm, or yarn — examples below use pnpm)

## Inside a Vite project (recommended)

Rozie ships as an `unplugin` so it works with Vite, Rollup, Webpack, esbuild, Rolldown, and Rspack from one package.

```bash
pnpm add -D @rozie/unplugin
```

Then in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import Rozie from '@rozie/unplugin/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    Rozie({ target: 'vue' }), // or 'react' | 'svelte' | 'angular' | 'solid' | 'lit'
    vue(),
  ],
});
```

Import `.rozie` files as normal components:

```ts
import Counter from './Counter.rozie';
```

## Standalone CLI

For one-shot codegen (CI, doc builds, ahead-of-time emit):

```bash
pnpm add -D @rozie/cli
pnpm rozie build src/Counter.rozie --target vue --out dist/Counter.vue
```

The CLI accepts `--target vue | react | svelte | angular | solid | lit` and supports `--source-map` for emitting sourcemaps alongside the output file.

## Versions

| Target | Supported version |
| --- | --- |
| React | 18+ |
| Vue | 3.4+ |
| Svelte | 5+ (runes mode) |
| Angular | 19+ (signals era) |
| Solid | 1.8+ |
| Lit | 3.2+ |

The Solid target additionally requires [`vite-plugin-solid`](https://www.npmjs.com/package/vite-plugin-solid) `^2.0` installed in your project — Rozie's unplugin asserts the peer dep at runtime when `target: 'solid'` is selected.

The Lit target has **no host Vite plugin** — Lit components are plain ES modules that self-register via `customElements.define()`, so Rozie's unplugin handles the `.rozie` → custom-element transform directly and Vite's standard `.ts` pipeline takes it from there. Emitted components depend on [`lit`](https://www.npmjs.com/package/lit) `^3.2`, [`@lit-labs/preact-signals`](https://www.npmjs.com/package/@lit-labs/preact-signals), and `@rozie/runtime-lit`.

The Angular target additionally requires [`@analogjs/vite-plugin-angular`](https://www.npmjs.com/package/@analogjs/vite-plugin-angular) `^2.5` installed in your project — Rozie's unplugin asserts the peer dep at runtime when `target: 'angular'` is selected. Angular 19's own `peerDependencies.typescript` is `>=5.5.0 <5.9.0`, so any consumer building Angular 19+ has TS ≥5.5 by construction.

### pnpm monorepo note: mixed TypeScript versions

`@analogjs/vite-plugin-angular@2.5.x` doesn't declare a `typescript` peer dependency but its source uses `import * as ts from 'typescript'` and accesses flat names like `ts.createPrinter`. Pnpm resolves the import via its `.pnpm/node_modules/` hoist slot — a single shared symlink chosen from whichever TS versions exist in the workspace. If the slot lands on TypeScript ≤5.4 (whose CJS-to-ESM namespace wraps everything under `default`), the build fails at module-load time with `ts.createPrinter is not a function`.

Single-app projects with one TS pin don't hit this — the resolved TS is whatever you pinned. The trap only fires in **pnpm monorepos that keep ≤5.4 around alongside ≥5.5** (e.g., a legacy app and a modern Angular app in the same workspace). The fix is a `pnpm.packageExtensions` patch in your root `package.json` that gives analogjs an explicit `typescript` peer so pnpm scopes a satisfying version into its own slot:

```json
{
  "pnpm": {
    "packageExtensions": {
      "@analogjs/vite-plugin-angular": {
        "peerDependencies": {
          "typescript": ">=5.5"
        }
      }
    }
  }
}
```

After re-running `pnpm install`, analogjs gets a typescript symlink in its `.pnpm/.../node_modules/typescript` slot resolved against the consumer's pin — bypassing the workspace-wide hoist gamble. This is upstream's bug to fix (track at [analogjs/analog#…](https://github.com/analogjs/analog)); we recommend the workspace patch in the interim. npm and yarn classic users are unaffected because their resolution model doesn't have the shared-hoist failure mode.
