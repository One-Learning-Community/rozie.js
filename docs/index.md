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
    - theme: brand
      text: Browse components
      link: /components/
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
  - title: 13 real components, six frameworks each
    details: The @rozie-ui families are the proof. SortableJS, FullCalendar, CodeMirror, Chart.js, TipTap, MapLibre, Cropper, pdf.js, Rete, Embla — each a battle-tested engine wrapped once and shipped to all six frameworks — plus headless WAI-ARIA Listbox and a native-input Slider built in pure Rozie with no engine at all. Install only your framework's package.
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

## Ship-ready components

The clearest proof that one source can ship six idiomatic targets is a shelf of real components built that way. Each `@rozie-ui` family is **one `.rozie` source compiled to React, Vue, Svelte, Angular, Solid, and Lit** — consumers install only their framework's package, with no Rozie toolchain or runtime dependency.

**Engine-backed** — a battle-tested vanilla-JS engine wrapped once, where the existing per-framework bindings are uneven, community-maintained, or (for Lit) missing entirely:

[SortableList](/components/sortable-list) · [Flatpickr](/components/flatpickr) · [FullCalendar](/components/fullcalendar) · [CodeMirror](/components/codemirror) · [Chart.js](/components/chartjs) · [TipTap](/components/tiptap) · [MapLibre](/components/maplibre) · [Cropper](/components/cropper) · [PdfViewer](/components/pdf) · [FlowCanvas](/components/rete) · [Carousel](/components/embla)

**No-engine, pure Rozie** — headless, fully accessible interaction authored from scratch in a single `.rozie` file, proving Rozie carries rich behavior on its own:

[Listbox](/components/listbox) · [Slider & Range](/components/slider) · [Otp & PIN input](/components/otp) · [Combobox & Autocomplete](/components/combobox) · [Toast & Notifications](/components/toast) · [Dialog & Modal](/components/dialog) · [Tags & Token input](/components/tags) · [NumberField & Stepper](/components/number-field) · [Pagination](/components/pagination)

**Hosted widgets** — a third-party SaaS widget loaded at runtime (no npm engine), unified across providers *and* frameworks:

[Captcha](/components/captcha)

Every family ships six packages, a showcase-and-API page, a libraries-comparison page, and a live demo. **[Browse all components →](/components/)**
