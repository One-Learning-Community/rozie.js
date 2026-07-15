---
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
---

Platform-aware `actionKey` hint: the row-actions affordance's default hint badge rendered the mac `⌘` glyph on every platform. It now shows `⌘K` on Apple platforms and `Ctrl+K` elsewhere (SSR-safe sniff, display-only — shortcut matching was already portable via `metaKey || ctrlKey` and is unchanged).
