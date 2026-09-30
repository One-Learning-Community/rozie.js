<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'label' | 'children'> {
  label?: string;
}

let { label = '', ...__rozieAttrs }: Props = $props();

let ticks = $state(0);

onMount(() => {
  const timer = setInterval(() => {
    ticks += 1;
  }, 1000);
  return () => clearInterval(timer);
});
</script>

<div {...__rozieAttrs} class={["ticks", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-c1a25008>{ticks}</div>

<style>
:global {
  .ticks[data-rozie-s-c1a25008] { font-variant-numeric: tabular-nums; }
}
</style>
