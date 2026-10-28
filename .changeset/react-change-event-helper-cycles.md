---
"@rozie/core": patch
"@rozie/runtime-react": patch
---

Two React emitter fixes:

- `@change` on an `<input>` or `<textarea>` now listens to the DOM `change` event, which fires when the user commits an edit (on blur, or Enter in a single-line input), as on the other five targets. It used to compile to React's `onChange`, which fires on every keystroke. The listener is attached through the element's `ref` by a new `@rozie/runtime-react` helper, `rozieNativeListeners`, and an author `ref` on the same element keeps working. `<select>` and checkbox, radio and file inputs keep `onChange`, where React's event already matches the DOM one. An input with both `r-model` and `@change` no longer merges the two into one per-keystroke handler.
- Top-level helpers that call each other (`ping` calls `pong`, `pong` calls `ping`) no longer throw `Cannot access 'pong' before initialization` on the first render. The call to the helper declared later goes through a ref kept up to date after its declaration, so neither `useCallback` lists the other as a dependency.
