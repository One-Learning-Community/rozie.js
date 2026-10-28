---
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-vue": patch
"@rozie-ui/dialog-svelte": patch
"@rozie-ui/dialog-angular": patch
"@rozie-ui/dialog-solid": patch
"@rozie-ui/dialog-lit": patch
---

Dialog fixes found by the pre-release audit (all six targets):

- A press that started inside the panel (selecting text, a drag) and was released over the scrim closed the dialog with reason `'backdrop'`. It no longer does; only a press that starts on the scrim is a backdrop click.
- A native close that did not go through the component (a `<form method="dialog">` submit inside the panel, or a stray `dialog.close()`) left `open` set to `true` over a closed dialog, which then could not be reopened. The `open` model now follows, and `close` fires with `reason: 'programmatic'`.
- `hide()` on a dialog that is not open no longer writes the model or emits a `close` for a dismissal that never happened.
- Lit: `ariaLabelledby` could not reach a heading in the slotted content (an `aria-labelledby` id does not cross a shadow root), so the dialog had no accessible name. It is now bridged with `ariaLabelledByElements` where the browser supports it (Chrome and Edge 135+, Safari 16.4+); elsewhere use `ariaLabel`.
- The handle's `show()` and `hide()` are typed `() => void` on every target (React, Solid and Lit typed them `(...args: any[]) => any`). A call with an argument is now a type error.
- `ariaLabel` and `ariaLabelledby` are dropped from the `<dialog>` when they are `null`, so a strict consumer compiling the Vue or React source typechecks.
