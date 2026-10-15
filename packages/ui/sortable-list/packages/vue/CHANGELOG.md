# @rozie-ui/sortable-list-vue

## 0.1.10

### Patch Changes

- cf49212: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.

## 0.1.9

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

## 0.1.8

### Patch Changes

- Regenerated with the toolchain's Vue `$watch` flush:'post' fix: all `$watch`-driven prop/data reconcilers now run post-flush (after the DOM update, matching the React/Solid/Svelte/Angular/Lit leaves' timing) instead of Vue's default pre-flush. This closes the portal re-entrancy class (a portal fill mounting from inside an engine update can no longer synchronously flush a pending sibling watcher into the same engine mid-update) and the pre-flush `$refs`-read-too-early class (e.g. the embla runtime `thumbnails` toggle previously failed to build its thumb engine on Vue). No API surface change.

## 0.1.7

### Patch Changes

- Stale-publish reconciliation. The published `0.1.6` tarball shipped without a `web-types.json` IDE sidecar at all — it was missing from the tarball entirely, and the `package.json` `web-types` field / `files` entry that reference it were also absent from the published manifest, so PhpStorm/WebStorm consumers got zero `<SortableList>` prop/slot completion. This release republishes with the sidecar present and wired (`web-types` field + `files` entry), matching every other release-verified vue leaf's convention. No `src/` change, no API surface change.

## 0.1.6

### Patch Changes

- ac09c50: Fix a keyboard hijack when an interactive element (a `<input>`, `<button>`, etc.) is rendered into a sortable row's default slot — the row's `onRowKeyDown` handler previously ran on any keydown that bubbled up to it, hijacking Space/Enter/Escape/Arrow keystrokes typed into the slotted child for lift/drop/move/cancel before the child ever saw them. Reorder keys now apply only when the row element ITSELF is focused; keystrokes originating from a slotted interactive child fall through untouched to that child. No API change, no per-target behavior divergence — the "editable row" pattern (a text input alongside drag-to-reorder) now works as expected.
