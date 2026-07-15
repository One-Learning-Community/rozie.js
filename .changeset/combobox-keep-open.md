---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-angular": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
---

Added a `pinOpen(boolean)` imperative handle verb. While pinned, blurring the
input (e.g. because a host sub-surface like an action flyout took real DOM
focus) no longer collapses the result popup — `onBlur()` early-returns while
pinned. `pinOpen(false)` only unpins; it does not itself close the popup or
restore focus, which stays the host's responsibility.

Additive and render-neutral: never calling `pinOpen` leaves behavior
byte-identical to before this release.
