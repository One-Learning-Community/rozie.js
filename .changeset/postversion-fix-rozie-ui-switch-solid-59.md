---
"@rozie-ui/switch-solid": patch
---

**Fixed: a consumer `class` on `<Switch>` no longer replaces the component's own `rozie-switch`
class.** The root `<button role="switch">` merges its `click`/`keydown` handlers with the
consumer's own pass-through props (so a consumer-supplied native listener still fires alongside
them, R6 all-fire); that merge previously carried the WHOLE pass-through props bucket — not just
its listener keys — and re-applied the untouched `class` at the tail of the element's JSX
attribute list, silently overwriting the value Switch had already merged one attribute earlier.
Verified: `<Switch class="my-switch" />` used to render `class="my-switch"`; it now renders
`class="rozie-switch my-switch"`. No API change.
- @rozie/runtime-solid@0.7.5
