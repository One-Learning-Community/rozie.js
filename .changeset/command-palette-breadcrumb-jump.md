---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Breadcrumb ancestor segments are now click-to-jump — clicking a muted ancestor pops the level stack straight back to that tier, emitting one `back` event per popped level (exactly like pressing Backspace that many times), keyboard-focusable with a "Back to `<title>`" aria-label. The current segment stays non-interactive. It composes with the already-staged 0.4.0 minor.
