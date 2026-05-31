<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  value?: number;
  [key: string]: unknown;
}

let { value = $bindable(0), ...__rozieAttrs }: Props = $props();

let count = $state(0);

const incCount = () => {
  count++;
};
const decCount = () => {
  count--;
};
const incValue = () => {
  value++;
};
const decValue = () => {
  value--;
};
</script>


<div {...__rozieAttrs} class={["probe", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-0fceff7a>
  <button aria-label="Decrement count" onclick={decCount} data-rozie-s-0fceff7a>−</button>
  <span class="count" data-rozie-s-0fceff7a>{count}</span>
  <button aria-label="Increment count" onclick={incCount} data-rozie-s-0fceff7a>+</button>
  <button aria-label="Decrement value" onclick={decValue} data-rozie-s-0fceff7a>−</button>
  <span class="value" data-rozie-s-0fceff7a>{value}</span>
  <button aria-label="Increment value" onclick={incValue} data-rozie-s-0fceff7a>+</button>
</div>


<style>
:global {
  .probe[data-rozie-s-0fceff7a] { display: inline-flex; gap: 0.5rem; align-items: center; }
  .count[data-rozie-s-0fceff7a], .value[data-rozie-s-0fceff7a] { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
  button[data-rozie-s-0fceff7a] { padding: 0.25rem 0.5rem; }
}
</style>
