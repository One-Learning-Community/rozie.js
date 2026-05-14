<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  wrapper?: Snippet;
}

let { wrapper }: Props = $props();
</script>


<div class="nested-slots-fixture">
  {#if wrapper}{@render wrapper()}{:else}
    <div class="wrapper-fallback">
      {@render inner?.()}
    </div>
  {/if}
</div>

