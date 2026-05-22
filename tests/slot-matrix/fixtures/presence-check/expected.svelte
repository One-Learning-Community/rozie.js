<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  aside?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  aside: __asideProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const aside = $derived(__asideProp ?? snippets?.aside);
</script>


<div class="presence-check-fixture" {...__rozieAttrs}>
  {#if aside}<aside>
    {#if aside}{@render aside()}{/if}
  </aside>{/if}</div>

