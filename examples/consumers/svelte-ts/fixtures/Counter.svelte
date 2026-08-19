<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  value?: number;
  step?: number;
  min?: number;
  max?: number;
  [key: string]: unknown;
}

let {
  value = $bindable(0),
  step = 1,
  min = -Infinity,
  max = Infinity,
  ...__rozieAttrs
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

<div {...__rozieAttrs} class={["counter", { hovering: hovering }, (__rozieAttrs)?.class]} onmouseenter={($event) => { hovering = true; }} onmouseleave={($event) => { hovering = false; }} use:applyListeners={__rozieAttrs} data-rozie-s-c72e01d0><button disabled={!canDecrement} aria-label="Decrement" onclick={decrement} data-rozie-s-c72e01d0>−</button><span class="value" data-rozie-s-c72e01d0>{value}</span><button disabled={!canIncrement} aria-label="Increment" onclick={increment} data-rozie-s-c72e01d0>+</button></div>

<style>
:global {
  .counter[data-rozie-s-c72e01d0] { display: inline-flex; gap: 0.5rem; align-items: center; }
  .counter.hovering[data-rozie-s-c72e01d0] { background: rgba(0, 0, 0, 0.04); }
  .value[data-rozie-s-c72e01d0] { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
  button[data-rozie-s-c72e01d0] { padding: 0.25rem 0.5rem; }
  button[data-rozie-s-c72e01d0]:disabled { opacity: 0.4; cursor: not-allowed; }
}
</style>
