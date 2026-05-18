<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  label?: string;
  item?: Snippet<[{ value: any }]>;
  snippets?: Record<string, any>;
}

let {
  label = 'item',
  item: __itemProp,
  snippets,
}: Props = $props();

const item = $derived(__itemProp ?? snippets?.item);
</script>


<div class="scoped-params-fixture">
  {@render item?.({ value: label })}
</div>

