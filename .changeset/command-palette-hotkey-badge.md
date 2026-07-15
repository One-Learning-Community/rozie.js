---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Command items may now carry an optional `hotKey?: string` field — a display-only teaching badge advertising an app-global shortcut the consumer owns (e.g. Copy `$mod+c`, Print `$mod+p`), rendered right-aligned before the `#actions` affordance and gated on the item's `hotKey`. It reuses the same portable `$mod`/`$shift`/`$alt`/`$ctrl` modifier grammar as the existing `actionKey` hint — the palette never binds or listens for the key, it is purely visual. That grammar is now factored out into a shared `formatKeyToken` helper that `actionKey`'s own default hint also renders through. Five new `--rozie-command-palette-hotkey-*` theming tokens fall back to the existing `--rozie-command-palette-actions-hint-*` values.
