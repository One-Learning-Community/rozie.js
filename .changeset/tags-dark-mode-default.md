---
"@rozie-ui/tags-react": patch
"@rozie-ui/tags-vue": patch
"@rozie-ui/tags-svelte": patch
"@rozie-ui/tags-angular": patch
"@rozie-ui/tags-solid": patch
"@rozie-ui/tags-lit": patch
---

Tags now ships an OS-driven dark-mode default for its chip/input color tokens, matching the mechanism already shipped for `@rozie-ui/rete`.

Previously, `@rozie-ui/tags`'s default chip/input colors were light-only — a consumer on a `prefers-color-scheme: dark` system with no import at all got a bright white input on a dark page. `Tags.rozie` now carries a zero-import `@media (prefers-color-scheme: dark)` default on 8 color-bearing tokens (background, border, accent, focus ring, chip background, remove-button hover, placeholder, disabled background), plus an app-toggled `.dark` / `[data-theme="dark"]` class strategy in `themes/base.css` for apps that switch theme by a root class instead of the OS setting. An app that explicitly opts into light via `.light` / `[data-theme="light"]` keeps the light look under OS dark.

No public API changes: all new values are private `--rtg-*` wiring — no `--rozie-tags-*` token was added, renamed, or removed, so an existing consumer override of any `--rozie-tags-*` token keeps winning in both light and dark, exactly as before.
