# @rozie-ui/dialog-vue

Idiomatic **vue** `Dialog` — a headless, fully-accessible **modal dialog** built on the browser's native `<dialog>` element + `showModal()`, compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The platform IS the engine: top-layer rendering that escapes `z-index` / `overflow` / `transform` ancestors with **no portal/teleport**, a native `::backdrop` scrim, a real focus trap, Esc-to-dismiss, and focus restoration on close — all for free. Rozie owns the author-side API: the two-way `open` binding, the open↔native reconcile, backdrop/escape close policy, optional scroll-lock, and a fully-tokenised skin. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/dialog-vue
```

Peer dependencies: `vue`. Install them alongside this package.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Dialog from '@rozie-ui/dialog-vue';

const open = ref(false);
function onClose(e: { reason: 'backdrop' | 'escape' | 'programmatic' }) {
  console.log('closed:', e.reason);
}
</script>

<template>
  <button @click="open = true">Open dialog</button>

  <Dialog v-model:open="open" aria-labelledby="confirm-title" @close="onClose">
    <h2 id="confirm-title">Delete file?</h2>
    <p>This cannot be undone.</p>
    <button @click="open = false">Cancel</button>
    <button @click="open = false">Delete</button>
  </Dialog>
</template>
```

## Theming

Every cosmetic value is a `--rozie-dialog-*` CSS custom property — override any of them at any ancestor scope. The structural behaviour (top-layer, `::backdrop`, focus trap, centering) comes from the native `<dialog>` and is not tokenised. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/dialog-vue/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
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

```vue
<script setup>
import { ref } from 'vue';
const dialog = ref();          // template ref
</script>

<template>
  <Dialog ref="dialog" v-model:open="open"><!-- … --></Dialog>
  <button @click="dialog.show()">Open</button>
  <button @click="dialog.hide()">Close</button>
</template>
```

## Slots

| Slot | Params |
| --- | --- |
| (default) |  |
