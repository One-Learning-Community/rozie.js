---
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
---

Accept `@rozie-ui/combobox-<framework>` 0.8 as a peer dependency, alongside 0.5–0.7. Combobox 0.8 adds free-text options (`splitPaste`, `commitOnBlur`, a normalising `validate`) and the `query()` handle method; nothing command-palette uses changes. With no explicit `idBase`, the palette's inner combobox now generates a unique id base per instance.
