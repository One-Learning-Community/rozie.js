---
spike: 005
name: flatpickr-cva-baseline-gap
type: standard
validates: "Given today's generated @rozie-ui/flatpickr-angular class, when [(ngModel)] / [formControl] are attached, then the binding fails at runtime (capture the exact error) while [(date)] remains fully functional"
verdict: VALIDATED
related: [006-flatpickr-cva-directive]
tags: [angular, cva, forms, flatpickr, baseline-gap, phase-999.1]
---

# Spike 005: Flatpickr CVA Baseline Gap

## What This Validates

Given the CURRENT generated `@rozie-ui/flatpickr-angular` class (no CVA), when an
Angular consumer attaches `[(ngModel)]` or `[formControl]` to `<rozie-flatpickr>`,
then the forms binding fails at runtime — and the failure mode is captured exactly.
Control case: `[(date)]` model binding without forms directives keeps working.

## Research

- CVA contract (`writeValue` / `registerOnChange` / `registerOnTouched` /
  `setDisabledState` + `NG_VALUE_ACCESSOR` multi-provider) is stable across
  Angular 19/20/21.
- **Angular 21 experimental Signal Forms** (`FormValueControl`, PR #67267,
  Feb 2026): a component with a model signal literally named `value` binds to
  the new `[field]` directive without CVA. NOT a substitute for us — our model
  prop is `date`, the API is experimental, and the entire installed base of
  reactive/template-driven forms still goes through CVA. (Source:
  push-based.io "Goodbye ControlValueAccessor"; angular.dev/api/forms/ControlValueAccessor)
- GitHub angular/angular#58543 (closed not-planned): signal effects fire AFTER
  `writeValue` — confirms effect-based view→model hookup has unavoidable echo
  timing; informs Spike 006's design.

## How to Run

```bash
# Harness: tests/visual-regression (has @angular/forms@19 + flatpickr + analogjs AOT + Playwright)
cd tests/visual-regression
ROZIE_TARGET=angular pnpm exec vite build --config vite.config.ts
pnpm preview &   # port 4180
pnpm exec playwright test specs/flatpickr-cva.spec.ts --grep "005"
# afterwards: sweep cross-tree artifacts (examples/*.rozie.ts, packages/ui/*/src/*.rozie.ts + shims)
```

Probe hosts: `tests/visual-regression/host/cva-probe.ts` (spike code) mounted via
`?cvaProbe=BaselineNgModel | BaselineReactive | BaselineDate` (additive branch in
`host/entry.angular.ts`).

## What to Expect

- 005-A `[(ngModel)]` → uncaught TypeError (forms setup crash), component half-rendered.
- 005-B `[formControl]` → same TypeError.
- 005-C `[(date)]` → fully functional date picking, zero errors.

## Investigation Trail

1. Expected the documented `NG01203: No value accessor for form control` error.
   First run: assertion failed — the error is actually a raw
   **`TypeError: Cannot read properties of null (reading 'writeValue')`** at
   `_setUpStandalone` / `_setUpControl` / `NgModel.ngOnChanges`.
2. Explanation: NG01203 is raised inside an `ngDevMode` guard, which production
   builds compile out. The VR rig builds with `vite build` (production) — so the
   captured error IS what a real production consumer sees.
3. The component still half-renders (the flatpickr input is visible) before the
   forms setup crash — the failure is per-directive, not a whole-app crash, but
   the control is dead weight (no value sync at all).

## Results

**Verdict: VALIDATED — the gap is real and the production failure mode is worse than documented.**

| Binding | Result | Error |
|---|---|---|
| `[(ngModel)]` | runtime crash | `TypeError: Cannot read properties of null (reading 'writeValue')` (prod); `NG01203` (dev builds only) |
| `[formControl]` | runtime crash | same |
| `[(date)]` (no forms) | ✅ works | none |

Key surprises:
- **The prod error is unactionable.** A consumer who tries `formControlName` on a
  Rozie component in a production build gets a null-deref with no mention of
  "value accessor" — they can't even Google their way to the cause. This
  strengthens the case for shipping CVA (or at minimum documenting the limitation
  prominently).
- The docs claim in `docs/guide/flatpickr.md` ("bind `[name]` (or drive it from a
  `formControlName`)") over-promises — `formControlName` directly on the component
  crashes. The `name` prop path is native-form-submission only. **Docs correction
  needed regardless of the CVA decision.**
