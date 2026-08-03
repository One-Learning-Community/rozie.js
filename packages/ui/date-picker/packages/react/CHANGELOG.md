# @rozie-ui/date-picker-react

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1`. The public `.d.ts` no longer types `prev`/`next` (on `renderHeader`), `today`/`clear` (on `renderFooter`), or `apply` (on `renderPresets`) as `unknown` — all five resolve to top-level script functions and now type callable (`(...args: any[]) => any`), reversing the 0.3.0 regression that broke a strict-TS consumer using these render-prop callbacks. No runtime behavior change; type surface only.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. The public `.d.ts` no longer types unresolved `r-for` slot-context params as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller. No API surface change.

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/date-picker` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps.

  **Keyboard/accessibility hardening** (included in this first publish):
  - Disabled day cells are now focusable-but-inert per the ARIA grid pattern — the native `disabled` attribute moved off individual day buttons (kept only for whole-control `disabled`), with `aria-disabled="true"` carrying the state. Arrow keys traverse past disabled days instead of dead-ending, and Enter on one is a no-op. CSS hook changed from `.rozie-datepicker-day:disabled` to `[aria-disabled='true']` — identical declarations, pixel-identical output, but consumers who overrode the `:disabled` selector must update. **This is the only consumer-visible break in this release.**
  - Roving-tabindex fallback fixed — the grid always exposes exactly one day tab stop, falling back anchor-in-view → today-in-view → first-enabled, so tabbing into the calendar still works after the selected day scrolls out of view.
  - Drill focus continuity — entering/leaving the months and years views keeps keyboard focus inside the control instead of dropping to `<body>`.
  - Multi-month `Home`/`End` now resolve against the panel the focused day actually lives in (previously scanned month 0 only).

  Also includes documentation corrections (footer slot, range-mode `clear()`, 5 previously undocumented props, corrected React/Solid slot examples) — documentation only, no API change.
- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
