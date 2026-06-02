# For Preact teams

Preact teams consume Rozie the same way they consume the rest of the React ecosystem: through `preact/compat`. Rozie compiles your `.rozie` source to its **React** target — idiomatic functional components with `useState` / `useMemo` / `useEffect` — and you alias `react` / `react-dom` to `preact/compat` in your own build config. The compiled output never imports Preact directly; the aliasing happens entirely on the consumer side, exactly as it does for any other React library you already use under Preact.

Be clear-eyed about what this is: **the React target's emit, consumed via the compat layer.** Rozie does not ship a native, signals-based Preact target (no compat shim, authored against Preact's own `signal()` / `hooks` surface). A native target is a *possible* future direction, not a promise. Today, "Preact support" means "Rozie's React emit, proven to run under `preact/compat` and kept proven in CI."

If you already run a React-flavored stack on Preact, you can drop Rozie components in with one block of alias config and nothing else.

## Alias setup

Add the Rozie unplugin alongside your existing JSX plugin, then alias `react` / `react-dom` onto `preact/compat`. This config mirrors the CI-verified `vite.config.preact.ts` exactly — copy it into your own `vite.config.ts`:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  plugins: [
    Rozie({ target: 'react' }),
    react(),
  ],
  resolve: {
    // Array form, MOST-SPECIFIC FIRST so subpaths resolve before the bare
    // `react` / `react-dom` fallbacks. These are exact-string finds (not
    // regex), which avoids prefix ambiguity (e.g. `react` matching `react-dom`).
    alias: [
      { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react/jsx-dev-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react-dom/client', replacement: 'preact/compat/client' },
      { find: 'react-dom', replacement: 'preact/compat' },
      { find: 'react', replacement: 'preact/compat' },
    ],
    // Collapse every `react` import — in your app AND in workspace deps like
    // @rozie/runtime-react — onto a SINGLE preact/compat instance.
    dedupe: ['preact', 'preact/compat'],
  },
});
```

Two things matter here:

- **Most-specific-first ordering.** The subpath finds (`react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom/client`) must come *before* the bare `react-dom` and `react` fallbacks. Because these are exact-string finds, listing the bare `react` first would shadow the subpaths and they would never resolve. `@vitejs/plugin-react`'s automatic runtime emits `react/jsx-runtime` imports — the first alias redirects those to `preact/jsx-runtime`.
- **`dedupe`.** Without it, your app and its workspace dependencies (notably `@rozie/runtime-react`) can each resolve their own `react` copy. `dedupe: ['preact', 'preact/compat']` forces every resolution onto one `preact/compat` instance, so hooks state and context live in a single runtime.

That is the whole setup. Keep your existing `@vitejs/plugin-react`; it is the simpler of the two JSX options and its automatic-runtime output is handled by the first alias.

## This is a continuously-enforced guarantee

Rozie's React-under-Preact support is not a one-time spot check — it is a standing CI job. The `preact-compat` job in `react-matrix.yml`:

- Builds the react-vite demo through `build:preact` — the **same React emit** produced by `Rozie({ target: 'react' })`, with `react` / `react-dom` aliased to `preact/compat` via the config above.
- Runs the **full Playwright e2e suite** over that Preact build via `test:e2e:preact` (`VITE_USE_PREACT=1`). This is the identical suite the plain-React legs run — not a reduced subset.
- Fires on every pull request that touches React-emit code paths (`packages/targets/react/**`, `packages/runtime/react/**`, `packages/unplugin/**`, `packages/core/**`, `examples/consumers/react-vite/**`) and on every push to `main`.

The suite that runs under Preact covers Counter, controllable Counter, Modal StrictMode lifecycle, Dropdown outside-click / imperative handle / stale-closure, exhaustive-deps, prop-default coercion, console-preservation, the StrictMode matrix, source-maps, Lit-interop, and an HMR-state spec. So the guarantee isn't "it compiled once" — it's "the React emit keeps passing its real interaction tests under `preact/compat` on every relevant change."

## Measured bundle benefit

On the react-vite demo app, swapping React for `preact/compat` produces a meaningfully smaller bundle:

| Build | Raw | Gzipped |
| --- | --- | --- |
| React | 296 kB | ~93.1 kB |
| `preact/compat` | 121 kB | ~40.7 kB |

That is roughly **2.4× smaller**. These are measured numbers from the demo app, not a guaranteed figure for an arbitrary application — your delta depends on how much of React's surface you use and what else is in your bundle. But the demo is a representative Rozie consumer, and the direction is consistent: the same emit, fewer bytes shipped.

## One known semantic difference: effect timing

There is a single behavioral difference worth knowing about, and it is about *when* passive effects run.

Preact defers passive effects to after-paint (scheduled via `requestAnimationFrame`). React flushes them before a discrete-event update yields. In Rozie terms, side-effects driven from `$watch` and `$onMount` land **one frame later** under `preact/compat` than under React.

For users this is imperceptible. It only becomes observable to tests — or to code — that synchronously read a DOM side-effect *immediately* after an interaction, expecting it to already be applied. The fix is the same one the e2e suite uses to stay green under Preact: **use polling assertions** (e.g. Playwright's auto-retrying `expect(locator).toHaveText(…)`, or `waitFor`) instead of reading the DOM exactly once on the line after the click. If your consumer tests already use auto-retrying assertions, you will not notice the difference at all.

## @rozie-ui works the same way

The pre-compiled `@rozie-ui/<component>-react` packages are plain React components — they are exactly the emit this page describes, published as packages. That means they consume `preact/compat` through the **same aliases**, with no extra configuration. Install the `-react` variant, apply the alias block above once, and the `@rozie-ui` components resolve onto `preact/compat` alongside your own `.rozie` files.

## When Rozie + preact/compat is the right answer

- You already run a React-flavored app on Preact (or want to) and you want Vue-style SFC authoring ergonomics without leaving that stack.
- You want Rozie's cross-framework component model but ship to a Preact runtime to keep your bundle small.
- You consume `@rozie-ui/*-react` packages and want them to ride the same `preact/compat` aliasing you already maintain.

## When it isn't

- **You want a native, signals-first Preact authoring experience** (Preact's own `signal()` reactivity end-to-end, no compat layer). Rozie does not ship that today — this is the React emit under `preact/compat`, and that is what is CI-verified.
- **You depend on React-internal behavior** that `preact/compat` deliberately does not replicate. The full e2e suite passing under Preact covers Rozie's emit specifically; your *own* code's reliance on React internals is out of Rozie's scope.
- **You can't tolerate the after-paint effect-timing difference** and your tests read DOM side-effects synchronously without polling. Adopt polling assertions first (see above) — but if that genuinely doesn't fit, the plain-React target is right there.

## Next steps

- [For React teams](/guide/for-react-teams) — the React target this page builds on, plus the React-specific creature comforts.
- [Adopt incrementally](/guide/adopt-incrementally) — full per-stack install paths (Vite, Webpack, esbuild, Babel-only, CLI).
- [Quick Start](/guide/quick-start) — write your first `.rozie` file.
- [Features & design choices](/guide/features) — the full cross-framework feature surface.
- [Examples](/examples/) — full source + per-target output, including the React emit, for every reference component.
- [Compatibility](/compatibility) — supported framework versions and the parity bar.
