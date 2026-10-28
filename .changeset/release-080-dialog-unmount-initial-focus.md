---
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-vue": patch
"@rozie-ui/dialog-svelte": patch
"@rozie-ui/dialog-angular": patch
"@rozie-ui/dialog-lit": patch
---

A `Dialog` removed while open now releases its scroll lock and returns focus; a dialog that mounts closed no longer releases another open dialog's lock; new `initialFocus` prop (a selector or Element focused when the dialog opens).
