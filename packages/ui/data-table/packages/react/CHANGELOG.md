# @rozie-ui/data-table-react

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

- @rozie/runtime-react@0.7.2

## 0.2.9

### Patch Changes

- 287dbf2: An emitter fix in the shared public `.d.ts` renderer closes a `TS2300` duplicate-identifier defect that shipped in the published `@rozie-ui/data-table-react` React leaf.

  **`@rozie/core`.** `src/codegen/renderPropsInterface.ts` — the framework-agnostic public `.d.ts` / `.d.rozie.ts` renderer shared by all six targets' `emitTypes.ts` — emitted one `render<Slot>` field (or `children`) per slot OCCURRENCE in `ir.slots` rather than one per DISTINCT slot name. A component that repeats the same named slot across several mutually-exclusive `r-if` render branches therefore minted a public `.d.ts` with duplicate identifiers — a hard TypeScript error, not a lint nit. Now deduped by name, first-occurrence-wins. Every per-target INLINE interface emitter already guarded this same defect class; only the shared public renderer did not.

  **`@rozie-ui/data-table-react`.** The published `0.2.8` tarball's `src/DataTable.d.ts` carried seven duplicated interface members — `renderCell`, `renderColHeader`, `renderDetail`, `renderEditor`, `renderFilter`, `renderSelectAll`, `renderSelectCell` — 14 `error TS2300: Duplicate identifier` occurrences within that file, reproducing the exact renderer defect above. Unpacking the published tarball narrows the blast radius: the duplication lives ONLY in the sidecar `src/DataTable.d.ts`; the package's actual `types` entry is `dist/index.d.mts`, which has one of each field and imports nothing but `react`, and the exports map exposes only `"."` (→ `dist`) and `"./themes/*"` (→ CSS) — `src/DataTable.d.ts` ships inside the tarball but is unreachable through the exports map and unreferenced by the type entry. This is therefore a real defect in the shipped sidecar declarations consumed by IDE and author-side tooling that reads `src/` directly, NOT a break in the ordinary consumer typecheck path (`import` resolution through `dist/index.d.mts` was never affected). This patch republishes the corrected declaration with no runtime or API change.

- 287dbf2: All six `@rozie-ui/data-table-<target>` leaves widen their `@rozie-ui/popover-<target>` peer dependency from `^0.1.0` to `^0.1.0 || ^0.2.0`.

  **Why both, not just the new one.** Combobox moves its own popover peer to `^0.2.0` in this same wave. A caret range on a 0.x version pins the minor, so leaving data-table's range at `^0.1.0` would give any consumer installing both the combobox family and the data-table family two mutually exclusive ranges for the same `@rozie-ui/popover-<target>` package — an unsatisfiable peer pair. Forcing data-table forward to `^0.2.0` alone would avoid that conflict but strand existing data-table consumers on a popover upgrade they have no reason to take, since data-table does not use any of popover's five new props. Admitting both ranges is the option that resolves the conflict without an unnecessary forced upgrade.

  **Why it is safe to admit both.** Data-table composes a `<Popover>` at exactly two sites in source (`DataTable.rozie`), and both are byte-identical, binding only four props: `trigger="click"`, `placement="bottom-end"`, `strategy="fixed"`, `:offset="4"`. All four are present, unchanged, in both `0.1.x` and `0.2.0` — data-table binds none of popover's five new props (`bare`, `disablePositioning`, `keepMounted`, `matchWidth`, `disableDismiss`). The one behavioral change in this wave that touches existing consumers — `aria-haspopup`/`aria-expanded` gating on `hasGestureTrigger()` — only affects `trigger="manual"` popovers; data-table's `trigger="click"` stays on the gesture-trigger branch and sees no ARIA change in either version.

  **Scope of the change.** There is no runtime, API, or DOM change in `@rozie-ui/data-table-<target>` itself. The entire leaf diff is the one peer dependency range line per target, six lines total. This changeset is deliberately separate from the popover-promotion changeset covering combobox and popover: it is its own story about data-table's peer contract, not a restatement of theirs.
  - @rozie/runtime-react@0.7.1

## 0.2.8

### Patch Changes

- 6274a5f: React's `useMemo` stabilization of an escaping top-level `const` was discovered by a
  ONE-LEVEL, NON-TRANSITIVE scan of `Listener.deps` / `LifecycleHook.setupDeps` — a
  `new X()` an effect reached only THROUGH a top-level helper (`buildState() ->
gutterCompartment.of(...)`) was invisible to that scan and never got `useMemo`, so React
  rebuilt it fresh every render. For an identity-keyed engine object (a CodeMirror6
  `Compartment`, a Map/WeakMap/Set used as cross-render scratch state) this silently no-ops
  any imperative API keyed on that instance's identity — CodeMirror's
  `scheduleReconfigure(compartment, ...)` against an `EditorState` that never saw the fresh
  Compartment being the corpus shape that surfaced this. All four turbo gates (build, test,
  dist-parity, typecheck) stayed green while the bug was live; only visual regression testing
  caught it.

  `computeEscapingNames` (`packages/targets/react/src/emit/computeEscapingNames.ts`) now runs
  a worklist-to-fixpoint over top-level helper bodies: a helper name reached by an
  effect/listener seed is walked (its body inspected for further references) but never itself
  promoted into the escaping set — only a non-function top-level `const` binder reached at any
  depth through that walk is added. This bound is deliberate: promoting a helper NAME into the
  escaping set would flip a hoisted `function` declaration back into a non-hoisted
  `useCallback` const, reopening the temporal-dead-zone class the emitter's plain-hoist branch
  exists to close, across 860+ shipped `function` declarations corpus-wide. The duplicated seed
  computation (previously maintained independently in two places in `emitScript.ts`) is now
  one shared computation, so the `useMemo`/`useCallback` wrap decision and the seam-3 staleness
  classification can never silently diverge.

  The CodeMirror unwind quick 260829-gbs had to revert (`5d48f9156`, because the two
  `code-mirror [react]` VR cells failed all retries under the pre-fix emitter) is re-landed:
  all six leaves regenerated from the fixed emitter, all ten CM6 `Compartment` instances now
  emit as `useMemo(() => new Compartment(), [])` on React, and the five non-React leaves are
  byte-identical to the original unwind (`61bf99340`) — the emitter fix itself is React-only.

  Four other shipped React leaves carried a const of this exact shape and changed wrap form as
  an expected consequence, each individually inspected (correct empty dep array on a
  non-reactive initializer, no reactive-read case regressed to `[]`, no `.current`-read freeze
  hazard, and zero helper `function` declarations flipped form anywhere in the corpus):
  `@rozie-ui/data-table-react` (`GRID_PAGE_STEP`, `DATA_WRITE_TOKEN_KEY`, `SELECT_COL_ID`,
  `EXPANDER_COL_ID`), `@rozie-ui/rete-react` (`RESIZE_MIN_FALLBACK`, `CONN_WARN_SETTLE_MS`,
  `HISTORY_CAP`, `ZOOM_STEP`), and `@rozie-ui/toast-react` (`EXIT_FAILSAFE_MS`). Every one is a
  bare literal initializer reading nothing, so `[]` is the correct and complete dep array.

  **Emitted-comment fidelity — two structural fixes.** The component-scope emission loop mixes
  statements emitted as hand-built STRINGS (four `tryWrap*` passes) with statements emitted
  through a per-statement `@babel/generator` call, each of the latter carrying its own
  printed-comment dedup set. Because Babel attaches a comment sitting BETWEEN two statements to
  BOTH neighbours at once, a shared comment printed TWICE (both neighbours rendered it) or ZERO
  times (neither did), depending purely on which pass claimed each side — and both failures
  were live in the shipped corpus simultaneously. No per-wrap rule can be right for both sides,
  so the decision moved to a block-wide printed-comment ledger keyed on comment object
  identity, which prints every comment exactly once in source order regardless of which pass
  claims either neighbour. This mirrors the single-dedup-set precedent `genBlockInner` and
  `genImportsBlock` already set for their own scopes.

  Separately, `hoistModuleLet` removed a hoisted `let`'s declaration from the component body
  and took the author's comment on that declaration with it. Those leading comments are now
  re-homed onto the nearest surviving neighbour before removal. This one was invisible from
  inside a single component: an inline host kept such a comment (its neighbour is one parse
  away and carries it as `trailingComments`) while the byte-identical `<script src>`
  partial-inlined host — whose spliced node comes from a DIFFERENT parse with no comments
  attached — lost it. `dist-parity`'s Phase 56-R8 / R11 partial-vs-inline byte-identity cells
  are what caught it.

  Net effect across the shipped React corpus: 2110 comment lines restored, 187 duplicate
  prints removed, and **zero** comments dropped and **zero** non-comment bytes changed —
  verified line-by-line against the pre-change corpus. Fifteen further React leaves are bumped
  here for that comment-fidelity restoration alone, with no code change:
  `@rozie-ui/captcha-react`, `chartjs-react`, `combobox-react`, `command-palette-react`,
  `cropper-react`, `date-picker-react`, `embla-react`, `flatpickr-react`, `otp-react`,
  `pdf-react`, `popover-react`, `sortable-list-react`, `tags-react`, `tiptap-react`, and
  `wavesurfer-react`.

  Nine more React leaves drifted the same comment-only way but are deliberately OMITTED from
  the front matter: `@rozie-ui/dialog-react`, `lexical-react`, `listbox-react`,
  `maplibre-react`, `number-field-react`, `pagination-react`, `resizable-react`,
  `slider-react` and `switch-react` are all in `.changeset/config.json`'s `ignore` list, and
  listing an ignored package alongside a non-ignored one makes `changeset status` fail
  outright — the exact breakage `8865e96df` repaired, not reintroduced here.

- 4a2de54: React dropped the author's leading comments on any top-level `const f = () => {…}`. The
  emitter rebuilds those as `function f() {…}` so the binding hoists (a real TDZ fix), but it
  returned the bare synthetic node — no source position and no comments attached — so
  `@babel/generator` printed the declaration and silently discarded everything documenting it.
  Measured against the shipped corpus, that was 683 of React's 899 lost comments; Solid, whose
  identically-named `tryHoistArrowToFunction` has always ended with `t.inherits(fn, stmt)`,
  lost none. React simply never got that line.

  Restoring it alone is only half the mechanism, and the half on its own is a regression. A
  comment authored between a hoisted module-`let` and the declaration below it survives on the
  inline path (one parse attaches the comment object to both neighbours, so the successor still
  carries it) but not across a `<script src>` partial boundary, where the spliced successor
  comes from a different parse with nothing attached. There the comment lives only on the
  removed `let`'s trailing side and dies with the statement — so the inline host printed a
  comment the partial-inlined host could not, and the two stopped being byte-identical.

  Quick task 260829-j18 re-homed a removed statement's LEADING comments onto a surviving
  neighbour but deliberately skipped the trailing side, on the reasoning that a removed
  statement's trailing comments are the same objects Babel attached as the next statement's
  leading comments, so that side already had an owner. That holds for an inline-authored
  `<script>` and fails at a splice boundary. `hoistModuleLet` now re-homes the trailing side
  too, onto the nearest following survivor, deduped by comment object IDENTITY — which is what
  keeps the inline case from double-printing, since there the object is already present on the
  successor.

  The two changes ship together and are asserted together: `dist-parity`'s multi-boundary
  "DataTable-shaped permanent guard" goes red with either half missing, and green with both.

  Across the 38 regenerated React leaves this restores **2655 comments, with zero comments
  dropped and zero non-comment bytes changed** — verified by parsing each file before and
  after, comparing the parser's own comment list as a multiset, and comparing
  `generate(ast, { comments: false })` on both sides, rather than by reading the diff. The
  dist-parity fixture rebless was verified the same way (55 comments restored, no code delta).

  One cosmetic wart, not fixed here: in `@rozie-ui/data-table-react` a single restored comment
  prints on the same line as the preceding function's closing brace (`} // …`) instead of
  starting its own line, because it is re-homed as the previous statement's trailing comment.
  The block still reads immediately above the declaration it documents and the AST is
  unaffected. Output prettiness stays a v2 concern.

  Nine further React leaves drifted the same comment-only way but are deliberately absent from
  the front matter — `@rozie-ui/dialog-react`, `lexical-react`, `listbox-react`,
  `maplibre-react`, `number-field-react`, `pagination-react`, `resizable-react`,
  `slider-react` and `switch-react` are all in `.changeset/config.json`'s `ignore` list, and
  listing an ignored package beside a non-ignored one makes `changeset status` fail outright.
  - @rozie/runtime-react@0.7.0

## 0.2.7

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.2.6

### Patch Changes

- Stale-publish reconciliation. The published `0.2.5` tarball predates commit `1b0e5254`'s value-position stale-closure fix and never carried it — `pnpm publish` silently skips an already-published version, so the registry has been serving the pre-fix bytes at `0.2.5` since 2026-08-06.
  - **Fix: the deferred indeterminate-checkbox sync ran against a stale closure.** `syncIndeterminate` was invoked twice per selection-change cycle — once synchronously through an already-fresh ref, and a second time deferred via `queueMicrotask`/`Promise.resolve().then()`, but that second call passed the raw mount-time function identity rather than the ref, so it kept re-running the closure captured when the table was first constructed instead of the current one. Both calls now route through the same fresh reference.
  - **Fix: the 12 table-core `onXChange` callbacks (sorting, filters, pagination, selection, column visibility/sizing/order/pinning, grouping, expansion) were bound by identity at the table's one-time construction.** A consumer whose `onSortingChange`/etc. prop identity changes after mount — for example an inline handler closing over updated local state — had every subsequent table-core callback keep dispatching to that first-render closure. Each callback is now ref-indirected, so table-core always calls through to the consumer's current handler.
  - No prop / event / slot / handle surface change.

- Updated dependencies
  - @rozie/runtime-react@0.5.1

## 0.2.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  This is the largest ripple in the wave — 19 synced refs across both shipped components:
  - **Prop reads** (`DataTable`) — `getSubRows`, `manual` and `virtual`. Switching to manual pagination/sorting, toggling virtualization, or supplying a new `getSubRows` after mount is now observed by the mount-registered table wiring.
  - **Helper calls** (`DataTable`, 14) — `clampActiveCell`, `currentData`, `currentState`, `effectiveColumnFilters`, `effectiveGlobalFilter`, `effectiveSorting`, `focusCellWhenReady`, `indexOfRowIn`, `isGrid`, `syncIndeterminate`, `tableColumns`, `virtualizerOptions`, `windowSource`, `writePagination`. The mount-time table/virtualizer wiring now reads live filter, sort, pagination and windowing state instead of the snapshot taken at mount.
  - **Helper calls** (`Column`, 2) — `buildSpec` and `colId`.

  In practice this is what makes a grid whose columns, filters or data source change after first paint keep its active-cell tracking, windowing and pagination writes consistent.

- `Column`'s mount effect no longer emits the `react-hooks/exhaustive-deps` suppression.
- No `$emit` handler prop was affected. No API surface change.
- @rozie/runtime-react@0.2.3

## 0.2.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1`. The public `.d.ts` no longer types `applyGrouping`/`clearGrouping` (on `renderGroupBar`), `toggle` (on `renderSelectAll`), or `setFilter` (on `renderFilter`) as `unknown` — all four resolve to top-level script functions and now type callable (`(...args: any[]) => any`), reversing the 0.3.0 regression that broke a strict-TS consumer calling `setFilter` per the documented API. No runtime behavior change; type surface only.

## 0.2.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The public `.d.ts` no longer types unresolved `r-for` slot-context params as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller. No API surface change.

## 0.2.2

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.2.1

### Patch Changes

- @rozie/runtime-react@0.2.0

## 0.2.0

### Minor Changes

- 1a2e30c: data-table composes `@rozie-ui/popover` via the published-package model (Option A) instead of vendoring its source.

  The header column `⋯` menu previously vendored the popover primitive's source into each data-table leaf. It now resolves the published `@rozie-ui/popover-<target>` package at compile time (via the schema-versioned manifest), and each data-table leaf declares `@rozie-ui/popover-<target>` (`^0.1.0`) as a required runtime **peerDependency**.

  **Consumer action:** install the matching popover leaf alongside data-table, e.g. `@rozie-ui/popover-react` for `@rozie-ui/data-table-react`. (`@floating-ui/dom` is no longer a direct data-table peer — it graduates to the popover leaf's own peer.)

  Also fixes `@rozie-ui/data-table-lit` `sideEffects` (was a css-only allowlist that left the `customElements.define(...)` registrations for `rozie-data-table` / `rozie-column` / `rozie-editor-*` / `rozie-filter-*` unprotected against production tree-shaking).

  **Release ordering:** `@rozie-ui/popover-<target>` must be published to npm before this release, since it is now a required peer of every data-table leaf.
