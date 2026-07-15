---
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
---

Style polish for the nested-levels + sub-actions UI, driven by a rendered
audit:

- **fix:** the per-row action flyout escaped to the viewport's right edge
  instead of staying anchored to the palette (the panel established no
  containing block). A new non-clipping `.rozie-command-palette-frame`
  wrapper now owns positioning; the flyout is a frame child (sibling of the
  panel) so it can extend past a short panel without ever being clipped or
  escaping to the viewport.
- The default `#breadcrumb` fill now renders the full root..current trail
  (muted ancestors › an emphasized current segment) instead of a bare `‹` +
  the current title alone. The slot API (`{ stack, back }`) is unchanged.
- The composed search input renders borderless with a subtle bottom divider
  instead of the vendored combobox's default bordered/blue-focus-ring look,
  via panel-scope token overrides (see the combobox tokens release below).
- Subtle top spacing now separates the leading ungrouped command block from
  the first labeled group heading.

No new props/emits/slots/expose; no behavior change. Requires the sibling
`@rozie-ui/combobox-*` packages at a version carrying
`--rozie-combobox-focus-border-color` / `--rozie-combobox-input-underline` /
`--rozie-combobox-group-heading-margin-top`.
