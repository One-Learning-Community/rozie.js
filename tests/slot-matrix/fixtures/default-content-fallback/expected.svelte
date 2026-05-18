<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  status?: Snippet;
  snippets?: Record<string, any>;
}

let { status: __statusProp, snippets }: Props = $props();

const status = $derived(__statusProp ?? snippets?.status);
</script>


<div class="default-content-fallback-fixture">
  {#if status}{@render status()}{:else}
    <span class="fallback">No status provided.</span>
  {/if}
</div>

