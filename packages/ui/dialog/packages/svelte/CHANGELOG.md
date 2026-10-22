# @rozie-ui/dialog-svelte

## 0.2.4

### Patch Changes

- 115e395: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.

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
- 115e395: Dialog: the `close` event handler now has a real payload type instead of `(...args: any[]) => void`. It receives `DialogClosePayload` (`{ reason: DialogCloseReason }`, where the reason is `'backdrop' | 'escape' | 'programmatic'`). Both types are exported from the package entry. A handler written against a different payload shape may now be rejected by the type checker.
- 115e395: Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).
  - React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
  - Solid: the same with `ComponentProps<'<tag>'>`.
  - Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>`; an attribute the root element does not support is a type error.
  - The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
  - An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
  - Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

  The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.
  - @rozie/runtime-svelte@0.10.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0
