---
title: Dialog — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Dialog from '@rozie-ui/dialog-vue';

const open = ref(false);
const noBackdrop = ref(false);
const lastReason = ref<string | null>(null);

const dialogBox = ref();

function onClose(e: { reason: string }) {
  lastReason.value = e.reason;
}
</script>

# Dialog — live demo

This is the **real `@rozie-ui/dialog-vue` package** running on this page (VitePress is itself a Vue app). Open the dialog, then dismiss it by clicking the backdrop, pressing Escape, or using a button — and watch the two-way bound `open` value and the `@close` reason readout update. Everything below is driven by the same `Dialog.rozie` source that compiles to all six frameworks, built on the native `<dialog>` element with **no portal, no engine, and no required CSS** — top-layer rendering, the `::backdrop` scrim, the focus trap, and Esc-to-dismiss all ship inside the platform.

<ClientOnly>
<div class="dialog-live">

  <div class="dialog-live__head">
    <button @click="open = true">Open dialog</button>
    <button @click="dialogBox?.show()">show()</button>
    <button @click="dialogBox?.hide()">hide()</button>
    <label class="dialog-live__opt">
      <input type="checkbox" v-model="noBackdrop" /> disableBackdropClose
    </label>
  </div>

  <div class="dialog-live__readouts">
    <code class="dialog-live__readout">open: {{ JSON.stringify(open) }}</code>
    <code class="dialog-live__readout">last @close reason: {{ lastReason === null ? '—' : JSON.stringify(lastReason) }}</code>
  </div>

  <Dialog
    ref="dialogBox"
    v-model:open="open"
    :disableBackdropClose="noBackdrop"
    aria-labelledby="demo-dialog-title"
    @close="onClose"
  >
    <h2 id="demo-dialog-title" class="dialog-live__title">Delete this file?</h2>
    <p class="dialog-live__body">This action cannot be undone. The file will be permanently removed.</p>
    <div class="dialog-live__actions">
      <button @click="open = false">Cancel</button>
      <button class="dialog-live__danger" @click="open = false">Delete</button>
    </div>
  </Dialog>

</div>
</ClientOnly>

`open` is two-way bound with `v-model:open` — the readout updates the instant the dialog shows or dismisses, and a consumer write flows back in. The dialog renders in the **top layer** above this content with no portal; click the dimmed backdrop (unless you tick `disableBackdropClose`), press `Escape`, or use Cancel / Delete to close it, and watch `@close` report `'backdrop'`, `'escape'`, or — via the `show()` / `hide()` handle buttons — `'programmatic'`. See the [full API](/components/dialog) for every prop, event, and handle verb, plus theming and accessibility reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/dialog/src/Dialog.rozie{html}[Dialog.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/dialog-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/dialog/packages/react/src/Dialog.tsx[React]
<<< ../../packages/ui/dialog/packages/vue/src/Dialog.vue[Vue]
<<< ../../packages/ui/dialog/packages/svelte/src/Dialog.svelte[Svelte]
<<< ../../packages/ui/dialog/packages/angular/src/Dialog.ts[Angular]
<<< ../../packages/ui/dialog/packages/solid/src/Dialog.tsx[Solid]
<<< ../../packages/ui/dialog/packages/lit/src/Dialog.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same `close` event, same two-way `open`, same `show` / `hide` handle — all from the one source above, built on the native `<dialog>` with no third-party engine behind it.

## See also

- [Dialog — showcase & API](/components/dialog) — install, quick start, theming, and the full reference.
- [Headless modal dialog comparison](/components/dialog-comparison) — how `@rozie-ui/dialog` stacks up against Radix Dialog, Headless UI Dialog, the native `<dialog>`, vue-final-modal, and Angular CDK Dialog.

<style scoped>
.dialog-live {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.dialog-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
}
.dialog-live__opt {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.dialog-live__head button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.dialog-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.dialog-live__readouts {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.dialog-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
.dialog-live__title {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
  border: none;
  padding: 0;
}
.dialog-live__body {
  margin: 0 0 1.25rem;
  color: var(--vp-c-text-2);
}
.dialog-live__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
.dialog-live__actions button {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.dialog-live__danger {
  background: #dc2626 !important;
  border-color: #dc2626 !important;
  color: #fff !important;
}
</style>
