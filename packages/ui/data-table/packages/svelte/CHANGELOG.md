# @rozie-ui/data-table-svelte

## 0.3.1

### Patch Changes

- Performance: `columnDefs()` is now memoized, removing an accidental O(columns² × rows) recompute from the per-cell metadata path.

  `columnDefs()` rebuilt the entire column-definition array on every call, and its caller chain (`defFor` → `editMetaOf` / `columnEditable` / `editorTypeOf` / `isEditing`) runs once per rendered cell, per render commit. On a 60-column table that is roughly 72,000 column-definition rebuilds per commit — repeated on every frame during a sustained scroll gesture, because the fill-drag edge auto-scroll bumps the window version each frame.

  The array is now cached on the reference identity of `:columns` and the internal `<Column>` registry — the same two dependencies the component's existing re-feed watch already treats as reference-only. A cache hit is an O(1) identity check; a miss recomputes exactly as before. Output is byte-identical; this is a pure memoization with no behavior or API change.

  The cost was identical on all six targets, but it was most visible on Vue, where `:columns` and the column registry are reactive proxies and every property read the builder performs pays proxy-tracking overhead on top of the redundant work. Under CPU contention that combination could starve the fill-drag auto-scroll loop badly enough that a drag toward the bottom edge scrolled the viewport without the selection range keeping pace with the newly revealed rows. That is fixed, and the same fix removes the wasted work for every other target too.

## 0.3.0

### Minor Changes

- 877dbdf: Data-table gains column (horizontal) windowing and content-driven auto-measure — the shared windowing engine's two remaining "what Rozie defers" bullets are closed. Combobox picks up the shared engine's new host-contract stubs as dead code, no behavior change. Command-palette republishes in lockstep, with one genuine bug fix on its Lit leaf. The compiler's inliner gets a small tree-shaking fix that this phase's own pure-helper extraction needed.

  **`data-table` — column windowing.** `virtual` widens from a Boolean to a value grammar: `false` (default, unchanged) | `true` / `'rows'` (unchanged from before — every existing consumer is untouched) | `'columns'` (new: horizontal windowing) | `'both'` (new: both axes). Under column windowing, pinned columns, the active cell's column, and a single in-progress edit's column always stay rendered regardless of scroll position; every header level (including grouped headers) windows on the same slice as the body with a clamped `colSpan`; the dedicated filter row windows the same way; and `focusCell` / `getActiveCell` / `activecell-change` all resolve against the absolute (unwindowed) column index, so off-window columns stay fully addressable through the handle. Fill-drag gets edge auto-scroll on all four container edges — this also closes a pre-existing gap on the row axis, where a fill drag previously could not reach unrendered rows past the top or bottom edge of a row-windowed table either.

  Two consumer-visible consequences: `virtual='columns'` (and `'both'`) moves the `<table>` inside an `rdt-scroll` `<div>` wrapper, the same wrapper row windowing already uses; and the windowed path applies `table-layout: fixed`, so columns stop auto-fitting their content — size them via `:columnSizing`, a `<Column size>` attribute, or the resize handle. `virtual={false}` and `virtual` unset remain byte-identical to before this change; `virtual={true}` / `'rows'` remains byte-behavior-identical to today's row-only windowing.

  The `.d.ts` for `virtual` widens from `boolean` to `boolean | string` on all six leaves — a typed-surface change existing consumers with strict TypeScript will see, even though the runtime default is unchanged.

  **`data-table` — `autoMeasure`.** A new, independent `autoMeasure: Boolean` prop (default `false`). When on, the windowing engine feeds `estimateSize()` a running mean of measured row heights instead of the fixed `estimateRowHeight` seed, so `getTotalSize()` (and the scrollbar it drives) converges toward the true content total on a large table with variable-height rows, instead of staying pinned at `rowCount x estimateRowHeight` forever. The re-feed is hysteresis-gated and anchor-preserving — the topmost rendered row's position holds steady while the estimate refines, so content does not visibly lurch. `estimateRowHeight` is unchanged and un-deprecated: it remains the required first-paint seed (the very first render has zero measurements regardless of `autoMeasure`), and remains the explicit, permanent override when `autoMeasure` is off.

  **`combobox` — engine only, no behavior change.** Gains the shared windowing engine's new required host-contract one-liners (`rowsWindowed()`, `autoMeasureOn()`) preserving today's exact semantics: `autoMeasureOn()` returns `false`, so `windowing.rzts`'s content-driven-estimate accumulator stays dead code here, exactly as before. (A gap-closure during review removed five _additional_ column-axis stub declarations — `colVirtualizer`, `colsWindowed()`, `columnCount()`, `columnSize()`, `forcedColumns()` — that an earlier draft of this same patch had also added under a mistaken premise about the compiler's tree-shaking requirements; they were genuinely dead code with zero callers, verified by tracing every function combobox imports from `windowing.rzts` back to its body. Their removal is folded into this same patch bump since neither of them has shipped to npm yet — see `87-16-SUMMARY.md`.) No new props, no behavior change, regenerated dist only. (Listbox's source gets the identical mechanical `rowsWindowed()`/`autoMeasureOn()` addition, but listbox has never been published — per standing policy this repo does not version or changelog packages that are not yet on npm, so listbox is not part of this changeset; its addition ships whenever listbox itself is first published.)

  **`@rozie/core` (and the rest of the toolchain fixed group) — two compiler-level fixes surfaced by this phase.** `@rozie/target-lit` (inlined into `@rozie/core` / `@rozie/cli` / `@rozie/unplugin` / `@rozie/babel-plugin` at build time) fixes a real bug in Lit's emitted output for any `[Boolean, String]` union prop: Lit's built-in `type: Boolean` attribute converter collapses any non-null static attribute value to `true`, silently discarding a string value. `emitNonModelProp()` now emits a custom `converter.fromAttribute` for this prop shape instead. This is the SAME fix that closes `command-palette-lit`'s `appendTo` bug above — one emitter fix, two visible symptoms. Separately, this phase's own `DataTable.rozie` pure-helper extraction (moving framework-agnostic logic into colocated `.ts` helpers) surfaced a real gap in `inlineScriptPartials()`'s tree-shaking: a script partial that only re-exports a name introduced by its own plain-module import (no local declaration body) was not recognized as a valid tree-shake target, silently dropping the backing import and producing a `TS2304` in the emitted leaves. Both are compiler-level fixes; no `.rozie`-author-visible API change.

  **`command-palette` — lockstep republish, with one genuine fix.** Five of its six leaves have a byte-identical emitted diff from this phase: command-palette composes the _published_ combobox package for its own target at compile time rather than the combobox source, so the shared engine change does not reach those five leaves' bytes at all — this patch keeps them in the same release wave as their combobox peer, per the release-mechanics decision that every published leaf should ride the same windowing engine generation. The Lit leaf is the one exception with a real emitted change: its `appendTo` property's Lit `@property({ type: Boolean })` converter previously discarded a string value (`appendTo="body"`, the documented example) by coercing it to `true` via Lit's default Boolean-attribute converter — the string was silently dropped. It now uses an explicit converter that preserves `true` / `false` / a string value correctly, matching the `[Boolean, String]` union type the prop has always declared.

### Patch Changes

- @rozie/runtime-svelte@0.7.2

## 0.2.5

### Patch Changes

- 287dbf2: All six `@rozie-ui/data-table-<target>` leaves widen their `@rozie-ui/popover-<target>` peer dependency from `^0.1.0` to `^0.1.0 || ^0.2.0`.

  **Why both, not just the new one.** Combobox moves its own popover peer to `^0.2.0` in this same wave. A caret range on a 0.x version pins the minor, so leaving data-table's range at `^0.1.0` would give any consumer installing both the combobox family and the data-table family two mutually exclusive ranges for the same `@rozie-ui/popover-<target>` package — an unsatisfiable peer pair. Forcing data-table forward to `^0.2.0` alone would avoid that conflict but strand existing data-table consumers on a popover upgrade they have no reason to take, since data-table does not use any of popover's five new props. Admitting both ranges is the option that resolves the conflict without an unnecessary forced upgrade.

  **Why it is safe to admit both.** Data-table composes a `<Popover>` at exactly two sites in source (`DataTable.rozie`), and both are byte-identical, binding only four props: `trigger="click"`, `placement="bottom-end"`, `strategy="fixed"`, `:offset="4"`. All four are present, unchanged, in both `0.1.x` and `0.2.0` — data-table binds none of popover's five new props (`bare`, `disablePositioning`, `keepMounted`, `matchWidth`, `disableDismiss`). The one behavioral change in this wave that touches existing consumers — `aria-haspopup`/`aria-expanded` gating on `hasGestureTrigger()` — only affects `trigger="manual"` popovers; data-table's `trigger="click"` stays on the gesture-trigger branch and sees no ARIA change in either version.

  **Scope of the change.** There is no runtime, API, or DOM change in `@rozie-ui/data-table-<target>` itself. The entire leaf diff is the one peer dependency range line per target, six lines total. This changeset is deliberately separate from the popover-promotion changeset covering combobox and popover: it is its own story about data-table's peer contract, not a restatement of theirs.
  - @rozie/runtime-svelte@0.7.1

## 0.2.4

### Patch Changes

- @rozie/runtime-svelte@0.7.0

## 0.2.3

### Patch Changes

- @rozie/runtime-svelte@0.6.0

## 0.2.2

### Patch Changes

- Stale-publish reconciliation. The published `0.2.1` tarball's `src/DataTable.svelte` predates a regeneration that landed on `main` without a version bump, so the registry kept serving the pre-regeneration bytes. This release republishes the current generated output — verified purely internal source-comment cleanup (documentation of the grouping/pinning/windowing internals); every non-comment line is byte-identical to the previously published version. No behavior change, no API surface change.
- @rozie/runtime-svelte@0.2.2 (unchanged — no runtime bump in this wave)

## 0.2.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0

## 0.2.0

### Minor Changes

- 1a2e30c: data-table composes `@rozie-ui/popover` via the published-package model (Option A) instead of vendoring its source.

  The header column `⋯` menu previously vendored the popover primitive's source into each data-table leaf. It now resolves the published `@rozie-ui/popover-<target>` package at compile time (via the schema-versioned manifest), and each data-table leaf declares `@rozie-ui/popover-<target>` (`^0.1.0`) as a required runtime **peerDependency**.

  **Consumer action:** install the matching popover leaf alongside data-table, e.g. `@rozie-ui/popover-react` for `@rozie-ui/data-table-react`. (`@floating-ui/dom` is no longer a direct data-table peer — it graduates to the popover leaf's own peer.)

  Also fixes `@rozie-ui/data-table-lit` `sideEffects` (was a css-only allowlist that left the `customElements.define(...)` registrations for `rozie-data-table` / `rozie-column` / `rozie-editor-*` / `rozie-filter-*` unprotected against production tree-shaking).

  **Release ordering:** `@rozie-ui/popover-<target>` must be published to npm before this release, since it is now a required peer of every data-table leaf.
