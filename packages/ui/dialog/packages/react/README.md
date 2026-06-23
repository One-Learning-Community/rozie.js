# @rozie-ui/dialog-react

Idiomatic **react** `Dialog` — a headless, fully-accessible **modal dialog** built on the browser's native `<dialog>` element + `showModal()`, compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The platform IS the engine: top-layer rendering that escapes `z-index` / `overflow` / `transform` ancestors with **no portal/teleport**, a native `::backdrop` scrim, a real focus trap, Esc-to-dismiss, and focus restoration on close — all for free. Rozie owns the author-side API: the two-way `open` binding, the open↔native reconcile, backdrop/escape close policy, optional scroll-lock, and a fully-tokenised skin. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/dialog-react
```

Peer dependencies: `react + react-dom`. Install them alongside this package.

## Usage

```tsx
import { useState } from 'react';
import { Dialog } from '@rozie-ui/dialog-react';

export function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        ariaLabelledby="confirm-title"
        onClose={(e) => console.log('closed:', e.reason)}
      >
        <h2 id="confirm-title">Delete file?</h2>
        <p>This cannot be undone.</p>
        <button onClick={() => setOpen(false)}>Cancel</button>
        <button onClick={() => setOpen(false)}>Delete</button>
      </Dialog>
    </>
  );
}
```

## Theming

Every cosmetic value is a `--rozie-dialog-*` CSS custom property — override any of them at any ancestor scope. The structural behaviour (top-layer, `::backdrop`, focus trap, centering) comes from the native `<dialog>` and is not tokenised. Ready-made design-system bridges ship in the package:

```tsx
import '@rozie-ui/dialog-react/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
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

```tsx
import { useRef } from 'react';
import { Dialog, type DialogHandle } from '@rozie-ui/dialog-react';

const dialog = useRef<DialogHandle>(null);
// <Dialog ref={dialog} ...>…</Dialog>
dialog.current?.show();
dialog.current?.hide();
```

## Slots

| Slot | Params |
| --- | --- |
| (default) |  |
