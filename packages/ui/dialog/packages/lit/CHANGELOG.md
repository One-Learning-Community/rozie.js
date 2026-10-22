# @rozie-ui/dialog-lit

## 0.2.4

### Patch Changes

- 115e395: First release of `@rozie-ui/dialog` on React, Vue, Svelte, Angular and Lit. The Solid leaf has been on npm since the 2026-09-26 wave; all six targets of the family now ship at the same version, so one version number means one component revision everywhere.

  The headless, accessible modal dialog is built on the native `<dialog>` element and `showModal()`: top-layer rendering without a portal, a native `::backdrop` scrim, a real focus trap, Escape-to-dismiss, focus restoration, and a ref-counted `<html>` scroll lock that survives nested dialogs. It has a two-way `open` binding, a typed `close` event (`{ reason: 'backdrop' | 'escape' | 'programmatic' }`), an `initialFocus` prop, `show()` / `hide()` handle verbs, and design-system token bridges for shadcn/ui, Material 3 and Bootstrap 5.

  The Vue leaf ships a `web-types.json` and the Lit leaf a `custom-elements.json`, so JetBrains IDEs and `lit-plugin` complete the props, events and slots.

- 115e395: Dialog fixes found by the pre-release audit (all six targets):
  - A press that started inside the panel (selecting text, a drag) and was released over the scrim closed the dialog with reason `'backdrop'`. It no longer does; only a press that starts on the scrim is a backdrop click.
  - A native close that did not go through the component (a `<form method="dialog">` submit inside the panel, or a stray `dialog.close()`) left `open` set to `true` over a closed dialog, which then could not be reopened. The `open` model now follows, and `close` fires with `reason: 'programmatic'`.
  - `hide()` on a dialog that is not open no longer writes the model or emits a `close` for a dismissal that never happened.
  - Lit: `ariaLabelledby` could not reach a heading in the slotted content (an `aria-labelledby` id does not cross a shadow root), so the dialog had no accessible name. It is now bridged with `ariaLabelledByElements` where the browser supports it (Chrome and Edge 135+, Safari 16.4+); elsewhere use `ariaLabel`.
  - The handle's `show()` and `hide()` are typed `() => void` on every target (React, Solid and Lit typed them `(...args: any[]) => any`). A call with an argument is now a type error.
  - `ariaLabel` and `ariaLabelledby` are dropped from the `<dialog>` when they are `null`, so a strict consumer compiling the Vue or React source typechecks.

- 115e395: A `Dialog` removed while open now releases its scroll lock and returns focus; a dialog that mounts closed no longer releases another open dialog's lock; new `initialFocus` prop (a selector or Element focused when the dialog opens).
- 115e395: Regenerated with kebab-case attributes for multi-word props: a prop such as `idBase` is now observed as `id-base` (it was the lowercased `idbase`), matching the model props and what a Rozie consumer writes. These packages are new, so the kebab attribute (or the property) is the only form there is.
- 115e395: Lit: a standalone `$onUnmount(() => { … })` now runs when the element is removed. The Lit emitter spliced the callback into `disconnectedCallback` as an uncalled arrow, so the teardown never ran on Lit (the other five targets were unaffected, as was an `$onMount` cleanup return or an `$onUnmount` paired with an `$onMount(fn)`). The body now runs as its own function, so an early `return` in it cannot skip the remaining teardown. `dialog-lit` releases its scroll lock and returns focus when removed while open.
- 115e395: Dialog: the `close` event handler now has a real payload type instead of `(...args: any[]) => void`. It receives `DialogClosePayload` (`{ reason: DialogCloseReason }`, where the reason is `'backdrop' | 'escape' | 'programmatic'`). Both types are exported from the package entry. A handler written against a different payload shape may now be rejected by the type checker.
  - @rozie/runtime-lit@0.10.1

## 0.1.2

### Patch Changes

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
