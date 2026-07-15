---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Pass-through `groupCap` prop — cap command sections with an expand-in-place
"+N more" row.

Set `groupCap` to cap each command section (see [Grouped
commands](/components/command-palette-api#grouped-commands)) to its first
`groupCap` results, straight through to the vendored `@rozie-ui/combobox`
primitive's own `groupCap`. An overflowing section renders a
keyboard-reachable "+N more" row that expands that section in place when
activated — no new palette prop/slot/emit/expose beyond `groupCap` itself.
`0`/absent (default) is uncapped, byte-identical to before this release.

Note: the ⌘K/Right-arrow row action menu resolves the highlighted row by
section index, which assumes the uncapped section order — combining
`groupCap` with per-row `actions` is not composed in this release.

This release requires the sibling `@rozie-ui/combobox-*` packages at a
version carrying the native `groupCap` prop / `groupMore` slot
(`combobox-group-cap`).
