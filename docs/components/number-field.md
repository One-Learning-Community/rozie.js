# NumberField — the cross-framework headless numeric stepper

`NumberField` is Rozie's **headless, fully-accessible** numeric input / spinbutton — a `@rozie-ui` family with **no third-party engine** behind it. Every behaviour (typing with locale-aware parse/format, clamp to `[min, max]`, step snapping, the +/- steppers with press-and-hold acceleration, keyboard control — ArrowUp/Down, PageUp/Down, Home/End — optional scrub-on-drag, and `role="spinbutton"` with the full `aria-value*` set) is authored once in `NumberField.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is the **platform itself**: a native `<input>` for text entry, browser focus, the keyboard, and `Intl.NumberFormat` for locale-aware display. The numeric value *is* `modelValue` (the sole `model: true` prop), typed `number | null` — `null` is the empty field. The one piece of local state is the **edit buffer** (`text`): a half-typed entry like `"1."` or `"-"` is not yet a valid number, so it is held as text while the field is focused and parsed back to a number on blur / Enter. Rozie owns the author-side API: the two-way `r-model:modelValue`, the clamp/snap math, the keyboard choreography, the press-hold ramp, and the token-themed skin.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/number-field` packages

`NumberField` ships as six pre-compiled, per-framework packages generated from a single `NumberField.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/number-field-react` | `npm i @rozie-ui/number-field-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/number-field/packages/react/README.md) |
| `@rozie-ui/number-field-vue` | `npm i @rozie-ui/number-field-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/number-field/packages/vue/README.md) |
| `@rozie-ui/number-field-svelte` | `npm i @rozie-ui/number-field-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/number-field/packages/svelte/README.md) |
| `@rozie-ui/number-field-angular` | `npm i @rozie-ui/number-field-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/number-field/packages/angular/README.md) |
| `@rozie-ui/number-field-solid` | `npm i @rozie-ui/number-field-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/number-field/packages/solid/README.md) |
| `@rozie-ui/number-field-lit` | `npm i @rozie-ui/number-field-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/number-field/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `NumberField.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Two-way bind `modelValue` and set `min` / `max` / `step` to get a clamped, step-snapped stepper. The value is always clamped + snapped on commit; `@change` fires on every committed change:

```rozie
<components>
{
  NumberField: './NumberField.rozie',
}
</components>

<data>
{
  qty: 1,
}
</data>

<template>
  <!-- 0..10 integer quantity -->
  <NumberField r-model:modelValue="$data.qty" :min="0" :max="10" :step="1" ariaLabel="Quantity" @change="onChange" />

  <!-- locale-aware currency -->
  <NumberField r-model:modelValue="$data.qty" :min="0" :step="0.01" :formatOptions="{ style: 'currency', currency: 'USD' }" ariaLabel="Price" />
</template>
```

`r-model:modelValue` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `NumberField` a `number | null`, `NumberField` writes the new clamped + snapped value back on every commit, and the framework reconciler picks it up — no `onChange → setState` wiring. Because `modelValue` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — a `NumberField` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `modelValue` | `Number \| null` | `null` | yes (via `r-model`) | The numeric value — the sole `model: true` prop, so Angular emits a `ControlValueAccessor`. `null` is the empty field. Clamped to `[min, max]` and snapped to `step` on every commit. |
| `min` | `Number \| null` | `null` | yes | Inclusive lower bound. Every commit clamps `>= min`; **Home** jumps to `min`. `null` = no lower bound. Emitted as `aria-valuemin`. |
| `max` | `Number \| null` | `null` | yes | Inclusive upper bound. Every commit clamps `<= max`; **End** jumps to `max`. `null` = no upper bound. Emitted as `aria-valuemax`. |
| `step` | `Number` | `1` | yes | Increment/decrement granularity. Arrow keys + the +/- buttons step by `step`; commits snap to the nearest multiple of `step` from `min` (or `0`). |
| `largeStep` | `Number` | `10` | yes | Coarse step applied by **PageUp** / **PageDown**. |
| `formatOptions` | `Object` | `{}` | yes | Forwarded to `Intl.NumberFormat` for locale-aware display (e.g. `{ style: 'currency', currency: 'USD' }`). Stripped back off on commit. |
| `allowScrub` | `Boolean` | `false` | yes | Opt in to scrub-on-drag — drag horizontally to change the value by `step` per few pixels. |
| `disabled` | `Boolean` | `false` | yes | Disable the whole control (also sets the Angular CVA disabled state). |
| `readonly` | `Boolean` | `false` | yes | Show + focus the value but block all edits. |
| `ariaLabel` | `String` | `null` | yes | Accessible name applied to the `role="spinbutton"` input (`aria-label`). |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired on every committed change — a typed value committed on blur/Enter, a step from the +/- buttons or the keyboard, a Home/End jump, a scrub, or a programmatic `increment`/`decrement`/`clear`. Payload `{ value }` — the new clamped + snapped number, or `null` when empty. |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the input and select its text. **Deliberately named `focus`**, which overrides the inherited `HTMLElement.focus` on the Lit custom element — the public `focus()` handle is intended (an accepted, warn-only ROZ137). This mirrors the slider/otp precedent. |
| `increment` | Step the value up by one `step` (clamped + snapped). Emits `change`. |
| `decrement` | Step the value down by one `step` (clamped + snapped). Emits `change`. |
| `clear` | Set the value to `null` (empty) and clear the edit buffer. Emits `change`. |

## Accessibility

The input carries `role="spinbutton"` with `aria-valuemin` / `aria-valuemax` (when `min` / `max` are set), `aria-valuenow` (the current number, omitted when empty), and `aria-valuetext` (the locale-formatted display). Set `ariaLabel` (or wire an external `<label>`) so the control is announced. The +/- buttons are `tabindex="-1"` and `aria-label`led so the keyboard story lives entirely on the focused input (Arrow / PageUp·Down / Home / End), matching the WAI-ARIA spinbutton pattern.
