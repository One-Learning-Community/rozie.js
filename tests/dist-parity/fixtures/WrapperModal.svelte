<script lang="ts">
import Modal from './Modal.svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  open?: boolean;
  brand?: Snippet;
  children?: Snippet;
  actions?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  title = 'Wrapped',
  open = $bindable(false),
  brand: __brandProp,
  children: __childrenProp,
  actions: __actionsProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const brand = $derived(__brandProp ?? snippets?.brand);
const children = $derived(__childrenProp ?? snippets?.children);
const actions = $derived(__actionsProp ?? snippets?.actions);
</script>


<Modal bind:open={open} title={title}>{#snippet header()}
    {#if brand}{@render brand()}{:else}
      <h2>{title}</h2>
    {/if}
  {/snippet}{#snippet footer()}
    {@render actions?.()}
  {/snippet}{@render children?.()}</Modal>

