# @rozie-ui/otp-angular

## 0.1.5

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

## 0.1.4

### Patch Changes

- The vendored `internal/otpWrite.ts` write model (IN-04) now early-returns `null` from `planWrite` at the degenerate `length: 0` boundary instead of computing `landed: -1` (a boundary violation of the documented `OtpWrite.landed` contract; unreachable through this component with a sane `length`, but this is an exported pure function with its own test suite). No observable runtime behavior change for a correctly-configured `Otp`; no API surface change.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. All input now routes through one clamped write model (`src/internal/otpWrite.ts`, vendored through codegen): SMS-autofill, swipe, and IME-commit multi-character input is distributed across cells instead of collapsing to the last character, and the fill point is clamped to the first empty cell so a write can no longer desync from the rendered value. Emit hygiene fixed: `change` fires only on an actual value transition, and `complete` fires only on the not-full → full transition (fixes a re-fire on an in-place edit of an already-full code, and the `length: 0` `clear()` edge). Added an `onPointerUp` re-select so a pointer-placed caret still overwrites the cell on mouse input.
- A nullable attribute binding no longer renders the literal string `null` through Angular's property-binding path.
- Docs corrections: the emit contract, the write model, the keyboard/paste/multi-character-input rows, and the accessibility section now describe the shipped behavior. The leaf README renders a prose line instead of a headerless empty Slots table.
- No API surface change: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle, unchanged. This leaf's only dependency remains `tslib`.

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/otp` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0` on-disk number was never published; it is a changesets ripple from `@rozie/runtime-*` bumps, not release history.

  This release adds behavior-VR coverage (paste distribution, backspace navigation, arrow/Home/End movement, mask rendering, disabled state, filled-cell overwrite) as test-only hardening — no API change. The surface is unchanged: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle.

  This leaf's only dependency is `tslib` — no `@rozie/runtime-*` dependency, so it is unaffected by the `@rozie/runtime-*` 0.2.2 bump landing in this same wave. `otp` is a pure-Rozie family (no third-party engine): framework peer only, no external engine peer.
