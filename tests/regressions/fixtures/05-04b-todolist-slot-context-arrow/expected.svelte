<script lang="ts">
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


<ul {...__rozieAttrs} class={["list", (__rozieAttrs)?.class]}>
  
  {#each items as item (item.id)}<li>
    {#if item}{@render item({ item, remaining })}{:else}
      {item.label}
    {/if}
  </li>{/each}
</ul>


<style>
.list { list-style: none; padding: 0; }
</style>
