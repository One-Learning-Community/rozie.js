<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

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

<div data-theme-passthrough="" {...__rozieAttrs} class={["theme-passthrough", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-515c25a2>{@render children?.()}</div>

<style>
:global {
  .theme-passthrough[data-rozie-s-515c25a2] {
    display: block;
    padding: 0.5rem;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    border-radius: 6px;
  }
}
</style>
