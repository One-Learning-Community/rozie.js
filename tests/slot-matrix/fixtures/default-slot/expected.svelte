<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  children?: Snippet;
  snippets?: Record<string, Snippet<[any]>>;
}

let { children: __childrenProp, snippets }: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
</script>


<div class="default-slot-fixture">
  {@render children?.()}
</div>

