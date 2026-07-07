<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let n = $state(0);

let box = $state<HTMLElement | undefined>(undefined);

const boxRef = 7;

onMount(() => {
  n = (box as HTMLElement).childElementCount + boxRef;
});
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-3039287c><div bind:this={box} data-rozie-s-3039287c>x</div></div>
