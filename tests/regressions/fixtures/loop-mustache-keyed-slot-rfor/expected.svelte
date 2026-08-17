<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  rows?: any[];
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let __defaultRows = (() => [])();

let {
  rows = __defaultRows,
  snippets,
  ...__rozieAttrs
}: Props = $props();

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-10bfe9b6>{#each rows as row (row.id)}{@render (snippets?.[row])?.()}{/each}</div>
