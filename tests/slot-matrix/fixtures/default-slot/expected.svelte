<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  children?: Snippet;
}

let { children }: Props = $props();
</script>


<div class="default-slot-fixture">
  {@render children?.()}
</div>

