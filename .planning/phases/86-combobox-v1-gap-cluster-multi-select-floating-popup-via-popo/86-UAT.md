---
status: resolved
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
source: [86-VERIFICATION.md]
started: 2026-09-01T17:30:00Z
updated: 2026-09-02T00:00:00Z
---

## Current Test

None — all tests resolved. Items 1 and 2 (both previously `🧪 backstop`
manual-only edges) are now machine-checked; see their `resolution:` blocks
below.

## Tests

### 1. Exact-fit (0px) viewport boundary does not trigger `flip`
expected: The popup renders below the input at exactly 0px of remaining space; no flip occurs.
why_human: Boundary arithmetic belongs to Floating UI, not Rozie, and is not deterministically reproducible in the happy-dom/vitest harness. Flagged 🧪 backstop in `86-SPEC.md`'s Edge Coverage table (R2) and listed in `86-VALIDATION.md`'s Manual-Only Verifications table — never automated by design.
how_to_test: Open the floating demo (`examples/demos/ComboboxFloatingDemo.rozie`) or any `creatable`/`multiple` combobox, then resize the viewport until the open popup's bottom edge sits exactly flush with the viewport bottom. Confirm it stays below the input rather than flipping above.
result: [resolved — automated the previous night, this entry was stale]
resolution: |
  Already machine-checked by `combobox-flip-exact-fit` (6 cells, one per target) in
  `tests/visual-regression/specs/combobox.spec.ts`, added the night before this entry
  was reviewed (quick-260901-tpq). Pass A measures the Combobox `offset` and panel
  height live rather than hardcoding the documented default; Pass B sets the viewport
  to the exact-fit height (`Math.ceil` of the measured sum) and asserts the popup
  stays below the input at zero slack; Pass C (8px short — the negative-control
  vacuity guard) asserts it flips entirely above at genuine overflow. Re-run during
  quick-260902-hmv: 6/6 passing. This entry's `result:` line was simply never updated
  after that automation landed — corrected here, per the note in item 2's resolution
  below.

### 2. `create` committed while an async `search` for the same query is still in flight
expected: Exactly one `create` event fires — no lost `create`, no duplicate — with the double-commit latch suppressing any second emit.
why_human: Race timing against a deliberately delayed async data source is not deterministically reproducible in the happy-dom harness. Flagged 🧪 backstop in `86-SPEC.md`'s Edge Coverage table (R3) and in `86-VALIDATION.md`. `86-06-SUMMARY.md` records this was NOT manually probed during that plan's run, so it is genuinely open. Note the same-tick double-commit guarantee IS automated and passing (`creatable.behavior.test.ts` test 5) — it is only the live async race that remains unproven.
how_to_test: Wire a `creatable` combobox to a `search` handler that resolves `options` after a deliberate delay (e.g. 500ms). Type a query matching no option, then commit the create gesture (Enter) while the search is still pending. Count `create` emissions.
result: [resolved — automated via quick-260902-hmv]
resolution: |
  Automated by a new fixture (`examples/demos/ComboboxCreatableAsyncDemo.rozie`) and a
  new `combobox-create-async` cell (6 targets) appended to
  `tests/visual-regression/specs/combobox.spec.ts`. The fixture wires `creatable` to a
  2000ms-delayed async `search` source and instruments the race with a fixture-side
  `createRaced` accumulator that only ever reads `'yes'` when a search was genuinely
  live at the instant of a `create` emit — an accumulating AND that degrades to `'no'`
  permanently the moment any emit lands outside a live window, immune to Playwright
  round-trip latency.

  Machine-checked contract, all 6 targets green:
  - Phase A: exactly one `create` fires while the search is still unresolved and
    in-flight (`readout-resolved` still `'0'`, `readout-inflight` still `'1'` at commit
    time) — the exact edge item 2 names.
  - Phase B: a second `End`+`Enter` inside the SAME in-flight window is suppressed by
    the `createdQuery` latch (`readout-create-count` stays `'1'`).
  - Phase C: after the async response lands (four options land ahead of the create
    row, which still renders LAST), a third commit is STILL suppressed — the latch
    survives the async round trip named in its own source comment.
  - Phase D (non-vacuity negative control): a fresh, distinct query re-arms the latch
    and a create committed inside its OWN in-flight window still emits
    (`readout-create-count` → `'2'`) — proves the emit path stays live and the latch is
    query-scoped, not global.

  Both mutation probes executed and observed, on `[vue]` only:
  - Probe 1 (assertion inversion): Phase B's expected create-count flipped 1→2 —
    observed RED (`Expected: "2"`, `Received: "1"`), restored GREEN.
  - Probe 2 (race-window destruction): the fixture's `SEARCH_DELAY_MS` collapsed to
    `0` — observed RED at the earliest race-window assertion (`readout-inflight`
    polling to `'1'` timed out: `Expected: "1"`, `Received: "0"` — the window
    collapsed too fast to ever be observed live), restored to `2000`, dist rebuilt,
    re-confirmed GREEN.

  A genuine bug was found and fixed while proving this on React (unrelated to
  Combobox.rozie itself, entirely inside the new fixture's own instrumentation): the
  original `onSearch` handler read `$data.inFlight`/`$data.resolved` from inside its
  own `setTimeout` callback, which on React closes over that render's `useState`
  values BY VALUE — so a read 2000ms later silently resolved to a stale pre-increment
  snapshot (`readout-inflight` went to `-1`). Fixed by tracking the race bookkeeping
  as plain top-level `let`s (mirroring `Combobox.rozie`'s own
  `virtualizer`/`remeasurePending` precedent) and only ever WRITING `$data` from them.

  Note on item 1 above: reviewing this item surfaced that item 1's own `result:` line
  had gone stale after `combobox-flip-exact-fit` landed the previous night
  (quick-260901-tpq) — updated in the same edit rather than left to mislead a future
  reader into re-testing it by hand.

### 3. Documentation claim-vs-code mismatch on click-outside dismissal
expected: The prose in `docs/components/combobox.md` and `docs/components/combobox-comparison.md` should not claim there is no document click-outside listener, since composing Popover installs one.
result: [resolved — fixed during execution, no user action needed]
resolution: |
  Fixed in commit `e3a13b48b` rather than routed to you, because it was an
  unambiguous false claim introduced by this phase's own work, not a judgment call.

  Both pages stated "there is no document click-outside listener and therefore no
  cross-Lit-shadow retargeting problem." Composing `@rozie-ui/popover` in 86-01/86-03
  added a real document-level click-outside listener plus an Escape handler, active
  while the popup is open and vetoable via `pinOpen(true)` → `disableDismiss`. Both
  paragraphs now describe the actual mechanism.

  A SECOND staleness in the same file, which the verifier did not flag, was fixed in
  the same commit: `combobox.md`'s "v1 scope" paragraph still claimed the `groups`,
  `groups`+`groupCap` and `:virtual` branches were "not yet composed with popover and
  still position with static CSS". Plan 86-03 moved all four branches onto the single
  composed `<Popover>`; no static-CSS fallback branch remains.

  Root cause worth noting: the `surface_hash` guard hashes the compiled public surface
  (props / models / emits / slots / `$expose`), not prose — so free-text capability
  claims sit unprotected. `docs/scripts/surface-hash.mjs` documents this exact failure
  mode from Phase 62 (date-picker range selection shipped while the comparison page
  kept claiming "single-date only"). It recurred here in prose the three required cell
  flips did not cover.

  Verified after the fix: `pnpm --filter docs test` → 29/29, and a repo-wide grep for
  both stale phrases returns no remaining matches.

## Summary

total: 3
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 0
resolved: 3

## Gaps

None blocking. `86-VERIFICATION.md` records 9/9 must-haves verified and no blocking
gaps. All three items are now resolved: item 3 was a code-review doc fix (unrelated to
automation); items 1 and 2 were SPEC-declared `🧪 backstop` edges — explicitly
designated manual-only at spec time, not coverage that was skipped or deferred under
time pressure — and are now machine-checked cross-target Playwright cells
(`combobox-flip-exact-fit`, `combobox-create-async`) rather than closed by manual
click-through.
