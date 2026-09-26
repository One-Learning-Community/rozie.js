# @rozie-ui/toast-solid

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

- 4f2148d: Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/toast-solid`, this package's own.
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
  - @rozie/runtime-solid@0.7.5
- 4f2148d: **Fixed: a consumer `class` on `<Toaster>` no longer replaces the component's own
  `rozie-toaster` class.** The root toast region merges its `mouseenter`/`mouseleave` handlers with
  the consumer's own pass-through props (so a consumer-supplied native listener still fires
  alongside them, R6 all-fire); that merge previously carried the WHOLE pass-through props bucket —
  not just its listener keys — and re-applied the untouched `class` at the tail of the element's
  JSX attribute list, silently overwriting the value Toaster had already merged one attribute
  earlier. Verified: `<Toaster class="my-toaster" />` used to render `class="my-toaster"`; it now
  renders `class="rozie-toaster ... my-toaster"`. No API change.
- 4f2148d: **Fixed: published Solid leaves now ship compiled JavaScript for `import`/`require`, with JSX
  kept only under the `solid` export condition.**

  Every `@rozie-ui/*-solid` leaf with markup previously shipped Solid JSX inside
  `dist/index.{mjs,cjs}` under a plain `import`/`require` (`chartjs-solid` renders no markup of its
  own, but ships the same corrected export shape for consistency with its siblings). That is not
  valid JavaScript on its own — a default `vite-plugin-solid` setup
  fails with "JSX syntax is disabled" (the plugin only transforms `.[mc]?[jt]sx` files), and any
  bundler without a Solid plugin fails outright. The only way to consume these packages was to
  manually point `vite-plugin-solid` at the package's `.mjs` files inside `node_modules` — a
  workaround, not a supported shape.

  New export shape (the standard one for a published Solid library):
  - `import` / `require` → `dist/<entry>.{mjs,cjs}`, compiled to plain DOM output by
    `babel-preset-solid`. Any bundler consumes this with no Solid plugin at all.
  - `solid` (export condition) → `dist/source/<entry>.jsx`, JSX kept intact. `vite-plugin-solid`
    and SolidStart resolve this condition first and compile it themselves for their own mode (DOM /
    SSR / hydration).

  **If you were using the `extensions: ['.mjs']` / `node_modules` `include` workaround with
  `vite-plugin-solid` to consume one of these packages, remove it — it is no longer needed** and a
  default `vite-plugin-solid` setup now resolves the `solid` condition correctly on its own. No
  public API change on any of these leaves.

- Updated dependencies [4f2148d]
  - @rozie/runtime-solid@0.7.5

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
