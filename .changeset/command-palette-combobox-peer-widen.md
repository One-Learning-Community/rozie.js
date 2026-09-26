---
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
"@rozie-ui/command-palette-angular": patch
---

All six `@rozie-ui/command-palette-<target>` leaves widen their required
`@rozie-ui/combobox-<target>` peer dependency from `^0.5.0` to `^0.5.0 || ^0.6.0`.

`@rozie-ui/combobox` moves to `0.6.0` in this same release (see that changeset). A caret range
on a 0.x version pins the minor, so leaving command-palette's declared range at `^0.5.0` would
make every command-palette leaf uninstallable against the combobox version it now needs once
combobox actually publishes at `0.6.0` — the same shape as the `data-table`/`popover` peer-widen
precedent from an earlier release.

**Why it is safe to admit both, not just force the new one.** Command-palette composes exactly
one `<Combobox>` per leaf, and combobox's `0.6.0` changes in this release are internal
virtualization-timing fixes, a CSS-cascade theming fix, and the removal of an already-inert
`--rozie-combobox-list-z` token — none of which command-palette's own usage reads or depends on.
There is no runtime, API, or DOM change in `@rozie-ui/command-palette-<target>` itself from this
edit; the entire diff is the one peer-dependency range line per target.

This changeset is deliberately kept separate from the theming changeset covering
command-palette in this same release — it is its own story about command-palette's peer
contract, not a restatement of the theming fix.
