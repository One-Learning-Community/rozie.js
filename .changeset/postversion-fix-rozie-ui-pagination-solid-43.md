---
"@rozie-ui/pagination-solid": patch
---

**Fixed: a consumer `class` on `<Pagination>` no longer replaces the component's own
`rozie-pagination` class.** The root `<nav>` merges its `keydown` handler with the consumer's
own pass-through props (so a consumer-supplied native listener still fires alongside it, R6
all-fire); that merge previously carried the WHOLE pass-through props bucket — not just its
listener keys — and re-applied the untouched `class` at the tail of the element's JSX attribute
list, silently overwriting the value Pagination had already merged one attribute earlier.
Verified: `<Pagination class="my-pagination" />` used to render `class="my-pagination"`; it now
renders `class="rozie-pagination my-pagination"`. No API change.
- @rozie/runtime-solid@0.7.5
