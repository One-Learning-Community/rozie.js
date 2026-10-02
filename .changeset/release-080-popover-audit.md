---
"@rozie-ui/popover-react": minor
"@rozie-ui/popover-vue": minor
"@rozie-ui/popover-svelte": minor
"@rozie-ui/popover-angular": minor
"@rozie-ui/popover-solid": minor
"@rozie-ui/popover-lit": minor
---

**Breaking: the `change` event is removed.** Use the `open` model's own change event, which carries the same boolean and fires at the same moments:

| Target | Before | Now |
| --- | --- | --- |
| Vue | `@change` | `@update:open` (or `v-model:open`) |
| React / Solid | `onChange` | `onOpenChange` |
| Svelte | `onchange` | `bind:open` |
| Angular | `(change)` | `(openChange)` (or `[(open)]`) |
| Lit | `change` | `open-change` |

On Angular and Lit, `change` collided with the native `change` event that bubbles out of any input inside the panel. Angular `(change)` handlers also received those DOM events, and Lit `change` listeners got plain `Event`s where the type promised `CustomEvent<boolean>`.

Fixes and additions from the pre-release audit:

- **Panel id:** the panel id is no longer the fixed `rozie-popover-floating`, which every popover on a page shared. It is `idBase + '-panel'`, with a new `idBase` prop (default `'rozie-popover'`; give each instance its own). The `anchor` slot now also passes `panelId`, so your trigger can set `aria-controls` / `aria-describedby`.
- **ARIA:** a click popover's anchor wrapper also sets `aria-controls` while open. Hover/focus tooltips no longer claim `aria-haspopup="dialog"` / `aria-expanded`; they keep `aria-describedby`.
- **Detached reference:** if a referenced Element is removed from the document while open, the popover closes. It used to be positioned against a zero rect at the top-left corner.
- **Placement changes stick (React):** a change to `placement`, `offset`, `disableFlip`, `disableShift` or `strategy` while open was reverted by the next scroll or resize update on React. Tracking now restarts with the new values on every target.
- **`matchWidth` and `arrow` reconcile:** toggling them while open now applies. Turning `matchWidth` off clears the width it set, and a zero-width reference (a point virtual element) no longer sets `width: 0px`.
- **Focus return:** focus now returns to where it was when the popover opened for `manual` popovers too (e.g. with `reference`), and for opens through the handle or a controlled `open`. It is restored only when focus would otherwise be lost (inside the closing panel, or on `<body>`), so clicking into another input no longer pulls focus back to the trigger.
- **Outside clicks are decided after your handlers:** the click-outside close is decided after the click's own handlers have run, against the `reference` as it is then. A handler that repoints `reference` at the element it was clicked on (keeping `open` true) now moves the panel there on every target. On Angular this used to close the panel while the parent still held `open = true`: the close and the parent's re-open landed in the same tick, and Angular does not re-push an unchanged binding.
