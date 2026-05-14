<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  items?: unknown[];
  item?: Snippet<[any, any]>;
}

let { items = $bindable(() => []), item }: Props = $props();

const remaining = $derived(items.filter(i => !i.done).length);
</script>


<ul class="list">
  
  {#each items as item (item.id)}<li>
    {#if item}{@render item(item, remaining)}{:else}
      {item.label}
    {/if}
  </li>{/each}
</ul>


<style>
.list { list-style: none; padding: 0; }
</style>
