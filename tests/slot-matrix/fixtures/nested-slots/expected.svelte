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


<div {...__rozieAttrs} class={["nested-slots-fixture", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>
  {#if wrapper}{@render wrapper()}{:else}
    <div class="wrapper-fallback">
      {@render inner?.()}
    </div>
  {/if}
</div>

