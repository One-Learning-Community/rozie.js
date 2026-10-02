---
"@rozie-ui/popover-react": minor
"@rozie-ui/popover-vue": minor
"@rozie-ui/popover-svelte": minor
"@rozie-ui/popover-angular": minor
"@rozie-ui/popover-solid": minor
"@rozie-ui/popover-lit": minor
---

Add a `reference` prop for positioning the popover against an external or virtual element.

Before this, `Popover` could only measure its own anchor wrapper, which holds whatever you project into the `anchor` slot. It could not open next to an element that another component renders, such as a calendar event element. The workaround was a `position: fixed` wrapper sized to that element's rect. Now you can pass the element directly:

- **`reference`** (`Element | Object`, default `null`) takes either a DOM Element or a Floating UI [virtual element](https://floating-ui.com/docs/virtual-elements), which is any object with `getBoundingClientRect()` plus an optional `contextElement`. Use a virtual element to open at a pointer position.
- **Positioning:** the panel is positioned and tracked against the reference with Floating UI's `autoUpdate`. Changing `reference` while the popover is open repositions it against the new reference.
- **Dismissal:** a click on (or inside) a referenced Element does not count as an outside click, so a toggle on that element closes the panel instead of dismissing it and reopening it. A virtual element adds no inside region. Escape dismissal is unchanged.
- **ARIA:** with `reference`, you own the trigger ARIA (`aria-haspopup` / `aria-expanded` / `aria-controls`) on your own element. Pair it with `trigger="manual"` and a two-way-bound `open`.
- **Stable value:** pass the same element or object across renders. A new object on every render restarts tracking.

The click-outside listener now receives the DOM event on every framework.

`reference` is additive: it defaults to `null`, which keeps the built-in anchor and behaves exactly as before. (This popover release does carry one breaking change, the removal of the `change` event; see its own entry.)
