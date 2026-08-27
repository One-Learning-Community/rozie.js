# Angular ControlValueAccessor — auto-wiring model props to Angular forms

Make `[(ngModel)]` / `[formControl]` work on generated Angular components. **Shipped.**

## Requirements

From the `killer-component-ports` idea.

- **REQ-13** — the Angular emitter auto-implements `ControlValueAccessor` + provides
  `NG_VALUE_ACCESSOR` for any component with **exactly one** `model: true` prop, gated by
  `angular: { cva: boolean }`, **default ON**. The `.rozie` language is untouched. Multiple model
  props → no auto-CVA + a diagnostic.
- **REQ-14** — hook view→model at the **internal model-prop write site** (where `$props.X = v` lowers
  to `this.X.set(v)`), NOT an `effect()` on the model signal. The effect form echoes programmatic
  `writeValue`s back into the form and wrongly marks controls dirty (proven by 006-D).
- **REQ-15** — `writeValue(null)` coerces to the model prop's declared default. Load-bearing from
  initialization: NgModel's first `writeValue` always passes null.
- **REQ-16** — `setDisabledState` lowers to an internal `__rozieCvaDisabled` signal OR-merged into
  every internal read of the `disabled` prop; silent no-op + info diagnostic when none is declared.
  The read-only `input()` signal cannot be written externally.
- **REQ-17** — `registerOnTouched` → host `focusout` binding.
- **REQ-18 (docs)** — the flatpickr guide's `formControlName` recipe over-promised; it crashed at
  runtime (prod: cryptic TypeError, not NG01203).

## What to Avoid

- Don't use an `effect()` on the model signal for view→model.
- Don't assume `writeValue(null)` is only a `form.reset()` concern.

## Constraints

**Angular forms probes MUST mount inside `NgZone.run()`.** The VR rig's default outside-zone
`createComponent` mounting masks zone-dependent flows — plain-property mutations never schedule
change detection; only signal writes do. Discovered in spike 006.

## Origin

Spikes: 005, 006 — sources in `sources/005-flatpickr-cva-baseline-gap/`, `sources/006-flatpickr-cva-directive/`
