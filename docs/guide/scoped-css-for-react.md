# Scoped CSS for React, zero runtime

React's CSS story has been a long argument with itself. CSS Modules ship class-hash boilerplate everywhere. styled-components / Emotion add a runtime tax. Tailwind paints over the problem with utility classes. Vanilla `.css` imports leak globally and break in any non-trivial design system. The Next.js App Router added CSS Modules + Server Components scoping, but the authoring shape is still "remember to thread `styles.foo` through every JSX call site."

Rozie gives React the one model the other frameworks have had for years: a **`<style>` block, scoped by default, with zero runtime overhead.** You author plain `class="card"`; the compiler isolates it with a `[data-rozie-s-<hash>]` attribute selector (exactly Vue's `<style scoped>` model) and extracts a plain sibling `.css` file. No CSS Modules, no class-name hashing, no `styles.foo` threading, no CSS-in-JS runtime.

You don't have to leave React, migrate anything, or give up your component library. You write one component in Rozie and import the compiled `.tsx` like any other.

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

The CSS file is fine. The component file is a `styles.foo` slog through every class reference, and hyphenated classes (`styles['search-input']`) read worse than vanilla CSS.

### CSS-in-JS runtime parsing

styled-components or Emotion solves the authoring ergonomics but adds:

- A runtime parse + inject pass on every component render
- Serialization fights with Server Components / streaming SSR
- A separate "what's a styled component" mental model
- Bundle weight: 11–17kB gzipped just for the runtime
- Theme-context dependency graphs that break tree-shaking

The React community has been openly looking for a way out for years. [Zero-runtime CSS-in-JS libraries](https://github.com/callstack/linaria) exist but are a different ecosystem each.

### Tailwind class soup

```tsx
<button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
  …
</button>
```

Tailwind ships fast and the toolchain is excellent. It also means your component's visual identity is encoded as a 30-class string in JSX; component-level reasoning gets harder, and CSS-token / design-system handoff is duplicated between Tailwind config and design files.

## What you write instead

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

## What the compiler emits

`@rozie/unplugin` compiles the file above into a regular React functional component (plain `useState`) plus a sibling plain `.css` file. The emitted `.tsx` writes plain class strings (`className="search-input"`) — there is no `styles` object to thread, because there is no `styles` object. Isolation comes from the `[data-rozie-s-<hash>]` attribute the compiler appends to every CSS rule, exactly the way Vue's `<style scoped>` works.

The runtime cost is **zero**: the `<style>` block becomes a build-time-extracted plain `.css` file. There is no styled-components runtime, no Emotion runtime, no extra bundle weight beyond the CSS itself.

Because the class name renders **literally** in the DOM (no hashing), `el.querySelector('.search-input')` — and third-party engine config like SortableJS's `handle: '.grip'` — resolves directly on React, the same as on every other target.

## Try it in five minutes

Add the unplugin to your existing Vite or Next.js build, write one leaf component you've been styling with CSS Modules or Tailwind as a `.rozie` file, and import it like any other component. If the team doesn't like it, the compiled `.tsx` is a normal React component — delete the `.rozie` source and keep the output. Zero lock-in, zero runtime dependency.

- [For React teams](/guide/for-react-teams) — the full React story: statically-computed `useEffect` deps, StrictMode-safe lifecycles, compile-time prop-mutation errors, two-way binding without a state library, and step-by-step Vite / Next.js install.
- [Adopt incrementally](/guide/adopt-incrementally) — per-stack install (Vite, Next.js, Astro, Webpack, esbuild, Babel-only, CLI).
- [Quick Start](/guide/quick-start) — write your first `.rozie` file.
- [Examples](/examples/) — full source + per-target output for every reference component.
