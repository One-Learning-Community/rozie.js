---
"@rozie-ui/toast-solid": patch
---

**Fixed: a consumer `class` on `<Toaster>` no longer replaces the component's own
`rozie-toaster` class.** The root toast region merges its `mouseenter`/`mouseleave` handlers with
the consumer's own pass-through props (so a consumer-supplied native listener still fires
alongside them, R6 all-fire); that merge previously carried the WHOLE pass-through props bucket —
not just its listener keys — and re-applied the untouched `class` at the tail of the element's
JSX attribute list, silently overwriting the value Toaster had already merged one attribute
earlier. Verified: `<Toaster class="my-toaster" />` used to render `class="my-toaster"`; it now
renders `class="rozie-toaster ... my-toaster"`. No API change.
