---
"@rozie-ui/dialog-solid": patch
---

**Fixed: a consumer `class` on `<Dialog>` no longer replaces the component's own `rozie-dialog`
class.** The root `<dialog>` merges its `cancel`/`click` handlers with the consumer's own
pass-through props (so a consumer-supplied native listener still fires alongside them, R6
all-fire); that merge previously carried the WHOLE pass-through props bucket — not just its
listener keys — and re-applied the untouched `class` at the tail of the element's JSX attribute
list, silently overwriting the value Dialog had already merged one attribute earlier. Verified:
`<Dialog class="my-dialog" />` used to render `class="my-dialog"`; it now renders
`class="rozie-dialog my-dialog"`. No API change.
- @rozie/runtime-solid@0.7.5
