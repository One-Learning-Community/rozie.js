# For React teams

Rozie compiles `.rozie` components to idiomatic React function components (plain `useState` / `useMemo` / `useEffect`) and gives React a `<style>` block that is scoped by default, with zero runtime cost. The full styling pitch lives at [Scoped CSS for React](/guide/scoped-css-for-react): the CSS Modules / styled-components / Tailwind comparison, the SearchInput before/after, and what the compiler emits.

You don't have to leave React, migrate anything, or give up your existing component library: you write one new component in Rozie this week and import the compiled `.tsx` like any other.

## The creature comforts beyond styling

The same compiler that scopes your CSS normalizes a handful of other React papercuts. Three of them are one-liners here because the [creature-comforts matrix](/guide/creature-comforts) carries the full treatment:

- **Statically-computed `useEffect` dep arrays.** `eslint-plugin-react-hooks/exhaustive-deps` is the lint rule everyone respects and quietly hates. With Rozie you don't write the dep array; the compiler emits the correct one from the lifecycle hook's body, and the output passes `exhaustive-deps` cleanly.
- **StrictMode double-fire safety.** `$onMount` returning a cleanup function lowers to one `useEffect` with a cleanup return, the canonical React 18 StrictMode-safe pattern.
- **Auto-fallthrough for attrs + listeners.** Consumer-passed attributes that aren't declared props auto-spread onto the root element. `class` and `className` are merged, not clobbered. Native listeners pass through. Opt out with `<rozie inherit-attrs="false">`.

Two deserve their own sections.

### Static error on prop mutation

```rozie
<script>
const rename = () => { $props.title = 'Untitled' }  // ROZ200: writing a non-model prop is a static error
</script>
```

The single most common React-component bug class (mutating a prop instead of calling the parent callback) is caught at compile time. A prop that isn't `model: true` can't be written at all — `$props.title = …` is **ROZ200**. A prop that *is* `model: true` is read via `$props.x` and written via the `$model.x` sigil (`$model.open = false`); writing it through `$props` instead is its own diagnostic, **ROZ204**, which points you at `$model`. `model: true` enables two-way binding (lowers to a controllable-state pair: `value` + `onValueChange`).

### Two-way binding that doesn't require a state-management library

The React `useControllableState` pattern lives in every component library that does headlessly-controllable components (Radix, Headless UI, React Aria) — each one re-implements the same glue. Declare `model: true` on a `<props>` member and Rozie emits the canonical controllable-state pair for you. Consumer code stays vanilla React:

```tsx
// Controlled
<Modal open={isOpen} onOpenChange={setIsOpen}>…</Modal>

// Uncontrolled (defaultValue takes over)
<Modal>…</Modal>
```

## Incremental adoption

### Step 1: Add the unplugin to your existing Vite / Next.js project

For Vite-based React (CRA replacements, Remix-on-Vite, Vite + React Router):

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  plugins: [Rozie({ target: 'react' }), react()],
});
```

For Next.js:

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

The [adopt-incrementally guide](/guide/adopt-incrementally) covers every other stack (Astro, Webpack 5, esbuild, Babel-only, CLI pre-compile).

### Step 2: Write one component in Rozie

Pick a leaf component with one or two CSS classes that you've been styling with CSS Modules or Tailwind. Rewrite as a `.rozie` file.

### Step 3: Import + use it like a regular React component

```tsx
import SearchInput from './SearchInput.rozie';

export default function Page() {
  return <SearchInput placeholder="Find…" onSearch={(q) => console.log(q)} />;
}
```

Types come from a generated `SearchInput.d.rozie.ts` sidecar the build writes next to the source, resolved through TypeScript's `allowArbitraryExtensions` flag; setup lives in [Install § Typed `.rozie` imports](/guide/install#typed-rozie-imports-per-framework-setup). Your editor gets full IntelliSense for props, including the generated `onValueChange` callbacks for `model: true` props.

### Step 4: Decide

If the team likes it, expand. If not, the compiled `.tsx` is a normal React component — delete the `.rozie` source and keep using the output. At runtime it depends on `react`, a plain sibling `.css` import your bundler already handles, and a handful of helpers from [`@rozie/runtime-react`](/guide/output-and-runtime) — a few hundred gzipped bytes for a typical leaf, MIT, and small enough to vendor if you ever want the dependency gone. Nothing locks you in.

## When Rozie isn't the right answer for a React team

- **You're committed to Tailwind utility-first authoring** and your team likes it that way. Rozie isn't going to change your mind, and you'd lose the integrated `tailwind.config.ts` token reasoning.
- **You ship a UI library to other React-only consumers** and your maintenance budget for cross-framework wrappers is zero. You're not the audience; the [component-library author audience](/guide/why#who-rozie-is-for) is.
- **Your CSS-in-JS choice IS the design-system handoff** (a tightly integrated `@emotion/react` + theme-context architecture, or `vanilla-extract`'s typed CSS-in-TS). Rozie's scoped-CSS model is build-time-static; it doesn't replace dynamic theme-context-driven styling.

## When Rozie absolutely is

- You want the Vue authoring ergonomics (SFC blocks, `:prop=`, `@event.modifier`, `r-if`/`r-for`, `r-model`, scoped styles) but can't migrate the codebase.
- Your component library glues vanilla-JS engines (Sortable, Flatpickr, Leaflet, TipTap, …) and you want `querySelector('.x')` to behave identically across every target without per-framework class-name surprises.
- You want scoped CSS with zero runtime cost and the existing options (CSS Modules + per-callsite plumbing, or CSS-in-JS + runtime tax) both feel wrong.
- You're prototyping a new section of an app and the "write less, ship the same" pitch resonates.

## Next steps

- [Scoped CSS for React](/guide/scoped-css-for-react) — the full styling pitch this page builds on.
- [Quick Start](/guide/quick-start) — write your first `.rozie` file.
- [Adopt incrementally](/guide/adopt-incrementally) — full per-stack install
  walkthrough including Next.js, Astro, Babel-only.
- [Creature comforts](/guide/creature-comforts) — the full matrix of cross-framework normalizations.
- [Examples](/examples/) — full source + per-target output, including the React emit, for every reference component.
