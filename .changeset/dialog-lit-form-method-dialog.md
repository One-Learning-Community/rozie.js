---
"@rozie-ui/dialog-lit": patch
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-vue": patch
"@rozie-ui/dialog-svelte": patch
"@rozie-ui/dialog-angular": patch
"@rozie-ui/dialog-solid": patch
---

A `<form method="dialog">` placed inside the dialog now closes it on Lit. The native `<dialog>` lives in the element's shadow root and the form is slotted light DOM, so the browser found no ancestor dialog and the submit did nothing. Dialog now handles the submit itself (submitter `value` becomes `returnValue`, a `preventDefault()`ed submit is left alone, and a form inside a nested dialog closes only that dialog). On the other five targets the behaviour is unchanged: the same handler runs, and the browser's own close then finds the dialog already closed.
