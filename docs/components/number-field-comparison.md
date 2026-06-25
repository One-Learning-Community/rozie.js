---
surface_hash: 7a049414b9f3
---

# NumberField vs the per-framework alternatives

A clamped, step-snapped, locale-formatted number input with +/- steppers, full keyboard control, and press-and-hold acceleration is something every form library re-implements — once per framework. `NumberField` is authored **once** in `NumberField.rozie` and compiled to all six. Here is what it replaces.

## The native `<input type="number">` it improves on

The platform `<input type="number">` is the usual starting point, but it is famously inconsistent: it allows `e`/`+`/`-` in ways that surprise users, has no locale-aware formatting (no thousands separators, no currency), no press-and-hold acceleration, browser-specific spinner chrome you cannot restyle, and a `valueAsNumber` that is `NaN` for an empty field rather than a clean `null`. `NumberField` keeps a native text `<input>` (so mobile keyboards + IME still work via `inputmode="decimal"`) but owns parse/format, clamping, snapping, and the steppers — giving identical behaviour across browsers and a `number | null` value.

## What it replaces per framework

| You were reaching for | `NumberField` instead |
| --- | --- |
| **React** — `react-number-format`, `@base-ui/number-field`, `@ark-ui/react` NumberInput, or a hand-rolled `<input>` + clamp/format effects | One `<NumberField>` with `modelValue` / `onModelValueChange`, a typed `NumberFieldHandle`, and the `--rozie-number-field-*` token skin. |
| **Vue** — `@ark-ui/vue` NumberInput, `@vueform/vueform` number field, or a custom `v-model` wrapper around `<input type="number">` | `<NumberField v-model:modelValue="qty" :min :max :step>` — idiomatic `v-model`, `@change`, and a template-ref handle. |
| **Svelte** — `bits-ui` / `melt-ui` NumberField, or a `bind:value` + reactive clamp | `<NumberField bind:modelValue={qty} />` with Svelte 5 runes; `onchange`; `bind:this` for the handle. |
| **Angular** — a custom `ControlValueAccessor` directive over `<input type="number">`, or `@ng-bootstrap` / Material `matInput type="number"` | `<NumberField [(modelValue)]>` that **is** a `ControlValueAccessor` out of the box — `[formControl]` / `[(ngModel)]` bind directly. |
| **Solid** — `@ark-ui/solid` NumberInput, or a `createSignal` + effect-driven `<input>` | `<NumberField modelValue={qty()} onModelValueChange={setQty} />` with a ref-callback handle. |
| **Lit** — a hand-written custom element wrapping `<input type="number">` | `<rozie-number-field>` with reactive `modelValue`/`min`/`max`/`step` properties and `model-value-change` / `change` events. |

## What you get in all six, for free

- **Clamp + step-snap on every commit** — values land on `min + k·step`, inside `[min, max]`, regardless of how they arrive (typing, buttons, keyboard, scrub, programmatic).
- **Full keyboard** — ArrowUp/Down (±`step`), PageUp/Down (±`largeStep`), Home/End (→`min`/`max`), Enter to commit.
- **Press-and-hold acceleration** — hold a stepper and the repeat ramps from slow to fast, then tears down cleanly on pointerup / pointerleave / unmount.
- **Locale-aware display** via `Intl.NumberFormat` (`formatOptions`) — currency, percent, grouping, fraction digits — with the formatting stripped back off on parse.
- **`number | null` value** — a clean empty state, not `NaN`.
- **WAI-ARIA `role="spinbutton"`** with `aria-valuemin` / `-valuemax` / `-valuenow` / `-valuetext`.
- **Optional scrub-on-drag** (`allowScrub`) for power users.
- **Token theming** — the same `--rozie-number-field-*` variables and the shadcn / Material / Bootstrap bridges across every framework.

The wedge is the usual Rozie one: you maintain **one** accessible, fully-featured number field, and every framework gets an idiomatic, byte-for-byte-consistent build of it.
