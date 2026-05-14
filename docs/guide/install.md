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
| Angular | 17+ (signals era) |
| Solid | 1.8+ |
| Lit | 3.2+ |

The Solid target additionally requires [`vite-plugin-solid`](https://www.npmjs.com/package/vite-plugin-solid) `^2.0` installed in your project — Rozie's unplugin asserts the peer dep at runtime when `target: 'solid'` is selected.

The Lit target has **no host Vite plugin** — Lit components are plain ES modules that self-register via `customElements.define()`, so Rozie's unplugin handles the `.rozie` → custom-element transform directly and Vite's standard `.ts` pipeline takes it from there. Emitted components depend on [`lit`](https://www.npmjs.com/package/lit) `^3.2`, [`@lit-labs/preact-signals`](https://www.npmjs.com/package/@lit-labs/preact-signals), and `@rozie/runtime-lit`.
