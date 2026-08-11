---
'@rozie-ui/command-palette-react': patch
'@rozie-ui/command-palette-solid': patch
'@rozie-ui/command-palette-svelte': patch
'@rozie-ui/command-palette-vue': patch
---

Restore the search input's accessible name. The palette's `ariaLabel` prop is forwarded to the composed Combobox that owns the search input; the binding was spelled kebab-case (`:aria-label`), which React/Svelte/Solid preserve verbatim on custom components, so the value never reached the Combobox's `ariaLabel` prop and the input shipped with no `aria-label` on these three targets. The binding is now camelCase and the value threads end-to-end (Angular and Lit were already correct and are byte-identical, unbumped). The Vue leaf was also already correct at runtime — Vue resolves both spellings to the same prop — but its emitted SFC now spells the binding camelCase, so it takes a cosmetic patch to keep the published tarball in sync with source.
