# Combobox — the cross-framework headless combobox / autocomplete

`Combobox` is Rozie's **headless, fully-accessible** combobox / autocomplete — a `@rozie-ui` family with **no third-party engine** behind it. Every behaviour (the text input + popup listbox, `aria-activedescendant` keyboard navigation, client-side filtering, async/server-side mode, the selection model, and dismissal) is authored once in `Combobox.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

The WAI-ARIA combobox pattern — a `role="combobox"` input paired with a `role="listbox"` popup, navigated by `ArrowUp` / `ArrowDown` / `Home` / `End` with the active option tracked via `aria-activedescendant` and committed on `Enter` — is re-implemented (and frequently re-implemented *inaccessibly*) in every framework. Rozie owns the author-side API: the two-way `r-model:value` (the sole `model: true` prop, so a combobox **is** a form control), the internal query + open + active-descendant state, built-in client filtering with an async escape hatch (`disableFilter` + the `search` event), the keyboard model, and the token-themed skin.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/combobox` packages

`Combobox` ships as six pre-compiled, per-framework packages generated from a single `Combobox.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/combobox-react` | `npm i @rozie-ui/combobox-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/react/README.md) |
| `@rozie-ui/combobox-vue` | `npm i @rozie-ui/combobox-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/vue/README.md) |
| `@rozie-ui/combobox-svelte` | `npm i @rozie-ui/combobox-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/svelte/README.md) |
| `@rozie-ui/combobox-angular` | `npm i @rozie-ui/combobox-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/angular/README.md) |
| `@rozie-ui/combobox-solid` | `npm i @rozie-ui/combobox-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/solid/README.md) |
| `@rozie-ui/combobox-lit` | `npm i @rozie-ui/combobox-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Combobox.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Two-way bind `value` and hand the component an `options` array of `{ value, label }`. The component owns the input text, the open/closed popup, and the active-descendant highlight; `@change` fires when a selection is committed:

```rozie
<components>
{
  Combobox: './Combobox.rozie',
}
</components>

<data>
{
  framework: null,
}
</data>

<script>
const frameworks = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'solid', label: 'Solid' },
]
</script>

<template>
  <Combobox
    r-model:value="$data.framework"
    :options="frameworks"
    placeholder="Search a framework…"
    ariaLabel="Framework"
    @change="onPick"
  />
</template>
```

`r-model:value` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Combobox` the selected value, `Combobox` writes the newly-picked value back, and the framework reconciler picks it up — no `onChange → setState` wiring. The input *text* is internal state, not a second model (two models would forfeit the form-control story); a `search` event exposes the typed query for async / server-side filtering. Because `value` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — a `Combobox` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `value` | `unknown` | `null` | yes (via `r-model`) | The selected option's value — the sole `model: true` prop, so Angular emits a `ControlValueAccessor`. `null` when nothing is selected. |
| `options` | `Array` | `[]` | yes | The option list — `[{ value, label, disabled?, group? }]`. `label` is the displayed text (and what client filtering matches against); `value` is what `r-model:value` reads/writes; an optional `group` string buckets the option under a matching entry of the `groups` prop (or a first-appearance fallback section) when grouping is active. |
| `placeholder` | `String` | `''` | yes | Placeholder text for the empty input. |
| `disabled` | `Boolean` | `false` | yes | Disable the control (also sets the Angular CVA disabled state). |
| `disableFilter` | `Boolean` | `false` | yes | Opt **out** of built-in client filtering (async / server-side mode): render `options` as supplied and rely on the `search` event to refetch. Default: filter `options` by `label` against the typed query. |
| `ariaLabel` | `String` | `null` | yes | Accessible name for the input when there is no visible `<label for>` (reflected onto `aria-label`). |
| `idBase` | `String` | `"rozie-combobox"` | yes | id base for the listbox + option elements (`aria-activedescendant` needs real ids). Set a **distinct** value per instance when more than one combobox is on a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element. |
| `inline` | `Boolean` | `false` | yes | Render the results list in normal flow (static) rather than as an absolutely-positioned popup — use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. |
| `closeOnSelect` | `Boolean` | `true` | yes | Close the popup after a selection commits (default `true`, standard autocomplete behavior); set `false` to keep it open after a selection — e.g. in a multi-action surface. |
| `optionLabel` | `Function` | `null` | yes | Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property. |
| `optionValue` | `Function` | `null` | yes | Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property. |
| `optionDisabled` | `Function` | `null` | yes | Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property. |
| `virtual` | `Boolean` | `false` | yes | Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling popup (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed combobox. Pair with `inline` + `maxHeight`. |
| `estimateRowHeight` | `Number` | `36` | yes | Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on. |
| `maxHeight` | `String` | `''` | yes | A CSS length string bounding the popup scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-combobox-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off. |
| `groups` | `Array` | `[]` | yes | Ordered section list `[{ id, label }]` setting group order + heading text. Options are partitioned by their optional `group?` string; groups present on options but absent here fall back to first-appearance order after the listed ones. Empty/absent ⇒ flat, ungrouped rendering (default). |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired when the selected value changes — a user picks an option, or `clear()` resets it. Payload `{ value, option }` — the newly-selected option value plus the raw source option object (`null`/`null` after a clear). |
| `search` | Fired on every keystroke in the input. Payload `{ query }` — the current text. Pair it with `disableFilter` to drive async / server-side filtering. |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the text input. **Deliberately named `focus`**, which overrides the inherited `HTMLElement.focus` on the Lit custom element — the public `focus()` handle is intended (an accepted, warn-only ROZ137). This mirrors the slider / otp precedent; listbox took the other branch (`focusControl`). |
| `clear` | Reset the selection: clear `value` (emits `change` with `{ value: null }`) and empty the input text. Collision-safe — not a host-element member. |
| `seedQuery(text)` | **Imperative only** — sets the input text (and therefore the filtered option list) without touching the `value` model or selection state. Does not open the popup, select an option, or emit `change`/`search`. Not a second model (a combobox has a single `model: true` prop, `value` — a second model would forfeit the Angular `ControlValueAccessor`). Intended for repopulating the input on programmatic restore (e.g. a consumer's back-navigation). |
| `pinOpen(boolean)` | **Imperative only** — pin the popup open so blurring the input into a host sub-surface (e.g. an action flyout) does not collapse the list. `pinOpen(true)` pins; `pinOpen(false)` unpins. Unpinning alone does not itself close the popup or restore focus — that is the host's responsibility. Render-neutral: never calling it leaves behavior byte-identical to today. |

### Slots

| Slot | Params | Description |
| --- | --- | --- |
| `option` | `option, index, active, selected, disabled` | Custom per-option rendering. `option` is the raw source option object, `index` is its position in the filtered list, `active` is whether it is the active-descendant (keyboard-highlighted), `selected` is whether its value equals the bound `value`, `disabled` is the resolved disabled state. Omit it to render the plain resolved label. |
| `empty` | `query` | Rendered inside the open popup when the filtered list is empty. `query` is the current input text. Omit it to render the default "No results". |
| `groupHeading` | `group` | Custom rendering for a group's heading (only when grouping is active — see [Grouping options](#grouping-options)). `group` is `{ id, label }`. Omit it to render the plain `group.label`. |

## Grouping options

Pass an ordered `groups` prop and tag each option with a matching `group` id to partition the popup into semantic sections — each rendered as a `role="group"` block with an `aria-label` heading, following the [WAI-ARIA listbox-with-groups pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

```rozie
<template>
  <Combobox
    r-model:value="$data.userId"
    :options="[
      { value: 'apple', label: 'Apple', group: 'fruit' },
      { value: 'carrot', label: 'Carrot', group: 'veg' },
    ]"
    :groups="[
      { id: 'fruit', label: 'Fruit' },
      { id: 'veg', label: 'Vegetable' },
    ]"
  />
</template>
```

`groups` sets both the section order and the heading text; a group id present on an option but absent from `groups` falls back to a section titled with the id itself, appended after the listed ones (first-appearance order). Options with no `group` render in a single leading, unheaded section. Within every section, options keep their filtered/scored order — grouping is a stable re-partition, never a re-sort. The keyboard model (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`, `aria-activedescendant`) is unchanged: it walks the same group-ordered flat sequence, so on-screen order always matches keyboard order, and headings are never a keyboard stop. **Leaving `groups` empty (and no option carrying `group`) is byte-identical to the ungrouped combobox** — grouping is strictly additive and opt-in. Grouping is supported only in the standard (non-`virtual`) render; `groups` × `virtual` windowing is not yet supported.

## Filtering: client vs. async

By default `Combobox` filters the `options` you pass by `label`, case-insensitively, against the typed query — zero wiring required. For server-side or async data, set `disableFilter` and listen to `@search`: the component renders whatever `options` you currently hold and emits the query on each keystroke, so you can debounce, refetch, and feed the results straight back in:

```rozie
<template>
  <Combobox
    r-model:value="$data.userId"
    :options="$data.results"
    disableFilter
    placeholder="Search users…"
    @search="onSearch"
  />
</template>
```

```js
// debounced refetch — the component shows $data.results verbatim
const onSearch = (e) => debouncedFetch(e.query).then((rows) => ($data.results = rows))
```

## Theming

Every value the component renders is a `--rozie-combobox-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-combobox {
  --rozie-combobox-accent: #16a34a;
  --rozie-combobox-width: 20rem;
  --rozie-combobox-radius: 0.75rem;
  --rozie-combobox-list-max-height: 20rem;
}
```

The full token vocabulary — the wrapper width and font, the input box model (`input-padding`, `bg`, `color`, `border-width`, `border-color`, `radius`), the accent, the focus ring (`focus-ring-width`, `focus-ring-color`), the disabled state (`disabled-opacity`, `disabled-bg`), the popup listbox (`list-z`, `list-gap`, `list-padding`, `list-max-height`, `list-bg`, `list-border-color`, `list-shadow`), and the option (`option-padding`, `option-radius`, `option-active-bg`, `option-selected-weight`, `option-selected-color`, `option-disabled-opacity`) — has documented defaults in `themes/base.css`. Only cosmetic values flow through tokens; the structural rules (the relative wrapper, the absolutely-positioned popup, the input box model, the focus ring) compile per-leaf and are not consumer-overridable.

### Design-system bridges

Each package ships token presets that map the combobox tokens onto a known design system's published CSS variables — so the control automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/combobox-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--ring/--border/--background/--popover…
import '@rozie-ui/combobox-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/combobox-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/combobox-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/src/themes/base.css).

## Keyboard

Focus the input, then type to filter and drive the popup from the keyboard:

| Key | Action |
| --- | --- |
| typing | Filters `options` by `label` (unless `disableFilter`), opens the popup, and emits `search`. |
| `↓` / `↑` | Open the popup (if closed) and move the active option down / up, skipping disabled options and clamping at the ends. |
| `Home` / `End` | Move the active option to the first / last selectable option. |
| `Enter` | Commit the active option (writes `value`, fires `change`, closes the popup). |
| `Escape` | Close the popup without changing the selection. |

Pointer interaction mirrors the keyboard: hovering an option makes it active, and selecting fires on `mousedown` (before the input blurs), so a click commits without the popup closing first.

## Accessibility

- The input is `role="combobox"` with `aria-autocomplete="list"`, `aria-expanded` reflecting the popup state, `aria-controls` pointing at the listbox id, and `aria-activedescendant` pointing at the active option's id (so screen readers announce the highlighted option without moving real DOM focus).
- The popup is `role="listbox"`; each option is `role="option"` with `aria-selected` and `aria-disabled` reflected from its data.
- Supply an accessible name via a visible `<label for>` pointing at the input, or the `ariaLabel` prop.
- Set a distinct `idBase` per instance when more than one combobox shares a page — `aria-activedescendant` requires unique option ids.
- Dismissal uses the headless pattern (options select on `@mousedown.prevent`, the input's `@blur` closes the popup), so there is no document click-outside listener and therefore no cross-Lit-shadow retargeting problem.

## v1 scope

The popup is positioned directly below the input (CSS `position: absolute`); there is **no floating-ui-style auto-flip/shift** to keep it on-screen near a viewport edge — a deliberate no-engine v1 limitation. See the [comparison](/components/combobox-comparison#what-rozie-defers) for the full list of deferrals.
