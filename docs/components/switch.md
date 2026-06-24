# Switch — the cross-framework headless toggle

`Switch` is Rozie's **headless, fully-accessible** on/off toggle — a `@rozie-ui` family with **no third-party engine** behind it. Every behaviour (a boolean two-way value, toggling on click *and* Space/Enter, `role="switch"` with `aria-checked` / `aria-disabled` / `aria-readonly`, focus management, and the `disabled` / `readonly` states) is authored once in `Switch.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is the **platform itself**: a focusable native element, a native click, and a Space/Enter keydown. The on/off state *is* `modelValue` (the sole `model: true` prop), typed `boolean` — there is no draft local state, so the thumb position and `aria-checked` derive straight from the bound value. Rozie owns the author-side API: the two-way `r-model:modelValue`, the toggle choreography, the ARIA wiring, and the token-themed skin.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/switch` packages

`Switch` ships as six pre-compiled, per-framework packages generated from a single `Switch.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/switch-react` | `npm i @rozie-ui/switch-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/switch/packages/react/README.md) |
| `@rozie-ui/switch-vue` | `npm i @rozie-ui/switch-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/switch/packages/vue/README.md) |
| `@rozie-ui/switch-svelte` | `npm i @rozie-ui/switch-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/switch/packages/svelte/README.md) |
| `@rozie-ui/switch-angular` | `npm i @rozie-ui/switch-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/switch/packages/angular/README.md) |
| `@rozie-ui/switch-solid` | `npm i @rozie-ui/switch-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/switch/packages/solid/README.md) |
| `@rozie-ui/switch-lit` | `npm i @rozie-ui/switch-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/switch/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Switch.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Two-way bind `modelValue` and (optionally) set an `ariaLabel`. The switch toggles on click and on Space/Enter; `@change` fires on every committed change:

```rozie
<components>
{
  Switch: './Switch.rozie',
}
</components>

<data>
{
  wifi: false,
}
</data>

<template>
  <Switch r-model:modelValue="$data.wifi" ariaLabel="Wi-Fi" @change="onChange" />
</template>
```

`r-model:modelValue` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Switch` a `boolean`, `Switch` writes the new state back on every toggle, and the framework reconciler picks it up — no `onChange → setState` wiring. Because `modelValue` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — a `Switch` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `modelValue` | `Boolean` | `false` | yes (via `r-model`) | The on/off state — the sole `model: true` prop, so Angular emits a `ControlValueAccessor`. `true` is checked/on; reflected as `aria-checked`. |
| `disabled` | `Boolean` | `false` | yes | Disable the control entirely — non-focusable, non-toggleable, `aria-disabled` set. Also sets the Angular CVA disabled state. |
| `readonly` | `Boolean` | `false` | yes | Show + focus the state but block toggling (click and keyboard are ignored). Reflected as `aria-readonly`. |
| `ariaLabel` | `String` | `null` | yes | Accessible name applied to the `role="switch"` control (`aria-label`). |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the switch is toggled — by a click, by Space/Enter, or by the programmatic `toggle()` handle. Payload `{ checked }` — the new boolean state. (No-op while `disabled` or `readonly`.) |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the switch control. **Deliberately named `focus`**, which overrides the inherited `HTMLElement.focus` on the Lit custom element — the public `focus()` handle is intended (an accepted, warn-only ROZ137). This mirrors the otp / number-field precedent. |
| `toggle` | Flip the on/off state (same funnel as a click / Space / Enter) and emit `change`. A no-op while `disabled` or `readonly`. |

### Slots

| Slot | Params |
| --- | --- |
| `(default)` | `checked`, `toggle` |

The default slot is **scoped** — it receives `{ checked, toggle }` so you can render a fully custom thumb/track (or a label + icon) while keeping the accessible button, keyboard, and two-way binding. Omit it and the component renders its built-in tokenised track + thumb.

## Accessibility

The control is a native `<button>` with `role="switch"` and `aria-checked` reflecting `modelValue` (never dropped on `false`). It carries `aria-disabled` / `aria-readonly` for those states, and `aria-label` from `ariaLabel`. It is keyboard-operable per the WAI-ARIA switch pattern — **Space** and **Enter** both toggle it — and `tabindex` is `0` when interactive, dropped when `disabled`. Provide `ariaLabel` (or wire an external `<label>`) so the switch is announced.
