<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let state = $state({
  count: 0,
  created: new Date(0)
});
let cloned: any = $state(null);

onMount(() => {
  cloned = $state.snapshot(state);
});
</script>

<div {...__rozieAttrs} class={["probe", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-67c332fe><span class="count" data-rozie-s-67c332fe>count: {rozieDisplay(state.count)}</span>{#if cloned}<span class="cloned" data-rozie-s-67c332fe>cloned</span>{/if}</div>

<style>
:global {
  .probe[data-rozie-s-67c332fe] {
    display: block;
    padding: 0.5rem;
  }
}
</style>
