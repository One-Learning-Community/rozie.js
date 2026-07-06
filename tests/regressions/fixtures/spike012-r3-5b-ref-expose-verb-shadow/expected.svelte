<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let n = $state(0);

let boxRef = $state<HTMLElement | undefined>(undefined);

export function box(): void {
  n += 1;
}

onMount(() => {
  void (boxRef as HTMLElement);
});
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-d26c63bb><div bind:this={boxRef} data-rozie-s-d26c63bb>x</div></div>
