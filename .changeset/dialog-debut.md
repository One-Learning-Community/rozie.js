---
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-vue": patch
"@rozie-ui/dialog-svelte": patch
"@rozie-ui/dialog-angular": patch
"@rozie-ui/dialog-lit": patch
---

First release of `@rozie-ui/dialog` on React, Vue, Svelte, Angular and Lit. The Solid leaf has been on npm since the 2026-09-26 wave; all six targets of the family now ship at the same version, so one version number means one component revision everywhere.

The headless, accessible modal dialog is built on the native `<dialog>` element and `showModal()`: top-layer rendering without a portal, a native `::backdrop` scrim, a real focus trap, Escape-to-dismiss, focus restoration, and a ref-counted `<html>` scroll lock that survives nested dialogs. It has a two-way `open` binding, a typed `close` event (`{ reason: 'backdrop' | 'escape' | 'programmatic' }`), an `initialFocus` prop, `show()` / `hide()` handle verbs, and design-system token bridges for shadcn/ui, Material 3 and Bootstrap 5.

The Vue leaf ships a `web-types.json` and the Lit leaf a `custom-elements.json`, so JetBrains IDEs and `lit-plugin` complete the props, events and slots.
