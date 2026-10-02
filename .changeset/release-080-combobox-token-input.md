---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-angular": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
---

Token-input support (from a Gmail-style recipient field built on `multiple` + `disableFilter`). Every new prop is off by default.

- **`block`** fills the container (the root, the input and the width-matched list stretch to 100%).
- **`chipLayout="inline"`** puts the chips and the input on one wrapping row, as Tags does (default `'stacked'` keeps the chips above the input).
- **`disableOpenOnFocus`**: focus no longer opens the list; typing and the arrow keys still do.
- **`hideEmpty`**: with no options and no create row to show, no popup is shown, `aria-expanded` stays `false`, and Escape is left to the host.
- **Free text** (`multiple` only), named after Tags: **`delimiters`** (e.g. `[',', ';']`) commit the typed text, a paste containing a delimiter adds every part, and when free text is on, Enter with nothing highlighted commits too. **`validate(text) => boolean`** gates every free-text commit. A commit appends the text to `value` and fires `change` with `option: null` and a new `text` field.
- **`selectOnTab`**: Tab picks the highlighted option (it only keeps focus when it picked). The handle gains **`activeOption()`**, the highlighted source option or `null`.
- **Typed surface:** `search`, `change` and `create` payloads, every slot context and the handle are typed, and the types are exported (`ComboboxChangePayload`, `ComboboxChipSlotCtx`, …). Handlers typed against the payloads can now reject a wrong-typed handler that used to compile.

Fixes:

- Ctrl/Cmd/Alt+Enter no longer picks the highlighted option, so a host's Ctrl+Enter shortcut is not doubled.
- Keys pressed while an IME composition is in progress are ignored (the Enter that confirms a composition no longer picks).
- Escape is consumed only when a list is actually visible.
- The custom `chip` slot's `remove()` returns focus to the input, like the built-in remove button.
- Angular: the input's native `change` event no longer bubbles into a consumer's `(change)` binding.
