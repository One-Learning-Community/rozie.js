# @rozie-ui/command-palette-react

Idiomatic **react** `CommandPalette` — a headless, accessible (WAI-ARIA) cmdk-style command menu (a centered modal overlay with a search box over a filtered, keyboard-navigable list — ⌘K palettes) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction model is authored entirely in Rozie — no third-party engine; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/command-palette-react
```

Peer dependencies: `react + react-dom`. Install them alongside this package.

## Usage

```tsx
import { useState } from 'react';
import { CommandPalette } from '@rozie-ui/command-palette-react';
import '@rozie-ui/command-palette-react/themes/base.css';

const commands = [
  { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'settings', label: 'Preferences', group: 'App' },
];

export function Demo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)}>Open palette (⌘K)</button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        items={commands}
        onSelect={(e) => console.log('ran:', e.item.id)}
      />
    </>
  );
}
```

## Theming

Every visual value is a `--rozie-command-palette-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```tsx
import '@rozie-ui/command-palette-react/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `open` | `Boolean` | `false` | ✓ |  | Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`. |
| `query` | `String` | `''` | ✓ |  | The current search text (two-way `r-model`). Two-way bind it to read the query, or pre-seed it by setting a value alongside `open` — an open no longer clears it, so the palette opens filtered to that query. The component ranks `items` by this string via `score` (fuzzy-subsequence by default, matched over each item `label` plus its `keywords`, label weighted above keywords). Reset to `""` when the palette closes, so each plain open starts with a fresh search box. |
| `score` | `Function` | `null` |  |  | Custom ranking/exclusion hook: `(item, query) => number \| null`. Return `null` to exclude an item from the results; otherwise higher numbers rank first. Leave unset (`default: null`) to use the built-in fuzzy-subsequence scorer (label weighted above keywords). A recency/frecency boost is added INSIDE `score` (e.g. `return baseScore + recencyBonus(item.id)`), not as a separate prop. |
| `items` | `Array` | `[]` |  |  | The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; commands sharing an optional `group` string are bucketed under a labeled section heading (auto-derived, via the vendored combobox's native section groups) — commands with no `group` render first in a headingless block. The heading text is the `group` string itself; override its markup with the `#groupHeading` slot. Optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots. |
| `defaultItems` | `Array` | `[]` |  |  | Items shown when the query is empty (the empty/home state), resolved PER LEVEL. This top-level prop is the ROOT level's home view; a navigating item's own `defaultItems` field (alongside its `children`/`source`) is that CHILD level's home view. They render grouped when they carry `group` fields (composes with native sections, same as `items`), and scoring never reorders them (the empty-query short-circuit preserves author order). Typing a query switches to scored `items`/`source` results; clearing the query returns to `defaultItems`. This is the first-class replacement for branching on `query === ''` inside a `source` function — and the natural home for a recents/frecency list (composes with the `score` prop's recency boost). Leave unset (`default: () => []`) for today's behavior — no defaultItems is byte-behavior-identical to the full source-order list. |
| `placeholder` | `String` | `"Type a command…"` |  |  | Placeholder text shown in the search input while the query is empty. |
| `emptyText` | `String` | `"No results."` |  |  | Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup. |
| `closeOnSelect` | `Boolean` | `true` |  |  | Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row. |
| `ariaLabel` | `String` | `"Command palette"` |  |  | Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands"). |
| `idBase` | `String` | `"rozie-command-palette"` |  |  | Id base for the combobox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element. |
| `searchDebounce` | `Number` | `150` |  |  | Debounce (ms) applied to a nested level's ASYNC `source(query)` keystroke refetch only — sync (`children`) levels re-rank locally on every keystroke with no debounce. Defaults to ~150ms (`internal/asyncSource.ts`'s `DEFAULT_SEARCH_DEBOUNCE`). |
| `actionKey` | `String` | `"$mod+k"` |  |  | The keyboard shortcut that opens the highlighted row's action menu — a portable `$mod+<letter>` token (default `"$mod+k"`, i.e. ⌘K/Ctrl+K) matched via `(event.metaKey \|\| event.ctrlKey) && event.key === <letter>`. A bare single-letter token (e.g. `"k"`) matches with no modifier required. Pressing it (or caret-at-end Right-arrow, or clicking the row's actions affordance) on a row with no `actions` is a no-op — the menu only opens for a row that has them. |
| `closeOnAction` | `Boolean` | `true` |  |  | Whether choosing an action closes the whole palette. Defaults to `true` — running an action ALWAYS closes the action menu itself; `closeOnAction` additionally decides whether the palette dismisses too (`false` returns to the result list with the palette still open, e.g. for firing several actions in a row). |
| `groupCap` | `Number` | `0` |  |  | Pass-through to the vendored combobox's `groupCap`: cap each command section to its first `groupCap` results with an expand-in-place '+N more' row. `0`/absent = uncapped (default). `groupCap` composes with per-row `actions`: the ⌘K/Right-arrow row action menu always anchors to the exact highlighted VISIBLE row (cap-aware, order-independent), and firing it on a '+N more' row is a no-op. |
| `appendTo` | `any` | `false` |  |  | Where the overlay portals to, escaping an ancestor `overflow:hidden`/`transform`/`filter`/`contain` that would otherwise clip a `position:fixed` overlay (e.g. an embedding iframe/app-shell with its own layout chrome). `false`/absent (default) renders in place — byte-behavior-identical to every existing consumer, zero churn. `true` or `'body'` portals to `document.body`. A CSS selector string portals to the first element that selector matches. An `Element` reference portals to that element directly. SSR-safe: falls back to in-place when `document` is unavailable. Token-placement note: theming custom properties (`--rozie-command-palette-*`) must be set on `:root` (or the `appendTo` container itself) to reach a portalled overlay — a host-scoped token does not cross the portal on any target. |

## Events

| Event | Description |
| --- | --- |
| `navigate` | Fired when a nested level is PUSHED — selecting an item that carries `children` or `source` drills into it instead of emitting `select`. Payload `{ item, depth }` — the navigated-to item and the resulting nesting depth (1-based; the root is depth 0). |
| `back` | Fired when a level is POPPED — via Backspace-on-empty, Escape at depth>0, the imperative `goBack()` handle, or an equivalent consumer-triggered back navigation. No payload. Does not fire at the root (popping is a no-op there). |
| `select` | Fired when the user chooses a LEAF command (clicks it, or highlights it and presses Enter) — an item with no `children`/`source` (see `navigate` for a navigating item). Payload `{ item, path }` — `item` is the full chosen command object, `path` is the id breadcrumb of levels navigated through to reach it (empty at the root). If `closeOnSelect` is true (the default) the palette also closes (its `open` model is written `false`). |
| `action-select` | Fired when the user chooses a row ACTION from its action menu (⌘K / caret-at-end Right-arrow / clicking the row's actions affordance, then Enter/Space/click on a menu item). Payload `{ item, action }` — `item` is the full anchored command object (the row the menu was opened for) and `action` is the chosen entry from that row's `actions[]`. The action menu ALWAYS closes on selection; if `closeOnAction` is true (the default) the palette also closes (its `open` model is written `false`). |

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

```tsx
import { useRef } from 'react';
import { CommandPalette, type CommandPaletteHandle } from '@rozie-ui/command-palette-react';

const palette = useRef<CommandPaletteHandle>(null);
// <CommandPalette ref={palette} ... />
palette.current?.show();
palette.current?.toggle();
palette.current?.close();
```

## Slots

| Slot | Params |
| --- | --- |
| breadcrumb | stack, back |
| option | option, index, active, selected, disabled, matches |
| groupHeading | group |
| empty | query |
| argsField | item, arg, value, setValue |
| loading | query |
| error | query, error, retry |
| footer |  |
| actionItem | action, item, active, disabled |
| icon | option |
| actions | option, actions |
| trailing | option |
