<script lang="ts">
import CardHeader from './CardHeader.svelte';
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  onClose?: ((...args: any[]) => any) | null;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  title = '',
  onClose = null,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
</script>


<article {...__rozieAttrs} class={["card", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>
  <CardHeader title={title} onClose={onClose}></CardHeader>
  <div class="card__body">
    {@render children?.()}
  </div>
</article>


<style>
.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body { padding: 1rem; }
</style>
