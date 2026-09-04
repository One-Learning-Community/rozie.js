# @rozie-ui/data-table-angular

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
