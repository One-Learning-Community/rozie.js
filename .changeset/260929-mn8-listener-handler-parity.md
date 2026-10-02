---
"@rozie/core": patch
---

`<listeners>` handlers now invoke identically on all six targets. Previously the React, Vue, Svelte, Angular, Solid and Lit emitters each decided on their own how to call a `<listener>` handler, and only Lit got it right.

The contract, now shared by every emitter through one classifier (`classifyListenerHandler`, exported from `@rozie/core`), applies to plain listeners, `.outside(...)` listeners and `.debounce(...)` / `.throttle(...)` listeners alike:

- **Method name, member reference or function expression** (`close`, `(e) => close(e)`): called with the DOM event, so a method-ref handler can read `event.target` or `event.composedPath()`.
- **Any other expression** (`close($event)`, `$data.open = false`): runs as a statement with `$event` in scope. It is never called as a function and never evaluated at setup.

This fixes the following bugs:

- **Method-name handlers lost the event.** Vue, Svelte, Angular and Solid called them with no arguments. The Vue and Svelte `.outside` paths did the same.
- **Inline statements were called as functions.** Vue, Svelte and Angular did `(close($event))($event)`, which throws a `TypeError` or `ReferenceError` when the listener fires.
- **Function expressions did nothing.** React and Solid emitted `(e) => close(e)` as a bare, no-op statement. Vue `.outside` returned the function without calling it.
- **Statements under `.debounce` / `.throttle` failed on all six targets.** They were either evaluated eagerly at setup (a `ReferenceError` on `$event`) or had their result called as a function.

Components whose `<listener>` handlers are method names now receive the event on every target. Handlers that ignore their argument are unaffected, because the call goes through a permissive cast, so a zero-argument method still typechecks.
