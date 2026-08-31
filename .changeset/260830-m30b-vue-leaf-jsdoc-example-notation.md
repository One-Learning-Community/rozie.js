---
"@rozie-ui/captcha-vue": patch
"@rozie-ui/cropper-vue": patch
"@rozie-ui/embla-vue": patch
"@rozie-ui/flatpickr-vue": patch
"@rozie-ui/pdf-vue": patch
"@rozie-ui/sortable-list-vue": patch
"@rozie-ui/wavesurfer-vue": patch
---

Vue leaves: `@example` snippets in prop documentation now use Vue syntax

The published tarballs for these seven leaves still carried Rozie authoring
notation inside their `@example` JSDoc blocks — `r-model:data="crop"` where a
Vue consumer should see `v-model:data="crop"`. Hovering a prop in an editor
showed markup that is not valid in the framework you are actually using.

The fix landed in source on 2026-08-24 but these seven were never bumped, so
npm kept serving the old bytes (`pnpm publish` silently skips an already-
published version). Documentation comments only — no runtime code, type
signature, or import changed.
