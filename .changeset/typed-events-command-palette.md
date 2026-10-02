---
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
---

CommandPalette: every event handler now has a real payload type instead of `(...args: any[]) => void`. `navigate` receives `CommandPaletteNavigatePayload` (`{ item, depth }`), `select` receives `CommandPaletteSelectPayload` (`{ item, path, args? }`), `action-select` receives `CommandPaletteActionSelectPayload` (`{ item, action }`), and `back` takes no argument. The `item` in each payload is a `CommandPaletteItem` (fields the palette does not read stay `any`), and `CommandPaletteAction` and `CommandPaletteArg` are exported alongside the payload types. A handler written against a different payload shape may now be rejected by the type checker.
