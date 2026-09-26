# @rozie-ui/toast-solid

## 0.1.8

### Patch Changes

- b084200: Solid: slot scope values are now passed as lazy getters instead of eager reads.

  A scoped slot invocation used to build its param object as `{ open: open() }`. Because that object is constructed inside the JSX insert that invokes the slot, Solid subscribed the **insert itself** to every signal read while building it — so any change re-ran the insert, re-invoked the consumer's slot function, and replaced the rendered subtree. Emitting `{ get open() { return open(); } }` defers the read into the consumer's own reactive scope, which is Solid's own convention for passing reactive props.

  Observable fix: opening the data-table column menu no longer tears the just-focused trigger out of the DOM, so the documented "Escape returns focus to the trigger" guarantee now holds on Solid as it already did on the other five targets.

  Literals and function-valued expressions are deliberately left as plain properties — neither can read a signal, and wrapping a function would hand the consumer a new identity on every property access.

  Note for consumers: destructuring a slot scope (`({ option, index }) => …`) and spreading it behave exactly as before. The one behavior change is that **assigning** to a scope property now throws `TypeError: Cannot set property x of #<Object> which has only a getter`, where it previously succeeded silently. Writing to a slot scope was never a supported pattern.

  `@rozie/core` is named here even though no file under `packages/core/` changed: the emitter lives in the private `@rozie/target-solid` package, which is bundled into core's published dist (and into `unplugin`, `babel-plugin`, and `cli`). A changeset derived from changed paths alone would ship a toolchain that still emits the bug.
  - @rozie/runtime-solid@0.7.4

## 0.1.7

### Patch Changes

- @rozie/runtime-solid@0.7.3

## 0.1.6

### Patch Changes

- @rozie/runtime-solid@0.7.2

## 0.1.5

### Patch Changes

- @rozie/runtime-solid@0.7.1

## 0.1.4

### Patch Changes

- @rozie/runtime-solid@0.7.0

## 0.1.3

### Patch Changes

- @rozie/runtime-solid@0.6.0

## 0.1.2

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The `splitProps` skip-list now correctly excludes emit-handler props from the root DOM fallthrough spread — previously a consumer's handler fired twice per emit. No API surface change.

## 0.1.1

### Patch Changes

- @rozie/runtime-solid@0.2.1

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

- @rozie/runtime-solid@0.2.0
