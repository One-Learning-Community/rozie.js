# @rozie/cli

## 0.5.1

### Patch Changes

- Solid emitter fix: `@event` handlers now correctly rewrite a destructured reactive-portal slot-scope parameter. A component consuming a slot scope shape like `#linkEditor="{ setLink, unsetLink, close }"` and wiring `@click="unsetLink()"` previously emitted a bare, un-rewritten `unsetLink` identifier on the Solid target — a runtime `ReferenceError`, since `unsetLink` is only in scope as a property of the slot-scope render-prop argument, not as a free variable. Every other Solid attribute-expression path (bindings, interpolations, spreads) already rewrote such a parameter to the scope accessor; event handlers were the one code path that did not.

  `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin` all bundle `@rozie/core`'s compiler and therefore carry this fix too, even though none of their own source changed.

- Updated dependencies
- Updated dependencies
  - @rozie/runtime-react@0.5.1
  - @rozie/runtime-vue@0.5.1
  - @rozie/runtime-svelte@0.5.1
  - @rozie/runtime-solid@0.5.1
  - @rozie/runtime-lit@0.5.1
  - @rozie/core@0.5.1

## 0.5.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  - @rozie/core@0.5.0
  - @rozie/runtime-lit@0.5.0
  - @rozie/runtime-react@0.5.0
  - @rozie/runtime-vue@0.5.0
  - @rozie/runtime-svelte@0.5.0
  - @rozie/runtime-solid@0.5.0

## 0.4.0

### Minor Changes

- `r-keynav`'s tabindex focus model no longer steals DOM focus or scrolls on a
  cold page load, or on any mount/re-appearance while focus sits on an
  unrelated element elsewhere on the page. Previously the first focus/scroll
  pass after mount (or a conditionally-rendered `r-if` root re-appearing)
  always ran unconditionally, which could yank keyboard focus into a
  just-mounted component even though the user was never interacting with it.

  The new rule is strict component containment: the guarded first/redundant
  pass only focuses and scrolls when DOM focus is already somewhere inside the
  owning component's rendered subtree (not merely "somewhere on the page").
  Arrow-key navigation and every other active-index change are completely
  unaffected — they still focus and scroll unconditionally, exactly as
  before.

  `@rozie/runtime-keynav-core` exports the shared containment predicate
  (`focusIsWithinScope` plus its `composedActiveElement`/`composedContains`/
  `documentHasRealFocus` building blocks) that every target implementation
  calls, so the semantics can never drift between React, Vue, Svelte, Solid,
  Lit, and Angular. React, Vue, Svelte, and Solid thread an additive, OPTIONAL
  runtime option — `getFocusScope` — through to the predicate; Lit derives its
  scope from `this.host` and Angular from an injected `ElementRef`, so neither
  needs the extra field. **Compatibility contract:** a previously-published
  leaf calling this runtime WITHOUT `getFocusScope` (i.e. not yet regenerated)
  degrades to the OLD document-scoped fallback rather than the old
  unconditional-focus behavior — never the reverse, and never a hard
  rejection.

  This release also folds in a drill-continuity fix: a component-internal
  transition that destroys the currently-focused element as part of the same
  render that resolves a sibling attachment's guarded pass (date-picker's
  months → days Escape exit is the concrete case) is treated as "still within
  scope" for a short, bounded window after the removal, so keyboard focus
  correctly lands back on the resolved item instead of falling to `<body>`.
  That window is chained across three animation frames rather than one,
  specifically so it survives a sibling consumer's own
  `requestAnimationFrame`-deferred value resolution (needed on React and
  Solid, whose effect/DOM-commit ordering can otherwise clear the window one
  frame too early — see `@rozie/runtime-keynav-core`'s `focusGuard.ts` module
  doc comment for the full mechanism).

  `@rozie/runtime-lit` additionally ships a previously-unreleased fix
  (`963233d1`): a multi-root `KeynavController` (multiple independent
  `r-keynav` groups sharing one shadow root, e.g. date-picker's day/months/
  years panels) no longer lets an inactive group's controller steal focus
  onto a different, currently-visible group's item at the same
  `data-rozie-keynav-item` index, and a group's root re-appearing with an
  unchanged active index is correctly re-focused instead of silently
  dropped.

  `@rozie/core`, `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`
  bump because the compiler's five target emitters (bundled into `@rozie/core`
  and, through it, into the other three toolchain packages) now emit the
  `getFocusScope` wiring — one minted ref per top-level template element for
  the four fragment targets, an injected `ElementRef` host reference for
  Angular — alongside every `r-keynav` root's opts object.

### Patch Changes

- Updated dependencies
  - @rozie/core@0.4.0
  - @rozie/runtime-react@0.4.0
  - @rozie/runtime-vue@0.4.0
  - @rozie/runtime-svelte@0.4.0
  - @rozie/runtime-solid@0.4.0
  - @rozie/runtime-lit@0.4.0

## 0.3.2

### Patch Changes

- Republish for `@rozie/core@0.3.2` — the React `$onMount` staleness seams and the React/Solid component-tag prop-delivery seams. `@rozie/cli` bundles `@rozie/core` and the private `@rozie/target-*` emitters, so a stale CLI ships stale emitters; there is no independent change of its own in this release.
- @rozie/core@0.3.2

## 0.3.1

### Patch Changes

- Compiles through `@rozie/core@0.3.1`: fixes the 0.3.0 slot-param-callable regression (script-function slot params — `toggle`, `retry`, `setFilter`, … — type callable again in the public `.d.ts`; `r-for` loop vars correctly stay `unknown`), narrows the Lit `key` strip to the binding form (a static `key="…"` renders again), Lit derived-`$watch` `Object.is` NaN parity with React, Lit `:class` nullish-drop parity with React/Vue, and the new `ROZ209` `$emit`-name charset validator. The target emitters are bundled into `@rozie/core` and inlined here, so every `rozie build`/`rozie dev` invocation emits the corrected output for every target.
- Updated dependencies
  - @rozie/core@0.3.1

## 0.3.0

### Minor Changes

- Compiles through `@rozie/core@0.3.0`: adds the `$memo(fn, keyFn)` primitive plus its `ROZ146` misuse diagnostic, the `ROZ147` Lit inherited-DOM-property validator, `ROZ144` retirement (array-form `:style` now uniformly supported), the `ROZ207`/`ROZ208` narrowing plus their per-target reactive/sigil lowering, Lit slot scope-param type synthesis, the Angular `?url` import rewrite for `new URL(lit, import.meta.url)`, boundary-comment/splice-seam dedups, and this series' 8 emitter seam fixes (react/solid emit-handler fallthrough, react `autocorrect` + solid `spellcheck` attribute mapping, lit nullish-attribute-drop + `r-for` key leak, react/lit derived-getter `$watch` dep correctness, react `.d.ts` unresolved slot-param typing, angular nullish-attribute-drop). The target emitters are bundled into `@rozie/core` and inlined here, so every `rozie build`/`rozie dev` invocation emits the corrected output for every target.
- Updated dependencies
  - @rozie/core@0.3.0
  - @rozie/runtime-lit@0.2.2
  - @rozie/runtime-react@0.2.2
  - @rozie/runtime-vue@0.2.1
  - @rozie/runtime-svelte@0.2.2
  - @rozie/runtime-solid@0.2.2

## 0.2.1

### Patch Changes

- c279a7e: Fix the `@rozie/target-lit` emitter's `$attrs` auto-fallthrough skip-list to always exclude the reserved `data-rozie-ref` attribute (compiler bookkeeping, never a consumer prop). Without this fix, a parent-assigned `ref=` on a compiled Lit component's own host tag could clobber that component's own internal `data-rozie-ref` markers via attribute fallthrough re-application. The Lit emitter is bundled into `@rozie/core` (and therefore inlined into `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`, all of which compile `.rozie` through core) — this patch corrects the emitted Lit output for every consumer compiling through any of those entry points.
- Updated dependencies [c279a7e]
- Updated dependencies [c279a7e]
  - @rozie/core@0.2.1
  - @rozie/runtime-lit@0.2.1
  - @rozie/runtime-react@0.2.1
  - @rozie/runtime-vue@0.2.1
  - @rozie/runtime-svelte@0.2.1
  - @rozie/runtime-solid@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/core@0.2.0
  - @rozie/runtime-svelte@0.2.0
  - @rozie/runtime-lit@0.2.0
  - @rozie/runtime-react@0.2.0
  - @rozie/runtime-vue@0.2.0
  - @rozie/runtime-solid@0.2.0
