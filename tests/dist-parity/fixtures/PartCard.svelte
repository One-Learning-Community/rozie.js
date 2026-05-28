<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  title = 'Card',
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
</script>


<div part="body" {...__rozieAttrs} class={["card-body", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-1462f7ea>
  <h3 class="card-title" data-rozie-s-1462f7ea>{title}</h3>
  {@render children?.()}
</div>


<style>
:global {
  .card-body[data-rozie-s-1462f7ea] {
    padding: 1rem;
    border-radius: 0.5rem;
    background: #f3f4f6;
  }
  .card-title[data-rozie-s-1462f7ea] {
    margin: 0 0 0.5rem;
    font: inherit;
    font-weight: 600;
  }
}
</style>
