# @rozie-ui/otp-angular

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
