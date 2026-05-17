<script lang="ts">
import CardHeader from './CardHeader.svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  onClose?: (...args: any[]) => any;
  children?: Snippet;
  snippets?: Record<string, Snippet<[any]>>;
}

let {
  title = '',
  onClose = null,
  children: __childrenProp,
  snippets,
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
</script>


<article class="card">
  <CardHeader title={title} on-close={onClose}></CardHeader>
  <div class="card__body">
    {@render children?.()}
  </div>
</article>


<style>
.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body { padding: 1rem; }
</style>
