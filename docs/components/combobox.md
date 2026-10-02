# Combobox — the cross-framework headless combobox / autocomplete

`Combobox` is a headless, fully-accessible combobox / autocomplete with no third-party engine behind it. It covers the whole behaviour surface: the text input + popup listbox, `aria-activedescendant` keyboard navigation, client-side filtering, async/server-side mode, the selection model, and dismissal. The same component ships for React, Vue, Svelte, Angular, Solid, and Lit.

The WAI-ARIA combobox pattern — a `role="combobox"` input paired with a `role="listbox"` popup, navigated by `ArrowUp` / `ArrowDown` / `Home` / `End` with the active option tracked via `aria-activedescendant` and committed on `Enter` — is re-implemented (and frequently re-implemented *inaccessibly*) in every framework. Rozie owns the author-side API: the two-way `r-model:value` (the sole `model: true` prop, so a combobox **is** a form control), the internal query + open + active-descendant state, built-in client filtering with an async escape hatch (`disableFilter` + the `search` event), the keyboard model, and the token-themed skin.

Every visual value is a CSS custom property, so the control re-skins to any design system, with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/combobox` packages

`Combobox` ships as six pre-compiled, per-framework packages. Install the one for your framework; there is no build step and no Rozie toolchain to set up:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/combobox-react` | `npm i @rozie-ui/combobox-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/react/README.md) |
| `@rozie-ui/combobox-vue` | `npm i @rozie-ui/combobox-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/vue/README.md) |
| `@rozie-ui/combobox-svelte` | `npm i @rozie-ui/combobox-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/svelte/README.md) |
| `@rozie-ui/combobox-angular` | `npm i @rozie-ui/combobox-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/angular/README.md) |
| `@rozie-ui/combobox-solid` | `npm i @rozie-ui/combobox-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/solid/README.md) |
| `@rozie-ui/combobox-lit` | `npm i @rozie-ui/combobox-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/packages/lit/README.md) |

Each package carries its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`) **plus a required non-optional peer chain**: `@rozie-ui/popover-<target>` `^0.2.0` — composed internally for the floating popup — which in turn requires `@floating-ui/dom` `^1.7.2`. Each leaf's own README gives one copy-paste `npm i` line covering the whole chain.

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

`r-model:value` is Rozie's [two-way bind](/guide/props-and-two-way#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Combobox` the selected value, `Combobox` writes the newly-picked value back, and the framework reconciler picks it up with no `onChange → setState` wiring. The input *text* is internal state, not a second model (two models would forfeit the form-control story); a `search` event exposes the typed query for async / server-side filtering. Because `value` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor`, so a `Combobox` is a form control (`[formControl]` / `[(ngModel)]` bind directly).

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
| `idBase` | `String` | `''` | yes | id base for the listbox, option and popup elements (`aria-activedescendant` needs real ids). Empty (the default): each instance generates a unique base after mount (`rozie-combobox-<n>`). Set it when you need stable, predictable ids. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element. |
| `inline` | `Boolean` | `false` | yes | Render the results list in normal flow (static) rather than as an absolutely-positioned popup — use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. |
| `closeOnSelect` | `Boolean` | `null` | yes | Close the popup after a selection commits. Unset (`null`, the default) resolves to `true` in single-select (today's behavior) and `false` in `multiple` mode, where closing after every chip pick would make multi-select unusable; pass an explicit `true`/`false` to override in either mode. |
| `multiple` | `Boolean` | `false` | yes | `value` widens to hold an **array** of selected values and remains the sole `model: true` prop, so the Angular `ControlValueAccessor` is preserved (a second model would forfeit it). Re-selecting an already-selected option toggles it off. Default `false` is byte-identical to single-select. |
| `creatable` | `Boolean` | `false` | yes | When the user commits text matching no option (case-insensitive, trimmed, exact label equality — no Unicode normalization applied), combobox emits `create` with the query and writes NOTHING to `value` — the consumer adds the option to `options` and updates the model itself. Composes with `multiple`. Turning this on replaces the `#empty` fill with the `#create` row whenever the query is creatable (non-empty, no exact match); `#empty` still renders for an empty or whitespace-only query. Default `false` is byte-identical to today. |
| `optionLabel` | `Function` | `null` | yes | Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property. |
| `optionValue` | `Function` | `null` | yes | Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property. |
| `optionDisabled` | `Function` | `null` | yes | Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property. |
| `virtual` | `Boolean` | `false` | yes | Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling popup (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed combobox. Pair with `inline` + `maxHeight`. **Reactive — may be flipped at runtime**: toggling `virtual` builds or tears down the windowing engine (and resets any expanded-group state); a brief mid-flip frame renders the un-windowed full list rather than a blank popup. |
| `estimateRowHeight` | `Number` | `36` | yes | Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on. |
| `maxHeight` | `String` | `''` | yes | A CSS length string bounding the popup scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-combobox-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off. |
| `groups` | `Array` | `[]` | yes | Ordered section list `[{ id, label }]` setting group order + heading text. Options are partitioned by their optional `group?` string; groups present on options but absent here fall back to first-appearance order after the listed ones. Empty/absent ⇒ flat, ungrouped rendering (default). |
| `groupCap` | `Number` | `0` | yes | Cap each native section group to its first `groupCap` results, adding a keyboard-reachable "+N more" row that expands that group in place when activated. `0`/absent = uncapped (default), byte-identical to today. Only applies to the non-virtual grouped render (`groups` non-empty); ignored when `virtual` is on. |
| `placement` | `String` | `"bottom-start"` | yes | Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf. Default `"bottom-start"` matches the pre-Phase-86 static popup alignment. Ignored when `inline` is set. |
| `offset` | `Number` | `4` | yes | Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Default `4` preserves the pre-Phase-86 resting gap. Ignored when `inline` is set. |
| `disableFlip` | `Boolean` | `false` | yes | Disable the popup's Floating UI `flip` middleware (forwarded to the composed `@rozie-ui/popover` leaf). Ignored when `inline` is set. |
| `disableShift` | `Boolean` | `false` | yes | Disable the popup's Floating UI `shift` middleware (forwarded to the composed `@rozie-ui/popover` leaf). Ignored when `inline` is set. |
| `block` | `Boolean` | `false` | yes | Fill the container: the root becomes `display: block; width: 100%`, the control (chips + input) stretches to that width, and the width-matched popup follows. Adds the `rozie-combobox--block` modifier class on the root. |
| `chipLayout` | `String` | `"stacked"` | yes | Chip rail layout under `multiple`: `'stacked'` (default) renders the chips above the input; `'inline'` puts chips and input on ONE wrapping row (the Tags layout), the input taking the remaining width (never narrower than `--rozie-combobox-inline-input-min-width`, default `6rem`). Only meaningful with `multiple`. |
| `disableOpenOnFocus` | `Boolean` | `false` | yes | Do not open the list when the input gains focus. Typing and `↓` / `↑` still open it. |
| `hideEmpty` | `Boolean` | `false` | yes | When there are no option rows and no create row, show **no popup at all**: the list does not render, `aria-expanded` stays `false`, and Escape is left to the host (not `preventDefault`ed). This is the supported way to show nothing — see [Hiding the empty state](#hiding-the-empty-state). |
| `delimiters` | `Array` | `[]` | yes | Keys that commit the **typed text** as a value (matched against the key event's `key`), under `multiple` only — a delimiter never picks the highlighted option. Character entries (e.g. `[',', ';']`) also split pasted text (see `splitPaste` to replace that split). `'Enter'` / `'Tab'` are allowed; Enter commits the typed text only when no option is highlighted. A non-empty list turns on free-text commits — see [Token input](#token-input-recipient-field). |
| `validate` | `Function` | `null` | yes | Free-text gate and normaliser, `(text: string) => string \| boolean \| null \| undefined`, under `multiple` only (the same shape as Tags' `validate`). Return the **string to store** (e.g. the bare address out of `Sam Roe <sam@x.test>`), `true` to store the text as typed, or a falsy value to reject it (rejected text stays in the input). Setting it also turns on free-text commits (Enter with no highlighted option commits the typed text). |
| `splitPaste` | `Function` | `null` | yes | Replaces the built-in paste split, `(text: string) => string[] \| null`, under `multiple` only. Return the parts to commit (each is trimmed and run through `validate`; rejected parts are inserted at the caret), or `null` to leave the paste to the browser. Use it for syntax a delimiter split cannot know, e.g. `"Roe, Sam" <sam@x.test>`. Setting it also turns on free-text commits. |
| `commitOnBlur` | `Boolean` | `false` | yes | Commit the typed text when the input loses focus, under `multiple` only, through `validate` (rejected text stays). A blur into a pinned host sub-surface (`pinOpen(true)`) does not commit. Setting it also turns on free-text commits. |
| `selectOnTab` | `Boolean` | `false` | yes | Tab picks the highlighted option while the popup is visible (keeping focus in the input). When nothing is picked, Tab moves focus normally. |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired when the selected value changes — a user picks an option (toggling membership in `multiple` mode), commits free text (`delimiters` / `validate` / `splitPaste` / `commitOnBlur`), or `clear()` resets it. Payload `{ value, option, selected, text? }` (`ComboboxChangePayload`); `text` is set **only** on free-text commits, where `option` is `null`, and is the stored string (what `validate` returned, when it returned one): `value` is always the model's NEW value (the whole array in `multiple` mode, the scalar or `null` in single mode); `option` is the raw source option that was toggled (`null` after `clear()`); `selected` is the direction of the toggle — `true` when added / always `true` in single-select, `false` when removed or after `clear()`. |
| `search` | Fired whenever the input text changes. Payload `{ query }` — the current text. It fires on every keystroke, after a paste Combobox handles itself (with the resulting text), and with `{ query: '' }` whenever Combobox clears the input itself: a pick or create under `multiple`, a free-text commit (including one of a value that is already selected, which fires no `change`) and `clear()`. Pair it with `disableFilter` to drive async / server-side filtering; `query()` reads the current text. |
| `create` | Fired when `creatable` is set and the user commits text matching no option (case-insensitive, trimmed, exact label equality — no Unicode normalization). Payload `{ query }` — the committed text. Combobox writes NOTHING to `value` when this fires — the consumer adds the option to `options` and updates the model itself. Fires at most once per distinct query (a double-commit is a no-op); composes with `multiple` (`value` stays untouched there too). |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the text input. Deliberately named `focus`, overriding the inherited `HTMLElement.focus` on the Lit custom element; the override is intentional, and the compiler accepts it with a warning. This mirrors the slider / otp precedent; listbox took the other branch (`focusControl`). |
| `clear` | Reset the selection: clear `value` (emits `change` with `{ value: null }` in single-select mode, `{ value: [] }` under `multiple`) and empty the input text (emits `search` with `{ query: '' }` when there was text). Collision-safe — not a host-element member. |
| `query()` | Return the current input text — what the last `search` event reported. Read-only; use `seedQuery(text)` to set it. |
| `seedQuery(text)` | **Imperative only** — sets the input text (and therefore the filtered option list) without touching the `value` model or selection state. Does not open the popup, select an option, or emit `change`/`search`. Not a second model (a combobox has a single `model: true` prop, `value` — a second model would forfeit the Angular `ControlValueAccessor`). Intended for repopulating the input on programmatic restore (e.g. a consumer's back-navigation). |
| `activeOption()` | Return the currently highlighted **raw source option**, or `null` when nothing is highlighted, the popup is hidden, or the highlighted row is a synthetic "+N more" / create row. Read-only — e.g. to preview what Enter or Tab (`selectOnTab`) would pick. |
| `pinOpen(boolean)` | **Imperative only** — pin the popup open so blurring the input into a host sub-surface (e.g. an action flyout) does not collapse the list. `pinOpen(true)` pins; `pinOpen(false)` unpins. Unpinning alone does not itself close the popup or restore focus — that is the host's responsibility. Render-neutral: never calling it leaves behavior unchanged. |

Every event payload and slot-param shape is exported as a type from each leaf (`ComboboxSearchPayload`, `ComboboxChangePayload`, `ComboboxCreatePayload`, `ComboboxChipSlotCtx`, `ComboboxOptionSlotCtx`, `ComboboxQuerySlotCtx`, `ComboboxGroupHeadingSlotCtx`, `ComboboxGroupMoreSlotCtx`, `ComboboxGroup`).

### Slots

| Slot | Params | Description |
| --- | --- | --- |
| `option` | `option, index, active, selected, disabled` | Custom per-option rendering. `option` is the raw source option object, `index` is its position in the filtered list, `active` is whether it is the active-descendant (keyboard-highlighted), `selected` is whether its value equals the bound `value`, `disabled` is the resolved disabled state. Omit it to render the plain resolved label. |
| `empty` | `query` | Rendered inside the open popup when the filtered list is empty. `query` is the current input text. Omit it to render the default "No results". |
| `groupHeading` | `group` | Custom rendering for a group's heading (only when grouping is active — see [Grouping options](#grouping-options)). `group` is `{ id, label }`. Omit it to render the plain `group.label`. |
| `groupMore` | `group, hidden, expand` | Custom rendering for a capped group's "+N more" row (only when `groupCap` is set — see [Capping groups](#capping-groups)). `group` is `{ id, label }` (or `null` for the leading ungrouped section), `hidden` is the count of not-yet-shown options, `expand` is a zero-arg closure that expands the group in place. Omit it to render the default `+{hidden} more` text. |
| `chip` | `option, remove, index` | Custom rendering for one selected-value chip in the chip rail (only when `multiple` is set — see [Multi-select](#multi-select)). `option` is the raw source option object, or `null` when it has disappeared from `options` (the chip still renders, labelled by its raw value). `remove` is a zero-arg closure that removes that value from the selection via the same toggle path a re-select uses, then refocuses the input exactly like the built-in remove button. `index` is the chip's position in the (de-duplicated, selection-ordered) chip list. Omit it to render the default label + focusable aria-labelled remove button. |
| `create` | `query` | Custom rendering for the trailing create row (only when `creatable` is set and the query is creatable — see [Creatable](#creatable)). `query` is the current input text. Omit it to render the default `Create "{query}"`. |

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

`groups` sets both the section order and the heading text; a group id present on an option but absent from `groups` falls back to a section titled with the id itself, appended after the listed ones (first-appearance order). Options with no `group` render in a single leading, unheaded section. Within every section, options keep their filtered/scored order — grouping is a stable re-partition, never a re-sort. The keyboard model (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`, `aria-activedescendant`) is unchanged: it walks the same group-ordered flat sequence, so on-screen order always matches keyboard order, and headings are never a keyboard stop. Leaving `groups` empty (and no option carrying `group`) renders the ungrouped combobox unchanged — grouping is strictly additive and opt-in. Grouping is supported only in the standard (non-`virtual`) render; `groups` × `virtual` windowing is not yet supported.

### Capping groups

Pass `groupCap` alongside `groups` to cap each section to its first `groupCap` options, adding a keyboard-reachable "+N more" row when a section overflows the cap:

```rozie
<template>
  <Combobox
    r-model:value="$data.userId"
    :options="OPTIONS"
    :groups="GROUPS"
    :group-cap="5"
  />
</template>
```

Activating the "+N more" row — `Enter` while it is the active-descendant, or a click/tap — expands **that section only**, in place: the rest of its options render inline and the more-row disappears. Expanding never writes the `value` model or fires `change`; it is purely a reveal. `ArrowDown`/`ArrowUp` rove onto the more-row like any other option and, once expanded, continue into the newly-revealed options — `aria-activedescendant` always resolves to a rendered option or more-row id. A section with `groupCap` or fewer options renders in full with no more-row. Expansion state resets whenever the option set or the typed query changes (a new result set invalidates any prior expansion). Customize the row's markup with the `groupMore` slot; the default reads `+{hidden} more`. `0`/absent (the default) is uncapped, identical to plain grouping. `groupCap` only applies to the standard (non-`virtual`) grouped render, same as `groups` itself.

## Multi-select

Set `multiple` to select many options. `value` widens to an **array** while staying the sole `model: true` prop, so the Angular `ControlValueAccessor` is preserved — no second model, no `<ComboboxMulti>`:

```rozie
<template>
  <Combobox
    r-model:value="$data.selected"
    :options="OPTIONS"
    multiple
    placeholder="Pick fruit…"
  />
</template>
```

Selected values render as chips **inside the control, before the input** — the whole control box becomes the popover anchor, so the width-matched popup spans the chips plus the input, not the input alone. Re-selecting an already-selected option toggles it off; chips render in selection order (the `value` array order IS the display order); duplicate values dedupe to one chip; a chip whose option has disappeared from `options` (an async `options` swap) persists, labelled with its raw value. Every chip carries a focusable, aria-labelled remove button (customize via the `chip` slot above), and Backspace on an empty input removes the last chip — Backspace with any text in the input edits the text instead. The effective `closeOnSelect` default flips to `false` under `multiple` (closing after every pick would make multi-select unusable); pass an explicit `:close-on-select="true"` to override. `aria-multiselectable="true"` and per-option `aria-selected` mark the listbox and options.

## Token input (recipient field)

An email-style recipient field: chips and the input share one row that fills its container, the popup shows server suggestions only when there are any, and typed addresses commit on `,` / `;`, on Enter (when no suggestion is highlighted), and on paste:

```rozie
<template>
  <Combobox
    r-model:value="$data.to"
    :options="$data.suggestions"
    multiple
    block
    chipLayout="inline"
    disableFilter
    hideEmpty
    disableOpenOnFocus
    :delimiters="[',', ';']"
    :validate="toAddress"
    :split-paste="splitAddresses"
    commitOnBlur
    selectOnTab
    ariaLabel="To"
    @search="onSearch"
  />
</template>
```

- **Free-text commits** are on under `multiple` whenever `delimiters` is non-empty or `validate`, `splitPaste` or `commitOnBlur` is set. A commit trims the text, runs `validate`, appends the stored string to `value` (skipped when already present), clears the input, and emits `change` with `{ value, option: null, selected: true, text }`. Rejected text stays in the input.
- **`validate` can normalise**: return the string to store (`toAddress` above can turn `Sam Roe <sam@x.test>` into `sam@x.test`), `true` to keep the text as typed, or a falsy value to reject.
- **Tracking the query**: `search` also fires with `{ query: '' }` whenever Combobox clears the input itself (a pick, a free-text commit — even of an address that is already a chip, which fires no `change` — or `clear()`), so suggestions fetched from `search` never go stale. `query()` on the handle reads the current text.
- **`commitOnBlur`** commits a valid typed address when focus leaves the field.
- A delimiter key always commits the **typed** text — never the highlighted suggestion. Enter picks the highlighted suggestion if there is one, and otherwise commits the typed text.
- **Paste**: a pasted text containing a character delimiter is split on the delimiters and every part `validate` accepts is committed; the rejected parts are inserted at the caret, replacing the selection, as an ordinary paste would be — so typing `ann@` and pasting `corp.com, bob@x.test` leaves `ann@corp.com` in the input and `bob@x.test` as a chip. A paste with no delimiter is ordinary text. The default split knows nothing about address syntax: pass `splitPaste` (return the parts, or `null` for "paste normally") to split quoted display names such as `"Roe, Sam" <sam@x.test>` yourself.
- `selectOnTab` makes Tab pick the highlighted suggestion; with nothing highlighted Tab moves focus as usual.
- Enter with Ctrl / Meta / Alt never picks or commits (left to the host — e.g. a send shortcut), and keys pressed during an IME composition are ignored.

### Hiding the empty state

Filling the `empty` slot with nothing does **not** hide the popup: on most targets a fill that renders nothing cannot be told apart from no fill, so the default "No results" row (or an empty popup row) still renders. Use `hideEmpty` instead — it hides the popup entirely while there is nothing to show, keeps `aria-expanded="false"`, and lets Escape through to the host.

## Creatable

Set `creatable` to let arbitrary typed text become a selection, without `Combobox` ever guessing the consumer's option shape:

```rozie
<template>
  <Combobox
    r-model:value="$data.userId"
    :options="OPTIONS"
    creatable
    @create="onCreate"
  />
</template>
```

```js
// The consumer owns adding the option — combobox writes NOTHING to `value`.
const onCreate = (e) => {
  const newOption = { value: e.query, label: e.query }
  $data.options = [...$data.options, newOption]
  $data.userId = newOption.value
}
```

When the user commits text (`Enter`, or a click/tap on the row) that matches no option, `Combobox` emits `create` with `{ query }` and leaves `value` untouched — the `create` handler is responsible for adding the option and updating the model itself. "Matches no option" is decided by **case-insensitive, trimmed, exact label equality** — never a substring, and never with any Unicode normalization, so a query differing from an option's label only by composition form is treated as a genuine miss. A query equal to an existing option's label — in any case, with any surrounding whitespace — offers no create row at all; an empty or whitespace-only query never does either. The create row is the LAST navigable row, after every option and every group section, arrow-reachable and carrying a real option id, and it REPLACES the `#empty` row whenever the query is creatable (`#empty` still renders for an empty/whitespace-only query — see the `create` slot above to customize its default `Create "{query}"` wording). A double-commit of the same text fires `create` exactly once; typing anything new re-arms it, covering the round-trip window before an async `options` update lands. Composes with `multiple`: `create` fires and `value` stays untouched there too, and after it fires local UI state behaves like a pick (the effective `closeOnSelect` applies, and the query clears in `multiple` mode / is left alone in single mode). Works in all four render branches (plain, `groups`, `groups` + `groupCap`, and `virtual`).

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

Only cosmetic values flow through tokens; the structural rules (the relative wrapper, the absolutely-positioned popup, the input box model, the focus ring) compile per-leaf and are not consumer-overridable.

The complete token table and the design-system bridges live on the [dedicated theming page](/components/combobox-theming).

## Keyboard

Focus the input, then type to filter and drive the popup from the keyboard:

| Key | Action |
| --- | --- |
| typing | Filters `options` by `label` (unless `disableFilter`), opens the popup, and emits `search`. |
| `↓` / `↑` | Open the popup (if closed) and move the active option down / up, skipping disabled options and clamping at the ends. The active option is kept scrolled into view when the list overflows the popup. |
| `Home` / `End` | Move the active option to the first / last selectable option. |
| `Enter` | Commit the active option (writes `value`, fires `change`, closes the popup). With free-text commits on (`delimiters` / `validate` / `splitPaste` / `commitOnBlur`) and no active option, commit the typed text. Ctrl / Meta / Alt + Enter is left to the host. |
| `Tab` | With `selectOnTab`, pick the active option while the popup is visible; otherwise move focus normally. |
| delimiter keys | With `delimiters`, commit the typed text (never the active option). |
| `Escape` | Close the popup without changing the selection — consumed only while the popup is visible. |

Keys pressed while an IME composition is active are ignored (no pick, commit or navigation).

Pointer interaction mirrors the keyboard: hovering an option makes it active, and selecting fires on `mousedown` (before the input blurs), so a click commits without the popup closing first.

## Accessibility

- The input is `role="combobox"` with `aria-autocomplete="list"`, `aria-expanded` reflecting the popup state, `aria-controls` pointing at the listbox id, and `aria-activedescendant` pointing at the active option's id (so screen readers announce the highlighted option without moving real DOM focus).
- The popup is `role="listbox"`; each option is `role="option"` with `aria-selected` and `aria-disabled` reflected from its data.
- Supply an accessible name via a visible `<label for>` pointing at the input, or the `ariaLabel` prop.
- Each instance generates a unique `idBase` after mount, so several comboboxes on one page never share option ids (`aria-activedescendant` requires unique ids). Set `idBase` yourself only when you need stable ids.
- Dismissal uses the headless pattern for selection: options select on `@mousedown.prevent` (before the input blurs, so focus stays on the input) and the input's `@blur` closes the popup. Since the popup is composed from [`@rozie-ui/popover`](/components/popover), that leaf additionally binds a document-level click-outside listener and an Escape handler **while the popup is open**. A host that drives the open state itself can veto both for as long as it needs — `pinOpen(true)` forwards to the composed popover's `disableDismiss`, which is how a sub-surface anchored to (but not nested inside) the control can hold focus without the popup dismissing under it.

## v1 scope

The popup is positioned by composing the published [`@rozie-ui/popover`](/components/popover) leaf via Floating UI — `placement` / `offset` / `disableFlip` / `disableShift` are forwarded straight through, so it flips and shifts to stay on-screen near a viewport edge. All four render branches — plain, `groups`, `groups` + `groupCap`, and `:virtual` — position through that one composed popover; there is no static-CSS fallback branch. The `inline` prop still renders the list statically, with the composed popover inert. See the [comparison](/components/combobox-comparison#what-rozie-defers) for the full list of deferrals.
