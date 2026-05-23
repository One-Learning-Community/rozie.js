<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  status?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  status: __statusProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const status = $derived(__statusProp ?? snippets?.status);
</script>


<div {...__rozieAttrs} class={["default-content-fallback-fixture", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>
  {#if status}{@render status()}{:else}
    <span class="fallback">No status provided.</span>
  {/if}
</div>

