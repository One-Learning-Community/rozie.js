---
"@rozie-ui/tags-react": patch
"@rozie-ui/tags-vue": patch
"@rozie-ui/tags-svelte": patch
"@rozie-ui/tags-angular": patch
"@rozie-ui/tags-solid": patch
"@rozie-ui/tags-lit": patch
---

Paste fixes:
- A paste no longer discards the text already typed. The parts of a split paste that are rejected (by `validate` or `max`) are inserted at the caret, as an ordinary paste would be; they used to vanish, and a successful paste cleared the input.
- A paste with no split character is ordinary text again. With the default delimiters every paste was intercepted and committed straight away as a tag, even a single word pasted into the middle of a typed one.
- A paste of several parts adds all of them. Only the last part used to be kept on frameworks where the model updates after the handler (React, and Vue until the next tick).
- A paste of several parts writes the model and fires `change` once, with one `add` per added tag.
