# @rozie-ui/date-picker-solid

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The `splitProps` skip-list now correctly excludes emit-handler props from the root DOM fallthrough spread — previously a consumer's handler fired twice per emit. No API surface change.

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/date-picker` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps.

  **Keyboard/accessibility hardening** (included in this first publish):
  - Disabled day cells are now focusable-but-inert per the ARIA grid pattern — the native `disabled` attribute moved off individual day buttons (kept only for whole-control `disabled`), with `aria-disabled="true"` carrying the state. Arrow keys traverse past disabled days instead of dead-ending, and Enter on one is a no-op. CSS hook changed from `.rozie-datepicker-day:disabled` to `[aria-disabled='true']` — identical declarations, pixel-identical output, but consumers who overrode the `:disabled` selector must update. **This is the only consumer-visible break in this release.**
  - Roving-tabindex fallback fixed — the grid always exposes exactly one day tab stop, falling back anchor-in-view → today-in-view → first-enabled, so tabbing into the calendar still works after the selected day scrolls out of view.
  - Drill focus continuity — entering/leaving the months and years views keeps keyboard focus inside the control instead of dropping to `<body>`.
  - Multi-month `Home`/`End` now resolve against the panel the focused day actually lives in (previously scanned month 0 only).

  Also includes documentation corrections (footer slot, range-mode `clear()`, 5 previously undocumented props, corrected React/Solid slot examples) — documentation only, no API change.
- @rozie/runtime-solid@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-solid@0.2.0
