---
"@rozie-ui/dialog-solid": patch
---

Fixes `<html>` scroll-lock so it survives nested/stacked dialogs: closing an inner dialog while an outer one is still open no longer unlocks background scrolling. The scroll lock is now ref-counted (a module-level counter shared by every mounted `Dialog`) instead of a naive per-instance `overflow` toggle, and it restores the page's original inline `overflow` value (not a hardcoded empty string) once the last open dialog closes.
