---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-angular": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
---

Free-text (token input) follow-ups, from a Gmail-style recipient field.

Fixes:
- A paste split on `delimiters` no longer discards the text already in the input. The parts `validate` rejects are now inserted at the caret, replacing the selection, as an ordinary paste would be. Typing `ann@` and pasting `corp.com, bob@x.test` leaves `ann@corp.com` in the input and adds `bob@x.test`; it used to leave `corp.com`.
- `search` now fires whenever the input text changes, not only on keystrokes. It fires with the resulting text after a paste Combobox handles itself, and with `{ query: '' }` whenever Combobox clears the input itself: a pick or create under `multiple`, a free-text commit and `clear()`. A free-text commit of a value that is already selected clears the input but fires no `change`, so a host that tracked the query through `search` used to keep offering suggestions for text that was gone.
- `idBase` now defaults to `''`, and each instance generates a unique id base after mount (`rozie-combobox-<n>`). Two comboboxes left at the default used to share their listbox and option ids, and every combobox's popup shared the panel id `rozie-popover-panel`. An explicit `idBase` is used as before.

New:
- `validate` may return the string to store, the same shape as Tags' `validate`. Return a string to store it (for example the bare address from `Sam Roe <sam@x.test>`), `true` to store the text as typed, or a falsy value to reject. Boolean validators behave as before. `change.text` is the stored string.
- `splitPaste: (text) => string[] | null` replaces the built-in paste split. Return the parts to commit, or `null` to leave the paste to the browser. Use it for syntax a delimiter split cannot know, such as `"Roe, Sam" <sam@x.test>`.
- `commitOnBlur` (default `false`) commits the typed text when the input loses focus, through `validate`.
- `query()` on the handle returns the current input text.

`splitPaste` and `commitOnBlur`, like `validate`, turn free-text commits on.
