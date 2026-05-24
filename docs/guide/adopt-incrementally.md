# Adopt incrementally: drop one `.rozie` file into your existing app

Rozie is a compiler, not a runtime framework. A compiled `.rozie` file is
indistinguishable from a hand-written component in your target framework — it
imports the same way, uses the same renderer, and ships through the same
bundler.

That means you can add one Rozie component to your existing app this week
without rewriting anything. This guide is the recipe per stack.

## The shape of every adoption

The same three things have to be true regardless of bundler:

1. **A build-time transform** turns `.rozie` files into the target framework's
   source. Rozie ships transforms for Vite, Rollup, Webpack, esbuild,
   Rolldown, Rspack (all from one `unplugin` package) plus a standalone Babel
   plugin and a CLI for ahead-of-time codegen.
2. **The target framework's own pipeline runs after Rozie**. For Vue/Svelte/
   Angular targets, that means chaining into the host framework's Vite plugin
   (`@vitejs/plugin-vue`, `@sveltejs/vite-plugin-svelte`,
   `@analogjs/vite-plugin-angular`). For React/Solid/Lit, the emitted code is
   plain `.tsx` / `.ts` and the standard TS pipeline handles it.
3. **Your existing code imports the compiled component normally**. No
   wrappers, no codegen step you commit to git, no runtime glue.

The pre-compile escape hatch (`pnpm rozie build`) skips step 1 entirely —
emit `.tsx` / `.vue` / `.svelte` / `.ts` files to disk and `git add` them
like regular components. Use this for stacks where adding a build-time
transform is more friction than checking in the output.

## By stack

### Vite (React, Vue, Svelte, Solid, Lit, Astro, Remix-on-Vite)

The shortest path. Add the unplugin to your existing `vite.config.ts`:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import Rozie from '@rozie/unplugin/vite';
// Plus your existing framework plugin — react / vue / svelte / etc.
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    Rozie({ target: 'react' }), // matches your project's framework
    react(),
  ],
});
```

The order matters for Vue, Svelte, and Angular: Rozie emits SFC text in
those cases, and the host framework's plugin needs to run after to take it
the rest of the way. The unplugin chains via path-virtual schemes, so the
ordering is automatic — but keeping Rozie listed first in `plugins` is the
predictable shape.

```tsx
// App.tsx
import Counter from './Counter.rozie';

export default function App() {
  return <Counter value={0} step={1} />;
}
```

### Next.js (Webpack / Turbopack)

Next.js exposes its Webpack config via `next.config.js`. The `unplugin`
package gives you a Webpack plugin from the same factory:

```js
// next.config.js
const Rozie = require('@rozie/unplugin/webpack');

module.exports = {
  webpack(config) {
    config.plugins.push(Rozie({ target: 'react' }));
    return config;
  },
};
```

For Turbopack (Next 15+ App Router): Turbopack doesn't accept arbitrary
Webpack plugins yet. The cleanest path is the pre-compile escape hatch —
emit `.tsx` files alongside your `.rozie` sources and check them in. The
[CLI section](#cli-pre-compile) below covers this.

A working end-to-end smoke lives at
[`examples/consumers/nextjs-rozie/`](https://github.com/One-Learning-Community/rozie.js/tree/main/examples/consumers/nextjs-rozie) —
mirrors what `npx create-next-app@latest --typescript --app` produces,
with the Rozie unplugin wired in exactly as above. The CI smoke runs a
real `next build` on every push touching `packages/unplugin/**` and
asserts the produced bundle contains compiled Rozie markers.

### Angular CLI (Application Builder / esbuild)

Angular's modern Application Builder (Angular 17+ default) is esbuild under
the hood. Use the unplugin's esbuild adapter via a custom builder hook, or
pre-compile via the CLI (recommended for first adoption).

The **pre-compile path** is the lowest-friction:

```bash
# In your Angular project root
pnpm add -D @rozie/cli
pnpm rozie build src/app/Counter.rozie --target angular --out src/app/Counter.ts
```

`Counter.ts` is a standalone component you import into your existing module
or other standalone component:

```ts
// src/app/app.component.ts
import { Component } from '@angular/core';
import { Counter } from './Counter';

@Component({
  standalone: true,
  imports: [Counter],
  template: `<rz-counter [value]="0" [step]="1" />`,
})
export class AppComponent {}
```

For build-time compilation (skip the codegen step), use the Vite-based
Angular toolchain via `@analogjs/vite-plugin-angular` — see the
[install guide](/guide/install) for the workspace setup.

[For Angular shops](/guide/for-angular-shops) walks through the pitch and
the Rozie ↔ Angular code-shape mapping in detail.

### Nuxt 3+

Nuxt builds on Vite. Register Rozie via a Nuxt module or directly through
`nuxt.config.ts`:

```ts
// nuxt.config.ts
import Rozie from '@rozie/unplugin/vite';

export default defineNuxtConfig({
  vite: {
    plugins: [Rozie({ target: 'vue' })],
  },
});
```

Nuxt's auto-import picks up `.rozie` files placed under `components/` once
the transform is registered. `<Counter />` resolves to the compiled Vue SFC
without an explicit import.

### SvelteKit

SvelteKit's `vite.config.ts` is a normal Vite config:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  plugins: [Rozie({ target: 'svelte' }), sveltekit()],
});
```

Import `.rozie` files exactly like `.svelte` files from any route or
component. Note: Svelte 5+ runes mode only — `Counter.rozie` compiles to
`{...as $state(0)}` runes that need Svelte 5 to interpret.

### Astro

Astro ships its own integration system on top of Vite. Wire Rozie via the
Vite-plugin slot:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  vite: {
    plugins: [Rozie({ target: 'lit' })], // or react / vue / svelte / solid
  },
});
```

The Lit target is a particularly natural fit for Astro: emitted Web
Components run inside Astro's static islands without an island-bridge
runtime, and the same `.rozie` source can be reused in your React /
Svelte / Vue islands by changing the target flag in another `vite` slot.

A working end-to-end smoke lives at
[`examples/consumers/astro-rozie/`](https://github.com/One-Learning-Community/rozie.js/tree/main/examples/consumers/astro-rozie) —
mirrors what `npm create astro@latest` produces, with the Rozie unplugin
wired in exactly as above. The CI smoke runs a real `astro build` on
every push touching `packages/unplugin/**` and asserts (a) the rendered
HTML contains the `<rozie-counter>` custom-element tag and (b) the
client-side JS bundle contains compiled Rozie markers.

### Babel-only (legacy build pipelines, no Vite/esbuild/Webpack 5)

If your build is a pure Babel chain (older Create React App, Babel-loader on
Webpack 4, custom toolchains), use the standalone Babel plugin:

```json
// babel.config.json
{
  "plugins": [
    ["@rozie/babel-plugin", { "target": "react" }]
  ]
}
```

The plugin is a ~50-LOC `ImportDeclaration` visitor — it intercepts imports
ending in `.rozie`, calls the Rozie compiler, writes a sibling artifact next
to the source, and rewrites the import path. Errors surface as Babel errors
with full code frames.

### CLI pre-compile (any bundler, no transform plugin)

The escape hatch for every other case. Emit per-target sources to disk
and treat them as regular files:

```bash
pnpm add -D @rozie/cli
pnpm rozie build src/components/Counter.rozie --target react --out src/components/Counter.tsx
```

```bash
# Or batch the whole directory across multiple targets:
pnpm rozie build src/components/ \
  --target react,vue,svelte,angular,solid,lit \
  --out dist/
```

`.d.ts` files are emitted by default; pass `--no-types` to disable. Source
maps are off by default; pass `--source-map` to enable.

This is also the right path when:

- Your bundler isn't covered by `unplugin` (Bun, Deno, Parcel as of v2).
- You ship a library that consumers depend on pre-compiled (the typical
  component-library author flow).
- You want the compiled output checked in to git for code review.

## Interop at the edges

### A Rozie component, used by native code

This is the primary path and works everywhere. Once compiled, a Rozie
component IS a native target-framework component — typed, treeshakeable,
indistinguishable from a hand-authored one. Drop it into JSX, a Vue
template, a Svelte file, an Angular standalone component, a Solid tree, or
plain HTML (Lit target).

### A native component, used inside a `.rozie` file

For cross-Rozie composition, the `<components>` block does the right thing:

```rozie
<rozie name="ModalConsumer">

<components>
  import Modal from './Modal.rozie';
</components>

<template>
<Modal :open="$data.open">
  <template #header="{ close }">…</template>
</Modal>
</template>

</rozie>
```

For consuming a **native** Vue/React/Svelte/Angular component from inside
a `.rozie` file: this works when the target you're compiling to matches the
native component's framework. A Rozie file compiled to Vue can import a
native Vue SFC; compiled to React, it can import a native `.tsx`
component.

A Rozie file cannot consume a native Vue SFC and compile to React — that
would mean bridging Vue's renderer into a React tree, which is a separate
problem (micro-frontend / module-federation territory) that Rozie doesn't
attempt.

### TypeScript types

Every target emits its own `.d.ts` automatically:

- **React**: sibling `Counter.d.ts` with `interface CounterProps` + render-
  prop slot signatures + `onValueChange` callbacks for `model: true` props.
- **Vue / Svelte / Angular**: types inline via `defineProps<T>()`, `$props<T>()`,
  and decorator-typed inputs — `vue-tsc` / `svelte-check` / `tsc` pick them
  up.
- **Solid**: sibling `.d.ts` like React.
- **Lit**: typed class fields; consumers reading `el.value` get full
  IntelliSense.

Six per-target consumer typecheck gates (`tsc`, `vue-tsc`, `svelte-check`)
run in CI on every commit to keep these honest.

### CSS interop

`<style>` rules are scoped per component via `data-rozie-s-<hash>`
selectors. Your host app's design tokens, CSS variables, and Tailwind
classes pass through to the component scope without modification —
specifically because every target now hoists `<style>` to `<head>` so
consumer rules win same-specificity cascades.

Use `:root { … }` inside a Rozie `<style>` block to escape the scope (e.g.
for design-token publishing).

### Asset imports

`import './foo.svg'` and similar Vite/Webpack asset imports work
transparently — Rozie passes through `<script>`-block imports unchanged, so
your bundler's asset pipeline runs against the compiled output.

## Verifying the setup works

The fastest smoke is the Counter example. Drop this file in your repo:

```rozie
<rozie name="Counter">
<props>{ value: { type: Number, default: 0, model: true } }</props>
<template>
  <button @click="$props.value += 1">{{ $props.value }}</button>
</template>
</rozie>
```

Then import + render it from your existing app. If it increments, your
build is wired correctly.

## Next steps

- [For Angular shops](/guide/for-angular-shops) — the legacy-Angular
  incremental-adoption pitch with side-by-side code.
- [For vanilla-JS + plugin shops](/guide/for-vanilla-js-shops) — port a
  jQuery-era engine wrapper once, ship to every framework.
- [Creature comforts](/guide/creature-comforts) — the full matrix of pain
  points Rozie quietly fixes.
- [Examples](/examples/) — full source + per-target output for every
  reference component.
