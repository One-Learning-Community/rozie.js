<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  wrapper?: Snippet;
  inner?: Snippet;
}

let { wrapper, inner }: Props = $props();
</script>


<div class="outer">
  
  {#if wrapper}{@render wrapper()}{:else}
    <div class="wrapper-fallback">
      {@render inner?.()}
    </div>
  {/if}
</div>


<style>
.outer { display: block; }
</style>
