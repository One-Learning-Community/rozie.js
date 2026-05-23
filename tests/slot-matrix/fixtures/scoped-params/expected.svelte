<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  label?: string;
  item?: Snippet<[{ value: any }]>;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  label = 'item',
  item: __itemProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const item = $derived(__itemProp ?? snippets?.item);
</script>


<div {...__rozieAttrs} class={["scoped-params-fixture", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>
  {@render item?.({ value: label })}
</div>

