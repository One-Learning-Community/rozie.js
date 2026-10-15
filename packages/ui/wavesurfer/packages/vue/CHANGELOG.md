# @rozie-ui/wavesurfer-vue

## 0.1.5

### Patch Changes

- cf49212: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.

## 0.1.4

### Patch Changes

- a113f0e: Vue leaves: `@example` snippets in prop documentation now use Vue syntax

  The published tarballs for these seven leaves still carried Rozie authoring
  notation inside their `@example` JSDoc blocks — `r-model:data="crop"` where a
  Vue consumer should see `v-model:data="crop"`. Hovering a prop in an editor
  showed markup that is not valid in the framework you are actually using.

  The fix landed in source on 2026-08-24 but these seven were never bumped, so
  npm kept serving the old bytes (`pnpm publish` silently skips an already-
  published version). Documentation comments only — no runtime code, type
  signature, or import changed.

## 0.1.3

### Patch Changes

- Debut release of `@rozie-ui/wavesurfer` — an idiomatic cross-framework audio waveform
  player wrapping wavesurfer.js v7, shipping identically for React, Vue, Svelte, Angular,
  Solid, and Lit. Core waveform rendering and full playback control, the two-way
  `currentTime` binding, the Timeline and Hover plugins, and the interactive Regions
  plugin with a two-way `regions` binding.

  A deep pre-release audit (`.planning/quick/260811-kt2-wavesurfer-debut-shore-up/
AUDIT.md`) found no public-surface change from this shore-up wave — no prop, emit,
  model, slot, or expose verb was added, renamed, or removed — so this debut ships as a
  PATCH, aligning all six leaves at one version. The wave closed the family's full
  coverage gap in a single pass: every prop, emit, model, and expose verb now has a
  behavioral runtime assertion executed on all six targets (previously the family's only
  runtime exercise was a single static pixel cell). It also added JetBrains web-types.json
  (Vue) and a Custom Elements Manifest (Lit) IDE sidecars, generated from the same lowered
  IR the READMEs use.
