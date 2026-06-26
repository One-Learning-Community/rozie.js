---
"@rozie-ui/command-palette-react": major
"@rozie-ui/command-palette-vue": major
"@rozie-ui/command-palette-svelte": major
"@rozie-ui/command-palette-angular": major
"@rozie-ui/command-palette-solid": major
"@rozie-ui/command-palette-lit": major
---

BREAKING: command-palette slot API re-aligned to the listbox vocabulary

command-palette now composes the shipped `@rozie-ui/listbox` primitive internally
(authoring-time source vendoring, Phase 999.4 Option B). As part of that, its
public scoped-slot API is re-aligned to listbox's slot vocabulary so the primitive
and the composite share one slot contract:

- `#item {item, active}` → `#option {option, index, active, selected, disabled}`
  (the slot is renamed `item` → `option`, the scoped item is renamed `item` →
  `option`, and the scope gains `index`, `selected`, and `disabled`).
- `#empty` now exposes `{query}` (additive — the current search text).
- `#footer` is unchanged (it stays in the palette panel, a sibling of the listbox).

Migration: consumers using the `#item` slot must rename it to `#option` and read
`option` instead of `item`:

```diff
- <template #item="{ item, active }">{{ item.label }}</template>
+ <template #option="{ option, active }">{{ option.label }}</template>
```

The two-way models (`open`, `query`), the `:items`/`:placeholder`/`:emptyText`/
`:closeOnSelect`/`:ariaLabel`/`:idBase` props, the `select` event, and the
`show`/`close`/`toggle`/`focus` imperative handle are all unchanged.

This is a breaking change to the shipped 0.1.0 consumer slot API — acceptable
pre-1.0, and it yields one shared slot vocabulary across the listbox primitive and
the command-palette composite.
