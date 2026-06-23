# @rozie-ui/combobox-solid

Idiomatic **solid** `Combobox` — a headless, fully-accessible (WAI-ARIA) combobox / autocomplete: a text input plus a popup listbox with `aria-activedescendant` keyboard navigation (Arrow/Home/End/Enter/Escape), built-in client-side filtering (or async/server-side via the `search` event + `disableFilter`), a custom-option scoped slot, and a two-way `value` binding — compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. There is NO third-party engine; the behaviour is authored once on native DOM. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/combobox-solid
```

Peer dependencies: `solid-js`. Install them alongside this package.

## Usage

```tsx
import { createSignal } from 'solid-js';
import { Combobox } from '@rozie-ui/combobox-solid';

const frameworks = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'solid', label: 'Solid' },
];

export function Demo() {
  const [value, setValue] = createSignal<string | null>(null);
  return (
    <Combobox
      value={value()}
      onValueChange={setValue}
      options={frameworks}
      placeholder="Search…"
      ariaLabel="Framework"
      onChange={(e) => console.log('picked:', e.value)}
    />
  );
}
```

## Theming

Every visual value is a `--rozie-combobox-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```tsx
import '@rozie-ui/combobox-solid/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
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

```tsx
import { Combobox, type ComboboxHandle } from '@rozie-ui/combobox-solid';

let handle: ComboboxHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Combobox ref={(h) => (handle = h)} value={value()} options={frameworks} />;
handle?.clear();
```

## Slots

| Slot | Params |
| --- | --- |
| option | option, active, selected |
