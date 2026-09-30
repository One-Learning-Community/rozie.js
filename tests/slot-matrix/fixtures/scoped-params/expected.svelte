<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'label' | 'item' | 'snippets' | 'children'> {
  label?: string;
  item?: Snippet<[{ value: any }]>;
  snippets?: Record<string, any>;
}

let {
  label = 'item',
  item: __itemProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const item = $derived(__itemProp ?? snippets?.item);
</script>

<div {...__rozieAttrs} class={["scoped-params-fixture", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-94f3adc8>{@render item?.({ value: label })}</div>
