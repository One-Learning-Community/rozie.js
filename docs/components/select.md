# Select — the cross-framework headless select

`Select` is the simple select: pick one value (or several) from a fixed list. For type-to-filter with an editable input, use [Combobox](/components/combobox) instead; the two share the same `@rozie-ui/headless-core` list spine. `Select` is headless and fully accessible, with no third-party engine behind it. It covers roving virtual focus, full keyboard navigation, type-ahead, single and multi select, option groups, a clear button, a floating popup (through `@rozie-ui/popover`), an opt-in native picker on touch devices, and windowing for long lists. The same component ships for React, Vue, Svelte, Angular, Solid, and Lit.

There is no vanilla-JS dependency: selection state, keyboard navigation, type-ahead, and focus management are implemented directly against the platform. Every visual value is a CSS custom property, so the select re-skins to any design system, with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

<PublishedTargetsNotice family="select" :published="[]" />

## The `@rozie-ui/select` packages

`Select` is designed to ship as six pre-compiled, per-framework packages, but none of them is published to npm yet — all six are still in dogfooding. (The earlier `@rozie-ui/listbox-solid` package is superseded by this family.) The rows below link to each workspace README for review:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/select-react` | *not yet published (dogfooding)* | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/react/README.md) |
| `@rozie-ui/select-vue` | *not yet published (dogfooding)* | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/vue/README.md) |
| `@rozie-ui/select-svelte` | *not yet published (dogfooding)* | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/svelte/README.md) |
| `@rozie-ui/select-angular` | *not yet published (dogfooding)* | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/angular/README.md) |
| `@rozie-ui/select-solid` | *not yet published (dogfooding)* | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/solid/README.md) |
| `@rozie-ui/select-lit` | *not yet published (dogfooding)* | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/packages/lit/README.md) |

Each package carries its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`) **plus a required non-optional peer chain**: `@rozie-ui/popover-<target>` — composed internally for the floating popup — which in turn requires `@floating-ui/dom`. Each leaf's own README gives one copy-paste `npm i` line covering the whole chain.

The leaves also require `@tanstack/virtual-core` (`^3`), the windowing engine behind `virtual`. Select imports it whether or not you set `virtual`, so install it in every project. In practice, install the target's `Select` package together with its peers:

```bash
npm i @rozie-ui/select-<target> @rozie-ui/popover-<target> @floating-ui/dom @tanstack/virtual-core
```

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

A listed group with no matching options renders no heading. Options without a `group` come first with no heading, then the listed groups in `groups` order, then any group that appears on an option but is not listed (headed by its id). Options keep their source order inside a group. Each section is a `role="group"` element named by its label, and the arrow keys, Home/End and type-ahead walk the options in the order they are shown. Grouping applies only while `groups` is non-empty, and is not applied while `virtual` is on.

## Multiple selection with chips

Set `multiple` and `value` becomes an array. Picking an option toggles its membership and the popup stays open. The selected values render as removable chips inside the control; a value that is missing from `options` keeps a chip labelled by its raw value. Backspace removes the last chip while the popup is closed.

```rozie
<template>
  <Select r-model:value="$data.picked" :options="$data.fruits" multiple placeholder="Pick some fruit…" />
</template>
```

The `chip` slot replaces one chip's content (it receives `option`, `remove` and `index`). An interactive element a consumer renders inside a chip, such as a remove button, does not toggle the popup; non-interactive chip content (the label) does. If you build an interactive element out of a non-button, give it `role="button"`, or use a real `<button>`.

## Clearable

`clearable` shows a clear button in the control whenever there is a value (its accessible name is `clearLabel`, default "Clear"). Delete also clears from the keyboard while the popup is closed. In single-select Backspace clears too; in multi-select Delete clears every value and Backspace removes only the last chip.

```rozie
<template>
  <Select r-model:value="$data.fruit" :options="$data.fruits" clearable clear-label="Reset" />
</template>
```

`change` fires on a clear with `{ value: null, option: null }` (`[]` in multi-select).

## Positioning and sizing

The popup floats through the composed `@rozie-ui/popover` leaf (Floating UI). It opens below the control at the control's width, flips above when there is no room below, and shifts to stay on-screen. Four props steer it, and `inline` switches the floating off:

| Prop | Effect |
| --- | --- |
| `placement` | Which side and alignment of the control the popup opens on: `top`, `right`, `bottom` or `left`, each optionally suffixed `-start` or `-end`. Default `bottom-start`. |
| `offset` | The gap in pixels between the control and the popup. Default `4`. |
| `disableFlip` | Keep the popup on `placement` even when it would overflow the viewport. |
| `disableShift` | Keep the popup strictly aligned to the control instead of sliding it into view. |

The floating popup's gap is the `offset` prop. The `--rozie-select-list-gap` token only affects `inline`, where the list is in normal flow. With `inline` set, `placement`, `offset`, `disableFlip` and `disableShift` are ignored.

The control has a fixed default width (`16rem`, the `--rozie-select-width` token, the same rule as Combobox). A root sized with CSS does not stretch its control; set `block` (or `inline`, which also makes the root block-level at 100% width so the control stretches) to make the root `display: block; width: 100%` so the control and the width-matched popup fill the container.

Select sets `--rozie-popover-z` on its root from the `--rozie-select-z` token (default `1000`), so override `--rozie-select-z` to raise or lower the popup's stacking, not the popover token.

## Native mobile picker

On a phone the operating system's own picker (the iOS wheel, the Android dialog) is usually the better list. Set `nativePicker` on a single-select and, whenever the primary pointer is coarse (`matchMedia('(pointer: coarse)')`, re-evaluated when it changes), an invisible native `<select>` is laid over the control: the control looks the same, and a tap opens the OS picker instead of the custom popup.

```rozie
<template>
  <Select r-model:value="$data.fruit" :options="$data.fruits" native-picker placeholder="Pick a fruit…" aria-label="Fruit" />
</template>
```

- `value` and `change` behave as on the custom path: option values of any type (numbers, objects) come back unchanged, and `change` carries the same `{ value, option }` payload. `open-change` does not fire for the OS picker.
- `groups` render as `<optgroup>` sections (ungrouped options first) and disabled options are disabled. The clear button stays tappable above the overlay.
- The `placeholder` is the first entry of the OS picker. With `clearable`, choosing it clears the value; without `clearable` it is disabled once there is a value.
- If your code does not accept a commit (a controlled value you keep as it was), the OS picker goes back to showing the real selection.
- What the OS picker cannot do is left out: `option`, `groupHeading` and `empty` slot content is not shown there, and the keyboard model in [Keyboard](#keyboard) does not apply.
- While it is active the native `<select>` carries the `ariaLabel` and takes focus; the custom trigger is `aria-hidden` and out of the tab order, and the root carries the `rozie-select--native` class. The `open()` and `toggle()` handle verbs do nothing while it is active (the OS picker cannot be opened from script); `close()`, `clear()` and `focusControl()` work as usual.
- The native `<select>` has no `name`: it does not take part in form submission.

The native picker has four limits:

1. Slot content is not shown: `option`, `groupHeading` and `empty` slots do not appear in the OS picker.
2. It is single-select only: a `multiple` select always uses the custom popup.
3. It is not available with `virtual`.
4. It is not available with `inline`.

It also stays off with a mouse or trackpad, whatever the props.

## Long lists

Set `virtual` to window a long option list. It uses the `@tanstack/virtual-core` (`^3`) peer every Select install already includes: only the visible slice renders inside a bounded scrolling list, with spacers keeping the total scroll height. Bound the list with `maxHeight` (for example `'320px'`) and, if your rows are not about 36px tall, seed `estimateRowHeight`. Windowing works in the floating popup and with `inline` alike. Groups are ignored while `virtual` is on: the options render flat, in source order.

```rozie
<template>
  <Select r-model:value="$data.n" :options="$data.thousands" virtual max-height="320px" />
</template>
```

## Option values

How a value is matched to an option decides which options show as selected.

- Primitive values compare as `===` (so `NaN` equals `NaN`).
- Object values match by identity first. Only when no option is identical do plain objects and arrays compare by content, bounded to 32 levels and 2,000 object-pair comparisons per value pair. Dates, Maps, Sets, class instances, and plain objects from another realm (an iframe) match by identity only.
- On Vue and Svelte, a value read back through reactive state is a proxy. Two options whose values are equal-content objects can both show as selected, and a class-instance or `Map` value held in reactive state never shows as selected. Map the options to a primitive with `optionValue` (an id) and the question goes away.
- A value that a multi-select model holds more than once shows as one chip. Removing that chip removes every occurrence, and Backspace removes the last chip shown.
- `options` may grow or shrink in place (`push`, `splice`). To replace an option, pass a new array.

## Not yet supported

- **Native form submission.** There is no `name` / `required` support yet: a `Select` does not take part in a native `<form>` submission. On Angular the control binds through `ngModel` / `formControl` today.

## Known limitations

- **A refused pick with one-way binding.** With a one-way `value` binding, a consumer that refuses a pick in its `change` handler (by keeping the old value) does not move the control back on Vue, Svelte and Angular. With two-way binding (`r-model:value`, `v-model`, `bind:value`, `[(value)]`) the same happens on Angular. Prefer two-way binding; on Angular, until this is fixed in the compiler, avoid writing the old value back inside the `change` handler.
- **React: `close()` then `open()` in one tick.** Calling the handle's `close()` and then `open()` in the same tick on an open select leaves it closed. Call them in separate ticks.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `options` | `Array` | `[]` | yes | The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`. An option is selected when its value is identical to the model value. Only when no option is identical does a value match by content, and only a plain object or an array: equal own properties, compared up to 32 levels deep and at most 2,000 object-pair comparisons per value pair, beyond which the two values count as different. That is how a plain-object value read back through reactive state (Vue `ref` / `reactive`, Svelte `$state`) still shows as selected. Every other object matches by identity only — a class instance, a `Map`, a `Set`, and a plain object created in another realm (an iframe). On Vue that means a class-instance or `Map` value held in reactive state never shows as selected. Two options whose plain-object values have equal contents cannot be told apart on Vue and Svelte. Mapping options to a primitive with `optionValue` is the robust choice. The list may grow or shrink in place (`push`, `splice`); to change an option, pass a new array. |
| `value` | `unknown` | `null` | yes (via `r-model`) | The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Select **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). How a value is matched to an option is described under `options`. |
| `multiple` | `Boolean` | `false` | yes | Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit. Selected values render as removable chips inside the control (a value missing from `options` keeps a chip labelled by its raw value), and Backspace removes the last chip while the popup is closed. A value the array holds more than once shows a single chip; removing that chip, or picking its option again, removes every occurrence. Backspace removes the last chip shown. |
| `inline` | `Boolean` | `false` | yes | Render the results list in normal flow (static) rather than as a floating popup. Use when embedding the select inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior). |
| `disabled` | `Boolean` | `false` | yes | Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state. |
| `placeholder` | `String` | `''` | yes | Placeholder text shown in the empty control. |
| `closeOnSelect` | `Boolean` | `true` | yes | Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting. |
| `optionLabel` | `Function` | `null` | yes | Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property. |
| `optionValue` | `Function` | `null` | yes | Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property. Returning a primitive (an id) is the robust way to use object options; see `options` for how values are matched. |
| `optionDisabled` | `Function` | `null` | yes | Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property. |
| `idBase` | `String` | `''` | yes | Id base for the popup and option elements — `aria-activedescendant` needs real ids. Option ids are `idBase + "-opt-" + i`, the popup id is `idBase + "-list"`. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-select-<n>`). Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element. |
| `hideEmpty` | `Boolean` | `false` | yes | Show nothing instead of the empty state: when there are no options the popup is not shown, the control reports `aria-expanded="false"`, and Escape is left to the host. |
| `selectOnTab` | `Boolean` | `false` | yes | Tab picks the highlighted option while the popup is open and an option is highlighted, then moves focus normally. Default `false` (Tab only closes the popup). |
| `clearable` | `Boolean` | `false` | yes | Show a clear button in the control whenever there is a value, and let Delete clear it from the keyboard while the popup is closed. In single-select Backspace clears too; in multi-select Delete clears every value while Backspace removes only the last chip. |
| `clearLabel` | `String` | `"Clear"` | yes | Accessible name of the clear button (`aria-label`). Localise it. |
| `nativePicker` | `Boolean` | `false` | yes | Single-select only. On touch devices (primary pointer coarse), open the operating system's own picker instead of the custom popup. Custom `option`, `groupHeading` and `empty` slot content does not appear in the OS picker. The picker lists the `placeholder` as its first entry: with `clearable` choosing it clears the value; without `clearable` it is disabled once there is a value. Has no effect with a mouse, with `multiple`, with `virtual`, or with `inline`. |
| `placement` | `String` | `"bottom-start"` | yes | Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end`. Default `"bottom-start"` keeps the popup flush with the control's left edge. Ignored when `inline` is set. |
| `offset` | `Number` | `4` | yes | Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Default `4`. Ignored when `inline` is set (the in-flow gap is the `--rozie-select-list-gap` token). |
| `disableFlip` | `Boolean` | `false` | yes | Disable the popup's Floating UI `flip` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup flips above the control when it would overflow the viewport below; set this to keep it pinned to `placement` regardless. Ignored when `inline` is set. |
| `disableShift` | `Boolean` | `false` | yes | Disable the popup's Floating UI `shift` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup shifts to stay within the viewport; set this to keep it strictly aligned to the control. Ignored when `inline` is set. |
| `block` | `Boolean` | `false` | yes | Fill the container: the root becomes `display: block; width: 100%`, the control stretches to that width, and the width-matched popup follows. Adds the `rozie-select--block` modifier class on the root. Default `false` keeps the fixed-width control (`--rozie-select-width`, `16rem` by default). |
| `groups` | `Array` | `[]` | yes | Ordered section list `[{ id, label }]` setting group order and heading text. Options are partitioned by their optional `group` string; groups present on options but absent here follow in first-appearance order. Empty (the default) renders a flat list. Ignored when `virtual` is on. |
| `ariaLabel` | `String` | `null` | yes | Accessible name for the control (`aria-label`). This is how you name the select: the focusable control is a `role="combobox"` element, not a form input, so a `<label for>` cannot point at it. Set it to the text of your visible label. |
| `virtual` | `Boolean` | `false` | yes | Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height). Default `false` renders every option. Set `maxHeight` to bound the scrolling list; windowing works in the floating popup and with `inline` alike. Grouping is not applied while `virtual` is on. |
| `estimateRowHeight` | `Number` | `36` | yes | Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on. |
| `maxHeight` | `String` | `''` | yes | A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-select-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off. |

### Events

| Event | Description |
| --- | --- |
| `open-change` | Fired whenever the popup opens or closes. Payload `{ open: boolean }`. |
| `change` | Fired after the selection changes. Payload `{ value, option }` — `value` is the new selected value (an array in multi-select), `option` is the toggled option (`null` when cleared or when a chip is removed). |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `open` | Open the popup (no-op when disabled or already open). |
| `close` | Close the popup. |
| `toggle` | Toggle the popup open/closed. |
| `clear` | Clear the selection (`null`, or `[]` in multi-select). |
| `focusControl` | Move DOM focus to the control. (Named `focusControl`, not `focus`, so it does not override the native `HTMLElement.focus` on the Lit element.) |

### Slots

| Slot | Params | Description |
| --- | --- | --- |
| `selected` | `selected, value` | Custom rendering of the trigger's chosen-value display. Single-select only: with `multiple` the selected values render as chips (see `chip`). |
| `option` | `option, index, active, selected, disabled` | Custom per-option rendering (the main scoped slot). |
| `empty` | `query` | Shown when there are no options. `query` is always an empty string (Select has no filter). |
| `chip` | `option, remove, index` | Custom rendering of one multi-select chip, inside the `.rozie-select-chip` wrapper (`option` is `null` for a value missing from `options`; `remove()` removes that value and refocuses the control). Defaults to a label plus a remove button. |
| `groupHeading` | `group` | Custom rendering of a group's heading (`group` is the `{ id, label }` entry). Defaults to the group's label. |

## Theming

Every value the component renders is a `--rozie-select-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-select {
  --rozie-select-accent: #16a34a;
  --rozie-select-radius: 10px;
  --rozie-select-bg: #0b1220;
  --rozie-select-color: #e5e7eb;
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
| `Space` | Toggle the popup / commit the active option. |
| `Tab` | Close the popup and move on. With `selectOnTab`, first picks the highlighted option. |
| _printable_ | Type-ahead — jump to the first option whose label starts with the typed buffer. |

## Accessibility

- The control carries `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; the popup is `role="listbox"` (with `aria-multiselectable` in multi-select); each option is `role="option"` with `aria-selected` / `aria-disabled`.
- The popup is positioned by composing the published [`@rozie-ui/popover`](/components/popover) leaf (Floating UI): it opens below the control at the control's width, flips above when there is no room below, and shifts to stay on-screen. A click outside, or Escape, closes it; `open-change` fires once per open or close whichever way it happened. `inline` switches the floating off and renders the list in normal flow.
- Name the select with the `ariaLabel` prop. The focusable control is a `role="combobox"` element, not a form input, so a `<label for>` cannot point at it; when you show a visible label, pass the same text as `ariaLabel`.
- Each instance generates a unique id base after mount, so several selects on one page never share option ids or `aria-activedescendant` references. Set `idBase` yourself only when you need stable ids.
