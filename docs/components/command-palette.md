# Command Palette — the cross-framework headless command menu

`CommandPalette` is Rozie's **headless, accessible** cmdk-style command menu — a `@rozie-ui` family with **no third-party engine** behind it. The "⌘K" pattern (a centered modal overlay with a search box over a filtered, keyboard-navigable list of commands) is re-implemented — often inaccessibly — in every framework. Rozie owns the author-side API: the two-way `open` + `query` bindings, the query filter over each item's `label` plus its `keywords`, the roving-highlight keyboard model (ArrowUp / ArrowDown / Home / End / Enter / Escape), the close policy (backdrop click + Escape), and the token-themed skin.

It compiles once from `CommandPalette.rozie` to idiomatic React, Vue, Svelte, Angular, Solid, and Lit. And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/command-palette` packages

`CommandPalette` ships as six pre-compiled, per-framework packages generated from a single `CommandPalette.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/command-palette-react` | `npm i @rozie-ui/command-palette-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/packages/react/README.md) |
| `@rozie-ui/command-palette-vue` | `npm i @rozie-ui/command-palette-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/packages/vue/README.md) |
| `@rozie-ui/command-palette-svelte` | `npm i @rozie-ui/command-palette-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/packages/svelte/README.md) |
| `@rozie-ui/command-palette-angular` | `npm i @rozie-ui/command-palette-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/packages/angular/README.md) |
| `@rozie-ui/command-palette-solid` | `npm i @rozie-ui/command-palette-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/packages/solid/README.md) |
| `@rozie-ui/command-palette-lit` | `npm i @rozie-ui/command-palette-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/packages/lit/README.md) |

Each package carries only its framework peer. For the full prop / event / handle / slot surface see the [**API reference**](/components/command-palette-api); for per-framework consumption code see the [**usage page**](/components/command-palette-usage).

## Quick start

Two-way bind `open` (visibility) and `query` (the search text), hand the component an `items` array, and run the chosen command in `@select`. The component owns the overlay, the search input, the filter, and the keyboard navigation:

```rozie
<components>
{
  CommandPalette: './CommandPalette.rozie',
}
</components>

<data>
{
  paletteOpen: false,
  q: '',
}
</data>

<script>
const commands = [
  { id: 'new', label: 'New File', group: 'File', keywords: ['create', 'add'] },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'settings', label: 'Preferences', group: 'App' },
]

const run = (e) => {
  console.log('ran command:', e.id)
}
</script>

<template>
  <button @click="$data.paletteOpen = true">Open palette (⌘K)</button>

  <CommandPalette
    r-model:open="$data.paletteOpen"
    r-model:query="$data.q"
    :items="commands"
    @select="run"
  />
</template>
```

## How it works

- **Two models, not a form control.** `open` and `query` are both `model: true`. Because there are *two* models the component does **not** generate an Angular `ControlValueAccessor` (a palette is not a single form value) — that is the intended shape.
- **Portal-style overlay.** The overlay is a `position: fixed` full-viewport backdrop + a centered `role="dialog"` panel, rendered only while `open`. It escapes overflow/`z-index` ancestors without a teleport. A click on the backdrop (not the panel) closes; Escape closes; selecting an item closes when `closeOnSelect` (the default).
- **Filter over label + keywords.** The query matches case-insensitively against each item's `label` and every entry of its optional `keywords` array. The filter lives in `src/internal/filterCommands.ts` and is unit-tested in isolation.
- **Roving keyboard model.** ArrowUp / ArrowDown move the highlight (skipping `disabled` items), Home / End jump to the ends, Enter selects the highlighted item, Escape closes. The highlight is tracked virtually via `aria-activedescendant` — DOM focus stays on the search `<input role="combobox">`.
- **Scoped slots.** `item` (custom item render, scoped with `{ item, active }`), `empty` (the no-results state), and `footer` (a persistent footer bar).

## Accessibility

The overlay panel is `role="dialog"` `aria-modal="true"` with an accessible name (`ariaLabel`). The search field is `<input role="combobox" aria-autocomplete="list" aria-expanded aria-controls aria-activedescendant>`; the results are a `role="listbox"` of `role="option"` elements, each with `aria-selected` (the active option) and `aria-disabled`. Selection is committed on `Enter`, and the active option is announced via `aria-activedescendant` while focus never leaves the input — the WAI-ARIA APG combobox-with-listbox pattern.

See the [comparison page](/components/command-palette-comparison) for how this replaces the per-framework command-menu libraries.
