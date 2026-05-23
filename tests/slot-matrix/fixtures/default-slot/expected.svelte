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


<div {...__rozieAttrs} class={["default-slot-fixture", (__rozieAttrs)?.class]}>
  {@render children?.()}
</div>

