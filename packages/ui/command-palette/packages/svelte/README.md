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
  onselect={(e) => console.log('ran:', e.item.id)}
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
| `query` | `String` | `''` | ✓ |  | The current search text (two-way `r-model`). Two-way bind it to read the query, or pre-seed it by setting a value alongside `open` — an open no longer clears it, so the palette opens filtered to that query. The component ranks `items` by this string via `score` (fuzzy-subsequence by default, matched over each item `label` plus its `keywords`, label weighted above keywords). Reset to `""` when the palette closes, so each plain open starts with a fresh search box. |
| `score` | `Function` | `null` |  |  | Custom ranking/exclusion hook: `(item, query) => number \| null`. Return `null` to exclude an item from the results; otherwise higher numbers rank first. Leave unset (`default: null`) to use the built-in fuzzy-subsequence scorer (label weighted above keywords). A recency/frecency boost is added INSIDE `score` (e.g. `return baseScore + recencyBonus(item.id)`), not as a separate prop. |
| `items` | `Array` | `[]` |  |  | The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` is shown as a per-row label on each matching command (it is not a section heading — items are not bucketed); optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots. |
| `placeholder` | `String` | `"Type a command…"` |  |  | Placeholder text shown in the search input while the query is empty. |
| `emptyText` | `String` | `"No results."` |  |  | Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup. |
| `closeOnSelect` | `Boolean` | `true` |  |  | Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row. |
| `ariaLabel` | `String` | `"Command palette"` |  |  | Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands"). |
| `idBase` | `String` | `"rozie-command-palette"` |  |  | Id base for the combobox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element. |
| `searchDebounce` | `Number` | `150` |  |  | Debounce (ms) applied to a nested level's ASYNC `source(query)` keystroke refetch only — sync (`children`) levels re-rank locally on every keystroke with no debounce. Defaults to ~150ms (`internal/asyncSource.ts`'s `DEFAULT_SEARCH_DEBOUNCE`). |

## Events

| Event | Description |
| --- | --- |
| `navigate` | Fired when a nested level is PUSHED — selecting an item that carries `children` or `source` drills into it instead of emitting `select`. Payload `{ item, depth }` — the navigated-to item and the resulting nesting depth (1-based; the root is depth 0). |
| `back` | Fired when a level is POPPED — via Backspace-on-empty, Escape at depth>0, the imperative `goBack()` handle, or an equivalent consumer-triggered back navigation. No payload. Does not fire at the root (popping is a no-op there). |
| `select` | Fired when the user chooses a LEAF command (clicks it, or highlights it and presses Enter) — an item with no `children`/`source` (see `navigate` for a navigating item). Payload `{ item, path }` — `item` is the full chosen command object, `path` is the id breadcrumb of levels navigated through to reach it (empty at the root). If `closeOnSelect` is true (the default) the palette also closes (its `open` model is written `false`). |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: the open verb is `show()` (an `open()` verb would collide with the `open` model), and `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the search input) — on the Lit custom element this is an accepted ROZ137 warn-only override:

| Method | Description |
| --- | --- |
| `show` | Open the palette (writes the `open` model to `true`). Resets the highlight and focuses the search input; a pre-seeded query is preserved (the query resets on close, not open). |
| `close` | Close the palette (writes the `open` model to `false`). Resets the query and the level stack (`levelStack`) to root, so the next open starts fresh. |
| `toggle` | Toggle the palette open/closed (writes the `open` model to its negation). |
| `focus` | Move DOM focus to the search input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `goBack` | Pop one nested level (restoring the parent query + input text, D-3 undo). A no-op at the root (an empty level stack). NOTE: named `goBack`, NOT `back` — a `back()` handle would collide with the `back` EMIT. |
| `openTo` | Deep-link into a nested level: `openTo(path)`, where `path` is an array of item ids from the root. Opens the palette, resets to root, then drills through each id in turn — async-aware (awaits a Promise `source` before resolving the next hop). Stops silently at the first id that does not resolve in the current level. |

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
| breadcrumb | stack, back |
| option | option, index, active, selected, disabled, matches |
| empty | query |
| loading | query |
| error | query, error, retry |
| footer |  |
| icon | option |
| actions | option, actions |
| trailing | option |
