# Counter

A minimal two-way-bound counter. Demonstrates `<props>` with `model: true`, `<data>` for local reactive state, `$computed`, and `@event` handlers in `<template>`.

## Source — Counter.rozie

```vue
<rozie name="Counter">

<props>
{
  value: { type: Number, default: 0,  model: true },
  step:  { type: Number, default: 1 },
  min:   { type: Number, default: -Infinity },
  max:   { type: Number, default: Infinity },
}
</props>

<data>
{
  hovering: false,
}
</data>

<script>
console.log("hello from rozie")

const canIncrement = $computed(() => $props.value + $props.step <= $props.max)
const canDecrement = $computed(() => $props.value - $props.step >= $props.min)

const increment = () => { if (canIncrement) $props.value += $props.step }
const decrement = () => { if (canDecrement) $props.value -= $props.step }
</script>

<template>
<div
  class="counter"
  :class="{ hovering: $data.hovering }"
  @mouseenter="$data.hovering = true"
  @mouseleave="$data.hovering = false"
>
  <button :disabled="!canDecrement" @click="decrement" aria-label="Decrement">−</button>
  <span class="value">{{ $props.value }}</span>
  <button :disabled="!canIncrement" @click="increment" aria-label="Increment">+</button>
</div>
</template>

<style>
.counter { display: inline-flex; gap: 0.5rem; align-items: center; }
.counter.hovering { background: rgba(0, 0, 0, 0.04); }
.value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button { padding: 0.25rem 0.5rem; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

</rozie>
```

## Vue output

```vue
<template>

<div :class="['counter', { hovering: hovering }]" @mouseenter="hovering = true" @mouseleave="hovering = false">
  <button :disabled="!canDecrement" aria-label="Decrement" @click="decrement">−</button>
  <span class="value">{{ value }}</span>
  <button :disabled="!canIncrement" aria-label="Increment" @click="increment">+</button>
</div>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{ step?: number; min?: number; max?: number }>(),
  { step: 1, min: -Infinity, max: Infinity }
);

const value = defineModel<number>('value', { default: 0 });

const hovering = ref(false);

const canIncrement = computed(() => value.value + props.step <= props.max);
const canDecrement = computed(() => value.value - props.step >= props.min);

console.log("hello from rozie");
const increment = () => {
  if (canIncrement.value) value.value += props.step;
};
const decrement = () => {
  if (canDecrement.value) value.value -= props.step;
};
</script>

<style scoped>
.counter { display: inline-flex; gap: 0.5rem; align-items: center; }
.counter.hovering { background: rgba(0, 0, 0, 0.04); }
.value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button { padding: 0.25rem 0.5rem; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

## React output

```tsx
import { useCallback, useMemo, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import styles from './Counter.module.css';

interface CounterProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export default function Counter(_props: CounterProps): JSX.Element {
  const props: CounterProps = {
    ..._props,
    step: _props.step ?? 1,
    min: _props.min ?? -Infinity,
    max: _props.max ?? Infinity,
  };
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? 0,
    onValueChange: props.onValueChange,
  });
  const [hovering, setHovering] = useState(false);
  const canIncrement = useMemo(() => value + props.step <= props.max, [props.max, props.step, value]);
  const canDecrement = useMemo(() => value - props.step >= props.min, [props.min, props.step, value]);

  console.log("hello from rozie");
  const increment = useCallback(() => {
    if (canIncrement) setValue(prev => prev + props.step);
  }, [canIncrement, props.step, setValue]);
  const decrement = useCallback(() => {
    if (canDecrement) setValue(prev => prev - props.step);
  }, [canDecrement, props.step, setValue]);

  return (
    <>
    <div className={clsx(styles.counter, { [styles.hovering]: hovering })} onMouseEnter={(e) => { setHovering(true); }} onMouseLeave={(e) => { setHovering(false); }}>
      <button disabled={!canDecrement} aria-label="Decrement" onClick={decrement}>−</button>
      <span className={styles.value}>{value}</span>
      <button disabled={!canIncrement} aria-label="Increment" onClick={increment}>+</button>
    </div>
    </>
  );
}
```

## Svelte output

```svelte
<script lang="ts">
interface Props {
  value?: number;
  step?: number;
  min?: number;
  max?: number;
}

let {
  value = $bindable(0),
  step = 1,
  min = -Infinity,
  max = Infinity,
}: Props = $props();

let hovering = $state(false);

console.log("hello from rozie");
const increment = () => {
  if (canIncrement) value += step;
};
const decrement = () => {
  if (canDecrement) value -= step;
};

const canIncrement = $derived(value + step <= max);
const canDecrement = $derived(value - step >= min);
</script>


<div class={["counter", { hovering: hovering }]} onmouseenter={(e) => { hovering = true; }} onmouseleave={(e) => { hovering = false; }}>
  <button disabled={!canDecrement} aria-label="Decrement" onclick={decrement}>−</button>
  <span class="value">{value}</span>
  <button disabled={!canIncrement} aria-label="Increment" onclick={increment}>+</button>
</div>


<style>
.counter { display: inline-flex; gap: 0.5rem; align-items: center; }
.counter.hovering { background: rgba(0, 0, 0, 0.04); }
.value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button { padding: 0.25rem 0.5rem; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

## Angular output

```ts
import { Component, ViewEncapsulation, computed, input, model, signal } from '@angular/core';

@Component({
  selector: 'rozie-counter',
  standalone: true,
  template: `

    <div class="counter" [ngClass]="{ hovering: hovering() }" (mouseenter)="hovering.set(true)" (mouseleave)="hovering.set(false)">
      <button [disabled]="!canDecrement()" aria-label="Decrement" (click)="decrement($event)">−</button>
      <span class="value">{{ value() }}</span>
      <button [disabled]="!canIncrement()" aria-label="Increment" (click)="increment($event)">+</button>
    </div>

  `,
  styles: [`
    .counter { display: inline-flex; gap: 0.5rem; align-items: center; }
    .counter.hovering { background: rgba(0, 0, 0, 0.04); }
    .value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
    button { padding: 0.25rem 0.5rem; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `],
})
export class Counter {
  value = model<number>(0);
  step = input<number>(1);
  min = input<number>(-Infinity);
  max = input<number>(Infinity);
  hovering = signal(false);

  constructor() {
    console.log("hello from rozie");
  }

  canIncrement = computed(() => this.value() + this.step() <= this.max());
  canDecrement = computed(() => this.value() - this.step() >= this.min());

  increment = () => {
    if (this.canIncrement()) this.value.set(this.value() + this.step());
  };
  decrement = () => {
    if (this.canDecrement()) this.value.set(this.value() - this.step());
  };
}

export default Counter;
```
