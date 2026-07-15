# Command Palette — the cross-framework headless command menu

`CommandPalette` is Rozie's **headless, accessible** cmdk-style command menu — a `@rozie-ui` family with **no third-party engine** behind it. The "⌘K" pattern (a centered modal overlay with a search box over a filtered, keyboard-navigable list of commands) is re-implemented — often inaccessibly — in every framework. Rozie owns the author-side API: the two-way `open` + `query` bindings, **fuzzy ranking with match highlighting** over each item's `label` plus its `keywords` (with a pluggable `score` hook), **nested levels** for drill-in navigation backed by optional **async sources**, **auto-derived group sections** (from each item's `group` field, cappable via `groupCap`), **per-row action menus** (⌘K on a highlighted row), a **`defaultItems` home view** while the query is empty, the roving-highlight keyboard model (ArrowUp / ArrowDown / Home / End / Enter / Escape), the close policy (backdrop click + Escape), and the token-themed skin.

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
  console.log('ran command:', e.item.id)
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
- **Fuzzy ranking + highlighting.** The query is matched as a fuzzy subsequence against each item's `label` (weighted above its `keywords`), results are ranked by match strength, and the matched characters are highlighted in every row (themeable via `--rozie-command-palette-match-*`). Pass a `score` prop — <span v-pre>`(item, query) => number | null`</span> — to customize ranking or exclusion (return `null` to drop an item; higher numbers rank first); a recency/frecency boost is simply added inside it. The ranking lives in `src/internal/scoreCommands.ts` and is unit-tested in isolation. **Behavior change from 0.1.0:** the default matching moved from plain substring to fuzzy-subsequence (more permissive).
- **Roving keyboard model.** ArrowUp / ArrowDown move the highlight (skipping `disabled` items), Home / End jump to the ends, Enter selects the highlighted item, Escape closes (or pops a level — see below). The highlight is tracked virtually via `aria-activedescendant` — DOM focus stays on the search `<input role="combobox">`.
- **Grouped sections & the home view.** Commands sharing a `group` field render as labeled sections automatically (first-appearance order, headings overridable via the `groupHeading` slot, cappable per-section with `groupCap` + a "+N more" row); the `defaultItems` prop (and a level's own `defaultItems` field) is what renders while the query is empty — the natural home for a recents list. See [Grouped commands](/components/command-palette-api#grouped-commands) and [Default items](/components/command-palette-api#default-items-empty-home-view).
- **Per-row action menus.** A row carrying `actions: [{ id, label, … }]` gets its own secondary action menu — opened with `actionKey` (default ⌘K), caret-at-end →, or a click on the row's actions affordance — firing `@action-select` while Enter stays the primary `@select`. See [Interactive sub-actions](/components/command-palette-api#interactive-sub-actions).
- **Scoped slots.** Row-level: `option` (custom row render, scoped <span v-pre>`{ option, index, active, selected, disabled, matches }`</span> — the listbox vocabulary shared with `@rozie-ui/listbox`), plus three additive display slots on the default row — `icon` (leading, scoped <span v-pre>`{ option }`</span>), `actions` (trailing action hints, scoped <span v-pre>`{ option, actions }`</span>), and `trailing` (right edge, scoped <span v-pre>`{ option }`</span>). Section/menu-level: `groupHeading` <span v-pre>`{ group }`</span> and `actionItem` <span v-pre>`{ action, item, active, disabled }`</span>. State-level: `empty` <span v-pre>`{ query }`</span>, `loading` <span v-pre>`{ query }`</span> (async in flight), `error` <span v-pre>`{ query, error, retry }`</span> (async rejected), `breadcrumb` <span v-pre>`{ stack, back }`</span> (the depth-&gt;0 header), and `footer` (a persistent footer bar). See the [API reference](/components/command-palette-api) for the full slot table.

## Nested levels & async sources

Turn any item into a **drill-in level** by giving it a `children` array or a `source` function — selecting it *pushes* a new level instead of firing `@select`. Presence of either field is the navigation signal; there is no separate flag. A `source` may be **async** (return a `Promise`): the level shows the `loading` slot while it resolves, only the latest in-flight request is applied (stale results are dropped), and keystroke refetches are debounced by `searchDebounce` (default ~150ms). A rejected source shows the `error` slot with a `retry`.

Backspace on an empty query pops one level; Escape pops one level and only closes the palette at the root; a breadcrumb/back header renders at depth > 0. The imperative `openTo(path)` handle deep-links straight to a nested level (e.g. bind ⌘P to jump to "Go to page…").

```rozie
<script>
const commands = [
  { id: 'new', label: 'New File', keywords: ['create'] },
  // Static drill-in: `children` makes this a level.
  {
    id: 'go-page', label: 'Go to page…', title: 'Pages', placeholder: 'Search pages…',
    children: [
      { id: 'p-home', label: 'Home' },
      { id: 'p-docs', label: 'Docs' },
    ],
  },
  // Async drill-in: `source(query)` fetches on demand; empty query → default view.
  {
    id: 'go-module', label: 'Go to module…', title: 'Modules', placeholder: 'Search modules…',
    source: async (query) => {
      const res = await fetch(`/api/modules?q=${encodeURIComponent(query)}`)
      return res.json() // [{ id, label }]
    },
  },
]

const run = (e) => console.log('ran leaf command:', e.item.id, 'via path', e.path)
</script>

<template>
  <CommandPalette
    ref="palette"
    r-model:open="$data.paletteOpen"
    r-model:query="$data.q"
    :items="commands"
    :search-debounce="150"
    @select="run"
    @navigate="e => console.log('pushed level', e.depth)"
  >
    <template #loading="{ query }">Searching “{{ query }}”…</template>
    <template #error="{ error, retry }">
      <button @click="retry()">Failed — retry</button>
    </template>
  </CommandPalette>

  <!-- Deep-link ⌘P straight into the pages level -->
  <button @click="$refs.palette.openTo(['go-page'])">Go to page… (⌘P)</button>
</template>
```

Levels compose *above* the rest of the pipeline: each level's items still flow through the fuzzy `score` ranking, the combobox groups, and the row slots. For the complete surface — every prop, event, handle, and slot with scopes — see the [**API reference**](/components/command-palette-api).

## Accessibility

The overlay panel is `role="dialog"` `aria-modal="true"` with an accessible name (`ariaLabel`). The search field is `<input role="combobox" aria-autocomplete="list" aria-expanded aria-controls aria-activedescendant>`; the results are a `role="listbox"` of `role="option"` elements, each with `aria-selected` (the active option) and `aria-disabled`. Selection is committed on `Enter`, and the active option is announced via `aria-activedescendant` while focus never leaves the input — the WAI-ARIA APG combobox-with-listbox pattern.

See the [comparison page](/components/command-palette-comparison) for how this replaces the per-framework command-menu libraries.
