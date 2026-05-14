<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  status?: Snippet;
}

let { status }: Props = $props();
</script>


<div class="default-content-fallback-fixture">
  {#if status}{@render status()}{:else}
    <span class="fallback">No status provided.</span>
  {/if}
</div>

