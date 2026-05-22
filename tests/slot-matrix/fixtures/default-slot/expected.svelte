<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
</script>


<div class="default-slot-fixture" {...__rozieAttrs}>
  {@render children?.()}
</div>

