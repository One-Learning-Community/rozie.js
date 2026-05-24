<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  wrapper?: Snippet;
  inner?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  wrapper: __wrapperProp,
  inner: __innerProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const wrapper = $derived(__wrapperProp ?? snippets?.wrapper);
const inner = $derived(__innerProp ?? snippets?.inner);
</script>


<div {...__rozieAttrs} class={["outer", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-3bc5be6c>
  
  {#if wrapper}{@render wrapper()}{:else}
    <div class="wrapper-fallback" data-rozie-s-3bc5be6c>
      {@render inner?.()}
    </div>
  {/if}
</div>


<style>
:global {
  .outer[data-rozie-s-3bc5be6c] { display: block; }
}
</style>
