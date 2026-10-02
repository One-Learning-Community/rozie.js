---
"@rozie-ui/dialog-solid": minor
---

Fixes for a `Dialog` removed while open, plus an `initialFocus` prop (from oinbox dogfooding):

- **Unmounted while open, the dialog now cleans up.** A `Dialog` inside `<Show>` that was removed with `open` still `true` never saw `open` go false: it kept `<html>` at `overflow: hidden` (the scroll-lock count was never released) and never returned focus, so keyboard users landed on `<body>`. On removal it now releases its scroll lock and closes the native dialog, which returns focus to the element focused before it opened. If the dialog has already left the page, focus is restored one task later, and only when nothing else has taken it.
- **A dialog that mounts closed no longer releases another dialog's scroll lock.** Each dialog now releases only the lock count it took, so mounting a closed `Dialog` while another one is open keeps the page locked.
- **`initialFocus`** (a CSS selector matched inside the dialog content, or an Element) is focused when the dialog opens, replacing the native `showModal()` choice (the first `autofocus` element, else the first focusable one). A parent no longer has to wait a microtask after the dialog mounts to focus its own field.
