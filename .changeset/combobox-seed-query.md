---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-angular": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
---

Add a `seedQuery(text)` imperative handle verb to `Combobox`.

`seedQuery` sets the combobox's internal input text (and therefore the
filtered option list, which reads the same state) without touching the
`value` model or selection state, and without opening the popup or emitting
`change`/`search`. It is deliberately **imperative-only** — combobox's sole
`model: true` prop stays `value` (a second model would forfeit the Angular
`ControlValueAccessor`, ROZ125).

Obtain it through each framework's native ref mechanism, alongside the
existing `focus` and `clear` verbs:

```js
$refs.combobox.seedQuery('cherry pie')
```

A small, additive prerequisite for `@rozie-ui/command-palette`'s planned
levels/restore-on-pop feature (repopulating the input's text when a consumer
navigates back to a prior level) — not itself a `@rozie-ui/command-palette`
or `@rozie-ui/data-table` behavior change. **Fully additive and
render-neutral:** with `seedQuery` never invoked, `Combobox`'s default render
and every compiled leaf's emitted output are unchanged.
