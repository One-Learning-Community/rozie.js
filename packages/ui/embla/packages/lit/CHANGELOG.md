# @rozie-ui/embla-lit

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

- Fixed: the multi-word `$emit('reInit', …)` event was dispatched in its raw
  camelCase source casing instead of being kebab-cased, so a consumer's
  kebab-cased template listener never fired on the Lit target —
  `addEventListener` is case-sensitive, and the two names never matched. The
  dispatch side now kebab-cases the event name to match the listener, the same
  convention the two-way model event path (`<prop>-change`) already used.

  **This changes the DOM event name string a Lit consumer must pass to
  `addEventListener`.** If you discovered the camelCase name empirically — the
  only form that worked before this fix — you must update your listener name:

  | Old (broken, never fired) | New (correct) |
  | ------------------------- | ------------- |
  | `reInit`                  | `re-init`     |

  **Note the exact result:** `reInit` kebab-cases to `re-init`, **not**
  `reinit` — the adjacent-capital-free run `Init` still gets a hyphen inserted
  before it because it follows a lowercase letter (`re` + `Init`), matching the
  same algorithm the compiler uses everywhere else. This is the one name in
  this release wave nobody would guess correctly from the source spelling
  alone.

  `pointer-down` (already kebab in source) and `select`/`settle` (single-word)
  are unaffected.

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

- Regenerated against `@rozie/core@0.3.1`. The `.length` derived `$watch` now compares with `Object.is` instead of strict `!==` (IN-02) — a NaN-valued derived getter (not reachable through this component's own `slides.length` shape today, but a real emitter parity fix) no longer re-fires the reInit/thumb-sync callback on every cycle the base `slides` property's setter ran; this matches React's existing `Object.is` dep-array comparison. The `startIndex` prop's JSDoc now correctly says "Init-only" instead of the stale "Runtime-updatable" (WR-01). No observable runtime behavior change for this component's actual usage (its watched value is never NaN); no API surface change.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The selected index now survives `reInit`: `startIndex` is stripped from every reInit payload after the raw `options` spread, so a runtime option flip (e.g. toggling `loop`) no longer teleports the carousel back to `startIndex`. **Deliberate behavior change to a published verb:** no-arg `reInitCarousel()` now preserves position instead of resetting to `startIndex` — documented in `embla.md`. Scheduled mount work (two `requestAnimationFrame` handles + a macrotask) is now cancelled on teardown, and both engines are nulled after `destroy()`, so all 14 `$expose` verbs fall through their guards after unmount. A runtime `thumbnails` toggle now actually builds the thumb engine (deferred/idempotent double-schedule).
- The derived-getter `$watch` on `.length` now fires on value change instead of base-property identity — it previously gated on `changedProperties.has('slides')`, which could miss a length change that didn't also change array identity.
- `r-for` loop keys are no longer leaked as literal DOM attributes on the emitted slide elements.
- Docs truth pass: the runtime-updatable contract (17 of 20 props; `startIndex`/`plugins`/`options` marked construction-only, with reasons), the five previously-missing handle verbs (`scrollProgress`/`slidesInView`/`slidesNotInView`/`previousScrollSnap`/`getPlugins`), and a filled Events table. The docs' Slots section carries a still-open Lit-specific caveat: filling the `slide` scoped slot via native `slot="slide"` light-DOM children does not distribute per-iteration (the browser assigns all matching children to the first same-named `<slot>` in tree order) — use the documented property-function API (`el.slide = ({ slide, index }) => html\`…\`;`) instead. Tracked as an open architecture gap, not fixed in this release.
- No API surface change.
- Updated dependencies
  - @rozie/runtime-lit@0.2.2

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/embla` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  `embla-carousel ^8.6` and `embla-carousel-autoplay ^8.6` are `peerDependencies` — the consumer installs them; nothing is bundled. There is no engine CSS to import: the carousel skeleton ships scoped and tokenised inside the component.

  The `@rozie/runtime-lit` dependency now resolves to `0.2.2` (array-form `:style` merge).

  Two built-in navigation fixes are now VR-locked in this release: Embla's `slides` option is pinned to `.rozie-embla__slide` (Lit's trailing declarative-mode `<slot/>` used to be counted as a phantom slide, collapsing `scrollSnapList()` to one snap), and `selectThumb` no longer calls the Embla-8-removed `clickAllowed()`.

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
