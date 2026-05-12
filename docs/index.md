---
layout: home

hero:
  name: "Rozie.js"
  text: "One source. Every framework."
  tagline: "Write components once in a Vue/Alpine-flavored syntax. Ship idiomatic React, Vue, Svelte, and Angular — no per-framework wrappers."
  actions:
    - theme: brand
      text: Quick Start
      link: /guide/quick-start
    - theme: alt
      text: Why Rozie?
      link: /guide/why
    - theme: alt
      text: See examples
      link: /examples/counter

features:
  - title: One file, four frameworks
    details: Author a single .rozie file. Rozie compiles it to idiomatic React, Vue, Svelte, and Angular components — each using the target framework's native reactivity primitives.
  - title: Familiar Vue/Alpine syntax
    details: Block-based SFCs with &lt;props&gt;, &lt;data&gt;, &lt;script&gt;, &lt;template&gt;, and &lt;style&gt;. r-* directives, @event modifiers, {{ }} interpolation. No JSX-isms.
  - title: Not a runtime framework
    details: Rozie compiles away. The heavy lifting still happens in your target framework — React, Vue, Svelte, or Angular owns the rendering pipeline.
  - title: Built for component-library authors
    details: If you maintain manual cross-framework wrappers today, Rozie eliminates that work. One source of truth, four working consumer packages.
---
