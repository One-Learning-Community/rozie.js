# @rozie-ui/combobox-lit

Idiomatic **lit** `Combobox` — a headless, fully-accessible (WAI-ARIA) combobox / autocomplete: a text input plus a popup listbox with `aria-activedescendant` keyboard navigation (Arrow/Home/End/Enter/Escape), built-in client-side filtering (or async/server-side via the `search` event + `disableFilter`), a custom-option scoped slot, and a two-way `value` binding — compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. There is NO third-party engine; the behaviour is authored once on native DOM. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/combobox-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/combobox-lit';

// <rozie-combobox> is a custom element. Bind `value`/`options` as properties,
// listen for `value-change` to receive the new selected value as the two-way
// value, and `search` for the query string on each keystroke.
const el = document.querySelector('rozie-combobox');
el.options = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
];
el.value = null;
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
});
el.addEventListener('search', (e) => {
  console.log('query:', e.detail.query);
});
```

## Theming

Every visual value is a `--rozie-combobox-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/combobox-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `unknown` | `null` | ✓ |  |
| `options` | `Array` | `[]` |  |  |
| `placeholder` | `String` | `''` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `disableFilter` | `Boolean` | `false` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `idBase` | `String` | `"rozie-combobox"` |  |  |
| `inline` | `Boolean` | `false` |  |  |
| `closeOnSelect` | `Boolean` | `true` |  |  |
| `optionLabel` | `Function` | `null` |  |  |
| `optionValue` | `Function` | `null` |  |  |
| `optionDisabled` | `Function` | `null` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired when the selected value changes — a user picks an option, or `clear()` resets it. Payload `{ value }` — the newly-selected option value (or `null` after a clear). This is the two-way `value` write-back funneled through one wrapper. |
| `search` | Fired on every keystroke in the input. Payload `{ query }` — the current text. Pair it with `disableFilter` to drive async / server-side filtering: refetch `options` from the query and the popup re-renders the supplied list verbatim. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the text input) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the text input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `clear` | Reset the selection: clear `value` (emits `change` with `{ value: null }`) and empty the input text. |

```ts
// The custom element IS the handle — exposed methods are public element
// methods. `focus()` here DELIBERATELY overrides the inherited
// HTMLElement.focus (it focuses the text input).
const el = document.querySelector('rozie-combobox');
el.focus();
el.clear();
```

## Slots

| Slot | Params |
| --- | --- |
| option | option, index, active, selected, disabled |
| empty | query |
