# Quick Start

The shortest path from a `.rozie` file to working framework output.

## 1. Write a component

Create `Counter.rozie`:

```rozie
<rozie name="Counter">

<props>
{
  value: { type: Number, default: 0, model: true },
  step:  { type: Number, default: 1 },
}
</props>

<data>
{ 
  hovering: false 
}
</data>

<script>
const canIncrement = $computed(() => $props.value + $props.step <= Infinity)
const increment = () => { if (canIncrement) $props.value += $props.step }
</script>

<template>
<button
  :class="{ hovering: $data.hovering }"
  @mouseenter="$data.hovering = true"
  @click="increment"
>
  {{ $props.value }}
</button>
</template>

<style>
.hovering { background: rgba(0, 0, 0, 0.04); }
</style>

</rozie>
```

Key things to notice:

- `<props>` and `<data>` accept real JS expressions, not JSON. `default: () => []`, `Number`, `Infinity` — all fine.
- `model: true` on a prop signals two-way binding. Rozie expands this to each framework's native pattern: `defineModel` (Vue), controllable-state pair (React), `$bindable` (Svelte), `model<T>()` (Angular), `createControllableSignal` (Solid).
- `r-*` directives mirror Vue's `v-*` but are deliberately namespaced so `.rozie` files are visually distinct.

## 2. Compile in a Vite project

Install the unplugin and import the file:

```ts
// vite.config.ts
import Rozie from '@rozie/unplugin/vite';
import vue from '@vitejs/plugin-vue';

export default { plugins: [Rozie({ target: 'vue' }), vue()] };
```

```vue
<!-- App.vue -->
<script setup>
import Counter from './Counter.rozie';
import { ref } from 'vue';
const n = ref(0);
</script>
<template><Counter v-model:value="n" /></template>
```

Swap `target: 'vue'` for `react`, `svelte`, `angular`, or `solid` and the same `.rozie` file produces an idiomatic component in that framework.

## 3. Inspect the output

The fastest way to see what Rozie emits is the CLI:

```bash
pnpm rozie build Counter.rozie --target vue
pnpm rozie build Counter.rozie --target react
pnpm rozie build Counter.rozie --target svelte
pnpm rozie build Counter.rozie --target angular
pnpm rozie build Counter.rozie --target solid
```

See the [Counter example](/examples/counter) for the full per-target output side by side.

## Next steps

- [Examples](/examples/counter) — full source + five-target output for representative components
- [Why Rozie?](/guide/why) — the problem Rozie solves and who it's for
- [Install](/guide/install) — supported framework versions and bundler setup
