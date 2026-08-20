# @rozie-ui/otp-svelte

## 0.1.5

### Patch Changes

- @rozie/runtime-svelte@0.6.0

## 0.1.4

### Patch Changes

- The vendored `internal/otpWrite.ts` write model (IN-04) now early-returns `null` from `planWrite` at the degenerate `length: 0` boundary instead of computing `landed: -1` (a boundary violation of the documented `OtpWrite.landed` contract; unreachable through this component with a sane `length`, but this is an exported pure function with its own test suite). No observable runtime behavior change for a correctly-configured `Otp`; no API surface change.

## 0.1.3

### Patch Changes

- Regenerated from a fixed `Otp.rozie` source (no emitter change reaches Svelte in this wave). All input now routes through one clamped write model (`src/internal/otpWrite.ts`, vendored through codegen): SMS-autofill, swipe, and IME-commit multi-character input is distributed across cells instead of collapsing to the last character, and the fill point is clamped to the first empty cell so a write can no longer desync from the rendered value. Emit hygiene fixed: `change` fires only on an actual value transition, and `complete` fires only on the not-full → full transition (fixes a re-fire on an in-place edit of an already-full code, and the `length: 0` `clear()` edge). Added an `onPointerUp` re-select so a pointer-placed caret still overwrites the cell on mouse input.
- `autocorrect="off"` / `spellcheck="false"` are now emitted on the cell inputs — Svelte's attribute handling already accepted them correctly; this leaf ships them now that the source restores them (the prior wave had reverted them repo-wide pending the react/solid attribute-map fix, which does not affect Svelte).
- Docs corrections: the emit contract, the write model, the keyboard/paste/multi-character-input rows, and the accessibility section now describe the shipped behavior. The leaf README renders a prose line instead of a headerless empty Slots table.
- No API surface change: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle, unchanged.

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/otp` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  This release adds behavior-VR coverage (paste distribution, backspace navigation, arrow/Home/End movement, mask rendering, disabled state, filled-cell overwrite) as test-only hardening — no API change. The surface is unchanged: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle.

  The `@rozie/runtime-svelte` dependency now resolves to `0.2.2` (array-form `:style` merge).

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0
