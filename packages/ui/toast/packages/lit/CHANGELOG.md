# @rozie-ui/toast-lit

## 0.2.2

### Patch Changes

- f19abdb: Regenerated with kebab-case attributes for multi-word props: a prop such as `idBase` is now observed as `id-base` (it was the lowercased `idbase`), matching the model props and what a Rozie consumer writes. **If you set one of these from raw HTML with the lowercased or camelCase name, switch to the kebab attribute** (or set the property). Single-word props are unchanged.
- Updated dependencies [a83d077]
  - @rozie/runtime-lit@0.8.0

## 0.2.1

### Patch Changes

- 64cebc6: The imperative handle's `show`/`dismiss`/`clear`/`patch`/`promise` methods now carry their real action/data-aware TypeScript signatures in every target's declaration output, instead of the untyped `(...args: any[]) => any` catch-all.

  `show()` and `patch()` were already functionally action/data-aware at runtime — both accept `{ message, type, duration, action: { label, onClick }, data }`, exactly as the README's Undo example documents — but none of the five methods carried an explicit TypeScript return-type annotation in the Rozie source, so every target's declaration emitter fell back to the untyped catch-all shape. A consumer typing `show({ actoin: {...} })` (typo) or misusing `patch()` got zero compile-time help.

  Purely a type-accuracy fix: no runtime behavior changed on any target.

## 0.2.0

### Minor Changes

- 4f2148d: A toast can now carry an action and pass-through data, from a dogfooding report: `show()`
  whitelisted `id`/`message`/`type`/`duration` and silently dropped everything else, so an "Undo"
  toast previously needed the `#toast` slot plus a side map from toast id to action.
  - `show({ action: { label, onClick } })` renders an action button in the default toast;
    clicking it calls `onClick({ id, data })` and dismisses with a new dismiss reason, `'action'`.
    An action with no `onClick` function is dropped — no dead button ships.
  - `show({ data })` carries any payload through untouched, available in the `#toast` slot's scope
    (`toast.data`), the `dismissed` payload, and the action callback.
  - `patch(id, { action, data })` can update both, so a promise-toast can gain its "Undo" action
    once it resolves.
  - The action button inherits the toast's own colour, matching every type variant. No new public
    theming token yet.

  Purely additive: `dismissed` can now also report reason `'action'`; existing consumers of
  `show()`/`patch()` are unaffected.

  **Theming — design-system bridges now yield to an ancestor's own tokens, and apply correctly on
  Lit.** Same fix as every other themed family in this release — see the `@rozie-ui/data-table`
  changeset in this release for the full description of the bridge-scoping defect and its fix.

  **Solid packaging.** `@rozie-ui/toast-solid` ships the same compiled-JS-by-default,
  JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
  — see the dedicated Solid packaging changeset for the full description. No API change.

### Patch Changes

- 4f2148d: Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/toast-lit`, this package's own.
- 4f2148d: Fixed two pre-release defects in the `action`/`data` API above before its first publish:
  - An action's `onClick` that threw an error used to leave its toast stuck forever (the
    dismiss never ran). `runAction` now dismisses with reason `'action'` in a `finally` block —
    the dismiss always happens, and the error itself still propagates (never silently
    swallowed).
  - The auto-dismiss timer now pauses on keyboard focus, not just pointer hover: tabbing to a
    toast's action (or close) button pauses it with the same exact-remainder precision as
    hover, so a keyboard user reading or acting on a toast never loses it to the timeout
    mid-interaction (WCAG 2.2.1). Hover-pause and focus-pause compose — leaving one does not
    resume the timer while the other is still active — and this is unconditional, not gated by
    `disablePauseOnHover`.
  - @rozie/runtime-lit@0.7.5

## 0.1.9

### Patch Changes

- b084200: Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

  `workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

  This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

  The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

  This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
  - @rozie/runtime-lit@0.7.4

## 0.1.8

### Patch Changes

- @rozie/runtime-lit@0.7.3

## 0.1.7

### Patch Changes

- @rozie/runtime-lit@0.7.2

## 0.1.6

### Patch Changes

- @rozie/runtime-lit@0.7.1

## 0.1.5

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

## 0.1.4

### Patch Changes

- @rozie/runtime-lit@0.6.0

## 0.1.3

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

## 0.1.2

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. `r-for` loop keys are no longer leaked as literal DOM attributes on emitted elements. No API surface change.

## 0.1.1

### Patch Changes

- c279a7e: Fix the `$attrs` auto-fallthrough skip-list to always exclude `data-rozie-ref` — a reserved compiler bookkeeping attribute, never a consumer prop. Previously a parent-assigned `ref=` on this component's own host tag could clobber the component's own internal `data-rozie-ref` markers via fallthrough re-application. No API change, no per-target behavior divergence.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.0

### Minor Changes

- a7bc443: Toast UX cluster — closes the four previously-deferred `@rozie-ui/toast` UX items in one wave:
  - **Precise remaining-time hover pause.** Hovering the stack now stores each timer's exact remainder instead of a full restart — a 1000ms toast hovered ~600ms in and released dismisses ~400ms later, not after a fresh 1000ms.
  - **The family's first event, `@dismissed { toast, reason }`.** Every dismissal (timer expiry, the close button, the `dismiss()` verb, or a swipe) routes through one funnel and fires `dismissed` exactly once, before a new CSS enter/exit animation lifecycle runs; `clear()` stays bulk and fires nothing.
  - **`patch(id, changes)` and `promise(p, { loading, success, error })`.** `patch` updates an existing toast in place (message/type/duration, with duration-key timer restart semantics). `promise` shows a `{ type: 'loading' }` spinner toast synchronously and flips it to success/error at settle — the timer starts at settle, and a toast dismissed while pending is never resurrected.
  - **Pointer swipe-to-dismiss**, on by default (`disableSwipe` opts out): direction auto-derived from `position`, a 45%-width/velocity threshold, rubber-band on the wrong direction, and spring-back below threshold.
  - **An opt-in `stacked` collapsed stack**: a sonner-style depth-driven grid overlay (newest on top, depth 3+ hidden) that expands to the normal flex column on hover or keyboard focus.
  - 6 new theming tokens (`--rozie-toast-enter-duration`, `--rozie-toast-exit-duration`, `--rozie-toast-stack-offset`, `--rozie-toast-stack-scale-step`, `--rozie-toast-spinner-size`, `--rozie-toast-spinner-color`) with preset mappings across the shadcn/Material/Bootstrap theme bridges.

  The public surface grows from 5 props / 0 events / 3-verb handle to 7 props / 1 event / 5-verb handle; the `toast` scoped slot and all five existing props are unchanged. No breaking changes.

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
