<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  items?: any[];
  children?: Snippet<[{ name: any }]>;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let __defaultItems = (() => [])();

let {
  items = __defaultItems,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-42e72e5a>{#each items as x}{@render children?.({ name: x })}{/each}</div>
