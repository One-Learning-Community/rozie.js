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
    Rozie({ target: 'vue' }), // or 'react' | 'svelte' | 'angular'
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

The CLI accepts `--target vue | react | svelte | angular` and supports `--source-map` for emitting sourcemaps alongside the output file.

## Versions

| Target | Supported version |
| --- | --- |
| React | 18+ |
| Vue | 3.4+ |
| Svelte | 5+ (runes mode) |
| Angular | 17+ (signals era) |
