<script lang="ts">
import Inner from './inner.svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: Snippet;
  children?: Snippet;
}

let { title, children }: Props = $props();
</script>


<Inner>{#snippet header()}
    {#if title}{@render title()}{:else}default title{/if}
  {/snippet}{#if children}{@render children()}{:else}default body{/if}</Inner>

