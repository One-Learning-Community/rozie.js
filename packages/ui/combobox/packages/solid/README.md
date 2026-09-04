# @rozie-ui/combobox-solid

Idiomatic **solid** `Combobox` — a headless, fully-accessible (WAI-ARIA) combobox / autocomplete: a text input plus a popup listbox with `aria-activedescendant` keyboard navigation (Arrow/Home/End/Enter/Escape), built-in client-side filtering (or async/server-side via the `search` event + `disableFilter`), a custom-option scoped slot, and a two-way `value` binding — compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. There is NO third-party engine; the behaviour is authored once on native DOM. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/combobox-solid
```

Peer dependencies: `solid-js`. Install them alongside this package.

**Required peers** — beyond the framework peer above, this package requires these non-optional peers to actually render:

- `@rozie-ui/popover-solid` `^0.2.0` — required by `@rozie-ui/combobox-solid`
- `@floating-ui/dom` `^1.7.2` — required by `@rozie-ui/popover-solid`

Install the whole chain in one line:

```bash
npm i @rozie-ui/combobox-solid @rozie-ui/popover-solid @floating-ui/dom
```

Also installed: `@rozie/runtime-solid` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. Your bundler keeps only the helpers this component actually uses — typically a few hundred bytes to a few KB, minified and gzipped. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

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
| `inline` | `Boolean` | `false` |  |  |
| `closeOnSelect` | `Boolean` | `null` |  |  |
| `multiple` | `Boolean` | `false` |  |  |
| `creatable` | `Boolean` | `false` |  |  |
| `optionLabel` | `Function` | `null` |  |  |
| `optionValue` | `Function` | `null` |  |  |
| `optionDisabled` | `Function` | `null` |  |  |
| `virtual` | `Boolean` | `false` |  |  |
| `estimateRowHeight` | `Number` | `36` |  |  |
| `maxHeight` | `String` | `''` |  |  |
| `groups` | `Array` | `[]` |  |  |
| `groupCap` | `Number` | `0` |  |  |
| `placement` | `String` | `"bottom-start"` |  |  |
| `offset` | `Number` | `4` |  |  |
| `disableFlip` | `Boolean` | `false` |  |  |
| `disableShift` | `Boolean` | `false` |  |  |

## Events

| Event | Description |
| --- | --- |
| `create` | Fired when `creatable` is set and the user commits text matching no option (case-insensitive, trimmed, exact label equality — no Unicode normalization). Payload `{ query }` — the committed text. Combobox writes NOTHING to `value` when this fires — the consumer is responsible for adding the option to `options` and updating the model itself. Fires at most once per distinct query (a double-commit of the same text is a no-op); composes with `multiple` (`value` stays untouched there too). |
| `change` | Fired when the selected value changes — a user picks an option (toggling membership in `multiple` mode), or `clear()` resets it. Payload `{ value, option, selected }`. `value` is always the model's NEW value — the whole array in `multiple` mode, the scalar (or `null`) in single mode. `option` is the raw source option that was just toggled (`null` after a `clear()`). `selected` names the direction of the toggle: `true` when the option was just added (and always `true` in single-select), `false` when it was just removed or after `clear()`. |
| `search` | Fired on every keystroke in the input. Payload `{ query }` — the current text. Pair it with `disableFilter` to drive async / server-side filtering: refetch `options` from the query and the popup re-renders the supplied list verbatim. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the text input) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the text input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `clear` | Reset the selection: clear `value` (emits `change` with `{ value: null }` in single-select mode, `{ value: [] }` under `multiple`) and empty the input text. |
| `seedQuery` | Imperative-only: set the input text (`text ?? ''`, coerced to a string) without touching the `value` model or selection state — the typed query AND the filtered option list reflect it. Does not open the popup or emit `change`/`search`. |
| `pinOpen` | Imperative-only: pin (or unpin) the popup open, coercing its argument to a boolean. While pinned, onBlur() early-returns so the popup does NOT collapse when a host sub-surface (e.g. an action flyout) moves DOM focus out of the input. pinOpen(false) only unpins — it does not itself close the popup or restore focus (the host does that). Render-neutral when never called. |

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
| chip | option, remove, index |
| option | option, index, active, selected, disabled |
| empty | query |
| create | query |
| groupHeading | group |
| option | option, index, active, selected, disabled |
| empty | query |
| create | query |
| groupHeading | group |
| option | option, index, active, selected, disabled |
| groupMore | group, hidden, expand |
| empty | query |
| create | query |
| option | option, index, active, selected, disabled |
| empty | query |
| create | query |
