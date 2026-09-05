---
"@rozie/core": patch
"@rozie-ui/data-table-react": minor
"@rozie-ui/data-table-vue": minor
"@rozie-ui/data-table-svelte": minor
"@rozie-ui/data-table-angular": minor
"@rozie-ui/data-table-solid": minor
"@rozie-ui/data-table-lit": minor
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-vue": patch
"@rozie-ui/combobox-svelte": patch
"@rozie-ui/combobox-angular": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/combobox-lit": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
---

Data-table gains column (horizontal) windowing and content-driven auto-measure — the shared windowing engine's two remaining "what Rozie defers" bullets are closed. Combobox picks up the shared engine's new host-contract stubs as dead code, no behavior change. Command-palette republishes in lockstep, with one genuine bug fix on its Lit leaf. The compiler's inliner gets a small tree-shaking fix that this phase's own pure-helper extraction needed.

**`data-table` — column windowing.** `virtual` widens from a Boolean to a value grammar: `false` (default, unchanged) | `true` / `'rows'` (unchanged from before — every existing consumer is untouched) | `'columns'` (new: horizontal windowing) | `'both'` (new: both axes). Under column windowing, pinned columns, the active cell's column, and a single in-progress edit's column always stay rendered regardless of scroll position; every header level (including grouped headers) windows on the same slice as the body with a clamped `colSpan`; the dedicated filter row windows the same way; and `focusCell` / `getActiveCell` / `activecell-change` all resolve against the absolute (unwindowed) column index, so off-window columns stay fully addressable through the handle. Fill-drag gets edge auto-scroll on all four container edges — this also closes a pre-existing gap on the row axis, where a fill drag previously could not reach unrendered rows past the top or bottom edge of a row-windowed table either.

Two consumer-visible consequences: `virtual='columns'` (and `'both'`) moves the `<table>` inside an `rdt-scroll` `<div>` wrapper, the same wrapper row windowing already uses; and the windowed path applies `table-layout: fixed`, so columns stop auto-fitting their content — size them via `:columnSizing`, a `<Column size>` attribute, or the resize handle. `virtual={false}` and `virtual` unset remain byte-identical to before this change; `virtual={true}` / `'rows'` remains byte-behavior-identical to today's row-only windowing.

The `.d.ts` for `virtual` widens from `boolean` to `boolean | string` on all six leaves — a typed-surface change existing consumers with strict TypeScript will see, even though the runtime default is unchanged.

**`data-table` — `autoMeasure`.** A new, independent `autoMeasure: Boolean` prop (default `false`). When on, the windowing engine feeds `estimateSize()` a running mean of measured row heights instead of the fixed `estimateRowHeight` seed, so `getTotalSize()` (and the scrollbar it drives) converges toward the true content total on a large table with variable-height rows, instead of staying pinned at `rowCount x estimateRowHeight` forever. The re-feed is hysteresis-gated and anchor-preserving — the topmost rendered row's position holds steady while the estimate refines, so content does not visibly lurch. `estimateRowHeight` is unchanged and un-deprecated: it remains the required first-paint seed (the very first render has zero measurements regardless of `autoMeasure`), and remains the explicit, permanent override when `autoMeasure` is off.

**`combobox` — engine only, no behavior change.** Gains the shared windowing engine's new required host-contract one-liners (`rowsWindowed()`, `autoMeasureOn()`) preserving today's exact semantics: `autoMeasureOn()` returns `false`, so `windowing.rzts`'s content-driven-estimate accumulator stays dead code here, exactly as before. (A gap-closure during review removed five *additional* column-axis stub declarations — `colVirtualizer`, `colsWindowed()`, `columnCount()`, `columnSize()`, `forcedColumns()` — that an earlier draft of this same patch had also added under a mistaken premise about the compiler's tree-shaking requirements; they were genuinely dead code with zero callers, verified by tracing every function combobox imports from `windowing.rzts` back to its body. Their removal is folded into this same patch bump since neither of them has shipped to npm yet — see `87-16-SUMMARY.md`.) No new props, no behavior change, regenerated dist only. (Listbox's source gets the identical mechanical `rowsWindowed()`/`autoMeasureOn()` addition, but listbox has never been published — per standing policy this repo does not version or changelog packages that are not yet on npm, so listbox is not part of this changeset; its addition ships whenever listbox itself is first published.)

**`@rozie/core` (and the rest of the toolchain fixed group) — two compiler-level fixes surfaced by this phase.** `@rozie/target-lit` (inlined into `@rozie/core` / `@rozie/cli` / `@rozie/unplugin` / `@rozie/babel-plugin` at build time) fixes a real bug in Lit's emitted output for any `[Boolean, String]` union prop: Lit's built-in `type: Boolean` attribute converter collapses any non-null static attribute value to `true`, silently discarding a string value. `emitNonModelProp()` now emits a custom `converter.fromAttribute` for this prop shape instead. This is the SAME fix that closes `command-palette-lit`'s `appendTo` bug above — one emitter fix, two visible symptoms. Separately, this phase's own `DataTable.rozie` pure-helper extraction (moving framework-agnostic logic into colocated `.ts` helpers) surfaced a real gap in `inlineScriptPartials()`'s tree-shaking: a script partial that only re-exports a name introduced by its own plain-module import (no local declaration body) was not recognized as a valid tree-shake target, silently dropping the backing import and producing a `TS2304` in the emitted leaves. Both are compiler-level fixes; no `.rozie`-author-visible API change.

**`command-palette` — lockstep republish, with one genuine fix.** Five of its six leaves have a byte-identical emitted diff from this phase: command-palette composes the *published* combobox package for its own target at compile time rather than the combobox source, so the shared engine change does not reach those five leaves' bytes at all — this patch keeps them in the same release wave as their combobox peer, per the release-mechanics decision that every published leaf should ride the same windowing engine generation. The Lit leaf is the one exception with a real emitted change: its `appendTo` property's Lit `@property({ type: Boolean })` converter previously discarded a string value (`appendTo="body"`, the documented example) by coercing it to `true` via Lit's default Boolean-attribute converter — the string was silently dropped. It now uses an explicit converter that preserves `true` / `false` / a string value correctly, matching the `[Boolean, String]` union type the prop has always declared.
