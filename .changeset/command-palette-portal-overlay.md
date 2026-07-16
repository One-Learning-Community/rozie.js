---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

New `appendTo` prop (surface 14→15) lets the overlay escape an ancestor whose `overflow: hidden` / `transform` / `filter` / `contain` would otherwise clip the palette's `position: fixed` overlay — a real embedding bug (an app-shell iframe or a designer-chrome wrapper with its own layout is the common case). Defaults to `false` (render in place, today's behavior — zero change for existing consumers); set it to `true`/`'body'` to portal to `document.body`, a CSS selector string to portal to the first matching element, or an `Element` reference to portal to that element directly.

Built on a new compiler primitive (`r-portal`, see the toolchain changeset) using each target's native element-teleport construct — React `createPortal`, Vue `<Teleport>`, Solid `<Portal>`, a Svelte action, an AOT-safe Angular effect, and a Lit `ReactiveController`. Everything else about the palette works unchanged through the portal — the levels Escape funnel, combobox's own focus management, and the row-action-menu arbitration are all rooted at `$refs.panel`/`$refs.frame` (never `$el`), so a moved node's ref identity survives the relocation with zero logic changes. Theming custom properties (`--rozie-command-palette-*`) must be set on `:root` (or the `appendTo` container itself) to reach a portalled overlay — see the [API reference](/components/command-palette-api#escaping-a-clipped-ancestor-appendto) for the full value grammar and the Lit-specific theming note.

Also corrects a stale header comment in `CommandPalette.rozie` that cited an already-fixed compiler gap as the reason native `<dialog>` was avoided — the actual (unchanged) reason is that `<dialog>.showModal()`'s native focus-trap/Escape would fight the palette's own levels Escape funnel and combobox focus management.
