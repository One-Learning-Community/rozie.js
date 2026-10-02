---
"@rozie-ui/toast-react": patch
"@rozie-ui/toast-vue": patch
"@rozie-ui/toast-svelte": patch
"@rozie-ui/toast-angular": patch
"@rozie-ui/toast-solid": patch
"@rozie-ui/toast-lit": patch
---

Toaster: the `dismissed` event handler now has a real payload type instead of `(...args: any[]) => void`. It receives `ToastDismissedPayload` (`{ toast: ToastEntry; reason: ToastDismissReason }`), and the `#toast` slot's `toast` and `dismiss` parameters are typed too (`ToastEntry` and `(id: string) => void`). `ToastEntry`, `ToastType`, `ToastAction`, `ToastDismissReason` and `ToastDismissedPayload` are exported from the package entry. A handler written against a different payload shape may now be rejected by the type checker.
