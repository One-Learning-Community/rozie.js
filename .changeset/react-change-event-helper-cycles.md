---
"@rozie/core": patch
"@rozie/runtime-react": patch
---

Emitter fixes:

- React: `@change` on an `<input>` or `<textarea>` now listens to the DOM `change` event, which fires when the user commits an edit (on blur, or Enter in a single-line input), as on the other five targets. It used to compile to React's `onChange`, which fires on every keystroke. The listener is attached through the element's `ref` by a new `@rozie/runtime-react` helper, `rozieNativeListeners`; an author `ref` or bound `:ref` on the same element keeps working, and `.once`, `.passive` and `.capture` become listener options (`.once` fires once even across re-renders). `<select>` and checkbox, radio and file inputs keep `onChange`, where React's event already matches the DOM one. An input with both `r-model` and `@change` no longer merges the two into one per-keystroke handler.
- React: top-level helpers that call each other (`ping` calls `pong`, `pong` calls `ping`) no longer throw `Cannot access 'pong' before initialization` on the first render. The call to the helper declared later goes through a ref kept up to date after its declaration; a `$computed` that calls one of them is placed after that update, and the earlier helper's dependencies include what the later one reads, so a `$watch` or `$computed` calling it still re-runs when that state changes.
- React, Angular and Solid: `$data.n++` / `$data.n--` (and a model prop's) as a template event handler or `<listeners>` handler goes through the state setter. React emitted `n++` on the `useState` constant (a TypeError on click), Angular and Solid emitted `n()++`, which does not compile.
