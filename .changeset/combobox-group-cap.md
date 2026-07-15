---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-angular": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
---

Per-group result cap with an expand-in-place "+N more" affordance — new
`groupCap` prop + `#groupMore` slot.

Set `groupCap` alongside `groups` to cap each native section to its first
`groupCap` options; an overflowing section renders a keyboard-reachable
"+N more" row after its capped options. Activating the row (Enter while it
is the active-descendant, or a click) expands **that section only**, in
place — the remaining options render inline and the row disappears. It never
writes the `value` model or fires `change`; expansion is purely a reveal.
`ArrowDown`/`ArrowUp` rove onto the more-row like any option and, once
expanded, continue into the newly-revealed options — `aria-activedescendant`
always resolves to a rendered row. Expansion state resets whenever the
option set or the typed query changes.

New slot `groupMore` (scope `{ group, hidden, expand }`) customizes the
more-row's markup; the default fill renders `+{hidden} more`.

`0`/absent (default) is uncapped and byte-identical to plain grouping.
`groupCap` only applies to the standard (non-`virtual`) grouped render, same
as `groups` itself.
