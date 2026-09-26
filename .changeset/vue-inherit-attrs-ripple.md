---
"@rozie-ui/chartjs-vue": patch
"@rozie-ui/codemirror-vue": patch
"@rozie-ui/fullcalendar-vue": patch
"@rozie-ui/rete-vue": patch
---

**BEHAVIOUR CHANGE.** These components now emit `defineOptions({ inheritAttrs: false })` for
their `inherit-attrs`/`inherit-listeners` opt-out, closing a Vue-target emitter bug fixed in
`@rozie/core` in this same release (see that changeset for the full description): the opt-out
was previously silently inert on Vue specifically, so undeclared attributes and listeners kept
falling through onto the component's wrapper element regardless of the opt-out being declared.

If your usage of one of these components relied on that fallthrough happening on Vue despite the
opt-out (for example, `<DataTable class="x">` — a `@rozie-ui/data-table` example, not one of
these four — putting `x` on `.rozie-data-table-wrap`), you will see a difference: the wrapper
element no longer receives it, matching the behaviour every other target has always had.
`@rozie-ui/chartjs-{react,solid,lit,svelte,angular}`, `@rozie-ui/codemirror-*` (non-Vue),
`@rozie-ui/fullcalendar-*` (non-Vue), and `@rozie-ui/rete-*` (non-Vue) are unaffected — they
never had the fallthrough bug.

No other change; only the components regenerated for this fix ship in this release.
