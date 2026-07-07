<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let items = $state([1, 2, 3]);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-1453ae2b><ul data-rozie-s-1453ae2b>{#each items as number[] as it (it)}<li data-rozie-s-1453ae2b>{rozieDisplay(it)}</li>{/each}</ul></div>
