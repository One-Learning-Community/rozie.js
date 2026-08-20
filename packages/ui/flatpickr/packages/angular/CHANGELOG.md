# @rozie-ui/flatpickr-angular

## 0.1.3

### Patch Changes

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

## 0.1.2

### Patch Changes

- Stale-publish reconciliation. The published `0.1.1` tarball predates several regenerations that landed on `main` without a version bump, so the registry kept serving stale bytes; the package had never even shipped a `CHANGELOG.md` before this release. This release republishes the current generated output:
  - Adds the `:host(rozie-flatpickr) { display: contents; }` component style, so the host element no longer imposes its own box in the layout (consumers previously got an extra unstyled wrapping element).
  - Adds JSDoc across the component's props (0 blocks in the published tarball), so IDE tooltips/completion now describe each prop's semantics, runtime-vs-construction-time mutability, and defaults.
  - `LICENSE` copyright holder corrected from `Dan Krieger and Rozie.js contributors` to `One Learning Community LTD` (the repo's current holder — the worktree file was already correct; only the stale published tarball needed reconciling).
  - No prop/event/emit surface change.
