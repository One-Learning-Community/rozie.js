---
"@rozie-ui/toast-react": minor
"@rozie-ui/toast-vue": minor
"@rozie-ui/toast-svelte": minor
"@rozie-ui/toast-angular": minor
"@rozie-ui/toast-solid": minor
"@rozie-ui/toast-lit": minor
---

The toaster now announces through two standing live regions that are mounted with it, instead of a `role="status"` on each toast as it is inserted (a live region that arrives together with its content is often not announced, VoiceOver especially). A polite `role="status"` region and an assertive `role="alert"` region exist before the first toast; each toast's `message` is written into one of them, and a `patch()` or `promise()` that changes the message rewrites that toast's line in place.

`error` toasts are announced assertively (`role="alert"`) and every other type is polite. This changes `warning`, which was assertive before: it is now polite.

Toast rows no longer carry `role` or `aria-live`, so a test or stylesheet that selects toasts by `[role="status"]` should select `.rozie-toast` instead.

The regions carry `message`, so pass one to `show()` even when a `#toast` slot renders its own content. New `disableAnnounce` prop for a slot that supplies its own `role` / `aria-live`: the toaster then renders no live regions, so nothing is announced twice or nested.

On Solid, the `toastSlot` function no longer appears as a `toastslot` attribute on the root element (a compiler fix).
