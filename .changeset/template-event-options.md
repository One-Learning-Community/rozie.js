---
"@rozie/core": patch
"@rozie/runtime-react": patch
"@rozie/runtime-svelte": patch
"@rozie/runtime-angular": patch
"@rozie/runtime-solid": patch
---

`.capture`, `.passive` and `.once` now work on template `@event` bindings on every target, not only in `<listeners>`. Before, Svelte and Angular rejected them, Solid warned and bound the handler without the option, and React did the same for `.passive` and `.once` (so a `.once` handler fired every time). Vue and Lit already supported them.

Where a target's template syntax can't carry the option, the listener is attached with `addEventListener` through a small runtime helper, with the same handler, guards and `$event` as before:

- React: `.capture` alone still compiles to `on<Event>Capture`; `.passive`/`.once` go through `rozieNativeListeners` on the element's ref.
- Svelte: a `use:rozieListeners` action (new in `@rozie/runtime-svelte`).
- Angular: a `RozieListen` directive (new in `@rozie/runtime-angular`), added to the component's `imports` only when used.
- Solid: `rozieNativeListeners` (new in `@rozie/runtime-solid`) called from the element's ref, so it works on solid-js 1.8.

`.once` on a child component's event (`<Child @ping.once="...">`) now works on every target too, where React, Svelte, Angular and Solid used to reject it. Each rendered child gets its own once, including each child in an `r-for`: React uses a `useRozieOnce` hook keyed by the loop keys, Svelte a `rozieOnce` wrapper and Solid a `rozieOnceCall` function, each made once per child, and Angular a `RozieOnce` directive on the tag. `.capture` and `.passive` stay a compile error on a component event, since a component event is a callback, not a DOM listener. (React used to emit an `on<Event>Capture` prop that was never called.)

Angular: the class members that template event bindings call (the wrappers for key and other guards, `.debounce`, `.throttle`, and several listeners merged onto one event) are now `protected` instead of `private`. Strict template type-checking, which the Angular CLI enables by default, rejected the `private` ones with TS2341, so an app compiling `.rozie` source with strict templates failed to build.
