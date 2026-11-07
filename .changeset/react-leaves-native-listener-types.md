---
"@rozie-ui/combobox-react": patch
"@rozie-ui/data-table-react": patch
"@rozie-ui/text-field-react": patch
---

Rebuilt with the current compiler: the `<input>`/`<textarea>` change listener now passes its event names to `rozieNativeListeners`, so its handler gets the precise event type. No behaviour change.
