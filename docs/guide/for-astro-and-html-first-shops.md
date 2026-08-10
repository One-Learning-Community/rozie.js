# For Astro / island / HTML-first shops

The pendulum that swung toward client-side-only SPAs in the mid-2010s has been swinging back since 2020. Astro, Eleventy + island hydration, Remix's "server-first then client-progressive" stance, Hotwire / Turbo, Stimulus, Alpine — they're all flavors of the same insight: **render the page on the server, hydrate only the parts that need behavior, ship less JavaScript.**

The catch: each island still needs a component model. Astro and friends let you pick **per island** — a React island, a Vue island, a Svelte island, a Lit Web Component. In practice, that means your codebase ends up with three or four parallel component implementations of the same UI primitives. The "ship less JS" win evaporates the second you import a 40KB React runtime to render a 200-byte dropdown.

Rozie fits this pattern exactly. Author once in `.rozie`. Compile to **any of the six targets per island** — including the Lit Web Component target, which runs without a framework runtime at all. Same source, the right output per island budget.

This guide is for teams whose dominant pattern is: "the page is mostly HTML; interactive bits are isolated and need to ship as little code as possible."

## The two flavors of HTML-first

### Flavor A — Astro / Eleventy / Nuxt SSR / Remix

You write pages in a template language (`.astro`, Nunjucks, `.vue` SSR, `.tsx` Remix). Server renders the markup. The page ships interactive components as **islands** — small bundles that hydrate independently.

The choice you face per island: which framework? Astro accepts React, Vue, Svelte, Solid, Lit, Preact, Alpine. Each carries a runtime cost. Each requires its own component implementation. Maintaining the same `<Dropdown>` in three frameworks is a maintenance multiplier.

### Flavor B — Stimulus / Hotwire / vanilla JS + plugins

The page is server-rendered HTML, period. Interactivity comes from `data-controller="…"` attributes (Stimulus), `data-turbo-frame` (Turbo), or hand-rolled custom elements. The runtime is a thin coordination layer; the components are mostly DOM.

You don't want a framework runtime at all. You want standards-compliant Web Components that drop into any HTML page and act like native HTML elements.

Rozie addresses both with the same source file.

## What Rozie gives an Astro shop

### Pick the target per island

```astro
---
// Per-island target choice.
import Counter from '../components/Counter.rozie';
---
<html>
  <body>
    <h1>Page</h1>
    <Counter client:visible />  <!-- Compiled to your default target -->
  </body>
</html>
```

The default target is set per-project in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  vite: {
    plugins: [Rozie({ target: 'lit' })],  // ← cheapest island runtime
  },
});
```

For a typical Astro site where islands need to ship as little JavaScript as possible, `target: 'lit'` is the right default. Lit's runtime is ~6KB gzipped, roughly 7.5× smaller than React + ReactDOM combined (~45KB, per the table below). The compiled Rozie component is a Web Component that hydrates as a native custom element.

If you have one heavy island that needs a richer React component library, you can override the target for that file at the build-tool level — but the source stays the same.

### Web Components hydrate without an island bridge

A Vue / React / Svelte island typically needs a bridge runtime: the host has to instantiate the framework, mount the component into the island root, wire props, handle teardown. Astro abstracts this but the cost is real.

A Web Component (Lit target output) hydrates by definition:

```html
<rozie-counter value="42" step="5"></rozie-counter>
```

The browser registers the custom element, instantiates an instance, the constructor connects the shadow root, render runs. There is no bridge and no framework instantiation step. The component is a native HTML element with reactive properties.

This is the same pattern Astro uses for its native Web Components island integration. Rozie just makes authoring them ergonomic.

### Cross-island consistency

If different islands on the same page happen to use the same component — a Dropdown, a Toast, a Tabs primitive — and the islands are different frameworks (React for one, Svelte for another), today you maintain two implementations.

With Rozie, you maintain one `.rozie` source. The compiler produces the right per-island output. The components behave identically because they're compiled from the same source.

## What Rozie gives a Stimulus / Hotwire / vanilla-JS shop

Compiled with `target: 'lit'`, a `.rozie` file is a native custom element you drop into any server-rendered page: light-DOM children project through slots, `model: true` props compile to a property/attribute pair plus a `*-change` `CustomEvent`, and document/window listeners attach and detach with the component lifecycle. A Stimulus controller (or a plain `<script>`) reads the property, writes it, and listens for the event; the page carries no framework runtime beyond Lit's ~6KB.

```html
<rozie-dropdown-menu id="m"></rozie-dropdown-menu>
<script>
  const m = document.getElementById('m');
  m.open = true;
  m.addEventListener('open-change', (e) => console.log('open is now', e.detail));
</script>
```

[For vanilla-JS + plugin shops](/guide/for-vanilla-js-shops) is the full treatment for this audience, including the engine-wrapper pattern (SortableJS, Flatpickr, Leaflet) that ships those engines as Web Components a Stimulus `data-action` can listen to. [For Lit / Web Components teams](/guide/for-lit-teams) covers the emitted component model in depth.

## What an HTML-first stack stops paying for

| Cost in a typical framework SPA | Cost in Rozie + Lit-target |
| --- | --- |
| React + ReactDOM runtime per page (~45KB gzipped) | Lit runtime per page (~6KB gzipped) |
| Per-component framework re-hydration cost | Native custom-element registration, zero hydration overhead |
| State-management library for cross-component coordination | Standard DOM events + properties |
| CSS-in-JS runtime parsing | Build-time-scoped CSS via shadow DOM + `adoptConsumerStyles` for theming |
| Per-framework testing setup | `@web/test-runner` / Playwright — works on any Web Component |
| One component implementation per framework you support | One `.rozie` source, targets selected per consumer |

## Incremental adoption — Astro

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  vite: {
    plugins: [Rozie({ target: 'lit' })],
  },
});
```

Write a `.rozie` file under `src/components/`. Import it from any `.astro` page:

```astro
---
import Counter from '../components/Counter.rozie';
---
<Counter />
```

Astro renders the custom-element tag on the server (light DOM only), and the browser upgrades it in place once its defining module reaches the client. For the Lit target no `client:` directive is needed on the tag itself — but the element's defining module must still reach the browser via a client `<script>` that imports it. The repo's `examples/consumers/astro-rozie` smoke exercises exactly this split: framework islands mount with `client:load`, while the Lit `<rozie-counter>` carries no directive and is registered by a plain client script.

For richer interactive islands where you want a framework runtime — swap `target: 'lit'` for `target: 'react'` / `'vue'` / `'svelte'` / `'solid'` per file (via Astro's overrides), or per project.

## Incremental adoption — Stimulus / Hotwire / plain HTML

Use Rozie's [CLI codegen](/guide/install#standalone-cli) to emit the compiled custom element as a regular `.ts` file:

```bash
pnpm rozie build src/components/DropdownMenu.rozie --target lit --out public/dropdown.js
```

Drop `public/dropdown.js` into your `<head>`:

```html
<script type="module" src="/dropdown.js"></script>
```

The custom element is registered. Use it anywhere `<div>` works.

For a build-time-integrated workflow with Rails / Phoenix / Django, the unplugin's Webpack adapter integrates with the existing asset pipeline. See the [adopt-incrementally guide § Babel-only](/guide/adopt-incrementally#babel-only-legacy-build-pipelines-no-vite-esbuild-webpack-5) for the legacy-pipeline path.

## When Rozie is the right answer here

- You're on **Astro / Eleventy / Nuxt SSR / Remix** and want the smallest possible per-island runtime cost without giving up component authoring ergonomics.
- You're on **Stimulus / Hotwire / Rails / Phoenix** and want standards-compliant Web Components authored with modern ergonomics instead of hand-writing `class extends HTMLElement`.
- Your team writes server-rendered HTML and has resisted introducing a framework runtime for years; Rozie + the Lit target lets you author components without becoming a framework shop.
- You're building a **design system that ships to multiple internal apps**, some of which are SPAs (React, Vue) and some of which are MPAs (Rails, Django) — the same `.rozie` source compiles for all of them.

## Next steps

- [Quick Start](/guide/quick-start) — write your first `.rozie` file.
- [Adopt incrementally § Astro](/guide/adopt-incrementally#astro) — Astro install walkthrough.
- [For Lit / Web Components teams](/guide/for-lit-teams) — the deeper Lit-target pitch with slot semantics, scoped CSS bridge, engine integration.
- [For vanilla-JS + plugin shops](/guide/for-vanilla-js-shops) — the engine-wrapper pattern, particularly relevant when paired with Lit-target output.
- [Lit consumer demo](https://github.com/One-Learning-Community/rozie.js/tree/main/examples/consumers/lit-vanilla-demo) — working Vite + Lit project.
