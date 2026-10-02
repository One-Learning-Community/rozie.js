---
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-vue": patch
"@rozie-ui/dialog-svelte": patch
"@rozie-ui/dialog-angular": patch
"@rozie-ui/dialog-solid": patch
"@rozie-ui/dialog-lit": patch
---

Dialog: the `close` event handler now has a real payload type instead of `(...args: any[]) => void`. It receives `DialogClosePayload` (`{ reason: DialogCloseReason }`, where the reason is `'backdrop' | 'escape' | 'programmatic'`). Both types are exported from the package entry. A handler written against a different payload shape may now be rejected by the type checker.
