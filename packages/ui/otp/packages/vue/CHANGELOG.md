# @rozie-ui/otp-vue

## 0.1.7

### Patch Changes

- 4f2148d: Packaging fixes bundled with this release:
  - the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/otp-vue`, this package's own.
  - this package declared `"sideEffects": false` while still shipping `themes/*.css` — a bundler was technically permitted to tree-shake those files away even on a direct `import '@rozie-ui/otp-vue/themes/<name>.css'`. `sideEffects` is now `["*.css", "**/*.css"]`, matching the React leaf.
- 4f2148d: Design-system bridges now yield to a token set on any ancestor, and apply correctly on Lit.

  Each family's `bootstrap`/`material`/`shadcn` theme bridge previously assigned the tokens it
  maps directly on the component's own class. In CSS, a value an element declares for itself
  always beats one it would inherit — so with a bridge imported, a public
  `--rozie-<family>-*` token set on an ancestor (`:root`, `.dark`, a themed wrapper) had no effect;
  only setting it on the component element itself worked. On Lit specifically, where the
  component's class lives inside a shadow root that a document-level bridge selector can never
  match, every bridge was completely inert.

  Every read site that base.css gives a default, or a bridge maps, is now public-token-first, then
  a private wiring name, then the inline default — e.g.
  `var(--rozie-switch-on-bg, var(--rsw-on-bg, #0066cc))` — so a value set on any ancestor always
  wins over a bridge's own mapping, and a public accent set on an ancestor now also recolours the
  bridge-mapped tokens that default to it (ring colour, check colour, etc). Each bridge now
  redeclares only the wiring for the tokens it maps, with the design system's own variable as the
  fallback, resolved on the component itself — so it follows the nearest theme scope rather than
  only ever reading `:root`, and a Lit host in the document's light DOM is matched directly by its
  tag. Zero-import rendering is unchanged in every case: with nothing imported, every chain still
  resolves to the same built-in default it always has.

  **Behaviour changes a consumer can see:** with a bridge imported, a `--rozie-<family>-*` token
  set on any ancestor now wins over the bridge's mapping (previously it only won when set directly
  on the component element). On Lit, the bridges now actually apply (previously inert); a Lit
  component nested inside another shadow root reads the design system's variables at the document
  root.

  **`@rozie-ui/rete`** additionally fixes its dark palette specifically: `FlowCanvas`'s
  OS-dark palette was declared directly on the canvas element (competing with base.css's own
  `.dark`/OS-dark declarations on the same element), so any ancestor override of a
  `--rozie-flow-*` token was dead in OS-dark mode even with nothing else imported. The palette now
  lives at the document root at zero specificity, so an ancestor override reaches it in every mode.

  No component source behaviour changes beyond the CSS cascade described above; this is a pure
  theming/cascade fix in every family listed.
  - @rozie/runtime-vue@0.7.5

## 0.1.6

### Patch Changes

- @rozie/runtime-vue@0.7.0

## 0.1.5

### Patch Changes

- @rozie/runtime-vue@0.6.0

## 0.1.4

### Patch Changes

- The vendored `internal/otpWrite.ts` write model (IN-04) now early-returns `null` from `planWrite` at the degenerate `length: 0` boundary instead of computing `landed: -1` (a boundary violation of the documented `OtpWrite.landed` contract; unreachable through this component with a sane `length`, but this is an exported pure function with its own test suite). No observable runtime behavior change for a correctly-configured `Otp`; no API surface change.

## 0.1.3

### Patch Changes

- Regenerated from a fixed `Otp.rozie` source (no emitter change reaches Vue in this wave). All input now routes through one clamped write model (`src/internal/otpWrite.ts`, vendored through codegen): SMS-autofill, swipe, and IME-commit multi-character input is distributed across cells instead of collapsing to the last character, and the fill point is clamped to the first empty cell so a write can no longer desync from the rendered value. Emit hygiene fixed: `change` fires only on an actual value transition, and `complete` fires only on the not-full → full transition (fixes a re-fire on an in-place edit of an already-full code, and the `length: 0` `clear()` edge). Added an `onPointerUp` re-select so a pointer-placed caret still overwrites the cell on mouse input.
- `autocorrect="off"` / `spellcheck="false"` are now emitted on the cell inputs — Vue's attribute handling already accepted them correctly; this leaf ships them now that the source restores them (the prior wave had reverted them repo-wide pending the react/solid attribute-map fix, which does not affect Vue).
- Docs corrections: the emit contract, the write model, the keyboard/paste/multi-character-input rows, and the accessibility section now describe the shipped behavior. The leaf README renders a prose line instead of a headerless empty Slots table.
- No API surface change: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle, unchanged. `@rozie/runtime-vue` stays at `0.2.1` (unchanged; not part of this wave's runtime set).

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/otp` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  This release adds behavior-VR coverage (paste distribution, backspace navigation, arrow/Home/End movement, mask rendering, disabled state, filled-cell overwrite) as test-only hardening — no API change. The surface is unchanged: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle.

  Unlike the `-react` / `-solid` / `-lit` / `-svelte` leaves in this same wave, `otp-vue`'s `@rozie/runtime-vue` dependency stays at `0.2.1` (unchanged) — `runtime-vue` was not part of this wave's runtime bump (content-identical to the published `0.2.1`).

## 0.1.1

### Patch Changes

- @rozie/runtime-vue@0.2.0
