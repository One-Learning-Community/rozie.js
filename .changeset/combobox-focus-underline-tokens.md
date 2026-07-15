---
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-vue": patch
"@rozie-ui/combobox-svelte": patch
"@rozie-ui/combobox-angular": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/combobox-lit": patch
---

Three additive, render-neutral tokens (every fallback replicates today's
rendered value, so a consumer who never sets these sees no change):

- `--rozie-combobox-focus-border-color` — the input's `:focus` border color,
  decoupled from `--rozie-combobox-accent` (which also colors the selected
  option), so a host can neutralize the focus border independently.
- `--rozie-combobox-input-underline` — a bottom-border longhand that
  survives the `:focus` `border-color` override, letting a host render a
  persistent bottom divider (blurred and focused) without a full border.
- `--rozie-combobox-group-heading-margin-top` — top margin above each group
  heading, for separating the leading ungrouped block from the first
  labeled section.

Landed alongside `@rozie-ui/command-palette`'s style polish, which drives
these tokens from its panel scope for a clean, borderless, ring-free input.
