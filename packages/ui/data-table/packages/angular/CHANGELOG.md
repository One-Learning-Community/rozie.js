# @rozie-ui/data-table-angular

## 0.4.0

### Minor Changes

- 5ad5ef4: Adds a **per-column dynamic-name slot family** on each of data-table's four column-scoped slots — `cell`, `colHeader`, `filter`, and `editor`. Previously the only way to customize one column's rendering was the single catch-all `#cell` slot, branched by hand on the `columnId` scoped param; that branch does not compose, and the same story applied to `#colHeader`, `#filter`, and `#editor`. Now you can fill a specific column directly with an ordinary static named slot, e.g.:

  ```html
  <DataTable :columns="columns">
    <template #cell-price="{ row, value }">
      <span class="price">{{ formatCurrency(value) }}</span>
    </template>
  </DataTable>
  ```

  replacing `cell-price` with `colHeader-price`, `filter-price`, or `editor-price` for the other three seams. On React, Solid, Svelte, Lit, and Vue the slot key is template-literal-typed with the same scoped-parameter typing the generic slot already had (`{ row, value }` for `cell`, not an untyped `(...args) => ReactNode`). Angular's `templates()` intake stays `Record<string, TemplateRef<unknown>>`, type-erased per key — see `docs/parity.md` for that divergence.

  **Precedence is three-tier and structural, not a runtime presence check:** a family fill (`#cell-price`) wins over a generic fill (`#cell`), which wins over the built-in render. A column that only fills `#cell` behaves exactly as before for every other column; a column that fills neither renders the built-in cell.

  **Both `filter-<id>` and `editor-<id>` are gated the same way their generic siblings already were:** a `filter-<id>` fill only applies to a column with `filterable: true`, and an `editor-<id>` fill only applies to a column with `editor: 'custom'` — filling `#editor-status` on a column that isn't `editor: 'custom'` is a no-op, matching today's `#editor` behavior. `cell-<id>` and `colHeader-<id>` are ungated (every column is eligible), matching their generic siblings.

  **The built-in editor inputs now carry a `data-builtin-editor` marker attribute.** This is an internal implementation detail of the editor-owns-focus contract (the host needs to tell "this is my own editor" from "this is a consumer's drop-in editor" without a runtime slot-presence test) — it has no effect on a consumer's own markup or fills, and no prop or event surface changed.

  **Emitted markup is no longer byte-identical to 0.3.2 on any of the six targets**, even for a consumer who never touches a family slot: the filter seam's built-in `<input>` moved from a sibling gated by a presence check into a slot fallback, the editor chain now nests inside a fourth branch, and the built-in editors gained the marker attribute above. Behavior for an existing consumer is unchanged — this is a structural refactor of how the same three tiers (family / generic / built-in) are expressed, verified by the full data-table behavioral suite and a dedicated six-target focus-contract spec, not by comparing generated source. See the "Per-column slot families" section on the data-table columns docs page for the full precedence and gating reference.

  This release also folds in a separately-landed grouped-header width fix (`.changeset/data-table-grouped-header-width-fix.md`): under `table-layout: fixed`, a multi-level group header's `<th>` now correctly sums its spanned leaf columns' widths instead of reporting table-core's flat single-column default.

### Patch Changes

- c62c832: Fixes a grouped-header rendering defect: under `table-layout: fixed` (which every windowed/virtualized data-table already opts into), a multi-level group header's `<th>` reported table-core's flat single-column default size (150px) instead of the sum of its spanned leaf columns' sizes, so the browser divided that single declared width across every leaf column the group spans — a 5-column group rendered each leaf at 30px (150 / 5) instead of its real declared width. This was a pre-existing gap (tracked since Phase 87 as "Gap 1" in that phase's deferred-items ledger) that surfaced whenever a grouped-header table's rendered column window happened to include the grouped columns; it is now fixed at the source — the header-width chrome helper reads table-core's own `Header.getSize()` (which already sums descendant leaf-column sizes correctly for a group header, and is behavior-identical to the old code path for an ordinary leaf header) instead of the ungrouped `Column.getSize()` accessor. No prop or markup changes; any consumer using multi-level grouped headers will simply see the grouped columns render at their correct, intended width.

  Also hardens the fill-drag edge-auto-scroll gesture's cell hit-test (`fillDrag.rzts`, shared by the drag-select gesture too): the single-exact-pixel `elementFromPoint` probe used to resolve which cell sits under a stationary pointer while content auto-scrolls beneath it now falls back to a small nearest-cell horizontal search when the exact point misses, making the gesture robust against a narrow column transiting past the fixed probe point within a single animation frame. This is defense-in-depth alongside the width fix above (which was the actual root cause of the one observed user-facing symptom, a fill-drag range that failed to extend past a grouped-header column region during auto-scroll) — behavior is unchanged on every ordinary (non-edge-case) frame.
  - @rozie/runtime-angular@0.7.3

## 0.3.2

### Patch Changes

- Fix eight defects in grouped columns and grouped rows. All six targets.

  **Nested group leaf columns now resolve their own column definition.** A leaf declared inside a `columns:` group entry was never registered in the internal by-id lookup, so every definition-derived lookup fell back: the `<th>` rendered the raw column id instead of the declared `header`, the column could never be filterable or editable whatever its config said, and the clipboard/fill accessor fell back to the column id instead of the configured `field` — writing to the wrong key. Nested leaves now behave identically to top-level leaves.

  **A group-header row no longer receives an unrelated record in scoped slots.** The table engine builds each group-header row from its first leaf's record, which the `#cell`, `#selectCell` and `#editor` slots passed straight through as `row` — so a template reading `{{ row.someField }}` painted the first leaf's value on the group line. These slots now receive a group descriptor on group-header rows:

  ```js
  {
    isGroupRow: (true, groupId, groupingColumnId, groupingValue, leafCount);
  }
  ```

  Ordinary rows are unchanged and still receive their record. If your template reads record fields off `row`, guard with `row.isGroupRow` — the previous value on those rows was another row's data, never this one's.

  **Group-header rows are no longer editable, and bulk writes skip them.** Enter, F2, Space, a printable key, or a click on an editable non-grouping column would open an editor on a group-header row, and committing wrote to the first leaf's record. Paste, cut, clear and fill-drag wrote through the same path. Group rows are now guarded at every edit and write entry point; Enter on a group row toggles the group, as it already did for the grouping column. Copy is unaffected — it still serializes the displayed aggregate.

  **The group member count now counts records, not nodes.** Under multi-level grouping the count included intermediate sub-group nodes, so a region with 2 sub-groups and 3 records displayed `(5)`. It now displays `(3)`. Single-level grouping is unchanged.

  **`groupableColumns` (the `#groupBar` slot prop) now offers the right set.** Group columns are no longer offered — a group entry has no accessor and cannot be a grouping key. Groupable leaves nested under a group header are now offered, in declaration order; they were previously omitted entirely. Opt a leaf out with `groupable: false` as before.

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

- @rozie/runtime-angular@0.7.2

## 0.2.4

### Patch Changes

- 287dbf2: All six `@rozie-ui/data-table-<target>` leaves widen their `@rozie-ui/popover-<target>` peer dependency from `^0.1.0` to `^0.1.0 || ^0.2.0`.

  **Why both, not just the new one.** Combobox moves its own popover peer to `^0.2.0` in this same wave. A caret range on a 0.x version pins the minor, so leaving data-table's range at `^0.1.0` would give any consumer installing both the combobox family and the data-table family two mutually exclusive ranges for the same `@rozie-ui/popover-<target>` package — an unsatisfiable peer pair. Forcing data-table forward to `^0.2.0` alone would avoid that conflict but strand existing data-table consumers on a popover upgrade they have no reason to take, since data-table does not use any of popover's five new props. Admitting both ranges is the option that resolves the conflict without an unnecessary forced upgrade.

  **Why it is safe to admit both.** Data-table composes a `<Popover>` at exactly two sites in source (`DataTable.rozie`), and both are byte-identical, binding only four props: `trigger="click"`, `placement="bottom-end"`, `strategy="fixed"`, `:offset="4"`. All four are present, unchanged, in both `0.1.x` and `0.2.0` — data-table binds none of popover's five new props (`bare`, `disablePositioning`, `keepMounted`, `matchWidth`, `disableDismiss`). The one behavioral change in this wave that touches existing consumers — `aria-haspopup`/`aria-expanded` gating on `hasGestureTrigger()` — only affects `trigger="manual"` popovers; data-table's `trigger="click"` stays on the gesture-trigger branch and sees no ARIA change in either version.

  **Scope of the change.** There is no runtime, API, or DOM change in `@rozie-ui/data-table-<target>` itself. The entire leaf diff is the one peer dependency range line per target, six lines total. This changeset is deliberately separate from the popover-promotion changeset covering combobox and popover: it is its own story about data-table's peer contract, not a restatement of theirs.
  - @rozie/runtime-angular@0.7.1

## 0.2.3

### Patch Changes

- 6943820: Lit and Angular dropped every leading comment on a top-level declaration promoted into
  the component class — 1370 apiece across the shipped corpus. Both emitters build each
  class member as a hand-built string (`generate(decl)` / `renderExpression` / a rebuilt
  arrow or `t.classMethod`), and none of those carries the STATEMENT's own comments, so an
  author's documentation simply vanished from the emitted component.

  Both now run a printed-comment ledger keyed on comment OBJECT IDENTITY. Identity rather
  than source offsets is load-bearing: a `.rzts` script partial is parsed as its own file,
  so its comment offsets collide with unrelated host comments. A per-branch rule cannot
  work here at all, because @babel/parser attaches a comment sitting BETWEEN two statements
  to BOTH neighbours at once — whichever side a local rule picks, the other side either
  double-prints it or drops it.

  Three properties this needed, each found by measuring the corpus rather than by reading
  code:

  **It looks back, not just down.** Each statement claims the PREVIOUS statement's
  still-unclaimed trailing comments as well as its own leading ones, rendering both above
  its member. Inline, one parse hands the same comment object to both sides, so it prints
  once. Across a `.rzts` splice boundary the successor comes from a different parse with
  nothing attached, and the previous statement's trailing side is the only place the
  comment exists. Without this the inline host printed a comment the partial-inlined host
  could not, and the partial-vs-inline byte-identity guards went red.

  **The ledger spans the import block.** A comment between the last import and the first
  promoted declaration is printed by the module-scope import generation — a separate
  printer with its own dedup set. Unseeded, 132 comments printed twice on Lit and 155 on
  Angular. Seeding from every comment merely ATTACHED to an import node over-corrected and
  lost 16, since a comment can hang off a node the block never prints; the seed is taken
  from what the block actually emitted.

  **It unclaims.** A statement can be consumed by another pass — a `$computed`, a lifecycle
  hook, a `$provide` directive — and produce no class member at all. When the flush finds
  no target it releases the claim so whichever printer does emit that statement still
  renders its comments. Claiming without emitting is how a ledger silently drops comments,
  which is strictly worse than double-printing, and this is why both targets report zero
  lost despite several statement kinds never reaching a ledger-owned array.

  Net effect: 5311 comments restored across 53 Lit leaves and 5266 across the Angular
  leaves, with ZERO comments dropped and ZERO non-comment bytes changed, plus 16
  pre-existing double-prints fixed on each target (a comment that had been emitted both at
  module scope and again inside the mount hook). Verified by parsing every file before and
  after, comparing the parser's own comment list as a multiset, and comparing
  `generate(ast, { comments: false })` on both sides — never by reading the diff.

  Emitted code is unchanged in every case; this is documentation fidelity only.

  Eighteen further Lit/Angular leaves drifted the same comment-only way but are
  deliberately absent from the front matter — dialog, lexical, listbox, maplibre,
  number-field, pagination, resizable, slider and switch (both targets) are all in
  `.changeset/config.json`'s `ignore` list, and listing an ignored package beside a
  non-ignored one makes `changeset status` fail outright.
  - @rozie/runtime-angular@0.7.0

## 0.2.2

### Patch Changes

- f3266db: `@rozie/runtime-angular` now exports `rozieDisplay`, `rozieAttr`, and `rozieToken`
  alongside the existing `RozieSlot` marker directive. The Angular target used to
  inline a copy of these three helpers (and, for `rozieToken`, its
  `globalThis`-backed cross-package registry) as module-scope declarations in
  _every_ emitted component that wrapped an interpolation or used the
  `$provide`/`$inject` context primitive — duplicating the same ~40 lines across 21
  `@rozie-ui/*-angular` leaves. The emitter now imports the helpers from
  `@rozie/runtime-angular` instead.

  Behavior is unchanged: the delegating `rozieDisplay`/`rozieAttr` class methods
  Angular templates call are untouched, `rozieToken`'s `globalThis`-backed identity
  guarantee is preserved verbatim, and a component using none of the three continues
  to carry no reference to `@rozie/runtime-angular` at all. `number-field` and `otp`
  (previously the only two Angular leaves with no existing `@rozie/runtime-angular`
  dependency) now declare it in both `package.json` and `ng-package.json`'s
  `allowedNonPeerDependencies`.

- Updated dependencies [f3266db]
- Updated dependencies [78d5b5b]
- Updated dependencies [ae824bd]
  - @rozie/runtime-angular@0.6.0

## 0.2.1

### Patch Changes

- Stale-publish reconciliation. The published `0.2.0` tarball predates a regeneration that landed on `main` without a version bump, so the registry kept serving stale bytes across 11 files (`Column.ts`, `DataTable.ts`, the five `Editor*.ts` cell editors, the three `Filter*.ts` filter controls, and `GroupBar.ts`). This release republishes the current generated output. The drift is one mechanical, repo-wide theme, not 11 separate changes: every `Function`-typed input (`aggregationFn`, `validate`, `getSubRows`, each editor's `commit`/`cancel`, each filter's `setFilter`, `applyGrouping`/`clearGrouping`) is now widened from `(...args: unknown[]) => unknown` to `(...args: any[]) => any` — the Angular half of the emitter's function-prop type-lowering fix. The published `unknown`-typed signature rejected a consumer's own typed callback at the call site (`TS2345`, since `unknown` params/return are not assignable from/to a concrete function type); `any` accepts it. No runtime behavior change — these are compile-time-only input type annotations.

## 0.2.0

### Minor Changes

- 1a2e30c: data-table composes `@rozie-ui/popover` via the published-package model (Option A) instead of vendoring its source.

  The header column `⋯` menu previously vendored the popover primitive's source into each data-table leaf. It now resolves the published `@rozie-ui/popover-<target>` package at compile time (via the schema-versioned manifest), and each data-table leaf declares `@rozie-ui/popover-<target>` (`^0.1.0`) as a required runtime **peerDependency**.

  **Consumer action:** install the matching popover leaf alongside data-table, e.g. `@rozie-ui/popover-react` for `@rozie-ui/data-table-react`. (`@floating-ui/dom` is no longer a direct data-table peer — it graduates to the popover leaf's own peer.)

  Also fixes `@rozie-ui/data-table-lit` `sideEffects` (was a css-only allowlist that left the `customElements.define(...)` registrations for `rozie-data-table` / `rozie-column` / `rozie-editor-*` / `rozie-filter-*` unprotected against production tree-shaking).

  **Release ordering:** `@rozie-ui/popover-<target>` must be published to npm before this release, since it is now a required peer of every data-table leaf.
