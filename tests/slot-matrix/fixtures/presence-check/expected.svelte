<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  aside?: Snippet;
  snippets?: Record<string, any>;
}

let { aside: __asideProp, snippets }: Props = $props();

const aside = $derived(__asideProp ?? snippets?.aside);
</script>


<div class="presence-check-fixture">
  {#if aside}<aside>
    {#if aside}{@render aside()}{/if}
  </aside>{/if}</div>

