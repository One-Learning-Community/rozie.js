---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Grouped commands now render as real labeled sections via the vendored
`@rozie-ui/combobox` primitive's native option grouping, instead of a per-row
text badge. Commands sharing the same `items[].group` string are auto-derived
into `[{ id, label }]` sections (no new opt-in prop) and rendered under a
labeled `role="group"` heading; commands with no `group` render first in a
headingless block. Global relevance ranking is preserved WITHIN a group and
sacrificed ACROSS groups (the intended semantics of a sectioned list) —
groups themselves appear in first-appearance order.

The previous per-row `.rozie-command-palette-option-group` badge is
suppressed whenever grouping is active; a consumer whose items carry no
`group` sees today's flat, unsectioned list, byte-identical to before this
change.

New slot `groupHeading` (scope `{ group }`, where `group` is `{ id, label }`)
customizes the section heading; the default fill renders `group.label`.

This release requires the sibling `@rozie-ui/combobox-*` packages at a
version carrying the native `groups` prop / `groupHeading` slot
(`combobox-native-groups`).
