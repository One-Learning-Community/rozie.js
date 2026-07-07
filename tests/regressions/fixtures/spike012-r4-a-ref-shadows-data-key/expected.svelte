<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let box = $state(0);
let n = $state(0);

let boxRef = $state<HTMLElement | undefined>(undefined);

onMount(() => {
  n = (boxRef as HTMLElement).childElementCount + box;
});
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-89956078><div bind:this={boxRef} data-rozie-s-89956078>x</div></div>
