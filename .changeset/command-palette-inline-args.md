---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

New **inline command arguments** (Raycast-style): a command item declares `args: [{ id, placeholder?, required?, default? }]` (text inputs only in v1). Selecting an args-bearing item (Enter or click) automatically enters a panel-internal args surface — reusing the same real-focus/`pinOpen` mechanics as the existing per-row action menu, with zero new props/events. A non-interactive chip shows the pending command's label above the field(s); the result list stays visibly open but is dimmed and `aria-hidden` while the args surface is active.

Enter with every `required` field non-empty (after trim) fires the EXISTING `select` event with an added `args: { [id]: value }` key — additive and non-breaking: an argless command's `select` payload carries no `args` key at all. Enter with a missing required field instead focuses the first unfilled field. `default` prefills its field (selected on focus so typing replaces it). Escape closes the args surface and restores the list + query (same precedence tier as closing the sub-actions menu); Backspace on an empty first field also pops back to the list. `args` wins over a `source`/`children` navigation on the same item (mutually exclusive); `args` is compatible with the per-row `actions` menu (which is inactive once the args surface is open).

New optional slot `argsField` (scope `{ item, arg, value, setValue }`) replaces the default field chrome (surface 11→12 slots). New `--rozie-command-palette-args-{padding,gap,chip-bg,chip-color,field-padding,field-border,field-radius,field-bg,dim-opacity}` tokens alias the existing panel/input fallbacks. No compiler change, no `@rozie-ui/combobox` change — the args surface reuses `pinOpen`/`reopenComboboxPopup` verbatim.
