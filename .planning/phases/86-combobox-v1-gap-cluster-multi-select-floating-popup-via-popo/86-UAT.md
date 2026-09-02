---
status: testing
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
source: [86-VERIFICATION.md]
started: 2026-09-01T17:30:00Z
updated: 2026-09-01T17:30:00Z
---

## Current Test

number: 1
name: Floating UI `flip` must NOT relocate the popup on an exact-fit (0px) boundary
expected: |
  At a viewport height where the popup fits by exactly 0px below the input, the
  popup renders in its normal below-the-input position. It should NOT flip above
  on an exact-fit boundary — only on genuine overflow.
awaiting: user response

## Tests

### 1. Exact-fit (0px) viewport boundary does not trigger `flip`
expected: The popup renders below the input at exactly 0px of remaining space; no flip occurs.
why_human: Boundary arithmetic belongs to Floating UI, not Rozie, and is not deterministically reproducible in the happy-dom/vitest harness. Flagged 🧪 backstop in `86-SPEC.md`'s Edge Coverage table (R2) and listed in `86-VALIDATION.md`'s Manual-Only Verifications table — never automated by design.
how_to_test: Open the floating demo (`examples/demos/ComboboxFloatingDemo.rozie`) or any `creatable`/`multiple` combobox, then resize the viewport until the open popup's bottom edge sits exactly flush with the viewport bottom. Confirm it stays below the input rather than flipping above.
result: [pending]

### 2. `create` committed while an async `search` for the same query is still in flight
expected: Exactly one `create` event fires — no lost `create`, no duplicate — with the double-commit latch suppressing any second emit.
why_human: Race timing against a deliberately delayed async data source is not deterministically reproducible in the happy-dom harness. Flagged 🧪 backstop in `86-SPEC.md`'s Edge Coverage table (R3) and in `86-VALIDATION.md`. `86-06-SUMMARY.md` records this was NOT manually probed during that plan's run, so it is genuinely open. Note the same-tick double-commit guarantee IS automated and passing (`creatable.behavior.test.ts` test 5) — it is only the live async race that remains unproven.
how_to_test: Wire a `creatable` combobox to a `search` handler that resolves `options` after a deliberate delay (e.g. 500ms). Type a query matching no option, then commit the create gesture (Enter) while the search is still pending. Count `create` emissions.
result: [pending]

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
pending: 2
skipped: 0
blocked: 0
resolved: 1

## Gaps

None blocking. `86-VERIFICATION.md` records 9/9 must-haves verified and no blocking
gaps. Both pending items are SPEC-declared `🧪 backstop` edges — explicitly designated
manual-only at spec time, not coverage that was skipped or deferred under time pressure.
