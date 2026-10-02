---
"@rozie-ui/dialog-react": minor
"@rozie-ui/dialog-vue": minor
"@rozie-ui/dialog-svelte": minor
"@rozie-ui/dialog-angular": minor
"@rozie-ui/dialog-lit": minor
---

A `Dialog` removed while open now releases its scroll lock and returns focus; a dialog that mounts closed no longer releases another open dialog's lock; new `initialFocus` prop (a selector or Element focused when the dialog opens).
