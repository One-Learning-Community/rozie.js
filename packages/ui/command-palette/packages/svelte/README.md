# @rozie-ui/command-palette-svelte

Idiomatic **svelte** `CommandPalette` — a headless, accessible (WAI-ARIA) cmdk-style command menu (a centered modal overlay with a search box over a filtered, keyboard-navigable list — ⌘K palettes) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction model is authored entirely in Rozie — no third-party engine; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/command-palette-svelte
```

Peer dependencies: `svelte`. Install them alongside this package.

## Usage

```svelte
<script lang="ts">
  import CommandPalette from '@rozie-ui/command-palette-svelte';
  import '@rozie-ui/command-palette-svelte/themes/base.css';

  let open = $state(false);
  let query = $state('');
  const commands = [
    { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
    { id: 'open', label: 'Open File', group: 'File' },
    { id: 'settings', label: 'Preferences', group: 'App' },
  ];
</script>

<button onclick={() => (open = true)}>Open palette (⌘K)</button>
<CommandPalette
  bind:open
  bind:query
  items={commands}
  onselect={(e) => console.log('ran:', e.id)}
/>
```

## Theming

Every visual value is a `--rozie-command-palette-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```svelte
import '@rozie-ui/command-palette-svelte/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `open` | `Boolean` | `false` | ✓ |  | Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`. |
| `query` | `String` | `''` | ✓ |  | The current search text (two-way `r-model`). Two-way bind it to read or pre-seed the query; the component filters `items` by this string over each item `label` plus its `keywords`. Cleared to `""` whenever the palette opens. |
| `items` | `Array` | `[]` |  |  | The command list — `[{ id, label, group?, keywords?, disabled? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` buckets items under a heading; optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. |
| `placeholder` | `String` | `"Type a command…"` |  |  | Placeholder text shown in the search input while the query is empty. |
| `emptyText` | `String` | `"No results."` |  |  | Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup. |
| `closeOnSelect` | `Boolean` | `true` |  |  | Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row. |
| `ariaLabel` | `String` | `"Command palette"` |  |  | Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands"). |
| `idBase` | `String` | `"rozie-command-palette"` |  |  | Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element. |

## Events

| Event | Description |
| --- | --- |
| `select` | Fired when the user chooses a command (clicks it, or highlights it and presses Enter). Payload `{ id, label, group }` — the chosen item. If `closeOnSelect` is true (the default) the palette also closes (its `open` model is written `false`). |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: the open verb is `show()` (an `open()` verb would collide with the `open` model), and `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the search input) — on the Lit custom element this is an accepted ROZ137 warn-only override:

| Method | Description |
| --- | --- |
| `show` | Open the palette (writes the `open` model to `true`). Clears the query, resets the highlight, and focuses the search input. |
| `close` | Close the palette (writes the `open` model to `false`). |
| `toggle` | Toggle the palette open/closed (writes the `open` model to its negation). |
| `focus` | Move DOM focus to the search input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |

```svelte
<script>
  let palette;                  // component instance via bind:this
</script>

<CommandPalette bind:this={palette} bind:open :items={commands} />
<button onclick={() => palette.toggle()}>⌘K</button>
```

## Slots

| Slot | Params |
| --- | --- |
| option | option, index, active, selected, disabled |
| empty | query |
| footer |  |
