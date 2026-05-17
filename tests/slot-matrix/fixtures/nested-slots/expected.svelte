<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  wrapper?: Snippet;
  inner?: Snippet;
  snippets?: Record<string, Snippet<[any]>>;
}

let {
  wrapper: __wrapperProp,
  inner: __innerProp,
  snippets,
}: Props = $props();

const wrapper = $derived(__wrapperProp ?? snippets?.wrapper);
const inner = $derived(__innerProp ?? snippets?.inner);
</script>


<div class="nested-slots-fixture">
  {#if wrapper}{@render wrapper()}{:else}
    <div class="wrapper-fallback">
      {@render inner?.()}
    </div>
  {/if}
</div>

