---
layout: home

hero:
  name: "Rozie.js"
  text: "The same component, the same API, in React, Vue, Svelte, Angular, Solid, and Lit."
  tagline: "Install only your framework's package. Every component compiles to idiomatic native code for its target: no wrappers, no runtime, no Rozie dependency in your app."
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
  - title: Native to your framework
    details: The React package is a real function component using hooks; Vue gets a real SFC, Svelte gets runes, Angular gets signals, Solid gets createSignal, and Lit ships a native custom element. Each target uses its own reactivity primitives, indistinguishable from hand-written code.
  - title: 29 real components, six frameworks each
    details: The @rozie-ui families. Fifteen engine-backed components (a TanStack-powered DataTable, SortableJS, FullCalendar, CodeMirror, Chart.js, TipTap, Lexical, MapLibre, Cropper, and more), thirteen headless WAI-ARIA families (Listbox, Combobox, Dialog, Toast, DatePicker, Command Palette, and more) built in pure Rozie with no engine at all, and a hosted Captcha. Install only your framework's package.
  - title: Familiar Vue/Alpine syntax
    details: Block-based SFCs with &lt;props&gt;, &lt;data&gt;, &lt;script&gt;, &lt;template&gt;, and &lt;style&gt;. r-* directives, @event modifiers, mustache interpolation. No JSX-isms.
  - title: Not a runtime framework
    details: Rozie compiles away. The heavy lifting still happens in your target — React, Vue, Svelte, Angular, Solid, or the browser's native custom-element runtime owns the rendering pipeline.
  - title: Built for component-library authors
    details: Write a component once in a .rozie file and Rozie compiles it to six consumer packages. If you maintain manual cross-framework wrappers today, that work goes away.
  - title: Stuck on one framework? Use Rozie for ONE new component this week
    details: Drop a single .rozie file into your existing Next.js / Nuxt / Angular CLI / SvelteKit / Astro app. Get Vue-flavored SFC authoring, scoped CSS without runtime tax, automatic attribute fallthrough, and engine-wrapper escape hatches that fix pain your stack can't fix for you.
  - title: Quietly fixes cross-framework grit
    details: Scoped CSS that survives composition on every target — with literal class names everywhere (React included), so querySelector('.x') and engine selectors just work. Non-primitive {{ }} renders portable JSON instead of crashing React. $reconcileAfterDomMutation() for engines that mutate DOM under the reconciler's feet. The creature-comforts matrix flips the compatibility table on its head.
---

## Ship-ready components

Every `@rozie-ui` family is the same component with the same API in React, Vue, Svelte, Angular, Solid, and Lit: one docs set, one behavior contract, six packages maintained and released together. Each family is one `.rozie` source compiled to all six targets; consumers install only their framework's package, with no Rozie toolchain or runtime dependency.

**Engine-backed** — a battle-tested vanilla-JS engine wrapped once, where the existing per-framework bindings are uneven, community-maintained, or (for Lit) missing entirely:

[DataTable](/components/data-table) · [SortableList](/components/sortable-list) · [Flatpickr](/components/flatpickr) · [FullCalendar](/components/fullcalendar) · [CodeMirror](/components/codemirror) · [Chart.js](/components/chartjs) · [TipTap](/components/tiptap) · [Lexical](/components/lexical) · [MapLibre](/components/maplibre) · [Cropper](/components/cropper) · [Waveform](/components/wavesurfer) · [PdfViewer](/components/pdf) · [FlowCanvas](/components/rete) · [Carousel](/components/embla) · [Popover & Tooltip](/components/popover)

**No-engine, pure Rozie** — headless, fully accessible interaction authored from scratch in a single `.rozie` file, proving Rozie carries rich behavior on its own:

[Listbox](/components/listbox) · [Slider & Range](/components/slider) · [Otp & PIN input](/components/otp) · [Combobox & Autocomplete](/components/combobox) · [Toast & Notifications](/components/toast) · [Dialog & Modal](/components/dialog) · [Tags & Token input](/components/tags) · [NumberField & Stepper](/components/number-field) · [Pagination](/components/pagination) · [DatePicker & Calendar](/components/date-picker) · [Switch & Toggle](/components/switch) · [Resizable Split Pane](/components/resizable) · [Command Palette](/components/command-palette)

**Hosted widgets** — a third-party SaaS widget loaded at runtime (no npm engine), unified across providers *and* frameworks:

[Captcha](/components/captcha)

Every family ships six packages, a showcase-and-API page, a libraries-comparison page, and a live demo. **[Browse all components →](/components/)**
