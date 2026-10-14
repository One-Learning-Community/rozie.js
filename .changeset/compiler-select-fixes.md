---
"@rozie/core": minor
---

Compiler fixes found while building `@rozie-ui/select`:

- `model: true` props follow one rule on every target: controlled while the consumer binds a value (anything but `undefined`), uncontrolled otherwise. Vue (a one-way `:x`) and Angular (one-way, and two-way with the old value written back) used to show a write the consumer had refused. Angular lowers the prop to an aliased input + `<name>Change` output read through the new `rozieModel` (`@rozie/runtime-angular`); the field keeps its `ModelSignal` type. Svelte with a one-way binding keeps the component's write (Svelte cannot tell it from `bind:`).
- Angular: `$onUpdate` lowers to `ngAfterViewChecked()` (it was an `effect` returning a function, which never ran). An output named like a native bubbling, non-composed event (`change`, `submit`, `reset`, `select`) stops that native event at the host, so a consumer's `(change)` fires once.
- `$expose` accepts aliased keys (`{ open: openGated }`), inline arrows and methods on all six targets; they were silently dropped. A verb whose name is already a top-level binding is ROZ160.
- React: body statements are ordered so nothing reads a binding before its declaration on the first render (a `useCallback` listing a later one, a `$computed` calling a `$memo`); primitive literal constants are plain `const`s; `$expose` verbs run in `flushSync` (`react-dom`), so calls in one tick act on each other's state.
- Lit: a mixed props + `$data` `$watch` getter re-runs on a prop change; lifecycle bodies print each comment once, and one that returns early no longer skips the hooks after it (also Angular).
- Svelte, Solid: watchers are created before `onMount`, so a `$data` write in `$onMount` fires them. Svelte renames a parameter that shadows a `$data` key (`open$local`).
- An `r-for` alias named like a `<data>` key or a prop is ROZ161 (every target mis-resolved it).
- Solid: `<select :value>` re-applies the value when the options change (`rozieSelectValue`, `@rozie/runtime-solid`); `rozieAttr(boolean)` (Solid, React) is typed `'true' | 'false'`, which aria attributes accept.
- Script partials: a tree-shaken declaration takes its leading comments with it.
- Vue: a template-hoisted `computed` no longer adds a second `import … from 'vue'`.
