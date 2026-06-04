---
layout: home

hero:
  name: "Rozie.js"
  text: "One source. Every framework."
  tagline: "Write components once in a Vue/Alpine-flavored syntax. Ship idiomatic React, Vue, Svelte, Angular, Solid, and Lit web components — no per-framework wrappers."
  actions:
    - theme: brand
      text: Quick Start
      link: /guide/quick-start
    - theme: alt
      text: Why Rozie?
      link: /guide/why
    - theme: alt
      text: Adopt incrementally
      link: /guide/adopt-incrementally
    - theme: alt
      text: See examples
      link: /examples/

features:
  - title: One file, six targets
    details: Author a single .rozie file. Rozie compiles it to idiomatic React, Vue, Svelte, Angular, and Solid components plus Lit web components — each using the target's native reactivity primitives.
  - title: Familiar Vue/Alpine syntax
    details: Block-based SFCs with &lt;props&gt;, &lt;data&gt;, &lt;script&gt;, &lt;template&gt;, and &lt;style&gt;. r-* directives, @event modifiers, mustache interpolation. No JSX-isms.
  - title: Not a runtime framework
    details: Rozie compiles away. The heavy lifting still happens in your target — React, Vue, Svelte, Angular, Solid, or the browser's native custom-element runtime owns the rendering pipeline.
  - title: Built for component-library authors
    details: If you maintain manual cross-framework wrappers today, Rozie eliminates that work. One source of truth, six working consumer packages.
  - title: Stuck on one framework? Use Rozie for ONE new component this week
    details: Drop a single .rozie file into your existing Next.js / Nuxt / Angular CLI / SvelteKit / Astro app. Get Vue-flavored SFC authoring, scoped CSS without runtime tax, automatic attribute fallthrough, and engine-wrapper escape hatches that fix pain your stack can't fix for you.
  - title: Quietly fixes cross-framework grit
    details: Scoped CSS that survives composition on every target — with literal class names everywhere (React included), so querySelector('.x') and engine selectors just work. Non-primitive {{ }} renders portable JSON on all six targets instead of crashing React. $reconcileAfterDomMutation() for engines that mutate DOM under the reconciler's feet. The creature-comforts matrix flips the compatibility table on its head.
---
