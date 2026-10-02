---
"@rozie-ui/popover-react": patch
"@rozie-ui/popover-vue": patch
"@rozie-ui/popover-svelte": patch
"@rozie-ui/popover-angular": patch
"@rozie-ui/popover-solid": patch
"@rozie-ui/popover-lit": patch
---

`idBase` now defaults to `''`, and each popover generates a unique id base after mount (`rozie-popover-<n>`). Every popover left at the default used to get the panel id `rozie-popover-panel`, so two open popovers shared an id and the anchor's `aria-controls` / `aria-describedby` could point at the wrong panel. An explicit `idBase` is used as before, and the `anchor` slot's `panelId` follows the generated id.

The README and docs now explain that the root is `display: contents`: a `class` or `style` you pass reaches it, but only inherited properties (color, font, the `--rozie-popover-*` tokens) take effect there. To place a popover in a flex row or grid, wrap it in your own element.

Lit: a popover that re-rendered before its first open (for example after a prop change) could open unpositioned, in normal flow instead of floating at the anchor, because positioning started before the panel had rendered. Positioning now waits for the panel.
