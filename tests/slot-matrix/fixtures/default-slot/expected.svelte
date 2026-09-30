<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'children' | 'snippets'> {
  children?: Snippet;
  snippets?: Record<string, any>;
}

let {
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);
</script>

<div {...__rozieAttrs} class={["default-slot-fixture", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-61728cb8>{@render children?.()}</div>
