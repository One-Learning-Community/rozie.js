<script setup>
import { ref } from 'vue';
import Counter from '../../examples/Counter.rozie';

const n = ref(2);
</script>

# Counter

A minimal two-way-bound counter. Demonstrates `<props>` with `model: true`, `<data>` for local reactive state, `$computed`, and `@event` handlers in `<template>`.

## Live demo

The Counter below is the *actual* `examples/Counter.rozie` file from the monorepo, compiled by `@rozie/unplugin/vite` at build time into a Vue SFC and rendered inline. Click the buttons; the value is two-way-bound to local state on this page.

<div class="rozie-demo">
  <ClientOnly>
    <Counter v-model:value="n" :min="0" :max="10" :step="1" />
  </ClientOnly>

  <p>Current value: {{ n }}</p>
</div>

## Source — Counter.rozie

```rozie-src Counter
```

## Vue output

```rozie-out Counter vue
```

## React output

```rozie-out Counter react
```

## Svelte output

```rozie-out Counter svelte
```

## Angular output

```rozie-out Counter angular
```

## Solid output

```rozie-out Counter solid
```

## Lit output

```rozie-out Counter lit
```
