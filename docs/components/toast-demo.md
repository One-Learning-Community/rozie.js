---
title: Toaster — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Toaster from '@rozie-ui/toast-vue';

const toaster = ref();
let n = 0;

function info() {
  toaster.value?.show({ message: `Heads up (#${++n})`, type: 'info' });
}
function success() {
  toaster.value?.show({ message: `Saved successfully (#${++n})`, type: 'success' });
}
function error() {
  toaster.value?.show({ message: `Something went wrong (#${++n})`, type: 'error' });
}
function sticky() {
  toaster.value?.show({ message: 'Sticky — dismiss me', type: 'warning', duration: 0 });
}
function clearAll() {
  toaster.value?.clear();
}
</script>

# Toaster — live demo

This is the **real `@rozie-ui/toast-vue` package** running on this page (VitePress is itself a Vue app). Click a button to enqueue a toast — it appears in the corner, auto-dismisses after its duration (hover the stack to pause), and you can close it with its × button or clear them all. Everything below is driven by the same `Toaster.rozie` source that compiles to all six frameworks, built on native DOM with **no engine and no required CSS** — the queue/timer behaviour and a tokenised skin all ship inside the component.

The host is mounted **once** and driven entirely through Vue's `ref` — there is no global `toast()` singleton; "call from anywhere" is your app's wiring concern.

<ClientOnly>
<div class="toast-live">

  <div class="toast-live__head">
    <button class="toast-live__btn" @click="info()">show info</button>
    <button class="toast-live__btn toast-live__btn--ok" @click="success()">show success</button>
    <button class="toast-live__btn toast-live__btn--err" @click="error()">show error</button>
    <button class="toast-live__btn" @click="sticky()">sticky</button>
    <span class="toast-live__sep" />
    <button class="toast-live__btn" @click="clearAll()">clear()</button>
  </div>
  <p class="toast-live__hint">Toasts render in the <code>bottom-right</code> corner of the viewport. Errors and warnings announce <code>assertive</code>; everything else <code>polite</code>.</p>

  <Toaster ref="toaster" position="bottom-right" :duration="4000" />

</div>
</ClientOnly>

`show({ message, type, duration })` enqueues a toast and returns its `id`; `dismiss(id)` removes one and `clear()` removes them all. Pass `duration: 0` for a sticky toast. Set `position` to any of the six corners (`top-left`, `top-right`, `top-center`, `bottom-left`, `bottom-right`, `bottom-center`), cap the stack with `max`, and opt out of hover-pause with `disablePauseOnHover`. See the [full API](/components/toast) for every prop, the handle, the `#toast` scoped slot, theming, and accessibility.

## Custom chrome with the `#toast` slot

By default each toast renders its message plus a close button. The `#toast` scoped slot ({ `toast`, `dismiss` }) hands you the toast record and the dismiss function so you can render whatever chrome you like:

```vue
<script setup>
import { ref } from 'vue';
import Toaster from '@rozie-ui/toast-vue';
const toaster = ref();
</script>

<template>
  <button @click="toaster.show({ message: 'Undo?', type: 'info' })">Delete</button>

  <Toaster ref="toaster" position="top-center">
    <template #toast="{ toast, dismiss }">
      <strong style="text-transform: capitalize">{{ toast.type }}</strong>
      <span>{{ toast.message }}</span>
      <button @click="dismiss(toast.id)">Undo</button>
    </template>
  </Toaster>
</template>
```

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/toast/src/Toaster.rozie{html}[Toaster.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/toast-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/toast/packages/react/src/Toaster.tsx[React]
<<< ../../packages/ui/toast/packages/vue/src/Toaster.vue[Vue]
<<< ../../packages/ui/toast/packages/svelte/src/Toaster.svelte[Svelte]
<<< ../../packages/ui/toast/packages/angular/src/Toaster.ts[Angular]
<<< ../../packages/ui/toast/packages/solid/src/Toaster.tsx[Solid]
<<< ../../packages/ui/toast/packages/lit/src/Toaster.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same `show` / `dismiss` / `clear` handle, same `#toast` scoped slot — all from the one source above, with no third-party engine behind it.

## See also

- [Toaster — showcase & API](/components/toast) — install, quick start, theming, and the full reference.
- [Headless toast / notification comparison](/components/toast-comparison) — how `@rozie-ui/toast` stacks up against sonner, react-hot-toast, vue-toastification, ngx-toastr, and the Angular CDK.

<style scoped>
.toast-live {
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.toast-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.toast-live__btn {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.toast-live__btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.toast-live__btn--ok:hover { border-color: #16a34a; color: #16a34a; }
.toast-live__btn--err:hover { border-color: #dc2626; color: #dc2626; }
.toast-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.toast-live__hint {
  margin: 0.8rem 0 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
</style>
