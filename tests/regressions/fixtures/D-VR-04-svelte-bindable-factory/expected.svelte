<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  items?: any[];
  [key: string]: unknown;
}

let { items = $bindable((() => [])()), ...__rozieAttrs }: Props = $props();

const remaining = $derived(items.filter((i: any) => !i.done).length);
</script>


<div {...__rozieAttrs} class={["count", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>{remaining}</div>


<style>
.count { font-variant-numeric: tabular-nums; }
</style>
