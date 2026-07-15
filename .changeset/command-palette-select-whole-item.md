---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

**BREAKING:** `@select` now emits `{ item, path }` — `item` is the full chosen
command object (everything you put on the item: `id`/`label`/`group`/
`keywords`/`icon`/`actions`/`disabled`/any custom fields), and `path` is the
levels id-breadcrumb (unchanged). Previously `@select` emitted a slim
projection, `{ id, label, group, path }`, dropping any other fields you'd
attached to the item and forcing consumers to re-resolve the full item from
just its `id`.

This mirrors the existing `@navigate` event's `{ item, depth }` shape — both
navigation events now consistently hand back the full item.

**Migrate:** `e.id` → `e.item.id`, `e.label` → `e.item.label`, `e.group` →
`e.item.group`. `e.path` is unchanged.
