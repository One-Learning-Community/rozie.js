<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  onsave?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let { onsave, ...__rozieAttrs }: Props = $props();

let n = $state(0);

let save = $state<HTMLElement | undefined>(undefined);

function go(): void {
  onsave?.(n);
}

onMount(() => {
  void (save as HTMLElement);
});
</script>

<div {...__rozieAttrs} class={["red", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-ab8a0b4b><div bind:this={save} data-rozie-s-ab8a0b4b>x</div><button onclick={($event) => { go(); }} data-rozie-s-ab8a0b4b>go</button></div>
