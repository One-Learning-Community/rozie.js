---
spike: 006
name: flatpickr-cva-directive
type: standard
validates: "Given a hand-written CVA wrapper directive on <rozie-flatpickr>, when ngModel, reactive FormControl, and [(date)] all bind, then all three work simultaneously with no double-emission, and reset/touched/disabled semantics behave as the emitter design assumes"
verdict: VALIDATED
related: [005-flatpickr-cva-baseline-gap]
tags: [angular, cva, forms, flatpickr, emitter-design, phase-999.1]
---

# Spike 006: Flatpickr CVA Wrapper Directive

## What This Validates

The exact `ControlValueAccessor` behavior the Angular emitter's auto-CVA
capability (compiler-config-gated `angular: { cva: boolean }`, default ON, for
components with exactly one `model: true` prop) must generate — proven by a
hand-written wrapper directive against the CURRENT generated class, with the
generated leaf untouched.

## Research

Carried from Spike 005. Additional design input:
- `ModelSignal` is externally writable (`fp.date.set(...)`) — a wrapper CAN push
  values in. The implicit `dateChange` output is NOT a class member (it's
  template-level only), so programmatic subscription to model changes requires
  `effect()` — which is exactly the echo-prone path (006-D proves it).

## How to Run

```bash
cd tests/visual-regression
ROZIE_TARGET=angular pnpm exec vite build --config vite.config.ts
pnpm preview &   # port 4180
pnpm exec playwright test specs/flatpickr-cva.spec.ts --grep "006"
```

Probe hosts + the directive: `tests/visual-regression/host/cva-probe.ts`,
mounted via `?cvaProbe=NgModel | Reactive | Coexist | Echo`.

## What to Expect

All four probes green: ngModel two-way, reactive FormControl battery
(setValue / reset / disable / touched / no-echo), [(date)]+[formControl]
coexistence, and the naive-hookup echo demonstration.

## The Validated CVA Shape (what the emitter must generate)

Class members on the emitted component (translated from the directive):

```ts
// imports added: NG_VALUE_ACCESSOR from '@angular/forms'; forwardRef from '@angular/core'
// @Component providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Flatpickr), multi: true }]
// @Component host: { '(focusout)': '__rozieCvaOnTouched()' }

private __rozieCvaOnChange: (v: string) => void = () => {};
private __rozieCvaOnTouchedFn: () => void = () => {};
private __rozieCvaDisabled = signal(false);   // merged into internal disabled reads

writeValue(v: string | null): void {
  // null → the prop's declared default ('' for date)
  this.date.set(v ?? '');
}
registerOnChange(fn: (v: string) => void): void { this.__rozieCvaOnChange = fn; }
registerOnTouched(fn: () => void): void { this.__rozieCvaOnTouchedFn = fn; }
setDisabledState(isDisabled: boolean): void { this.__rozieCvaDisabled.set(isDisabled); }
__rozieCvaOnTouched(): void { this.__rozieCvaOnTouchedFn(); }

// CRITICAL — view→model hookup at the INTERNAL model-write site, i.e. inside
// flatpickr's onChange handler where `this.date.set(dateStr)` already happens:
//     this.date.set(dateStr);
//     this.__rozieCvaOnChange(dateStr);   // ← added line
// NOT via an effect() on the model signal (echo — see 006-D).

// Disabled merge: every internal read of `this.disabled()` becomes
// `(this.disabled() || this.__rozieCvaDisabled())`, including the
// ngAfterViewInit seed and the $watch reconciler.
```

## Investigation Trail

1. **Run 1 (4/7 pass):** Reactive forms battery, coexistence, and echo
   demonstration all passed first try. ngModel two-way failed: programmatic
   model write never reached the view. Baselines failed only on assertion
   pattern (expected NG01203, got prod TypeError — see Spike 005).
2. **Run 2 diagnostics:** added writeValue/fpDate counters → the click that sets
   the host property produced ZERO journal events. Not an async-timing issue:
   change detection never ran at all.
3. **Root cause:** the VR harness mounts components OUTSIDE the Angular zone
   (`createComponent` in module scope). Template click listeners register in the
   root zone, so plain-property mutations never schedule CD — only signal writes
   do (hybrid scheduler). NgModel's model→view path (plain property →
   `ngOnChanges` → `resolvedPromise.then`) is exactly the flow that needs zone
   ticks. Reactive forms worked because `FormControl.setValue` → `writeValue` →
   `date.set` is a signal write.
4. **Fix:** mount the spike probes inside `NgZone.run()` (matches real
   `bootstrapApplication` apps). All 7 tests green.
5. Event journal (006-A, final): `writeValue(NULL)` → `ready` →
   `writeValue('2026-06-02')` → `writeValue('2026-07-04')` — note **NgModel's
   very first writeValue call passes `null`**, before the model value
   propagates. Null-coercion is load-bearing from initialization, not just for
   `reset()`.

## Results

**Verdict: VALIDATED — the emitter design works on all axes tested.**

| Question | Answer | Evidence |
|---|---|---|
| CVA + `model()` coexist? | **Yes.** `[(ngModel)]`, `[formControl]`, and `[(date)]` all work; `[formControl]` + `[(date)]` simultaneously works. | 006-A/B/C green |
| Double-emission? | **None** when view→model hooks the interaction path (the `change` output / internal write site). Programmatic `setValue` → 0 onChange calls, control stays pristine. | 006-B: `cva-onchange-calls=0` after setValue |
| Echo if hooked via effect on the model signal? | **Yes — confirmed bug.** Programmatic setValue → onChange fires → control wrongly marked dirty. | 006-D: `onChangeCalls=1, ctrl.dirty=true` |
| `form.reset()` / `writeValue(null)`? | Null coerces to prop default (`''`) → flatpickr clears. Also: ngModel setup calls `writeValue(null)` FIRST, always. | 006-B reset step; 006-A journal |
| Touched semantics? | Host `focusout` works. Clicking into the body-appended popup DID mark touched (focus left the input) — acceptable, matches "user interacted". | 006-B: `ctrl.touched=true, onTouchedCalls=1` |
| `setDisabledState`? | Works. Directive had to reach into `fp.instance.input.disabled` (read-only `input()` signal can't be written externally) — the emitter must use an internal `__rozieCvaDisabled` signal merged into internal reads. Pre-mount calls need stashing (forms call it before `ngAfterViewInit`). | 006-B disable/enable steps |
| Inertness? | CVA provider + no forms directive = zero behavior change, zero DI errors. | 005-C + all hosts |
| `[(date)]` write vs form control | **Finding:** writing through `[(date)]` updates the view but NOT the form control (`ctrl.value` unchanged, no onChange). The form learns of changes only through user interaction or its own API. Same as Angular Material. Must be documented as a semantic. | 006-C annotation |

### Surprises / additional findings

1. **The attribute-fallthrough spread copies `ng-pristine`/`ng-touched`/`ng-valid`
   status classes + the `rozieCva` attribute onto the inner `<input>`** (the
   D-05/D-06 auto-fallthrough copies ALL host attributes). Harmless here, but a
   consumer styling `.ng-invalid` would hit both the host AND the inner input.
   Worth a line in the emitter-phase spec.
2. **VR harness zone caveat:** any future forms-related e2e MUST mount inside
   `NgZone.run()` or test against a real `bootstrapApplication` app. The
   existing demo cells don't care (signal-driven), forms cells do.
3. The directive form of CVA (Option A from the strategy discussion) is
   strictly worse than emitter-level: it needs engine-specific reach-ins for
   disabled, can't hook the internal write site (must rely on the wrapper's
   `change` event existing), and is per-component manual work.
