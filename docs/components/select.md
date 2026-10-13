# Select — the cross-framework headless select

`Select` is a headless, fully-accessible select-only select with no third-party engine behind it. It covers the whole behaviour surface: roving virtual focus, full keyboard navigation, type-ahead, and single + multi select. The same component ships for React, Vue, Svelte, Angular, Solid, and Lit. (For a type-to-filter editable input, reach for the sibling [`@rozie-ui/combobox`](/components/combobox) — it shares the same `@rozie-ui/headless-core` list spine.)

There is no vanilla-JS dependency: selection state, keyboard navigation, type-ahead, and focus management are implemented directly against the platform. Every visual value is a CSS custom property, so the select re-skins to any design system, with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

<PublishedTargetsNotice family="select" :published="['solid']" />

## The `@rozie-ui/select` packages

`Select` is designed to ship as six pre-compiled, per-framework packages, but today only `@rozie-ui/select-solid` is on npm — the rest are still in dogfooding. Install the published one for real use; the other rows below link to their workspace README for review:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/select-react` | *not yet published (dogfooding)* | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/react/README.md) |
| `@rozie-ui/select-vue` | *not yet published (dogfooding)* | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/vue/README.md) |
| `@rozie-ui/select-svelte` | *not yet published (dogfooding)* | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/svelte/README.md) |
| `@rozie-ui/select-angular` | *not yet published (dogfooding)* | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/angular/README.md) |
| `@rozie-ui/select-solid` | `npm i @rozie-ui/select-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/solid/README.md) |
| `@rozie-ui/select-lit` | *not yet published (dogfooding)* | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/lit/README.md) |

Each package carries its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`) **plus a required non-optional peer chain**: `@rozie-ui/popover-<target>` — composed internally for the floating popup — which in turn requires `@floating-ui/dom`. Each leaf's own README gives one copy-paste `npm i` line covering the whole chain.

## Quick start

Pass an `options` array and two-way bind `value`:

```rozie
<components>
{
  Select: './Select.rozie',
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
  <Select r-model:value="$data.fruit" :options="$data.fruits" placeholder="Pick a fruit…">
    <template #option="{ option, active, selected }">
      <span :class="{ active, selected }">{{ option.label }}</span>
    </template>
  </Select>
</template>
```

`r-model:value` is Rozie's [two-way bind](/guide/props-and-two-way#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Select` a value, `Select` writes the new selection back, and the framework reconciler picks it up with no `onChange → setState` wiring. Because `value` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor`, so a `Select` is a form control (`[formControl]` / `[(ngModel)]` bind directly).

## Option groups

Give each option an optional `group` id and pass `groups` — an ordered `[{ id, label }]` list — to render the options in sections:

```rozie
<template>
  <Select
    r-model:value="$data.food"
    :options="[
      { label: 'Apple', value: 'apple', group: 'fruit' },
      { label: 'Carrot', value: 'carrot', group: 'veg' },
      { label: 'Water', value: 'water' },
    ]"
    :groups="[{ id: 'veg', label: 'Vegetables' }, { id: 'fruit', label: 'Fruit' }]"
  >
    <template #groupHeading="{ group }"><strong>{{ group.label }}</strong></template>
  </Select>
</template>
```

Options without a `group` come first with no heading, then the listed groups in `groups` order, then any group that appears on an option but is not listed (headed by its id). Options keep their source order inside a group. Each section is a `role="group"` element named by its label, and the arrow keys, Home/End and type-ahead walk the options in the order they are shown. Grouping applies only while `groups` is non-empty, and is not applied while `virtual` is on.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `options` | `Array` | `[]` | yes | The option set. Each entry is a primitive (`string`/`number`) or an object resolved via the `option*` props (falling back to `.label` / `.value` / `.disabled`). |
| `value` | `unknown` | `null` | yes (via `r-model`) | The selected value. `model: true` — scalar in single-select, an array of values in multi-select. The sole model prop, so Angular emits a `ControlValueAccessor`. |
| `multiple` | `Boolean` | `false` | yes | Multi-select: `value` becomes an array; selecting toggles membership and keeps the popup open. |
| `inline` | `Boolean` | `false` | yes | Render the results list in normal flow (static) rather than as a floating popup, so an `overflow:hidden` ancestor (e.g. a command palette) can't clip it. Defaults to the standalone dropdown behavior. |
| `disabled` | `Boolean` | `false` | yes | Disable the control (also sets the Angular CVA disabled state). |
| `placeholder` | `String` | `''` | yes | Placeholder text for the empty control. |
| `closeOnSelect` | `Boolean` | `true` | yes | Close the popup after a single-select commit. Multi-select keeps it open regardless. |
| `optionLabel` | `Function` | `null` | yes | `(option) => string` — resolve an object option's display label. |
| `optionValue` | `Function` | `null` | yes | `(option) => value` — resolve an object option's committed value. |
| `optionDisabled` | `Function` | `null` | yes | `(option) => boolean` — mark an option non-selectable. |
| `idBase` | `String` | `''` | yes | Id base for the popup, option and control elements. Option ids are `idBase + "-opt-" + i`, the popup id is `idBase + "-list"`. Empty (the default): each instance generates a unique base after mount (`rozie-select-<n>`). |
| `hideEmpty` | `Boolean` | `false` | yes | Show nothing instead of the empty state: with no options the popup is not shown, `aria-expanded` is `false`, and Escape is left to the host. |
| `selectOnTab` | `Boolean` | `false` | yes | Tab picks the highlighted option while the popup is open and an option is highlighted, then moves focus normally. Default `false` (Tab only closes the popup). |
| `clearable` | `Boolean` | `false` | yes | Show a clear button in the control whenever there is a value, and let Delete (and Backspace in single-select) clear it from the keyboard while the popup is closed. |
| `clearLabel` | `String` | `"Clear"` | yes | Accessible name of the clear button (`aria-label`). Localise it. |
| `ariaLabel` | `String` | `null` | yes | Accessible name for the control when there is no visible `<label for>`. |
| `groups` | `Array` | `[]` | yes | Ordered section list `[{ id, label }]` setting group order and heading text. Options are partitioned by their optional `group` string; ungrouped options come first, and groups present on options but absent here follow in first-appearance order. Keyboard navigation and type-ahead follow that visual order. Empty (the default) renders a flat list. Ignored when `virtual` is on. |
| `virtual` | `Boolean` | `false` | yes | Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed select. Pair with `inline` + `maxHeight`. Grouping is not applied while `virtual` is on. |
| `estimateRowHeight` | `Number` | `36` | yes | Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on. |
| `maxHeight` | `String` | `''` | yes | A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-select-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off. |
| `placement` | `String` | `"bottom-start"` | yes | Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf — `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end`. Ignored when `inline` is set. |
| `offset` | `Number` | `4` | yes | Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Ignored when `inline` is set (the in-flow gap is the `--rozie-select-popup-offset` token). |
| `disableFlip` | `Boolean` | `false` | yes | Disable the popup's Floating UI `flip` middleware: by default the popup flips above the control when there is no room below. Ignored when `inline` is set. |
| `disableShift` | `Boolean` | `false` | yes | Disable the popup's Floating UI `shift` middleware: by default the popup shifts to stay within the viewport. Ignored when `inline` is set. |
| `block` | `Boolean` | `false` | yes | Fill the container: the root becomes `display: block; width: 100%`, the control stretches to that width, and the width-matched popup follows. Adds the `rozie-select--block` modifier class on the root. |

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
| `groupHeading` | `group` | Custom rendering of a group's heading (`group` is the `{ id, label }` entry). Defaults to the group's label. |

## Theming

Every value the component renders is a `--rozie-select-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-select {
  --rozie-select-accent: #16a34a;
  --rozie-select-radius: 10px;
  --rozie-select-bg: #0b1220;
  --rozie-select-fg: #e5e7eb;
}
```

The complete token table and the design-system bridges live on the [dedicated theming page](/components/select-theming).

## Keyboard

It follows the [ARIA APG "Select-Only Combobox" pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): DOM focus stays on the control while the highlighted option is tracked virtually via `aria-activedescendant`.

| Key | Action |
| --- | --- |
| `↓` / `↑` | Open the popup / move the active option down / up (wraps, skips disabled). |
| `Home` / `End` | Jump to the first / last enabled option. |
| `Enter` | Commit the active option. |
| `Escape` | Close the popup and return focus to the control. |
| `Space` | (Select-only) toggle the popup / commit the active option. |
| `Tab` | Close the popup and move on. With `selectOnTab`, first picks the highlighted option. |
| _printable_ | (Select-only) type-ahead — jump to the first option whose label starts with the typed buffer. |

## Accessibility

- The control carries `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; the popup is `role="listbox"` (with `aria-multiselectable` in multi-select); each option is `role="option"` with `aria-selected` / `aria-disabled`.
- The popup is positioned by composing the published [`@rozie-ui/popover`](/components/popover) leaf (Floating UI): it opens below the control at the control's width, flips above when there is no room below, and shifts to stay on-screen. A click outside, or Escape, closes it; `open-change` fires once per open or close whichever way it happened. `inline` switches the floating off and renders the list in normal flow.
- Supply an accessible name via a visible `<label for>` pointing at the control's `id`, or the `ariaLabel` prop.
- Each instance generates a unique id base after mount, so several selectes on one page never share option ids or `aria-activedescendant` references. Set `idBase` yourself only when you need stable ids.
