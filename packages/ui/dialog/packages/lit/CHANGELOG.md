# @rozie-ui/dialog-lit

## 0.2.6

### Patch Changes

- 6dcbd3e: A `<form method="dialog">` placed inside the dialog now closes it on Lit. The native `<dialog>` lives in the element's shadow root and the form is slotted light DOM, so the browser found no ancestor dialog and the submit did nothing. Dialog now handles the submit itself (submitter `value` becomes `returnValue`, a `preventDefault()`ed submit is left alone, and a form inside a nested dialog closes only that dialog). On the other five targets the behaviour is unchanged: the same handler runs, and the browser's own close then finds the dialog already closed.
- a46443a: Lit: a component that is removed from the page and added back works again. Its mount code (`$onMount`) runs again after a real teardown, as on the other targets, so listeners, observers and engine instances are set up again instead of staying torn down. Moving an element within the same task (remove and re-append before it has torn down) keeps the running instance, as before. Mount code and top-level script statements that run again see the element's retained property values.

  Lit: a prop typed with a `<types>` alias made only of string literals (or only of number literals) is now a plain reflected attribute, so `<my-el mode="compact">` works in HTML. It used to be an `Object` property whose attribute value was parsed as JSON, which failed and left the prop `null`.

  Lit: a plain-HTML or Lit consumer (not compiled by Rozie) can fill ANY slot that passes params through the element's `rozieSlots` property, keyed by the slot name (`default` for the default slot): ``el.rozieSlots = { default: ({ item }) => html`<span>${item.label}</span>` }``. The record was only read for dynamically named slots and names that are not identifiers, so an entry for an ordinary scoped slot was silently ignored. It is now tried first for every scoped slot (portal slots excepted), and a component's `$slots.<name>` check counts a record fill as filled, so content gated by `r-if="$slots.<name>"` (for example command-palette's `icon` / `actions` / `trailing` row slots) renders for a record-only fill. A Rozie consumer's fill and the native `<slot>` fallback work as before.

  Changed — Lit: a component's events no longer bubble or cross shadow roots, as on the other targets. `$emit('name', payload)` now dispatches `new CustomEvent('name', { detail: payload, bubbles: false, composed: false })` on the element. A listener on the element itself (`@name=${…}` in a Lit template, `el.addEventListener('name', …)`, a Rozie consumer's `@name`) works as before. A listener on an ancestor element, or outside the shadow root the element sits in, no longer hears it: listen on the element itself. This also means an outer `@rozie-ui/sortable-list` no longer hears the `start` / `add` / `remove` / `reorder` / `end` events of a list nested inside its rows, so the `e.composedPath()[0]` check is no longer needed. Model `*-change` events already behaved this way.

  Lit: a wrapper that forwards `r-on="$listeners"` to a child Rozie component re-dispatches the child's events on its host for the event types its consumer listens for (`@name=${…}`, `addEventListener`), and keeps doing so after the wrapper is moved in the DOM. More generally, an `r-on` listener object re-attaches as soon as its element reconnects, instead of at the element's next render. Listeners added before the component was defined are not seen (the DOM cannot list them); see Cross-Framework Parity.

  Lit: a component whose first render ran after it had already been removed from the page no longer runs its mount code (`$onMount`, document listeners) while detached, where nothing would tear it down; it mounts when it is added back.

  The `@rozie-ui/*-lit` packages listed here are rebuilt with one or more of these fixes; none of them has a string-union prop.

- Updated dependencies [a46443a]
  - @rozie/runtime-lit@0.10.3

## 0.2.5

### Patch Changes

- e9e5f05: README fixes: the Angular example now uses the component's real `<rozie-dialog>` selector (the `<Dialog>` tag it showed fails to compile), and the Svelte theming import is shown as a TypeScript snippet.

## 0.2.4

### Patch Changes

- 05cb9db: First release of `@rozie-ui/dialog` on React, Vue, Svelte, Angular and Lit. The Solid leaf has been on npm since the 2026-09-26 wave; all six targets of the family now ship at the same version, so one version number means one component revision everywhere.

  The headless, accessible modal dialog is built on the native `<dialog>` element and `showModal()`: top-layer rendering without a portal, a native `::backdrop` scrim, a real focus trap, Escape-to-dismiss, focus restoration, and a ref-counted `<html>` scroll lock that survives nested dialogs. It has a two-way `open` binding, a typed `close` event (`{ reason: 'backdrop' | 'escape' | 'programmatic' }`), an `initialFocus` prop, `show()` / `hide()` handle verbs, and design-system token bridges for shadcn/ui, Material 3 and Bootstrap 5.

  The Vue leaf ships a `web-types.json` and the Lit leaf a `custom-elements.json`, so JetBrains IDEs and `lit-plugin` complete the props, events and slots.

- 05cb9db: Dialog fixes found by the pre-release audit (all six targets):
  - A press that started inside the panel (selecting text, a drag) and was released over the scrim closed the dialog with reason `'backdrop'`. It no longer does; only a press that starts on the scrim is a backdrop click.
  - A native close that did not go through the component (a `<form method="dialog">` submit inside the panel, or a stray `dialog.close()`) left `open` set to `true` over a closed dialog, which then could not be reopened. The `open` model now follows, and `close` fires with `reason: 'programmatic'`.
  - `hide()` on a dialog that is not open no longer writes the model or emits a `close` for a dismissal that never happened.
  - Lit: `ariaLabelledby` could not reach a heading in the slotted content (an `aria-labelledby` id does not cross a shadow root), so the dialog had no accessible name. It is now bridged with `ariaLabelledByElements` where the browser supports it (Chrome and Edge 135+, Safari 16.4+); elsewhere use `ariaLabel`.
  - The handle's `show()` and `hide()` are typed `() => void` on every target (React, Solid and Lit typed them `(...args: any[]) => any`). A call with an argument is now a type error.
  - `ariaLabel` and `ariaLabelledby` are dropped from the `<dialog>` when they are `null`, so a strict consumer compiling the Vue or React source typechecks.

- 05cb9db: A `Dialog` removed while open now releases its scroll lock and returns focus; a dialog that mounts closed no longer releases another open dialog's lock; new `initialFocus` prop (a selector or Element focused when the dialog opens).
- 05cb9db: Regenerated with kebab-case attributes for multi-word props: a prop such as `idBase` is now observed as `id-base` (it was the lowercased `idbase`), matching the model props and what a Rozie consumer writes. These packages are new, so the kebab attribute (or the property) is the only form there is.
- 05cb9db: Lit: a standalone `$onUnmount(() => { … })` now runs when the element is removed. The Lit emitter spliced the callback into `disconnectedCallback` as an uncalled arrow, so the teardown never ran on Lit (the other five targets were unaffected, as was an `$onMount` cleanup return or an `$onUnmount` paired with an `$onMount(fn)`). The body now runs as its own function, so an early `return` in it cannot skip the remaining teardown. `dialog-lit` releases its scroll lock and returns focus when removed while open.
- 05cb9db: Dialog: the `close` event handler now has a real payload type instead of `(...args: any[]) => void`. It receives `DialogClosePayload` (`{ reason: DialogCloseReason }`, where the reason is `'backdrop' | 'escape' | 'programmatic'`). Both types are exported from the package entry. A handler written against a different payload shape may now be rejected by the type checker.
  - @rozie/runtime-lit@0.10.1

## 0.1.2

### Patch Changes

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
