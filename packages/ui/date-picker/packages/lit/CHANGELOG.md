# @rozie-ui/date-picker-lit

## 0.1.10

### Patch Changes

- @rozie/runtime-lit@0.7.2

## 0.1.9

### Patch Changes

- @rozie/runtime-lit@0.7.1

## 0.1.8

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

- Updated dependencies [dcc3336]
  - @rozie/runtime-lit@0.7.0

## 0.1.7

### Patch Changes

- @rozie/runtime-lit@0.6.0

## 0.1.6

### Patch Changes

- Fixed: the multi-word `$emit('rangeComplete', …)` event was dispatched in its
  raw camelCase source casing instead of being kebab-cased, so a consumer's
  kebab-cased `@range-complete` template listener never fired on the Lit
  target — `addEventListener` is case-sensitive, and the two names never
  matched. The dispatch side now kebab-cases the event name to match the
  listener, the same convention the two-way model event path (`<prop>-change`)
  already used.

  **This changes the DOM event name string a Lit consumer must pass to
  `addEventListener`.**

  | Old (broken, never fired) | New (correct)    |
  | ------------------------- | ---------------- |
  | `rangeComplete`           | `range-complete` |

  **This package's own README and the docs site previously stated, explicitly
  and in three places, that the Lit event name was "CASE-PRESERVED" —
  `addEventListener('rangeComplete', …)`. That documented contract is now
  superseded.** It was a deliberate-looking claim, but it described the same
  bug this changeset fixes: the dispatched name never matched what a
  kebab-cased Rozie-template listener binds. Anyone who followed that prior
  documentation and bound `rangeComplete` directly must switch to
  `range-complete`.

  `change` (single-word) is unaffected — kebab-casing a single lowercase word
  is a no-op.

## 0.1.5

### Patch Changes

- `@rozie/runtime-lit` gains a new public export, `RozieSlotDistributor` — a reactive
  controller that performs manual slot assignment for a Lit shadow root, used wherever a
  component needs to route projected children into loop-generated `<slot>` targets
  (e.g. carousel slides). Adopting manual `slotAssignment` turns OFF the browser's
  automatic Text-node projection for that shadow root: raw text children must now be
  assigned to a slot explicitly, and any code reading `assignedNodes()` needs to guard
  for the manual-assignment case. A host that adopts the controller needs its
  `shadowRootOptions` typed as `ShadowRootInit`.

  `@rozie/core` adds two new compile-time diagnostics and one new template sigil:
  - **ROZ148** — flags a prop whose name collides with an emitted callback name, before
    it becomes a runtime shadowing bug on a target that lowers the prop to a method.
  - **ROZ210** — flags a reserved slot name so it can't silently collide with an
    internally-generated one.
  - **`$slotted`** — a new member sigil authors can read inside a loop to get the live,
    reactively-assigned elements projected into that iteration's slot.

  `@rozie/{cli,unplugin,babel-plugin}` bundle `@rozie/core`'s compiler, so this release
  carries the same diagnostics and `$slotted` lowering through to every consumer of
  those packages — the compiler itself moved even though none of these three changed
  their own source. `$slotted` lowers to a reactive assigned-elements signal on the Lit
  target (backed by `RozieSlotDistributor`, gated behind a new `shouldDistributeSlots`
  check so it only emits where a loop actually needs manual slot assignment) and to a
  plain `[]` on the five hostless targets (React, Vue, Svelte, Solid, Angular), where
  there's no shadow root to distribute into.

  `@rozie/runtime-{react,vue,svelte,solid,keynav-core}` are version-aligned to 0.5.0 by
  the changesets `fixed` group riding the `runtime-lit` minor above — this is a
  version-alignment release only; none of these five packages has a source or behavior
  change in this wave.

  `@rozie-ui/date-picker-*` (all six targets) — day and caption labels are now derived
  from `Intl`, with a new `labels` prop for overriding them; range-span selections now
  validate against `disabled` dates; and the calendar header adds drill-in/drill-out
  navigation verbs.

  `@rozie-ui/embla-*` (all six targets) adopts `$slotted` for its carousel slides. On
  the Lit target specifically, this closes a real projection gap: raw `slot="slide"`
  children are now distributed per-iteration instead of only the first iteration
  claiming them.

  `@rozie-ui/{combobox,command-palette,data-table,sortable-list,tags,toast}-lit` are
  regenerated against the new Lit emitter output above — each already used a loop-slot
  pattern that now runs through `RozieSlotDistributor` / `$slotted` instead of the prior
  ad hoc approach, with no observable behavior change for existing consumers of these
  specific leaves.

- Updated dependencies
  - @rozie/runtime-lit@0.5.0

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/runtime-lit@0.4.0`, which folds in two fixes:
  - The `r-keynav` strict-containment focus guard — the day/months/years grids no longer steal DOM focus on a cold page load or while focus sits on an unrelated element elsewhere on the page; drilling into the months/years panels and exiting back out with Escape now reliably restores keyboard focus to the previously-selected day.
  - A previously-unreleased multi-root `KeynavController` fix: an inactive drill panel's controller no longer steals focus onto a different, currently-visible panel's item at the same index (the months panel was landing on January instead of the actually-selected month), and a panel re-appearing with an unchanged active index is now correctly re-focused instead of silently dropped.

  Arrow-key navigation and click selection are unaffected. No API surface change.

- @rozie/runtime-lit@0.4.0

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. `r-for` loop keys are no longer leaked as literal DOM attributes on emitted elements. No API surface change.

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/date-picker` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps.

  **Keyboard/accessibility hardening** (included in this first publish):
  - Disabled day cells are now focusable-but-inert per the ARIA grid pattern — the native `disabled` attribute moved off individual day buttons (kept only for whole-control `disabled`), with `aria-disabled="true"` carrying the state. Arrow keys traverse past disabled days instead of dead-ending, and Enter on one is a no-op. CSS hook changed from `.rozie-datepicker-day:disabled` to `[aria-disabled='true']` — identical declarations, pixel-identical output, but consumers who overrode the `:disabled` selector must update. **This is the only consumer-visible break in this release.**
  - Roving-tabindex fallback fixed — the grid always exposes exactly one day tab stop, falling back anchor-in-view → today-in-view → first-enabled, so tabbing into the calendar still works after the selected day scrolls out of view.
  - Drill focus continuity — entering/leaving the months and years views keeps keyboard focus inside the control instead of dropping to `<body>`.
  - Multi-month `Home`/`End` now resolve against the panel the focused day actually lives in (previously scanned month 0 only).

  Also includes documentation corrections (footer slot, range-mode `clear()`, 5 previously undocumented props, corrected React/Solid slot examples) — documentation only, no API change.

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
