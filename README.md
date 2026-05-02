# Rozie.js

A cross-framework component definition language and compiler. Authors write components once in a Vue/Alpine-flavored block-based syntax (`.rozie` files), and Rozie compiles them to idiomatic React, Vue, Svelte, and Angular components. The name derives from the Rosetta Stone — one source, many target languages.

Rozie is **not** a runtime framework. It does not own the rendering pipeline; the heavy lifting still happens in whichever target framework the consumer chose. Rozie owns the **author-side API** so a single component definition can drop into any of the four major frameworks without per-framework wrapper boilerplate.

## Who it's for

Component-library and design-system authors who today maintain manual bindings/wrappers across React, Vue, Svelte, and Angular for libraries that ultimately do their real work in vanilla JS. Write one `.rozie` file, ship working idiomatic React + Vue + Svelte + Angular consumers from it.

## Status

Pre-v1.0, internal monorepo. Phase 3 just shipped (2026-05-02): the Vue 3.4+ target emitter, runtime helpers, and Vite plugin wiring are working end-to-end with five reference examples passing Playwright e2e. React, Svelte, and Angular targets are placeholders pending later phases.

| Package | Status |
|---|---|
| [`@rozie/core`](packages/core) | Phase 2 shipped — parser + IR + lowering pipeline |
| [`@rozie/target-vue`](packages/targets/vue) | Phase 3 shipped — Vue 3.4+ SFC emitter |
| [`@rozie/runtime-vue`](packages/runtime/vue) | Phase 3 shipped — runtime helpers (useOutsideClick, debounce, throttle, key filters) |
| [`@rozie/unplugin`](packages/unplugin) | Phase 3 shipped (Vite); other bundlers scaffolded, CI-tested in Phase 6 |
| [`@rozie/target-react`](packages/targets/react) | Placeholder — Phase 4 |
| [`@rozie/target-svelte`](packages/targets/svelte) | Placeholder — Phase 5 |
| [`@rozie/target-angular`](packages/targets/angular) | Placeholder — Phase 5 |
| [`@rozie/cli`](packages/cli) | Placeholder — Phase 6 |
| [`@rozie/babel-plugin`](packages/babel-plugin) | Placeholder — Phase 6 |

See [`.planning/ROADMAP.md`](.planning/ROADMAP.md) for the full phase breakdown.

## Quick look

A minimal Counter component in `.rozie`:

```vue
<rozie name="Counter">
<props>{ value: { type: Number, default: 0, model: true }, step: { type: Number, default: 1 } }</props>
<script>
const canIncrement = $computed(() => $props.value + $props.step <= Infinity)
const increment = () => { if (canIncrement) $props.value += $props.step }
</script>
<template>
  <button @click="increment">{{ $props.value }}</button>
</template>
<style>.counter { display: inline-flex; }</style>
</rozie>
```

In a Vue + Vite project today, drop it in and import as a normal component — `@rozie/unplugin` does the transform:

```ts
// vite.config.ts
import Rozie from '@rozie/unplugin/vite';
import vue from '@vitejs/plugin-vue';

export default { plugins: [Rozie({ target: 'vue' }), vue()] };
```

```vue
<script setup>
import Counter from './Counter.rozie';
</script>
<template><Counter v-model:value="n" /></template>
```

## Repo layout

```
packages/
  core/              SFC parser, IR, lowering pipeline
  targets/{vue,react,svelte,angular}/   Per-framework emitters
  runtime/vue/       Vue runtime helpers used by emitted code
  unplugin/          Vite/Rollup/Webpack/esbuild/Rolldown/Rspack plugin
  cli/               Standalone codegen CLI (placeholder)
  babel-plugin/      Babel-plugin path for non-Vite consumers (placeholder)
examples/
  Counter.rozie, SearchInput.rozie, Dropdown.rozie, TodoList.rozie, Modal.rozie
  consumers/vue-vite/   End-to-end demo + Playwright e2e for Phase 3
.planning/           Project state, roadmap, phase artifacts (gitignored — internal)
```

## Getting started

```bash
pnpm install
pnpm -r --filter '@rozie/*' build
pnpm -r --filter '@rozie/{core,target-vue,runtime-vue,unplugin}' test --run
```

Run the live Vue demo:

```bash
pnpm --filter @rozie/unplugin build
cd examples/consumers/vue-vite
pnpm dev          # dev server with HMR
pnpm test:e2e     # Playwright suite (6 specs, 5 success criteria + OQ4)
```

## Tech stack rationale

- `@babel/parser` + `@babel/traverse` + `@babel/types` + `@babel/generator` — `<script>` AST round-trip
- `htmlparser2` — SFC block splitter and `<template>` tokenizer
- `peggy` — modifier micro-grammar (`@click.outside($refs.x).stop`)
- `magic-string` — source-map-preserving string mutation in `<script>` and CSS
- `postcss` — `<style>` AST + scope-attribute selector rewriting
- `unplugin` v3 — author once, ship to Vite + Rollup + Webpack + esbuild + Rolldown + Rspack

Full rationale and alternatives considered in [`CLAUDE.md`](CLAUDE.md).

## Contributing

This is a planned, phase-driven build under the [GSD workflow](https://github.com/anthropics/gsd) (`/gsd-execute-phase`, `/gsd-plan-phase`, etc.). Phase artifacts live in [`.planning/phases/`](.planning/phases). Read [`CLAUDE.md`](CLAUDE.md) and [`.planning/PROJECT.md`](.planning/PROJECT.md) before opening a substantive PR.

## License

Not yet declared. Will be MIT once v1.0 ships.
