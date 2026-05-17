<script lang="ts">
import Modal from './Modal.svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  open?: boolean;
  brand?: Snippet;
  children?: Snippet;
  actions?: Snippet;
}

let {
  title = 'Wrapped',
  open = $bindable(false),
  brand,
  children,
  actions,
}: Props = $props();
</script>


<Modal bind:open={open} title={title}>{#snippet header()}
    {#if brand}{@render brand()}{:else}
      <h2>{title}</h2>
    {/if}
  {/snippet}{#snippet footer()}
    {@render actions?.()}
  {/snippet}{@render children?.()}</Modal>

