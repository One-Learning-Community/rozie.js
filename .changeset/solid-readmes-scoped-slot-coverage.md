---
"@rozie-ui/pagination-solid": patch
"@rozie-ui/listbox-solid": patch
"@rozie-ui/switch-solid": patch
---

Docs-only: each package's README custom-slot example previously demonstrated only its basic usage, leaving its scoped-slot render props undemonstrated (or unnamed).

- `pagination-solid`: adds a worked example for the `itemSlot` scoped slot (`{ page, selected, goto }`) and names its siblings (`prevControlSlot` / `nextControlSlot` / `ellipsisSlot`).
- `listbox-solid`: the existing `optionSlot` example now also names the sibling `selectedSlot` (`{ selected, value }`) and `emptySlot` (`{ query }`) scoped slots.
- `switch-solid`: adds a worked example for the default slot's SCOPED form (`{ checked, toggle }`) — a children *function* rather than a plain child, which Solid distinguishes via `typeof children === 'function'`.
