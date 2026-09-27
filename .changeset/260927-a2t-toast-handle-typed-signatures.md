---
"@rozie-ui/toast-react": patch
"@rozie-ui/toast-vue": patch
"@rozie-ui/toast-svelte": patch
"@rozie-ui/toast-angular": patch
"@rozie-ui/toast-solid": patch
"@rozie-ui/toast-lit": patch
---

The imperative handle's `show`/`dismiss`/`clear`/`patch`/`promise` methods now carry their real action/data-aware TypeScript signatures in every target's declaration output, instead of the untyped `(...args: any[]) => any` catch-all.

`show()` and `patch()` were already functionally action/data-aware at runtime — both accept `{ message, type, duration, action: { label, onClick }, data }`, exactly as the README's Undo example documents — but none of the five methods carried an explicit TypeScript return-type annotation in the Rozie source, so every target's declaration emitter fell back to the untyped catch-all shape. A consumer typing `show({ actoin: {...} })` (typo) or misusing `patch()` got zero compile-time help.

Purely a type-accuracy fix: no runtime behavior changed on any target.
