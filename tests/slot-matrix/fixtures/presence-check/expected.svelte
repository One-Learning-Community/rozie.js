<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  aside?: Snippet;
}

let { aside }: Props = $props();
</script>


<div class="presence-check-fixture">
  {#if aside}<aside>
    {#if aside}{@render aside()}{/if}
  </aside>{/if}</div>

