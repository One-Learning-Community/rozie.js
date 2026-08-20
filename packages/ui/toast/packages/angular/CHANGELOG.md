# @rozie-ui/toast-angular

## 0.1.2

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

- 78d5b5b: `@rozie/runtime-angular` now exports `createRozieAttrApplier` and
  `createRozieHostAttrsReader` alongside the existing `RozieSlot`,
  `rozieDisplay`, `rozieAttr`, and `rozieToken` exports. The Angular target
  used to inline a copy of the `r-bind`/`$attrs` spread attribute applier and
  host-attribute reader (~85 lines: three `WeakMap` prev-state caches, the
  class/style merge logic, and the host-attribute fold) as a private-field
  IIFE pair in _every_ emitted component that used `r-bind` spread or read
  `$attrs` — 158 tracked emitted files, of which 23 are shipped
  `@rozie-ui/*-angular` leaf sources across 21 leaves.

  The emitted component keeps performing both `inject(Renderer2)` /
  `inject(ElementRef)` calls itself, in the same class-field initializer
  position; it now passes the resolved instance into the runtime factory
  (`createRozieAttrApplier(inject(Renderer2))`) instead of resolving it
  internally. Neither factory ever calls `inject()` or names an Angular
  type — both accept a structural interface (`RozieAttrRenderer`,
  `RozieHostRef`) — so this package still never resolves an Angular DI token
  itself, and the peer-keyed cross-package instance-identity hazard
  (`71dff1d5`) is structurally unreachable rather than merely tested against.

  Merge semantics, applied DOM output, and evaluation order are unchanged: a
  wrapper's own static `class` survives a spread that also sets `class`; a
  dropped `class`/`style` key removes only the tokens/properties this applier
  previously applied; an applied style still lands with `!important` priority,
  winning the last-write race against Angular's own `[ngClass]`/`ɵɵstyleMap`
  re-apply.

  A component using neither `r-bind` spread nor `$attrs` carries no new
  reference to `@rozie/runtime-angular` — the import gate is keyed on whether
  the emitter actually pushed the corresponding field declaration, independent
  of the two Tier-1 gates (`rozieDisplay`/`rozieAttr`/`rozieToken`,
  `RozieSlot`).

- Updated dependencies [f3266db]
- Updated dependencies [78d5b5b]
- Updated dependencies [ae824bd]
  - @rozie/runtime-angular@0.6.0

## 0.1.1

### Patch Changes

- Stale-publish reconciliation. The published `0.1.0` tarball predates the `0.4.0`-cluster's stacked-offset regeneration and never carried it — `pnpm publish` silently skipped republishing at the time, so the registry has been serving a `Toaster` missing the `stacked` mode's per-toast depth offset since the feature's introduction. This release republishes the current generated output:
  - **Fix: `stacked` mode's collapsed depth offset now actually applies.** The template's per-toast style call was `toastStyle(t)` (single-arg) in the published tarball; the depth-driven `--rozie-toast-depth` custom property that the `stacked` CSS relies on to fan/collapse the grid overlay was never computed per-row, so a `stacked` toaster rendered every toast at depth 0 (all stacked flush, no depth cascade). It is now `toastStyle(t, ti)`, threading the row index through to `depth(ti)`.
  - `depth()` itself changed from an O(n) `findIndex` scan per toast (invoked once per rendered row, so O(n²) per render) to O(1) arithmetic off the `@for`-provided index (`let ti = $index`) — same observable depth values, no behavior change beyond the fix above.
  - The `swipeGesture` pointer-drag bookkeeping moves from a component signal (`swipeGesture = signal<any>(null)`) to a plain instance field, matching the hoisted-non-reactive-bookkeeping convention used elsewhere in the corpus (the value is never read from the template, only from the four `onToastPointer*` handlers) — an internal implementation detail with no observable behavior change.
  - No prop/event/emit surface change. The `stacked` prop and its opt-in behavior shipped as designed in the `0.1.0` minor; only the depth-offset computation was missing from what actually reached npm.

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
