# For React teams who want Vue's scoped CSS (without paying the CSS-in-JS tax)

React's CSS story has been a long argument with itself. CSS Modules ship class-hash boilerplate everywhere. styled-components / Emotion add a runtime tax. Tailwind paints over the problem with utility classes. Vanilla `.css` imports leak globally and break in any non-trivial design system. The Next.js App Router added CSS Modules + Server Components scoping but the authoring shape is still "remember to thread `styles.foo` through every JSX call site."

Rozie writes React components in Vue/Alpine-flavored block syntax, compiles them to vanilla functional components with `useState` / `useMemo` / `useEffect`, and gives you **scoped CSS with zero runtime overhead** — the same `<style>` block model Vue / Svelte / Solid users have had for years. The isolation layer is a `[data-rozie-s-<hash>]` attribute selector appended to every rule (exactly Vue's `<style scoped>` model), emitted as a plain sibling `.css` file. No CSS Modules, no class-name hashing.

You don't have to leave React. You don't have to migrate. You don't have to give up your existing component library. You write one new component in Rozie this week, and the compiled output is a regular `.tsx` file you import like any other.

## What you stop writing

### Class-hash boilerplate

CSS Modules in vanilla React:

```tsx
// SearchInput.tsx
import styles from './SearchInput.module.css';

export function SearchInput({ placeholder }: Props) {
  const [query, setQuery] = useState('');
  return (
    <div className={styles['search-input']}>
      <input
        className={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      {query.length > 0 ? (
        <button className={styles['clear-btn']} onClick={() => setQuery('')}>×</button>
      ) : (
        <span className={styles.hint}>2+ chars</span>
      )}
    </div>
  );
}
```

```css
/* SearchInput.module.css */
.search-input { display: inline-flex; gap: 0.25rem; }
.input { padding: 0.25rem 0.5rem; }
.clear-btn { background: none; border: none; cursor: pointer; }
.hint { color: rgba(0, 0, 0, 0.4); }
```

The CSS file is fine. The component file is a `styles.foo` slog through every class reference. Hyphenated classes (`styles['search-input']`) read worse than vanilla CSS. Rozie eliminates the threading entirely: you author plain `class="search-input"`, and the compiler scopes it via the `[data-rozie-s-<hash>]` attribute instead of renaming the class.

### CSS-in-JS runtime parsing

styled-components or Emotion solves the authoring ergonomics but adds:

- A runtime parse + inject pass on every component render
- Serialization fights with Server Components / streaming SSR
- A separate "what's a styled component" mental model
- Bundle weight: 11–17kB gzipped just for the runtime
- Theme-context dependency graphs that break tree-shaking

The React community has been openly looking for a way out for years. [zero-runtime CSS-in-JS libraries](https://github.com/callstack/linaria) exist but are a different ecosystem each.

### Tailwind class soup

```tsx
<button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
  …
</button>
```

Tailwind ships fast and the toolchain is excellent. It also means your component's visual identity is encoded as a 30-class string in JSX. Component-level reasoning gets harder; CSS tokens / design-system handoff is duplicated between Tailwind config and design files.

## What you start writing instead

```rozie
<rozie name="SearchInput">

<props>
{ placeholder: { type: String, default: 'Search…' } }
</props>

<data>
{ query: '' }
</data>

<template>
<div class="search-input">
  <input
    :value="$data.query"
    @input="$data.query = $event.target.value"
    :placeholder="$props.placeholder"
  />
  <button r-if="$data.query.length > 0" class="clear-btn" @click="$data.query = ''">×</button>
  <span r-else class="hint">2+ chars</span>
</div>
</template>

<style>
.search-input { display: inline-flex; gap: 0.25rem; }
input        { padding: 0.25rem 0.5rem; }
.clear-btn   { background: none; border: none; cursor: pointer; }
.hint        { color: rgba(0, 0, 0, 0.4); }
</style>

</rozie>
```

Half the line count. No `styles.foo` indirection. The `<style>` block is plain CSS — no preprocessor required (SCSS is opt-in via `<style lang="scss">`).

### What the Rozie compiler emits

`@rozie/unplugin` compiles the file above into a regular React functional component plus a sibling plain `.css` file. The emitted `.tsx` writes plain class strings (`className="search-input"`) — there is no `styles.foo` indirection to author, because there is no `styles` object. Isolation comes from the `[data-rozie-s-<hash>]` attribute the compiler appends to every CSS rule, the same way Vue's `<style scoped>` works. `querySelector('.search-input')` resolves against the real DOM on React.

The runtime cost is **zero**: the `<style>` block becomes a build-time-extracted plain `.css` file. There is no styled-components runtime, no Emotion runtime, no extra bundle weight beyond the CSS itself.

## The creature comforts beyond styling

The `<style>` block is the headline pitch — but the same compiler that gives you scoped CSS also normalizes a handful of other React papercuts:

### Statically-computed `useEffect` dep arrays

`eslint-plugin-react-hooks/exhaustive-deps` is the lint rule everyone respects and quietly hates. With Rozie, you don't write the dep array — the compiler emits the correct one from the lifecycle hook's body. Output passes `exhaustive-deps` cleanly.

### StrictMode double-fire safety

`$onMount` returning a cleanup function lowers to one `useEffect` with a cleanup return — the canonical React 18 StrictMode-safe pattern.

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

### Auto-fallthrough for attrs + listeners

Every React component eventually needs `{...rest}` plus `onClick`-forwarding plus a `className` merge. Rozie's `<rozie>` block is `inheritAttrs="true"` by default — consumer-passed attributes that aren't declared props auto-spread onto the root element. `class` and `className` are merged, not clobbered. Native listeners pass through. Opt out with `<rozie inherit-attrs="false">` for components that want manual control.

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

`.d.ts` is emitted as a sibling automatically. Your editor gets full IntelliSense for props, including the auto-generated `onValueChange` callbacks for `model: true` props.

### Step 4: Decide

If the team likes it, expand. If not, the compiled `.tsx` is a normal React component — delete the `.rozie` source and keep using the output. Zero lock-in, zero parallel runtime, zero new dependency at runtime (the compiled output depends only on `react` + a plain sibling `.css` import your bundler already handles).

## When Rozie isn't the right answer for a React team

- **You're committed to Tailwind utility-first authoring** and your team likes it that way. Rozie isn't going to change your mind, and you'd lose the integrated `tailwind.config.ts` token reasoning.
- **You ship a UI library to other React-only consumers** and your maintenance budget for cross-framework wrappers is zero. You're not the audience; the [component-library author audience](/guide/why#who-rozie-is-for) is.
- **Your CSS-in-JS choice IS the design-system handoff** (a tightly integrated `@emotion/react` + theme-context architecture, or `vanilla-extract`'s typed CSS-in-TS). Rozie's scoped-CSS model is build-time-static; it doesn't replace dynamic theme-context-driven styling.

## When Rozie absolutely is

- You want the **Vue authoring ergonomics** (SFC blocks, `:prop=`, `@event.modifier`, `r-if`/`r-for`, `r-model`, scoped styles) but can't migrate the codebase.
- Your component library glues vanilla-JS engines (Sortable, Flatpickr, Leaflet, TipTap, …) and you want `querySelector('.x')` to behave identically across every target without per-framework class-name surprises.
- You want **scoped CSS with zero runtime cost** and the existing options (CSS Modules + per-callsite plumbing, or CSS-in-JS + runtime tax) both feel wrong.
- You're prototyping a new section of an app and the "write less, ship the same" pitch resonates.

## Next steps

- [Quick Start](/guide/quick-start) — write your first `.rozie` file.
- [Adopt incrementally](/guide/adopt-incrementally) — full per-stack install
  walkthrough including Next.js, Astro, Babel-only.
- [Creature comforts](/guide/creature-comforts) — the full matrix of cross-framework normalizations.
- [Examples](/examples/) — full source + per-target output, including the React emit, for every reference component.
