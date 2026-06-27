# Listbox — the cross-framework headless select

`Listbox` is Rozie's **headless, fully-accessible** select-only listbox — and the first `@rozie-ui` component with **no third-party engine** behind it. Every behaviour (roving virtual focus, full keyboard navigation, type-ahead, single + multi select) is authored once in `Listbox.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit. (For a type-to-filter editable input, reach for the sibling [`@rozie-ui/combobox`](/components/combobox) — it shares the same `@rozie-ui/headless-core` list spine.)

Because there is no vanilla-JS dependency, it is the purest demonstration of Rozie's native author-side primitives: `$computed`-derived state, parameterized `@keydown` modifiers, `$refs`-driven focus management, two-way `r-model:value`, scoped slots, and an `$expose` imperative handle. And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/listbox` packages

`Listbox` ships as six pre-compiled, per-framework packages generated from a single `Listbox.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/listbox-react` | `npm i @rozie-ui/listbox-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/packages/react/README.md) |
| `@rozie-ui/listbox-vue` | `npm i @rozie-ui/listbox-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/packages/vue/README.md) |
| `@rozie-ui/listbox-svelte` | `npm i @rozie-ui/listbox-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/packages/svelte/README.md) |
| `@rozie-ui/listbox-angular` | `npm i @rozie-ui/listbox-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/packages/angular/README.md) |
| `@rozie-ui/listbox-solid` | `npm i @rozie-ui/listbox-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/packages/solid/README.md) |
| `@rozie-ui/listbox-lit` | `npm i @rozie-ui/listbox-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Listbox.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Pass an `options` array and two-way bind `value`:

```rozie
<components>
{
  Listbox: './Listbox.rozie',
}
</components>

<data>
{
  fruit: null,
  fruits: [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
  ],
}
</data>

<template>
  <Listbox r-model:value="$data.fruit" :options="$data.fruits" placeholder="Pick a fruit…">
    <template #option="{ option, active, selected }">
      <span :class="{ active, selected }">{{ option.label }}</span>
    </template>
  </Listbox>
</template>
```

`r-model:value` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Listbox` a value, `Listbox` writes the new selection back, and the framework reconciler picks it up — no `onChange → setState` wiring. Because `value` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — a `Listbox` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `options` | `Array` | `[]` | yes | The option set. Each entry is a primitive (`string`/`number`) or an object resolved via the `option*` props (falling back to `.label` / `.value` / `.disabled`). |
| `value` | `unknown` | `null` | yes (via `r-model`) | The selected value. `model: true` — scalar in single-select, an array of values in multi-select. The sole model prop, so Angular emits a `ControlValueAccessor`. |
| `multiple` | `Boolean` | `false` | yes | Multi-select: `value` becomes an array; selecting toggles membership and keeps the popup open. |
| `inline` | `Boolean` | `false` | yes | Render the results list in normal flow (static) rather than as an absolute popup, so an `overflow:hidden` ancestor (e.g. a command palette) can't clip it. Defaults to the standalone dropdown behavior. |
| `disabled` | `Boolean` | `false` | yes | Disable the control (also sets the Angular CVA disabled state). |
| `placeholder` | `String` | `''` | yes | Placeholder text for the empty control. |
| `closeOnSelect` | `Boolean` | `true` | yes | Close the popup after a single-select commit. Multi-select keeps it open regardless. |
| `optionLabel` | `Function` | `null` | yes | `(option) => string` — resolve an object option's display label. |
| `optionValue` | `Function` | `null` | yes | `(option) => value` — resolve an object option's committed value. |
| `optionDisabled` | `Function` | `null` | yes | `(option) => boolean` — mark an option non-selectable. |
| `id` | `String` | `"rozie-listbox"` | yes | Stable id base for the ARIA wiring (listbox id, per-option ids, `aria-activedescendant`). Give each instance on a page a distinct id. |
| `ariaLabel` | `String` | `null` | yes | Accessible name for the control when there is no visible `<label for>`. |

### Events

| Event | Description |
| --- | --- |
| `open-change` | Fired whenever the popup opens or closes. Payload `{ open: boolean }`. |
| `change` | Fired after the selection changes. Payload `{ value, option }` (`option` is `null` when cleared). |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `open` | Open the popup (no-op when disabled or already open). |
| `close` | Close the popup. |
| `toggle` | Toggle the popup open/closed. |
| `clear` | Clear the selection and reset the internal query state. |
| `focusControl` | Move DOM focus to the control. (Named `focusControl`, not `focus`, so it does not override the native `HTMLElement.focus` on the Lit element.) |

### Slots

| Slot | Params | Description |
| --- | --- | --- |
| `selected` | `selected, value` | Custom rendering of the select-only trigger's chosen-value display. |
| `option` | `option, index, active, selected, disabled` | Custom per-option rendering (the main scoped slot). |
| `empty` | `query` | Shown when the (filtered) option list is empty. |

## Theming

Every value the component renders is a `--rozie-listbox-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-listbox {
  --rozie-listbox-accent: #16a34a;
  --rozie-listbox-radius: 10px;
  --rozie-listbox-bg: #0b1220;
  --rozie-listbox-fg: #e5e7eb;
}
```

### Design-system bridges

Each package ships token presets that map the listbox tokens onto a known design system's published CSS variables — so the listbox automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/listbox-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --background/--primary/--ring…
import '@rozie-ui/listbox-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/listbox-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/listbox-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/src/themes/base.css).

## Keyboard

It follows the [ARIA APG "Select-Only Combobox" pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): DOM focus stays on the control while the highlighted option is tracked virtually via `aria-activedescendant`.

| Key | Action |
| --- | --- |
| `↓` / `↑` | Open the popup / move the active option down / up (wraps, skips disabled). |
| `Home` / `End` | Jump to the first / last enabled option. |
| `Enter` | Commit the active option. |
| `Escape` | Close the popup and return focus to the control. |
| `Space` | (Select-only) toggle the popup / commit the active option. |
| `Tab` | Close the popup and move on. |
| _printable_ | (Select-only) type-ahead — jump to the first option whose label starts with the typed buffer. |

## Accessibility

- The control carries `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; the popup is `role="listbox"` (with `aria-multiselectable` in multi-select); each option is `role="option"` with `aria-selected` / `aria-disabled`.
- Supply an accessible name via a visible `<label for>` pointing at the control's `id`, or the `ariaLabel` prop.
- Give each instance on a page a distinct `id` so the generated option ids and `aria-activedescendant` references stay unique.
