<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  header?: Snippet;
  children?: Snippet;
}

let {
  title = '',
  header,
  children,
}: Props = $props();
</script>


<section class="panel">
  {#if header || title}<header>
    
    {#if header}{@render header()}{:else}{title}{/if}
  </header>{/if}<div class="body">
    {@render children?.()}
  </div>
</section>


<style>
.panel { border: 1px solid rgba(0, 0, 0, 0.1); }
</style>
