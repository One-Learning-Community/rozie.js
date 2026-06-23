# @rozie-ui/toast-vue

Idiomatic **vue** `Toaster` — a headless, accessible toast / notification host (a live-region queue with per-toast auto-dismiss timers, hover-to-pause, six corner positions, and a per-toast close button) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. It is **not** a global singleton + context system: the host owns the queue + timers as internal state and exposes an imperative `show` / `dismiss` / `clear` handle you drive via `ref` — "call from anywhere" is your app's wiring concern (stash the ref). Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/toast-vue
```

Peer dependencies: `vue`. Install them alongside this package.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Toaster from '@rozie-ui/toast-vue';

const toaster = ref();          // template ref → the imperative handle
</script>

<template>
  <button @click="toaster.show({ message: 'Saved!', type: 'success' })">Save</button>
  <button @click="toaster.show({ message: 'Something failed', type: 'error' })">Fail</button>

  <!-- Mount the host once (typically near the app root). -->
  <Toaster ref="toaster" position="bottom-right" :duration="4000" />

  <!-- Custom per-toast chrome via the #toast scoped slot:
  <Toaster ref="toaster">
    <template #toast="{ toast, dismiss }">
      <strong>{{ toast.type }}</strong> {{ toast.message }}
      <button @click="dismiss(toast.id)">OK</button>
    </template>
  </Toaster>
  -->
</template>
```

## Theming

Every visual value is a `--rozie-toast-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/toast-vue/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `position` | `String` | `"bottom-right"` |  |  |
| `duration` | `Number` | `4000` |  |  |
| `max` | `Number` | `0` |  |  |
| `disablePauseOnHover` | `Boolean` | `false` |  |  |
| `ariaLabel` | `String` | `null` |  |  |

## Imperative handle

The component has no events — its primary API is an imperative handle (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call the methods directly. None of the verbs overrides an inherited host-element member, so the Lit custom element emits no ROZ137 warning:

| Method | Description |
| --- | --- |
| `show` | Enqueue a toast. Accepts `{ message, type, duration, id }` (all optional — `message` defaults to `''`, `type` to `'info'`, `duration` to the `duration` prop). Returns the toast `id`. A non-sticky toast (duration > 0) auto-dismisses; `duration: 0` makes it sticky. |
| `dismiss` | Remove a single toast by the `id` returned from `show` (clears its auto-dismiss timer). |
| `clear` | Remove every visible toast at once and clear all pending auto-dismiss timers. |

```vue
<script setup>
import { ref } from 'vue';
const toaster = ref();          // template ref
</script>

<template>
  <Toaster ref="toaster" />
  <button @click="toaster.show({ message: 'Saved', type: 'success' })">Notify</button>
  <button @click="toaster.clear()">Clear all</button>
</template>
```

## Slots

| Slot | Params |
| --- | --- |
| toast | toast, dismiss |
