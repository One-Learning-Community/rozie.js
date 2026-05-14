<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  label?: string;
  item?: Snippet<[any]>;
}

let { label = 'item', item }: Props = $props();
</script>


<div class="scoped-params-fixture">
  {@render item?.(label)}
</div>

