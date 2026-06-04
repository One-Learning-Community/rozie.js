<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  items?: any[];
  item?: Snippet<[{ item: any; remaining: any }]>;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  items = $bindable((() => [])()),
  item: __itemProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const item = $derived(__itemProp ?? snippets?.item);

const remaining = $derived(items.filter((i: any) => !i.done).length);
</script>


<ul {...__rozieAttrs} class={["list", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-5e6c469d>
  
  {#each items as item (item.id)}<li data-rozie-s-5e6c469d>
    {#if item}{@render item({ item, remaining })}{:else}
      {rozieDisplay(item.label)}
    {/if}
  </li>{/each}
</ul>


<style>
:global {
  .list[data-rozie-s-5e6c469d] { list-style: none; padding: 0; }
}
</style>
