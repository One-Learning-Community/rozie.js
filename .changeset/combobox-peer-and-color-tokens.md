---
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-vue": patch
"@rozie-ui/combobox-svelte": patch
"@rozie-ui/combobox-angular": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/combobox-lit": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
---

Combobox:

- `@tanstack/virtual-core` is a required peer. Combobox imports it at module top level whether or not `virtual` is set, so it was never optional; the README install line now includes it (command-palette's too, which composes Combobox).
- `--rozie-combobox-color` reaches the chips and the popup options, not only the input.
- `--rozie-combobox-option-selected-color` is declared in `themes/base.css` (default: the accent), like the other public tokens; it was read but never declared.
