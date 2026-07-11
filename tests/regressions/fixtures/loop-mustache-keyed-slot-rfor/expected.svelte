<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  rows?: any[];
  children?: Snippet<[{ name: any }]>;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let __defaultRows = (() => [])();

let {
  rows = __defaultRows,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-10bfe9b6>{#each rows as row (row.id)}{@render children?.({ name: row })}{/each}</div>
