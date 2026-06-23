# @rozie-ui/dialog-lit

Idiomatic **lit** `Dialog` — a headless, fully-accessible **modal dialog** built on the browser's native `<dialog>` element + `showModal()`, compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The platform IS the engine: top-layer rendering that escapes `z-index` / `overflow` / `transform` ancestors with **no portal/teleport**, a native `::backdrop` scrim, a real focus trap, Esc-to-dismiss, and focus restoration on close — all for free. Rozie owns the author-side API: the two-way `open` binding, the open↔native reconcile, backdrop/escape close policy, optional scroll-lock, and a fully-tokenised skin. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/dialog-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/dialog-lit';

// <rozie-dialog> is a custom element. Put the dialog content in its light DOM,
// bind `open` as a property (true → showModal()), listen for `open-change` to
// receive the two-way value, and `close` for the dismiss reason.
const el = document.querySelector('rozie-dialog');
el.setAttribute('aria-labelledby', 'confirm-title');
el.open = true;
el.addEventListener('open-change', (e) => {
  el.open = e.detail;
});
el.addEventListener('close', (e) => {
  console.log('closed:', e.detail.reason);
});
```

## Theming

Every cosmetic value is a `--rozie-dialog-*` CSS custom property — override any of them at any ancestor scope. The structural behaviour (top-layer, `::backdrop`, focus trap, centering) comes from the native `<dialog>` and is not tokenised. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/dialog-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `open` | `Boolean` | `false` | ✓ |  |
| `disableBackdropClose` | `Boolean` | `false` |  |  |
| `disableEscapeClose` | `Boolean` | `false` |  |  |
| `disableScrollLock` | `Boolean` | `false` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `ariaLabelledby` | `String` | `null` |  |  |

## Events

| Event | Description |
| --- | --- |
| `close` | Fired whenever the dialog dismisses — through a backdrop click, the Escape key, or a programmatic `hide()`. Payload `{ reason }` where `reason` is `'backdrop'`, `'escape'`, or `'programmatic'`. The two-way `open` model is set to `false` on the same tick, so you usually only need this to learn *why* it closed (e.g. to skip a confirmation on an explicit Cancel). |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. The verbs are `show()` / `hide()` (not `open`/`close`) — `open` is the model prop and `close` is the dismiss event, so these names sidestep both collisions and are not inherited `HTMLElement` members:

| Method | Description |
| --- | --- |
| `show` | Open the dialog imperatively (sets the two-way `open` model to `true`). Equivalent to a consumer write of `open = true`; the native `<dialog>.showModal()` runs on the next reconcile. |
| `hide` | Close the dialog imperatively. Sets `open` to `false` and emits `close` with `{ reason: 'programmatic' }`. |

```ts
// The custom element IS the handle — exposed methods are public element
// methods. show() opens via showModal(); hide() closes + emits `close`.
const el = document.querySelector('rozie-dialog');
el.show();
el.hide();
```

## Slots

| Slot | Params |
| --- | --- |
| (default) |  |
