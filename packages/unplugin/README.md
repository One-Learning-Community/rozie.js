# @rozie/unplugin

The universal build-tool plugin for Rozie.js, authored once via `unplugin` v3 and exposed as Vite, Rollup, Webpack, esbuild, Rolldown, and Rspack adapters. Wires `import Foo from './Foo.rozie'` directly into any of those build pipelines — no codegen ceremony, full HMR, source maps back to the original `.rozie` file.

## Status

Shipped for all six targets — `vue`, `react`, `svelte`, `angular`, `solid`, and `lit`. **Vite** (`@rozie/unplugin/vite`) is the primary, end-to-end-tested host (the reference consumer apps under `examples/consumers/` build through it). The other adapters (`/rollup`, `/webpack`, `/esbuild`, `/rolldown`, `/rspack`) are produced from the same `unplugin` factory. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Inside the monorepo, depend on it plus the runtime package for your target:

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/unplugin": "workspace:*",
    "@rozie/runtime-react": "workspace:*", // or -vue / -svelte / -solid / -lit
    "react": "^18"
  }
}
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  plugins: [Rozie({ target: 'react' })],
});
```

For Vue, place `Rozie()` **before** `@vitejs/plugin-vue` — it rewrites `Foo.rozie` → a synthetic `Foo.rozie.vue` id via `resolveId` so `vite-plugin-vue` picks it up:

```ts
import vue from '@vitejs/plugin-vue';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  plugins: [Rozie({ target: 'vue' }), vue()],
});
```

Then anywhere in your app:

```ts
import Counter from './Counter.rozie';
```

## Options — `RozieOptions`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `target` | `'vue' \| 'react' \| 'svelte' \| 'angular' \| 'solid' \| 'lit'` | — | **Required.** Validated synchronously at config-load (`ROZ400`/`ROZ401`/`ROZ402`). |
| `safeInterpolation` | `boolean` | `true` | Phase 26. When `false`, non-primitive `{{ }}` interpolation reverts to raw per-target emit (re-exposes the React object-child crash). No-op for Vue. See [Safe non-primitive interpolation](../../docs/guide/features.md). |
| `angular` | `{ cva?: boolean }` | `{ cva: true }` | Angular-only. `cva: false` suppresses the auto `ControlValueAccessor` emit on single-`model` components. No-op for other targets. |
| `prebuildExtraRoots` | `readonly string[]` | — | Angular-only. Extra source roots to walk during the Angular disk-cache prebuild. No-op for other targets. |

Invalid option shapes throw a code-bearing error **before** any build hook runs.

## Public exports

From the package root (`@rozie/unplugin`):
- `unplugin` — the `createUnplugin` v3 factory (default export + named)
- `validateOptions` — synchronous `RozieOptions` validator
- Type: `RozieOptions`

From subpath entries: `@rozie/unplugin/vite`, `/rollup`, `/webpack`, `/esbuild`, `/rolldown`, `/rspack`.

For the codegen (no-build, pre-compiled output) path, see [`@rozie/cli`](../cli). For non-Vite Babel pipelines, see [`@rozie/babel-plugin`](../babel-plugin).

## Links

- Project orientation: [`CLAUDE.md`](../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md)
