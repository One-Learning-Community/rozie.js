# @rozie-ui/toast-svelte

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

- 4f2148d: Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/toast-svelte`, this package's own.
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
  - @rozie/runtime-svelte@0.7.5

## 0.1.3

### Patch Changes

- @rozie/runtime-svelte@0.7.0

## 0.1.2

### Patch Changes

- @rozie/runtime-svelte@0.6.0

## 0.1.1

### Patch Changes

- Stale-publish reconciliation. The published `0.1.0` tarball predates the `0.4.0`-cluster's stacked-offset regeneration and never carried it — `pnpm publish` silently skipped republishing at the time, so the registry has been serving a `Toaster` missing the `stacked` mode's per-toast depth offset since the feature's introduction. This release republishes the current generated output:
  - **Fix: `stacked` mode's collapsed depth offset now actually applies.** The template's `{#each}` was `{#each toasts as t (t.id)}` with `toastStyle(t)` (single-arg) in the published tarball; the depth-driven `--rozie-toast-depth` custom property that the `stacked` CSS relies on to fan/collapse the grid overlay was never computed per-row, so a `stacked` toaster rendered every toast at depth 0 (all stacked flush, no depth cascade). It is now `{#each toasts as t, ti (t.id)}` with `toastStyle(t, ti)`, threading the row index through to `depth(ti)`.
  - `depth()` itself changed from an O(n) `.findIndex()` scan per toast (invoked once per rendered row, so O(n²) per render) to O(1) arithmetic off the `{#each}`-provided index — same observable depth values, no behavior change beyond the fix above.
  - The `swipeGesture` pointer-drag bookkeeping moves from `$state(null)` to a plain module-scope `let`, matching the hoisted-non-reactive-bookkeeping convention used elsewhere in the corpus (the value is never read from the template, only from the four `onToastPointer*` handlers) — an internal implementation detail with no observable behavior change.
  - No prop/event/emit surface change. The `stacked` prop and its opt-in behavior shipped as designed in the `0.1.0` minor; only the depth-offset computation was missing from what actually reached npm.
- @rozie/runtime-svelte@0.2.2 (unchanged — no runtime bump in this wave)

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
  - @rozie/runtime-svelte@0.2.0
